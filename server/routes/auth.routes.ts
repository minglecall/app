import { Router } from 'express';
import type { ServerRuntime } from '../runtimeTypes';
import {
  generateSixDigitOtp,
  sendOtpEmail,
  verifyStoredOtp,
  getSmtpConfig,
  getShowOtpInForm,
} from '../emailService';
import {
  updateUserPasswordAdmin,
  authenticateUserWithPasswordAdmin,
  isProfileBanned,
  hashPassword,
  isSupabaseAdminConfigured,
} from '../supabaseAdmin';
import { requireAuth, requireAdmin, sanitizePublicSignupRole } from '../middleware/auth';
import { getPasswordPolicyError } from '../../shared/passwordPolicy';

/** Pending signup secrets keyed by email — never create orphan profiles with random UUIDs. */
const pendingSignupByEmail = new Map<
  string,
  { passwordHash: string; name?: string; role?: string; updatedAt: number }
>();

export function consumePendingSignup(email: string) {
  const key = email.trim().toLowerCase();
  const pending = pendingSignupByEmail.get(key);
  if (pending) pendingSignupByEmail.delete(key);
  return pending || null;
}

export function createAuthRouter(ctx: ServerRuntime): Router {
  const router = Router();
  const { serverUsers, normalizeUserProfile } = ctx;

  // POST Dispatch 6-digit OTP code & confirmation link via email
  router.post('/send-otp', async (req, res) => {
    try {
      const { email, name, role, confirmationUrl, password } = req.body;
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'A valid email address is required' });
      }

      const cleanEmail = email.toLowerCase().trim();
      const existing = Array.from(serverUsers.values()).find(
        (u) => u.email?.toLowerCase().trim() === cleanEmail
      );

      // Check if user is suspended/banned before sending OTP
      if (existing) {
        const banCheck = isProfileBanned(existing);
        if (banCheck.isBanned) {
          return res.status(403).json({ success: false, isBanned: true, error: banCheck.message });
        }
      }

      const otpCode = generateSixDigitOtp();
      const showOtpInForm = process.env.OTP_DEBUG === 'true' && getShowOtpInForm();
      const sendResult = await sendOtpEmail({
        to: email,
        name: name || 'User',
        otpCode,
        confirmationUrl,
      });

      // Signup only: store pending hash for NEW emails. Never apply password to existing
      // accounts here — that would allow unauthenticated resets. Use /reset-password after OTP.
      if (password) {
        const policyError = getPasswordPolicyError(password);
        if (policyError) {
          return res.status(400).json({ success: false, error: policyError });
        }
        if (!existing) {
          const hashedPassword = await hashPassword(password);
          pendingSignupByEmail.set(cleanEmail, {
            passwordHash: hashedPassword,
            name: name || undefined,
            role: sanitizePublicSignupRole(role),
            updatedAt: Date.now(),
          });
          // Password is applied to Auth/profile after verify + real auth user id exists.
        }
      }

      return res.json({
        success: true,
        delivered: sendResult.delivered,
        message: sendResult.message,
        showOtpInForm: showOtpInForm || !sendResult.delivered,
        otpCode: (showOtpInForm || !sendResult.delivered) ? otpCode : undefined,
      });
    } catch (err: any) {
      console.error('Error in /api/auth/send-otp:', err);
      return res.status(500).json({ error: err.message || 'Failed to dispatch verification email' });
    }
  });

  // POST Verify 6-digit OTP Code
  router.post('/verify-otp', (req, res) => {
    try {
      const { email, token } = req.body;
      if (!email || !token) {
        return res.status(400).json({ error: 'Email and 6-digit OTP code are required' });
      }

      const cleanEmail = email.toLowerCase().trim();
      const existing = Array.from(serverUsers.values()).find(
        (u) => u.email?.toLowerCase().trim() === cleanEmail
      );
      if (existing) {
        const banCheck = isProfileBanned(existing);
        if (banCheck.isBanned) {
          return res.status(403).json({ success: false, isBanned: true, error: banCheck.message });
        }
      }

      const verifyResult = verifyStoredOtp(email, token);
      if (!verifyResult.success) {
        return res.status(400).json({
          success: false,
          error: verifyResult.error || 'Invalid or expired OTP code',
        });
      }

      return res.json({
        success: true,
        message: 'OTP Code verified successfully',
        metadata: verifyResult.metadata,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Verification processing failed' });
    }
  });

  // POST Login with Password — Supabase Auth only (no in-memory / hash fallback)
  router.post('/login-password', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required' });
      }
      if (password.trim().length === 0) {
        return res.status(401).json({ success: false, error: 'Invalid email or password. Please check your credentials.' });
      }
      const cleanEmail = String(email).trim().toLowerCase();

      if (!isSupabaseAdminConfigured()) {
        return res.status(503).json({ success: false, error: 'Authentication service is not configured.' });
      }

      const authRes = await authenticateUserWithPasswordAdmin(cleanEmail, password);
      if (authRes.success && authRes.user) {
        const normalized = normalizeUserProfile(authRes.user);
        serverUsers.set(normalized.id, normalized);
        return res.json({
          success: true,
          user: normalized,
          session: authRes.session,
        });
      }
      if (authRes.error && (authRes.error.includes('suspended') || authRes.error.includes('banned'))) {
        return res.status(403).json({ success: false, isBanned: true, error: authRes.error });
      }

      return res.status(401).json({ success: false, error: 'Invalid email or password. Please check your credentials.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || 'Authentication error' });
    }
  });

  // POST Update User Password (authenticated — bcrypt hash & Supabase sync)
  router.post('/update-password', requireAuth, async (req, res) => {
    try {
      const { newPassword } = req.body;
      const userId = String((req as any).profileId || (req as any).user?.id || '');
      const email = (req as any).user?.email || (req as any).profile?.email;
      const policyError = getPasswordPolicyError(newPassword);
      if (policyError) {
        return res.status(400).json({ success: false, error: policyError });
      }

      const passwordHash = await hashPassword(newPassword);

      // Update in server memory (store only hash, never plain text!)
      if (userId && serverUsers.has(userId)) {
        const u = serverUsers.get(userId)!;
        (u as any).password_hash = passwordHash;
        delete (u as any).password;
        u.hasPasswordSet = true;
        serverUsers.set(userId, u);
      }

      // Also search by email in server memory
      if (email) {
        const cleanEmail = String(email).toLowerCase().trim();
        for (const [id, u] of serverUsers.entries()) {
          if (u.email?.toLowerCase().trim() === cleanEmail) {
            (u as any).password_hash = passwordHash;
            delete (u as any).password;
            u.hasPasswordSet = true;
            serverUsers.set(id, u);
          }
        }
      }

      // Update in Supabase Auth via Admin
      if (isSupabaseAdminConfigured()) {
        await updateUserPasswordAdmin(userId, newPassword, email);
      }

      return res.json({ success: true, message: 'Password successfully updated and securely hashed.' });
    } catch (err: any) {
      console.error('Error in /api/auth/update-password:', err);
      return res.status(500).json({ success: false, error: err.message || 'Failed to update password' });
    }
  });

  // POST Password reset via email OTP (unauthenticated; OTP required)
  router.post('/reset-password', async (req, res) => {
    try {
      const { email, token, newPassword } = req.body;
      if (typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ success: false, error: 'A valid email address is required.' });
      }
      if (typeof token !== 'string' || !token.trim()) {
        return res.status(400).json({ success: false, error: 'Verification code is required.' });
      }
      const policyError = getPasswordPolicyError(newPassword);
      if (policyError) {
        return res.status(400).json({ success: false, error: policyError });
      }

      const cleanEmail = email.trim().toLowerCase();
      const verifyResult = verifyStoredOtp(cleanEmail, token.trim());
      if (!verifyResult.success) {
        return res.status(400).json({
          success: false,
          error: verifyResult.error || 'Invalid or expired OTP code',
        });
      }

      const existing = Array.from(serverUsers.values()).find(
        (u) => u.email?.toLowerCase().trim() === cleanEmail
      );
      if (existing) {
        const banCheck = isProfileBanned(existing);
        if (banCheck.isBanned) {
          return res.status(403).json({ success: false, isBanned: true, error: banCheck.message });
        }
      }

      const passwordHash = await hashPassword(newPassword);
      const userId = existing?.id || '';

      if (existing) {
        (existing as any).password_hash = passwordHash;
        delete (existing as any).password;
        existing.hasPasswordSet = true;
        serverUsers.set(existing.id, existing);
      }

      if (isSupabaseAdminConfigured()) {
        const adminRes = await updateUserPasswordAdmin(userId, newPassword, cleanEmail);
        if (!adminRes.success && !existing) {
          return res.status(404).json({
            success: false,
            error: adminRes.error || 'No account found for this email. Please register instead.',
          });
        }
      } else if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'No account found for this email. Please register instead.',
        });
      }

      return res.json({
        success: true,
        message: 'Password reset successfully. You can now sign in with your new password.',
      });
    } catch (err: any) {
      console.error('Error in /api/auth/reset-password:', err);
      return res.status(500).json({ success: false, error: err.message || 'Failed to reset password' });
    }
  });

  // GET Email & SMTP Configuration Status
  router.get('/email-config', requireAdmin, (req, res) => {
    const smtpInfo = getSmtpConfig();
    res.json({
      success: true,
      smtpConfigured: smtpInfo.configured,
      resendConfigured: Boolean(process.env.RESEND_API_KEY),
      senderEmail: smtpInfo.from || process.env.SMTP_FROM || 'LiveCall <noreply@livecall-app.com>',
      host: smtpInfo.host || process.env.SMTP_HOST || 'Not configured',
      port: smtpInfo.port || 587,
      user: smtpInfo.user || '',
      showOtpInForm: smtpInfo.showOtpInForm,
    });
  });

  // POST Test Email Dispatch
  router.post('/test-email', requireAdmin, async (req, res) => {
    try {
      const { email, name } = req.body;
      if (!email) return res.status(400).json({ error: 'Destination email is required' });

      const testCode = generateSixDigitOtp();
      const sendResult = await sendOtpEmail({
        to: email,
        name: name || 'Admin Tester',
        otpCode: testCode,
      });

      return res.json({
        success: true,
        delivered: sendResult.delivered,
        message: sendResult.message,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
