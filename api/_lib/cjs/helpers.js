/**
 * Shared CommonJS helpers for Vercel API entries (kept under api/_lib — not a route).
 */
const { createHash } = require('crypto');
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

function getSupabaseEnv() {
  return {
    url: clean(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL),
    anonKey: clean(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY),
    // Never fall back to anon — service-role only for backend mutations / RLS bypass.
    serviceKey: clean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

function decodeJwtRole(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

function createServiceClient() {
  const { url, serviceKey } = getSupabaseEnv();
  if (!url || !serviceKey) return null;
  const role = decodeJwtRole(serviceKey);
  if (role && role !== 'service_role') {
    console.error(
      '[api/_lib/cjs/helpers] SUPABASE_SERVICE_ROLE_KEY is not a service_role JWT (got role=%s). Refusing client.',
      role
    );
    return null;
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidOtpToken(token) {
  return typeof token === 'string' && /^\d{6}$/.test(token.trim());
}

const PUBLIC_ROLES = new Set([
  'male_user',
  'female_user',
  'female_creator',
  'female_host',
  'other_user',
]);

function sanitizePublicSignupRole(role) {
  const r = String(role || '').trim();
  return PUBLIC_ROLES.has(r) ? r : 'male_user';
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

function mapProfileRow(p) {
  if (!p) return null;
  return {
    id: p.id,
    authId: p.auth_id || p.id,
    name: p.name || 'Member',
    email: p.email || '',
    gender: p.gender || 'male',
    genderLocked: p.gender_locked ?? true,
    role: p.role || 'male_user',
    age: Number(p.age) || 24,
    nationality: p.nationality || 'United States',
    countryCode: String(p.country_code || 'US').toUpperCase(),
    spokenLanguages: Array.isArray(p.spoken_languages) ? p.spoken_languages : ['English'],
    bio: p.bio || '',
    interests: Array.isArray(p.interests) ? p.interests : [],
    tags: Array.isArray(p.tags) ? p.tags : [],
    avatarUrl: p.avatar_url || '',
    gallery: Array.isArray(p.gallery) ? p.gallery : [],
    isVerified: Boolean(p.is_verified),
    isOnboarded: p.is_onboarded !== false,
    onlineStatus: p.online_status || 'offline',
    coinBalance: Number(p.coin_balance) || 0,
    hourlyCoinRate: Number(p.hourly_coin_rate) || 0,
    earningsCoins: Number(p.earnings_coins) || 0,
    hasPasswordSet: Boolean(p.has_password_set),
    isBanned: Boolean(p.is_banned),
    banReason: p.ban_reason || undefined,
    bannedUntil: p.banned_until || undefined,
    agencyName: p.agency_name || undefined,
    teamLeaderId: p.team_leader_id || p.created_by_id || undefined,
    createdById: p.created_by_id || p.team_leader_id || undefined,
    commissionPercent: p.commission_percent != null ? Number(p.commission_percent) : undefined,
    createdAt: p.created_at,
  };
}

function findAuthUserByEmail(users, email) {
  const target = String(email || '')
    .trim()
    .toLowerCase();
  if (!target || !Array.isArray(users)) return null;
  return users.find((u) => String((u && u.email) || '').toLowerCase() === target) || null;
}

async function requireAuth(req) {
  const { url, serviceKey } = getSupabaseEnv();
  if (!url || !serviceKey) {
    return {
      ok: false,
      status: 503,
      error: { message: 'Supabase not configured', code: 'ENV' },
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
  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await client.auth.getUser(token);
  if (userErr || !userData || !userData.user) {
    return {
      ok: false,
      status: 401,
      error: { message: 'Invalid or expired authentication token.', code: 'UNAUTHORIZED' },
    };
  }
  const authUser = userData.user;
  const { data: profile } = await client
    .from('profiles')
    .select('*')
    .or(`auth_id.eq.${authUser.id},id.eq.${authUser.id}`)
    .maybeSingle();
  const profileId = String((profile && profile.id) || authUser.id);
  const role = String((profile && profile.role) || '').toLowerCase();
  const email = String((profile && profile.email) || authUser.email || '').toLowerCase();
  return {
    ok: true,
    client,
    userId: authUser.id,
    profileId,
    role,
    email,
    user: authUser,
    profile,
  };
}

function isAdminRole(role, email) {
  return (
    role === 'admin' || email === 'admin@livecall.app' || email === 'superadmin@minglecall.com'
  );
}

function isTeamLeaderRole(role, email) {
  return (
    role === 'team_leader' ||
    role === 'agency_manager' ||
    isAdminRole(role, email)
  );
}

function hashOtp(code) {
  return createHash('sha256').update(String(code).trim()).digest('hex');
}

async function saveOtpDb(client, email, code, metadata) {
  const cleanEmail = email.trim().toLowerCase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error } = await client.from('auth_otps').upsert(
    {
      email: cleanEmail,
      code_hash: hashOtp(code),
      name: (metadata && metadata.name) || null,
      role: (metadata && metadata.role) || null,
      expires_at: expiresAt,
      attempts: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'email' }
  );
  if (error) throw new Error(error.message);
}

async function verifyOtpDb(client, email, inputCode) {
  const cleanEmail = email.trim().toLowerCase();
  const { data: stored, error } = await client
    .from('auth_otps')
    .select('email, code_hash, name, role, expires_at, attempts')
    .eq('email', cleanEmail)
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!stored) {
    return {
      success: false,
      error: 'No active verification code found for this email. Please request a new code.',
    };
  }
  if (Date.now() > new Date(stored.expires_at).getTime()) {
    await client.from('auth_otps').delete().eq('email', cleanEmail);
    return { success: false, error: 'The verification code has expired. Please request a new one.' };
  }
  const attempts = Number(stored.attempts || 0);
  if (attempts >= 5) {
    await client.from('auth_otps').delete().eq('email', cleanEmail);
    return {
      success: false,
      error: 'Too many incorrect attempts. Please request a fresh verification code.',
    };
  }
  if (stored.code_hash === hashOtp(inputCode)) {
    await client.from('auth_otps').delete().eq('email', cleanEmail);
    return {
      success: true,
      metadata: {
        email: stored.email,
        name: stored.name || undefined,
        role: stored.role || undefined,
      },
    };
  }
  await client
    .from('auth_otps')
    .update({ attempts: attempts + 1, updated_at: new Date().toISOString() })
    .eq('email', cleanEmail);
  return {
    success: false,
    error: `Invalid verification code. ${5 - (attempts + 1)} attempt(s) remaining.`,
  };
}

async function savePendingSignupDb(client, email, passwordHash, meta) {
  const cleanEmail = email.trim().toLowerCase();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const { error } = await client.from('auth_pending_signups').upsert(
    {
      email: cleanEmail,
      password_hash: passwordHash,
      name: (meta && meta.name) || null,
      role: (meta && meta.role) || null,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'email' }
  );
  if (error) throw new Error(error.message);
}

async function takePendingSignupDb(client, email) {
  const cleanEmail = email.trim().toLowerCase();
  const { data } = await client
    .from('auth_pending_signups')
    .select('password_hash, name, role, expires_at')
    .eq('email', cleanEmail)
    .maybeSingle();
  if (!data) return null;
  await client.from('auth_pending_signups').delete().eq('email', cleanEmail);
  if (Date.now() > new Date(data.expires_at).getTime()) return null;
  return {
    password_hash: data.password_hash,
    name: data.name || undefined,
    role: data.role || undefined,
  };
}

function generateSixDigitOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isSmtpConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY ||
      (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  );
}

async function sendOtpEmailVercel({ to, name, otpCode }) {
  const dest = String(to || '')
    .trim()
    .toLowerCase();
  const display = name || 'User';
  const from = clean(process.env.SMTP_FROM || process.env.RESEND_FROM) || 'noreply@minglecall.com';
  const subject = 'Your LiveCall verification code';
  const html = `<p>Hello <strong>${display}</strong>,</p><p>Your 6-digit OTP is:</p><p style="font-size:28px;letter-spacing:6px;font-weight:800">${otpCode}</p><p>Valid for 10 minutes.</p>`;
  const resendKey = clean(process.env.RESEND_API_KEY);
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [dest], subject, html }),
      });
      if (!res.ok) {
        const t = (await res.text().catch(() => '')).slice(0, 120);
        return {
          success: true,
          delivered: false,
          message: `Email provider error (${res.status}). ${t}`,
        };
      }
      return { success: true, delivered: true, message: 'Verification code sent.' };
    } catch (e) {
      return { success: true, delivered: false, message: (e && e.message) || 'Email send failed' };
    }
  }
  try {
    const nodemailer = require('nodemailer');
    const host = process.env.SMTP_HOST || '';
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';
    if (!host || !user || !pass) {
      return {
        success: true,
        delivered: false,
        message: 'SMTP not configured; OTP stored server-side only.',
      };
    }
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const secure = String(process.env.SMTP_SECURE || 'true') === 'true' || port === 465;
    const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    await transporter.sendMail({ from, to: dest, subject, html });
    return { success: true, delivered: true, message: 'Verification code sent.' };
  } catch (e) {
    return { success: true, delivered: false, message: (e && e.message) || 'Email send failed' };
  }
}

function hashPasswordSync(password) {
  try {
    const bcrypt = require('bcryptjs');
    return bcrypt.hashSync(password, 10);
  } catch {
    return `sha256:${createHash('sha256').update(password).digest('hex')}`;
  }
}

module.exports = {
  send,
  clean,
  bearer,
  readJsonBody,
  getSupabaseEnv,
  createServiceClient,
  createClient,
  isValidEmail,
  isValidOtpToken,
  sanitizePublicSignupRole,
  getPasswordPolicyError,
  mapProfileRow,
  findAuthUserByEmail,
  requireAuth,
  isAdminRole,
  isTeamLeaderRole,
  saveOtpDb,
  verifyOtpDb,
  savePendingSignupDb,
  takePendingSignupDb,
  generateSixDigitOtp,
  isSmtpConfigured,
  sendOtpEmailVercel,
  hashPasswordSync,
};
