import { sendJson, readJsonBody, createServiceClient, type VercelReq, type VercelRes } from '../_lib/vercelAuth';
import {
  isValidEmail,
  isValidOtpToken,
  sanitizePublicSignupRole,
  getPasswordPolicyError,
  findProfileByEmail,
} from '../_lib/authHelpers';
import { verifyOtpDb, takePendingSignupDb } from '../_lib/otpDb';

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
    const { email, token, password } = body || {};
    if (!isValidEmail(email) || !isValidOtpToken(token)) {
      return sendJson(res, 400, {
        success: false,
        error: 'A valid email and 6-digit OTP code are required',
      });
    }

    const client = createServiceClient();
    if (!client) {
      return sendJson(res, 503, { success: false, error: 'Supabase is not configured' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await findProfileByEmail(cleanEmail);
    if (existing?.is_banned) {
      return sendJson(res, 403, {
        success: false,
        isBanned: true,
        error: existing.ban_reason || 'This account is suspended.',
      });
    }

    const verifyResult = await verifyOtpDb(client, cleanEmail, token.trim());
    if (!verifyResult.success) {
      return sendJson(res, 400, {
        success: false,
        error: verifyResult.error || 'Invalid or expired OTP code',
      });
    }

    const pending = await takePendingSignupDb(client, cleanEmail);
    const hasPassword = typeof password === 'string' && password.length > 0;

    if (hasPassword && pending) {
      const policyError = getPasswordPolicyError(password);
      if (policyError) {
        return sendJson(res, 400, { success: false, error: policyError });
      }
      const { error: createErr } = await client.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
        user_metadata: {
          name: pending.name || verifyResult.metadata?.name,
          role: sanitizePublicSignupRole(pending.role || verifyResult.metadata?.role),
        },
      });
      // Ignore "already registered" — client may have signed up already
      if (createErr && !/already/i.test(createErr.message)) {
        const { data: list } = await client.auth.admin.listUsers({ perPage: 1000 });
        const matched = list?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);
        if (matched) {
          await client.auth.admin.updateUserById(matched.id, {
            password,
            email_confirm: true,
          });
        } else {
          return sendJson(res, 500, {
            success: false,
            error: createErr.message || 'Account activation failed',
          });
        }
      }
    } else {
      const { data: list } = await client.auth.admin.listUsers({ perPage: 1000 });
      const matched = list?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);
      if (matched) {
        await client.auth.admin.updateUserById(matched.id, { email_confirm: true });
      }
    }

    return sendJson(res, 200, {
      success: true,
      message: 'OTP Code verified successfully',
      emailConfirmed: true,
      metadata: {
        ...(verifyResult.metadata || {}),
        name: verifyResult.metadata?.name || pending?.name,
        role: sanitizePublicSignupRole(verifyResult.metadata?.role || pending?.role),
      },
    });
  } catch (err: any) {
    console.error('[api/auth/verify-otp]', err);
    return sendJson(res, 500, { success: false, error: err?.message || 'Verification failed' });
  }
}
