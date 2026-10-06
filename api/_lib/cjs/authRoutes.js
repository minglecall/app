/**
 * /api/auth/* handlers — CommonJS for Vercel Hobby router.
 */
const {
  send,
  readJsonBody,
  createServiceClient,
  getSupabaseEnv,
  createClient,
  isValidEmail,
  isValidOtpToken,
  sanitizePublicSignupRole,
  getPasswordPolicyError,
  mapProfileRow,
  findAuthUserByEmail,
  requireAuth,
  saveOtpDb,
  verifyOtpDb,
  savePendingSignupDb,
  takePendingSignupDb,
  generateSixDigitOtp,
  isSmtpConfigured,
  sendOtpEmailVercel,
  hashPasswordSync,
} = require('./helpers');

async function sendOtp(req, res) {
  if (req.method !== 'POST') return send(res, 405, { success: false, error: 'Method not allowed' });
  try {
    const body = await readJsonBody(req);
    const { email, name, role, confirmationUrl, password } = body || {};
    if (!isValidEmail(email)) {
      return send(res, 400, { success: false, error: 'A valid email address is required' });
    }
    const cleanEmail = email.toLowerCase().trim();
    const client = createServiceClient();
    if (!client) {
      return send(res, 503, {
        success: false,
        error: 'Supabase is not configured on this deployment.',
      });
    }

    const { data: existing } = await client
      .from('profiles')
      .select('id, is_banned, banned_until, ban_reason')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (existing && existing.is_banned) {
      const until = existing.banned_until ? new Date(existing.banned_until).getTime() : 0;
      if (!until || until > Date.now()) {
        return send(res, 403, {
          success: false,
          isBanned: true,
          error: existing.ban_reason || 'This account is suspended.',
        });
      }
    }

    if (password !== undefined && password !== null && password !== '') {
      const policyError = getPasswordPolicyError(password);
      if (policyError) return send(res, 400, { success: false, error: policyError });
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
    return send(res, 200, {
      success: true,
      delivered: sendResult.delivered,
      message: sendResult.message,
      showOtpInForm,
      otpCode: showOtpInForm ? otpCode : undefined,
      smtpConfigured: isSmtpConfigured(),
      confirmationUrl: confirmationUrl || undefined,
    });
  } catch (err) {
    console.error('[api/auth/send-otp]', err);
    return send(res, 500, {
      success: false,
      error: (err && err.message) || 'Failed to dispatch verification email',
    });
  }
}

async function verifyOtp(req, res) {
  if (req.method !== 'POST') return send(res, 405, { success: false, error: 'Method not allowed' });
  try {
    const body = await readJsonBody(req);
    const { email, token, password } = body || {};
    if (!isValidEmail(email) || !isValidOtpToken(token)) {
      return send(res, 400, {
        success: false,
        error: 'A valid email and 6-digit OTP code are required',
      });
    }
    const client = createServiceClient();
    if (!client) return send(res, 503, { success: false, error: 'Supabase is not configured' });

    const cleanEmail = email.toLowerCase().trim();
    const { data: existing } = await client
      .from('profiles')
      .select('*')
      .ilike('email', cleanEmail)
      .maybeSingle();
    if (existing && existing.is_banned) {
      return send(res, 403, {
        success: false,
        isBanned: true,
        error: existing.ban_reason || 'This account is suspended.',
      });
    }

    const verifyResult = await verifyOtpDb(client, cleanEmail, token.trim());
    if (!verifyResult.success) {
      return send(res, 400, {
        success: false,
        error: verifyResult.error || 'Invalid or expired OTP code',
      });
    }

    const pending = await takePendingSignupDb(client, cleanEmail);
    const hasPassword = typeof password === 'string' && password.length > 0;

    if (hasPassword && pending) {
      const policyError = getPasswordPolicyError(password);
      if (policyError) return send(res, 400, { success: false, error: policyError });
      const { error: createErr } = await client.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
        user_metadata: {
          name: pending.name || (verifyResult.metadata && verifyResult.metadata.name),
          role: sanitizePublicSignupRole(
            pending.role || (verifyResult.metadata && verifyResult.metadata.role)
          ),
        },
      });
      if (createErr && !/already/i.test(createErr.message)) {
        const { data: list } = await client.auth.admin.listUsers({ perPage: 1000 });
        const matched = findAuthUserByEmail(list && list.users, cleanEmail);
        if (matched) {
          await client.auth.admin.updateUserById(matched.id, {
            password,
            email_confirm: true,
          });
        } else {
          return send(res, 500, {
            success: false,
            error: createErr.message || 'Account activation failed',
          });
        }
      }
    } else {
      const { data: list } = await client.auth.admin.listUsers({ perPage: 1000 });
      const matched = findAuthUserByEmail(list && list.users, cleanEmail);
      if (matched) {
        await client.auth.admin.updateUserById(matched.id, { email_confirm: true });
      }
    }

    return send(res, 200, {
      success: true,
      message: 'OTP Code verified successfully',
      emailConfirmed: true,
      metadata: {
        ...(verifyResult.metadata || {}),
        name: (verifyResult.metadata && verifyResult.metadata.name) || (pending && pending.name),
        role: sanitizePublicSignupRole(
          (verifyResult.metadata && verifyResult.metadata.role) || (pending && pending.role)
        ),
      },
    });
  } catch (err) {
    console.error('[api/auth/verify-otp]', err);
    return send(res, 500, {
      success: false,
      error: (err && err.message) || 'Verification failed',
    });
  }
}

async function registerBootstrap(req, res) {
  if (req.method !== 'POST') return send(res, 405, { success: false, error: 'Method not allowed' });
  try {
    const body = await readJsonBody(req);
    const email = String((body && body.email) || '')
      .trim()
      .toLowerCase();
    const password = body && body.password;
    const name = String((body && body.name) || '').trim();
    const role = sanitizePublicSignupRole(body && body.role);
    if (!isValidEmail(email)) {
      return send(res, 400, { success: false, error: 'Valid email required' });
    }
    const pwError = getPasswordPolicyError(password);
    if (pwError) return send(res, 400, { success: false, error: pwError });

    const client = createServiceClient();
    if (!client) return send(res, 503, { success: false, error: 'Supabase not configured' });

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
      return send(res, 400, { success: false, error: error.message });
    }
    return send(res, 200, {
      success: true,
      authId: (created && created.user && created.user.id) || null,
      email,
      role,
      gender,
      message: 'Auth account ready for OTP verification.',
    });
  } catch (err) {
    console.error('[api/auth/register-bootstrap]', err);
    return send(res, 500, {
      success: false,
      error: (err && err.message) || 'Registration bootstrap failed',
    });
  }
}

async function loginPassword(req, res) {
  if (req.method !== 'POST') return send(res, 405, { success: false, error: 'Method not allowed' });
  try {
    const body = await readJsonBody(req);
    const { email, password } = body || {};
    if (!isValidEmail(email) || typeof password !== 'string' || !password) {
      return send(res, 400, { success: false, error: 'Email and password are required' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const client = createServiceClient();
    if (!client) return send(res, 503, { success: false, error: 'Supabase not configured' });

    const { data: profile } = await client
      .from('profiles')
      .select('*')
      .ilike('email', cleanEmail)
      .maybeSingle();
    if (profile && profile.is_banned) {
      const until = profile.banned_until ? new Date(profile.banned_until).getTime() : 0;
      if (!until || until > Date.now()) {
        return send(res, 403, {
          success: false,
          isBanned: true,
          error: profile.ban_reason || 'This account is suspended.',
        });
      }
    }

    const { url, anonKey } = getSupabaseEnv();
    if (!url || !anonKey) {
      return send(res, 503, { success: false, error: 'Supabase anon key not configured' });
    }
    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    if (error || !data || !data.user) {
      return send(res, 401, {
        success: false,
        error: (error && error.message) || 'Invalid email or password. Please check your credentials.',
      });
    }

    let row = profile;
    const { data: byAuth } = await client
      .from('profiles')
      .select('*')
      .or(`auth_id.eq.${data.user.id},id.eq.${data.user.id}`)
      .maybeSingle();
    if (byAuth) row = byAuth;
    if (!row) {
      return send(res, 401, {
        success: false,
        error: 'Account not found or was deleted. Please register again.',
      });
    }
    return send(res, 200, {
      success: true,
      user: mapProfileRow(row),
      session: data.session,
    });
  } catch (err) {
    console.error('[api/auth/login-password]', err);
    return send(res, 500, {
      success: false,
      error: (err && err.message) || 'Authentication error',
    });
  }
}

async function resetPassword(req, res) {
  if (req.method !== 'POST') return send(res, 405, { success: false, error: 'Method not allowed' });
  try {
    const body = await readJsonBody(req);
    const email = String((body && body.email) || '')
      .trim()
      .toLowerCase();
    const token = body && body.token;
    const newPassword = (body && (body.newPassword || body.password)) || '';
    if (!isValidEmail(email) || !isValidOtpToken(token)) {
      return send(res, 400, { success: false, error: 'Email and 6-digit OTP required' });
    }
    const pwError = getPasswordPolicyError(newPassword);
    if (pwError) return send(res, 400, { success: false, error: pwError });
    const client = createServiceClient();
    if (!client) return send(res, 503, { success: false, error: 'Supabase not configured' });
    const verify = await verifyOtpDb(client, email, String(token).trim());
    if (!verify.success) return send(res, 400, { success: false, error: verify.error });
    const { data: list } = await client.auth.admin.listUsers({ perPage: 1000 });
    const matched = findAuthUserByEmail(list && list.users, email);
    if (!matched) {
      return send(res, 404, { success: false, error: 'No auth user found for this email' });
    }
    const { error } = await client.auth.admin.updateUserById(matched.id, {
      password: newPassword,
      email_confirm: true,
    });
    if (error) return send(res, 500, { success: false, error: error.message });
    await client
      .from('profiles')
      .update({ has_password_set: true, updated_at: new Date().toISOString() })
      .ilike('email', email);
    return send(res, 200, { success: true, message: 'Password reset successfully.' });
  } catch (err) {
    console.error('[api/auth/reset-password]', err);
    return send(res, 500, { success: false, error: (err && err.message) || 'Reset failed' });
  }
}

async function updatePassword(req, res) {
  if (req.method !== 'POST') return send(res, 405, { success: false, error: 'Method not allowed' });
  const auth = await requireAuth(req);
  if (auth.ok === false) {
    return send(res, auth.status, {
      success: false,
      error: (auth.error && auth.error.message) || 'Unauthorized',
    });
  }
  try {
    const body = await readJsonBody(req);
    const newPassword = (body && (body.newPassword || body.password)) || '';
    const pwError = getPasswordPolicyError(newPassword);
    if (pwError) return send(res, 400, { success: false, error: pwError });
    const { error } = await auth.client.auth.admin.updateUserById(auth.userId, {
      password: newPassword,
    });
    if (error) return send(res, 500, { success: false, error: error.message });
    await auth.client
      .from('profiles')
      .update({ has_password_set: true, updated_at: new Date().toISOString() })
      .eq('id', auth.profileId);
    return send(res, 200, {
      success: true,
      message: 'Password successfully updated and securely hashed.',
    });
  } catch (err) {
    console.error('[api/auth/update-password]', err);
    return send(res, 500, { success: false, error: (err && err.message) || 'Update failed' });
  }
}

async function handleAuth(path, req, res) {
  if (path === 'auth/send-otp') return sendOtp(req, res);
  if (path === 'auth/verify-otp') return verifyOtp(req, res);
  if (path === 'auth/register-bootstrap') return registerBootstrap(req, res);
  if (path === 'auth/login-password') return loginPassword(req, res);
  if (path === 'auth/reset-password') return resetPassword(req, res);
  if (path === 'auth/update-password') return updatePassword(req, res);
  return null;
}

module.exports = { handleAuth };
