import { sendJson, readJsonBody, createServiceClient, type VercelReq, type VercelRes } from '../_lib/vercelAuth';
import { isValidEmail, sanitizePublicSignupRole, getPasswordPolicyError } from '../_lib/authHelpers';

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
    const email = String(body?.email || '').trim().toLowerCase();
    const password = body?.password;
    const name = String(body?.name || '').trim();
    const role = sanitizePublicSignupRole(body?.role);

    if (!isValidEmail(email)) {
      return sendJson(res, 400, { success: false, error: 'Valid email required' });
    }
    const pwError = getPasswordPolicyError(password);
    if (pwError) {
      return sendJson(res, 400, { success: false, error: pwError });
    }

    const client = createServiceClient();
    if (!client) {
      return sendJson(res, 503, { success: false, error: 'Supabase not configured' });
    }

    const gender =
      role === 'female_user' || role === 'female_creator' || role === 'female_host'
        ? 'female'
        : role === 'other_user'
          ? 'other'
          : 'male';

    const { data: created, error } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { name, role, gender },
    });

    if (error && !/already/i.test(error.message)) {
      return sendJson(res, 400, { success: false, error: error.message });
    }

    const authId = created?.user?.id;
    return sendJson(res, 200, {
      success: true,
      authId: authId || null,
      email,
      role,
      gender,
      message: 'Auth account ready for OTP verification.',
    });
  } catch (err: any) {
    console.error('[api/auth/register-bootstrap]', err);
    return sendJson(res, 500, { success: false, error: err?.message || 'Registration bootstrap failed' });
  }
}
