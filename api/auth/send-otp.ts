import {
  sendJson,
  readJsonBody,
  createServiceClient,
  type VercelReq,
  type VercelRes,
} from '../_lib/vercelAuth';
import { isValidEmail, sanitizePublicSignupRole, getPasswordPolicyError } from '../_lib/authHelpers';
import { generateSixDigitOtp, sendOtpEmailVercel, isSmtpConfigured } from '../_lib/mail';
import { saveOtpDb, savePendingSignupDb } from '../_lib/otpDb';
import { createHash } from 'crypto';

function hashPasswordSync(password: string): string {
  // Prefer bcrypt when available; fallback sha256 marker for pending only (Auth create uses plaintext path)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bcrypt = require('bcryptjs');
    return bcrypt.hashSync(password, 10);
  } catch {
    return `sha256:${createHash('sha256').update(password).digest('hex')}`;
  }
}

export default async function handler(req: VercelReq, res: VercelRes) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Method not allowed' });
  }

  try {
    const body = await readJsonBody(req);
    const { email, name, role, confirmationUrl, password } = body || {};
    if (!isValidEmail(email)) {
      return sendJson(res, 400, { success: false, error: 'A valid email address is required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const client = createServiceClient();
    if (!client) {
      return sendJson(res, 503, { success: false, error: 'Supabase is not configured on this deployment.' });
    }

    const { data: existing } = await client
      .from('profiles')
      .select('id, is_banned, banned_until, ban_reason')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (existing?.is_banned) {
      const until = existing.banned_until ? new Date(existing.banned_until).getTime() : 0;
      if (!until || until > Date.now()) {
        return sendJson(res, 403, {
          success: false,
          isBanned: true,
          error: existing.ban_reason || 'This account is suspended.',
        });
      }
    }

    if (password !== undefined && password !== null && password !== '') {
      const policyError = getPasswordPolicyError(password);
      if (policyError) {
        return sendJson(res, 400, { success: false, error: policyError });
      }
    }

    const otpCode = generateSixDigitOtp();
    await saveOtpDb(client, cleanEmail, otpCode, {
      name: name || undefined,
      role: sanitizePublicSignupRole(role),
    });

    if (password && !existing) {
      await savePendingSignupDb(client, cleanEmail, hashPasswordSync(password), {
        name: name || undefined,
        role: sanitizePublicSignupRole(role),
      });
    }

    const sendResult = await sendOtpEmailVercel({
      to: cleanEmail,
      name: name || 'User',
      otpCode,
    });

    const showOtpInForm = process.env.OTP_DEBUG === 'true' || !sendResult.delivered;
    return sendJson(res, 200, {
      success: true,
      delivered: sendResult.delivered,
      message: sendResult.message,
      showOtpInForm,
      otpCode: showOtpInForm ? otpCode : undefined,
      smtpConfigured: isSmtpConfigured(),
      confirmationUrl: confirmationUrl || undefined,
    });
  } catch (err: any) {
    console.error('[api/auth/send-otp]', err);
    return sendJson(res, 500, { success: false, error: err?.message || 'Failed to dispatch verification email' });
  }
}
