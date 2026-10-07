import { sendJson, readJsonBody, createServiceClient, type VercelReq, type VercelRes } from '../../vercelAuth';
import {
  isValidEmail,
  isValidOtpToken,
  sanitizePublicSignupRole,
  getPasswordPolicyError,
  findProfileByEmail,
  findAuthUserByEmail,
} from '../../authHelpers';
import { verifyOtpDb, takePendingSignupDb } from '../../otpDb';

async function resolveAuthUserId(
  client: NonNullable<ReturnType<typeof createServiceClient>>,
  cleanEmail: string
): Promise<string | null> {
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.warn('[api/auth/verify-otp] listUsers notice:', error.message);
      return null;
    }
    const matched = findAuthUserByEmail(data?.users as any, cleanEmail);
    if (matched?.id) return matched.id;
    if (!data?.users?.length || data.users.length < perPage) return null;
    page += 1;
    if (page > 50) return null;
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
    let resolvedAuthId: string | null =
      (typeof existing?.auth_id === 'string' && existing.auth_id) ||
      (typeof existing?.id === 'string' && existing.id) ||
      null;

    if (hasPassword && pending) {
      const policyError = getPasswordPolicyError(password);
      if (policyError) {
        return sendJson(res, 400, { success: false, error: policyError });
      }
      const { data: created, error: createErr } = await client.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
        user_metadata: {
          name: pending.name || verifyResult.metadata?.name,
          role: sanitizePublicSignupRole(pending.role || verifyResult.metadata?.role),
        },
      });
      if (!createErr && created?.user?.id) {
        resolvedAuthId = created.user.id;
      } else if (createErr && /already/i.test(createErr.message)) {
        const matchedId = await resolveAuthUserId(client, cleanEmail);
        if (matchedId) {
          resolvedAuthId = matchedId;
          await client.auth.admin.updateUserById(matchedId, {
            password,
            email_confirm: true,
          });
        }
      } else if (createErr) {
        const matchedId = await resolveAuthUserId(client, cleanEmail);
        if (matchedId) {
          resolvedAuthId = matchedId;
          await client.auth.admin.updateUserById(matchedId, {
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
      const matchedId = await resolveAuthUserId(client, cleanEmail);
      if (matchedId) {
        resolvedAuthId = matchedId;
        await client.auth.admin.updateUserById(matchedId, { email_confirm: true });
      }
    }

    if (!resolvedAuthId) {
      resolvedAuthId = await resolveAuthUserId(client, cleanEmail);
    }

    return sendJson(res, 200, {
      success: true,
      message: 'OTP Code verified successfully',
      emailConfirmed: true,
      authId: resolvedAuthId,
      userId: resolvedAuthId,
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
