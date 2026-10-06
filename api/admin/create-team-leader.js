/**
 * POST /api/admin/create-team-leader — plain CommonJS (Hobby-safe).
 * Isolated from api/router.ts so router boot failures cannot block user creation.
 */
const { createClient } = require('@supabase/supabase-js');

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function clean(v) {
  return String(v || '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

function bearer(req) {
  const h = req.headers.authorization || req.headers.Authorization;
  if (!h || typeof h !== 'string') return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

const WEAK = new Set(
  [
    'password',
    'password1',
    'password123',
    'passw0rd',
    '123456',
    '12345678',
    'qwerty',
    'admin',
    'admin123',
    'creator123',
    'admin@12345',
  ].map((p) => p.toLowerCase())
);

function getPasswordPolicyError(password) {
  if (typeof password !== 'string' || !password) return 'Password is required.';
  if (password.length < 8) return 'Password requirement not met: at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password requirement not met: at least 1 uppercase letter (A–Z).';
  if (!/[a-z]/.test(password)) return 'Password requirement not met: at least 1 lowercase letter (a–z).';
  if (!/[0-9]/.test(password)) return 'Password requirement not met: at least 1 number (0–9).';
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return 'Password requirement not met: at least 1 special character (!@#$…).';
  }
  if (WEAK.has(password.toLowerCase()) || /(.)\1{2,}/.test(password)) {
    return 'Password requirement not met: no common or repeating patterns.';
  }
  return null;
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function requireAdmin(req) {
  const supabaseUrl = clean(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);
  const serviceKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!supabaseUrl || !serviceKey) {
    return {
      ok: false,
      status: 503,
      error: {
        message: 'Supabase service role is not configured on this deployment.',
        code: 'SUPABASE_NOT_CONFIGURED',
      },
    };
  }

  const token = bearer(req);
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: { message: 'Missing Authorization Bearer token.', code: 'UNAUTHORIZED' },
    };
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData || !userData.user) {
    return {
      ok: false,
      status: 401,
      error: { message: 'Invalid or expired authentication token.', code: 'UNAUTHORIZED' },
    };
  }

  const authUser = userData.user;
  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, email')
    .or(`auth_id.eq.${authUser.id},id.eq.${authUser.id}`)
    .maybeSingle();

  const role = String((profile && profile.role) || '').toLowerCase();
  const email = String((profile && profile.email) || authUser.email || '').toLowerCase();
  const isAdmin =
    role === 'admin' || email === 'admin@livecall.app' || email === 'superadmin@minglecall.com';
  if (!isAdmin) {
    return {
      ok: false,
      status: 403,
      error: { message: 'Admin role required.', code: 'FORBIDDEN' },
    };
  }

  return { ok: true, admin, userId: String((profile && profile.id) || authUser.id) };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      return send(res, 405, {
        success: false,
        error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
      });
    }

    const auth = await requireAdmin(req);
    if (auth.ok === false) {
      return send(res, auth.status, { success: false, error: auth.error });
    }

    const body = await readJsonBody(req);
    const name = clean(body.name);
    const email = clean(body.email).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    const agencyName = clean(body.agencyName) || 'Talent Agency';
    const commissionPercent = Number(body.commissionPercent);
    const nationality = clean(body.nationality) || 'United States';
    const countryCode = clean(body.countryCode || body.country_code || 'US').toUpperCase() || 'US';
    const bio = clean(body.bio) || 'Talent Management & Creator Agency Director';
    const avatarUrl =
      clean(body.avatarUrl || body.avatar_url) ||
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400';
    const spokenLanguages = Array.isArray(body.spokenLanguages)
      ? body.spokenLanguages.map((s) => String(s).trim()).filter(Boolean)
      : String(body.spokenLanguages || 'English')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

    if (!name) {
      return send(res, 400, {
        success: false,
        error: { message: 'Name is required.', code: 'NAME_REQUIRED' },
      });
    }
    if (!email || !email.includes('@')) {
      return send(res, 400, {
        success: false,
        error: { message: 'A valid login email is required.', code: 'EMAIL_REQUIRED' },
      });
    }
    const pwError = getPasswordPolicyError(password);
    if (pwError) {
      return send(res, 400, {
        success: false,
        error: { message: pwError, code: 'PASSWORD_POLICY' },
      });
    }

    const admin = auth.admin;

    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, email, role')
      .ilike('email', email)
      .maybeSingle();
    if (existingProfile && existingProfile.id) {
      return send(res, 409, {
        success: false,
        error: {
          message: `A profile already exists for ${email}. Use Reset Password or a different email.`,
          code: 'EMAIL_EXISTS',
        },
      });
    }

    const { data: createdAuth, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'team_leader',
        gender: 'female',
        name,
        full_name: name,
      },
    });

    if (createErr || !createdAuth || !createdAuth.user || !createdAuth.user.id) {
      const msg = (createErr && createErr.message) || 'Failed to create Auth user';
      const code = /already/i.test(msg) ? 'EMAIL_EXISTS' : 'AUTH_CREATE_FAILED';
      return send(res, code === 'EMAIL_EXISTS' ? 409 : 500, {
        success: false,
        error: { message: msg, code },
      });
    }

    const authUserId = createdAuth.user.id;
    const now = new Date().toISOString();
    const commission = Number.isFinite(commissionPercent) ? commissionPercent : 15;
    const langs = spokenLanguages.length ? spokenLanguages : ['English'];
    const profileRow = {
      id: authUserId,
      auth_id: authUserId,
      name,
      email,
      gender: 'female',
      gender_locked: true,
      role: 'team_leader',
      age: 28,
      nationality,
      country_code: countryCode,
      bio,
      interests: ['Talent Growth', 'Creator Mentorship'],
      tags: ['Team Leader', 'VIP Agency'],
      spoken_languages: langs,
      avatar_url: avatarUrl,
      gallery: [avatarUrl],
      is_verified: true,
      is_onboarded: true,
      agreed_to_terms: true,
      online_status: 'offline',
      coin_balance: 0,
      hourly_coin_rate: 10,
      earnings_coins: 0,
      agency_name: agencyName,
      commission_percent: commission,
      has_password_set: true,
      created_at: now,
      updated_at: now,
    };

    const { error: upsertErr } = await admin.from('profiles').upsert(profileRow, { onConflict: 'id' });
    if (upsertErr) {
      try {
        await admin.auth.admin.deleteUser(authUserId);
      } catch {
        // ignore rollback failure
      }
      return send(res, 500, {
        success: false,
        error: {
          message: upsertErr.message || 'Failed to create team leader profile',
          code: 'PROFILE_UPSERT_FAILED',
        },
      });
    }

    await admin
      .from('profiles')
      .update({
        role: 'team_leader',
        gender: 'female',
        gender_locked: true,
        auth_id: authUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', authUserId);

    return send(res, 200, {
      success: true,
      user: {
        id: authUserId,
        authId: authUserId,
        name,
        email,
        role: 'team_leader',
        gender: 'female',
        genderLocked: true,
        agencyName,
        commissionPercent: commission,
        avatarUrl,
        gallery: [avatarUrl],
        spokenLanguages: langs,
        nationality,
        countryCode,
        bio,
        isVerified: true,
        isOnboarded: true,
        hasPasswordSet: true,
        coinBalance: 0,
        hourlyCoinRate: 10,
        earningsCoins: 0,
        onlineStatus: 'offline',
        createdAt: now,
      },
      message: `Team leader ${name} created in Supabase Auth + profiles. They can sign in with ${email}.`,
    });
  } catch (err) {
    console.error('[api/admin/create-team-leader]', err);
    return send(res, 500, {
      success: false,
      error: { message: (err && err.message) || 'Failed to create team leader', code: 'INTERNAL' },
    });
  }
};
