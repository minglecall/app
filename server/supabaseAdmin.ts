import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { purgeR2MediaUploads, clearLocalMediaCache } from './r2Storage';
import { VIRTUAL_GIFTS } from '../src/constants/appDefaults';

dotenv.config();

let supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
let supabaseServiceKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''
).trim();

let supabaseAdmin: SupabaseClient | null = null;

export function updateSupabaseRuntimeConfig(url?: string, key?: string) {
  if (url !== undefined) {
    supabaseUrl = String(url).trim();
    process.env.VITE_SUPABASE_URL = supabaseUrl;
  }
  if (key !== undefined) {
    supabaseServiceKey = String(key).trim();
    process.env.SUPABASE_SERVICE_ROLE_KEY = supabaseServiceKey;
  }
  // Re-create client on next getSupabaseAdmin call
  supabaseAdmin = null;
  if (isSupabaseAdminConfigured()) {
    getSupabaseAdmin();
  }
}

function decodeJwtRole(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    return typeof payload?.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(
    supabaseUrl &&
    supabaseServiceKey &&
    !supabaseUrl.includes('placeholder-project') &&
    !supabaseUrl.includes('your-project-ref')
  );
}

/** True only when the server key is a service_role JWT (anon keys cannot bypass RLS). */
export function isSupabaseServiceRoleConfigured(): boolean {
  return isSupabaseAdminConfigured() && decodeJwtRole(supabaseServiceKey) === 'service_role';
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseAdminConfigured()) return null;
  if (!supabaseAdmin) {
    try {
      supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      console.log('[Supabase Admin] Initialized server-side Supabase client connected to:', supabaseUrl);
    } catch (err) {
      console.error('[Supabase Admin] Failed to initialize Supabase client:', err);
    }
  }
  return supabaseAdmin;
}

export async function testSupabaseConnectivity(testUrl?: string, testKey?: string): Promise<{ success: boolean; message: string; tableCount?: number }> {
  const url = (testUrl || supabaseUrl || '').trim();
  const key = (testKey || supabaseServiceKey || '').trim();

  if (!url || !key || url.includes('your-project-ref')) {
    return { success: false, message: 'Supabase URL and Service Key are required.' };
  }

  try {
    const client = createClient(url, key, {
      auth: { persistSession: false },
    });

    const { data, error, count } = await client
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    if (error) {
      // If table does not exist, connection is valid but schema migration needed
      if (error.code === '42P01' || error.message.includes('relation "public.profiles" does not exist')) {
        return {
          success: true,
          message: 'Supabase PostgreSQL connected successfully! (Tables not yet migrated; auto-schema ready).',
          tableCount: 0,
        };
      }
      return { success: false, message: `Database error: ${error.message}` };
    }

    return {
      success: true,
      message: `Supabase PostgreSQL connected and authenticated! (${count ?? 0} profiles found in database).`,
      tableCount: count ?? 0,
    };
  } catch (err: any) {
    return { success: false, message: `Connection failed: ${err.message || 'Unknown network error'}` };
  }
}

/**
 * Securely hashes a plain-text password using bcrypt with random 10-round salt
 */
export async function hashPassword(plainText: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainText, salt);
}

/**
 * Securely compares a candidate password against a bcrypt hash only.
 * Plain-text equality is never accepted (prevents weak / non-hash storage bypasses).
 */
export async function comparePassword(plainText: string, hashedOrPlain: string): Promise<boolean> {
  if (typeof plainText !== 'string' || typeof hashedOrPlain !== 'string') return false;
  if (!hashedOrPlain || !plainText) return false;
  // Reject accidental whitespace-only or padded candidates used to probe auth
  if (plainText.trim().length === 0) return false;
  if (!(hashedOrPlain.startsWith('$2a$') || hashedOrPlain.startsWith('$2b$') || hashedOrPlain.startsWith('$2y$'))) {
    return false;
  }
  try {
    return await bcrypt.compare(plainText, hashedOrPlain);
  } catch {
    return false;
  }
}

export function ensureValidUuid(id: string): string {
  if (id && String(id).trim().length > 0) {
    return String(id).trim();
  }
  // Generate valid UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Server-side profile upsert that bypasses RLS using Service Role Key or direct server client
 * Automatically hashes any plain-text password with bcrypt and ensures raw passwords are NEVER stored.
 */
export async function upsertProfileAdmin(profile: any): Promise<{ success: boolean; data?: any; error?: string }> {
  const client = getSupabaseAdmin();
  if (!client) {
    return { success: false, error: 'Supabase URL or Key not configured on server' };
  }

  try {
    let validId = profile.id || ensureValidUuid('');
    
    // Check if password needs bcrypt hashing
    let passwordHash: string | null = null;
    let hasPassword = Boolean(profile.hasPasswordSet);

    if (profile.password_hash) {
      passwordHash = profile.password_hash;
      hasPassword = true;
    } else if (profile.password) {
      if (profile.password.startsWith('$2a$') || profile.password.startsWith('$2b$')) {
        passwordHash = profile.password;
      } else {
        passwordHash = await hashPassword(profile.password);
      }
      hasPassword = true;
    }

    // Check if a profile with this email already exists in Supabase to reuse its ID & preserve existing password_hash
    if (profile.email) {
      const cleanEmail = String(profile.email).toLowerCase().trim();
      try {
        const { data: existingUser } = await client
          .from('profiles')
          .select('id, password_hash, has_password_set')
          .eq('email', cleanEmail)
          .limit(1)
          .maybeSingle();

        if (existingUser && existingUser.id) {
          console.log(`[Supabase Admin] Reusing existing profile ID ${existingUser.id} for email ${cleanEmail}`);
          validId = existingUser.id;
          if (!passwordHash && existingUser.password_hash) {
            passwordHash = existingUser.password_hash;
            hasPassword = true;
          }
        }
      } catch (err) {
        // Continue if query fails
      }
    }

    // Core standardized profile record (Raw password completely stripped!)
    const payload: Record<string, any> = {
      id: validId,
      auth_id: (profile.authId && profile.authId !== validId && profile.authId !== profile.id && !String(profile.authId).startsWith('user_')) ? profile.authId : null,
      name: profile.name || 'New Member',
      email: profile.email || null,
      phone: profile.phone || null,
      gender: profile.gender || 'male',
      gender_locked: profile.genderLocked ?? true,
      age: Number(profile.age) || 24,
      nationality: profile.nationality || 'United States',
      country_code: (profile.countryCode || profile.country_code || 'US').toUpperCase(),
      bio: profile.bio || '',
      extended_bio: profile.extendedBio || profile.extended_bio || null,
      location_city: profile.locationCity || profile.location_city || null,
      zodiac: profile.zodiac || null,
      interests: Array.isArray(profile.interests) ? profile.interests : [],
      interested_in: Array.isArray(profile.interestedIn) ? profile.interestedIn : [],
      tags: Array.isArray(profile.tags) ? profile.tags : [],
      spoken_languages: Array.isArray(profile.spokenLanguages) ? profile.spokenLanguages : ['English'],
      avatar_url: profile.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=400',
      gallery: Array.isArray(profile.gallery) ? profile.gallery : [],
      intro_video_url: profile.introVideoUrl || null,
      verification_video_url: profile.verificationVideoUrl || null,
      is_verified: Boolean(profile.isVerified),
      is_onboarded: profile.isOnboarded !== undefined ? Boolean(profile.isOnboarded) : true,
      agreed_to_terms: profile.agreedToTerms !== undefined ? Boolean(profile.agreedToTerms) : true,
      agreed_to_adult_terms: Boolean(profile.agreedToAdultTerms),
      agreed_to_host_terms: Boolean(profile.agreedToHostTerms),
      kyc_status: profile.kycStatus || 'unsubmitted',
      online_status: profile.onlineStatus || 'online',
      role: profile.role || 'male_user',
      coin_balance: Number(profile.coinBalance) || 0,
      hourly_coin_rate: Number(profile.hourlyCoinRate) || 0,
      earnings_coins: Number(profile.earningsCoins) || 0,
      total_lifetime_earned_usd: Number(profile.totalLifetimeEarnedUSD) || 0,
      is_banned: Boolean(profile.isBanned ?? profile.is_banned),
      ban_reason: profile.banReason || profile.ban_reason || null,
      banned_until: profile.bannedUntil || profile.banned_until || null,
      banned_by_id: profile.bannedById || profile.banned_by_id || null,
      banned_by_role: profile.bannedByRole || profile.banned_by_role || null,
      team_leader_id: profile.teamLeaderId || profile.createdById || profile.team_leader_id || profile.created_by_id || null,
      created_by_id: profile.createdById || profile.teamLeaderId || profile.created_by_id || profile.team_leader_id || null,
      agency_name: profile.agencyName || profile.agency_name || null,
      coin_earn_override_rate: profile.coinEarnOverrideRate !== undefined && profile.coinEarnOverrideRate !== null ? Number(profile.coinEarnOverrideRate) : (profile.coin_earn_override_rate !== undefined && profile.coin_earn_override_rate !== null ? Number(profile.coin_earn_override_rate) : null),
      commission_percent: profile.commissionPercent !== undefined && profile.commissionPercent !== null ? Number(profile.commissionPercent) : (profile.commission_percent !== undefined && profile.commission_percent !== null ? Number(profile.commission_percent) : null),
      team_leader_note: profile.teamLeaderNote || profile.team_leader_note || null,
      has_password_set: hasPassword,
    };
    // Only write password_hash when explicitly provided — never null-out an existing hash
    if (passwordHash) {
      payload.password_hash = passwordHash;
      payload.has_password_set = true;
    }

    console.log(`[Supabase Admin] Upserting profile for user ${payload.name} (${validId}) into Supabase...`);

    let currentPayload = { ...payload };

    let lastError: string | null = null;
    let maxRetries = 10;

    while (maxRetries > 0) {
      const { data, error } = await client
        .from('profiles')
        .upsert(currentPayload, { onConflict: 'id' })
        .select()
        .single();

      if (!error) {
        console.log(`[Supabase Admin] Profile successfully saved to Supabase (${payload.name})!`);
        return { success: true, data };
      }

      lastError = error.message;
      console.warn(`[Supabase Admin] Upsert attempt failed (${maxRetries} retries left):`, error.message);

      // Check if error is due to email unique constraint violation
      if (
        error.message.includes('unique constraint') ||
        error.message.includes('profiles_email_key') ||
        error.message.includes('duplicate key')
      ) {
        console.log(`[Supabase Admin] Duplicate email constraint detected (${currentPayload.email}). Resolving...`);
        if (currentPayload.email) {
          try {
            const { data: existingUser } = await client
              .from('profiles')
              .select('id')
              .eq('email', currentPayload.email)
              .limit(1)
              .maybeSingle();

            if (existingUser && existingUser.id) {
              currentPayload.id = existingUser.id;
              const updateRes = await client
                .from('profiles')
                .update(currentPayload)
                .eq('id', existingUser.id)
                .select()
                .maybeSingle();

              if (!updateRes.error && updateRes.data) {
                console.log(`[Supabase Admin] Profile updated via email match (${existingUser.id})!`);
                return { success: true, data: updateRes.data };
              }
            }
          } catch (e: any) {
            console.warn('[Supabase Admin] Email recovery exception:', e.message);
          }
          // If still failing, strip email from this upsert attempt
          delete currentPayload.email;
        }
        maxRetries--;
        continue;
      }

      // Check if error is due to auth_id foreign key constraint violation
      if (
        error.message.includes('foreign key constraint') ||
        error.message.includes('auth_id_fkey') ||
        error.message.includes('profiles_auth_id_fkey')
      ) {
        console.log('[Supabase Admin] Pruning invalid auth_id to resolve foreign key constraint and retrying...');
        delete currentPayload.auth_id;
        maxRetries--;
        continue;
      }

      // Check if the error is due to a missing column in the user's remote table schema cache
      const colMatch =
        error.message.match(/Could not find the '([^']+)' column/i) ||
        error.message.match(/column ["']?([a-zA-Z0-9_]+)["']? of/i) ||
        error.message.match(/column ["']?([a-zA-Z0-9_]+)["']? does not exist/i);

      if (colMatch && colMatch[1]) {
        const missingCol = colMatch[1];
        console.log(`[Supabase Admin] Pruning missing column '${missingCol}' from payload and retrying...`);
        delete currentPayload[missingCol];
        maxRetries--;
        continue;
      }

      // If not a specific column regex match, try falling back to bare minimum fields
      if (maxRetries > 1) {
        console.log('[Supabase Admin] Retrying with core essential fields only...');
        currentPayload = {
          id: validId,
          name: payload.name,
          gender: payload.gender,
          role: payload.role,
          nationality: payload.nationality,
          country_code: payload.country_code,
          location_city: payload.location_city,
          bio: payload.bio,
          coin_balance: payload.coin_balance,
          avatar_url: payload.avatar_url,
          online_status: payload.online_status,
        };
        maxRetries = 1;
        continue;
      }

      break;
    }

    console.error('[Supabase Admin] All upsert retries failed:', lastError);
    return { success: false, error: lastError || 'Unknown Supabase error' };
  } catch (err: any) {
    console.error('[Supabase Admin] Upsert profile exception:', err);
    return { success: false, error: err.message || 'Supabase exception' };
  }
}

/**
 * Bulk upsert profiles in Supabase server-side with automatic error handling & fallback
 */
export async function bulkUpsertProfilesAdmin(profiles: any[]): Promise<{ success: boolean; count: number; error?: string }> {
  if (!profiles || profiles.length === 0) {
    return { success: true, count: 0 };
  }

  let successCount = 0;
  let lastError: string | undefined;

  for (const p of profiles) {
    const res = await upsertProfileAdmin(p);
    if (res.success) {
      successCount++;
    } else {
      lastError = res.error;
    }
  }

  if (successCount > 0) {
    return { success: true, count: successCount };
  }

  return { success: false, count: 0, error: lastError || 'Failed to sync profiles' };
}

/**
 * Fetch all profiles from Supabase server-side
 */
export async function fetchProfilesAdmin(): Promise<{ success: boolean; profiles?: any[]; error?: string }> {
  const client = getSupabaseAdmin();
  if (!client) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { data, error } = await client.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, profiles: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Check if a profile is currently suspended/banned with expiration support
 */
export function isProfileBanned(profile: any): { isBanned: boolean; message?: string; bannedUntil?: string } {
  if (!profile || (!profile.is_banned && !profile.isBanned)) {
    return { isBanned: false };
  }

  const bannedUntil = profile.banned_until || profile.bannedUntil;
  if (bannedUntil) {
    const expiryTime = new Date(bannedUntil).getTime();
    if (Date.now() > expiryTime) {
      // Ban has expired! Return unbanned
      return { isBanned: false };
    }

    const expiryDateStr = new Date(bannedUntil).toLocaleString();
    const reason = profile.ban_reason || profile.banReason || 'Host rule or agency violation';
    const banner = (profile.banned_by_role || profile.bannedByRole) === 'team_leader' ? 'your Team Leader' : 'Administration';
    return {
      isBanned: true,
      bannedUntil,
      message: `Your account has been suspended by ${banner} until ${expiryDateStr}.\nReason: "${reason}".\nPlease contact your agency management.`,
    };
  }

  const reason = profile.ban_reason || profile.banReason || 'Administrative suspension';
  return {
    isBanned: true,
    message: `Your account has been permanently suspended.\nReason: "${reason}".\nPlease contact support.`,
  };
}

/**
 * Delete profile from Supabase server-side (DB and Auth)
 */
export async function deleteProfileAdmin(userId: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseAdmin();
  if (!client) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { error } = await client.from('profiles').delete().eq('id', userId);
    if (error) {
      console.warn('[Supabase Admin] Error deleting profile from DB:', error.message);
    }

    // Delete user from Supabase Auth if valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(userId)) {
      client.auth.admin.deleteUser(userId).catch(() => {});
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Update or create user password in Supabase Auth & profiles table server-side
 * Hashes password using bcrypt before persisting.
 */
export async function updateUserPasswordAdmin(
  userId: string,
  newPassword: string,
  email?: string
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseAdmin();
  if (!client) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const passwordHash = await hashPassword(newPassword);
    const cleanEmail = email ? email.toLowerCase().trim() : null;

    // 1. Update password_hash in profiles table
    if (userId) {
      await client
        .from('profiles')
        .update({
          password_hash: passwordHash,
          has_password_set: true,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', userId);
    } else if (cleanEmail) {
      await client
        .from('profiles')
        .update({
          password_hash: passwordHash,
          has_password_set: true,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('email', cleanEmail);
    }

    // 2. Also sync to Supabase Auth so native Supabase tokens and client sessions work
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    let authUpdated = false;

    if (userId && uuidRegex.test(userId)) {
      try {
        const { data, error } = await client.auth.admin.updateUserById(userId, {
          password: newPassword,
          email_confirm: true,
        });
        if (!error && data?.user) {
          authUpdated = true;
          console.log(`[Supabase Admin] Updated password & confirmed email for auth user ID ${userId}`);
        }
      } catch (e: any) {
        console.warn(`[Supabase Admin] Auth updateUserById notice:`, e.message);
      }
    }

    if (!authUpdated && cleanEmail) {
      try {
        const { data: userList, error: listErr } = await client.auth.admin.listUsers({
          perPage: 1000,
        });
        if (!listErr && userList?.users) {
          const matched = (userList.users as any[]).find(
            (u: any) => u.email?.toLowerCase().trim() === cleanEmail
          );
          if (matched) {
            const { error: updErr } = await client.auth.admin.updateUserById(matched.id, {
              password: newPassword,
              email_confirm: true,
            });
            if (!updErr) {
              authUpdated = true;
              console.log(`[Supabase Admin] Updated password & confirmed email for auth user matching email ${cleanEmail}`);
            }
          } else {
            // User does not exist in Supabase Auth yet; create auth record with confirmed email
            const { data: createdAuth, error: createErr } = await client.auth.admin.createUser({
              email: cleanEmail,
              password: newPassword,
              email_confirm: true,
              user_metadata: {
                id: userId,
              },
            });
            if (!createErr && createdAuth?.user) {
              authUpdated = true;
              console.log(`[Supabase Admin] Created auth record in Supabase Auth for email ${cleanEmail}`);
            } else if (createErr) {
              console.warn(`[Supabase Admin] Create auth user notice:`, createErr.message);
            }
          }
        }
      } catch (e: any) {
        console.warn(`[Supabase Admin] Auth email lookup updateUser notice:`, e.message);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('[Supabase Admin] updateUserPasswordAdmin exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Authenticate with Supabase Auth ONLY.
 * Never accepts profiles.password_hash as a login authority, and never
 * overwrites Auth passwords during verification (that allowed forged passwords).
 */
export async function authenticateUserWithPasswordAdmin(
  email: string,
  passwordCandidate: string
): Promise<{ success: boolean; user?: any; session?: any; error?: string }> {
  const client = getSupabaseAdmin();
  if (!client) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    const password = typeof passwordCandidate === 'string' ? passwordCandidate : '';
    if (!cleanEmail || !password || password.trim().length === 0) {
      return { success: false, error: 'Invalid email or password. Please check your credentials.' };
    }

    const { data: authData, error: authError } = await client.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (authError || !authData?.user) {
      return { success: false, error: 'Invalid email or password. Please check your credentials.' };
    }

    const { data: profile } = await client
      .from('profiles')
      .select('*')
      .eq('email', cleanEmail)
      .limit(1)
      .maybeSingle();

    if (profile) {
      const banCheck = isProfileBanned(profile);
      if (banCheck.isBanned) {
        return { success: false, error: banCheck.message };
      }
    }

    const sanitized = profile
      ? { ...profile }
      : {
          id: authData.user.id,
          name: authData.user.user_metadata?.full_name || 'Member',
          email: cleanEmail,
          role: 'male_user',
          isOnboarded: true,
          onlineStatus: 'online',
        };
    delete (sanitized as any).password;
    delete (sanitized as any).password_hash;
    sanitized.hasPasswordSet = true;
    if (authData.user.id) {
      sanitized.auth_id = authData.user.id;
      sanitized.authId = authData.user.id;
    }

    return { success: true, user: sanitized, session: authData.session };
  } catch (err: any) {
    console.error('[Supabase Admin] authenticateUserWithPasswordAdmin exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Server-side user status updater bypassing RLS using service role client
 */
export async function updateUserStatusAdmin(
  userId: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseAdmin();
  if (!client) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { error } = await client
      .from('profiles')
      .update({ online_status: status })
      .eq('id', userId);

    if (error) {
      console.warn('[Supabase Admin] updateUserStatusAdmin error:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[Supabase Admin] updateUserStatusAdmin exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Server-side fetch all user statuses
 */
export async function fetchUserStatusesAdmin(): Promise<{
  success: boolean;
  statuses?: Array<{ id: string; online_status: string }>;
  error?: string;
}> {
  const client = getSupabaseAdmin();
  if (!client) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { data, error } = await client
      .from('profiles')
      .select('id, online_status');

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, statuses: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Comprehensive Server-Side Supabase Database Reset Engine
 * Bypasses RLS using the Service Role client and safely deletes/resets tables in cascade order.
 */
export async function granularResetSupabaseAdmin(options: {
  mockIds?: string[];
  clearAllUsers?: boolean;
  clearMockUsers?: boolean;
  clearAdmin?: boolean;
  purgeR2MediaStorage?: boolean;
  purgeAllR2Uploads?: boolean;
  chatMessages?: boolean;
  callLogs?: boolean;
  friendRequests?: boolean;
  payoutRequests?: boolean;
  moderationReports?: boolean;
  feedPosts?: boolean;
  favorites?: boolean;
  blockedUsers?: boolean;
  creatorAnalytics?: boolean;
  dailyRewardsAndQuests?: boolean;
  taxonomiesAndFlags?: boolean;
  creatorGoals?: boolean;
  homeBanners?: boolean;
  homeQuickLinks?: boolean;
  cmsPolicies?: boolean;
  systemSettings?: boolean;
  coinPackages?: boolean;
  virtualGiftsCatalog?: boolean;
  resetBalances?: {
    callerCoins?: boolean;
    creatorEarnings?: boolean;
    vipTiers?: boolean;
  };
}): Promise<{ success: boolean; clearedTables: string[]; error?: string }> {
  const client = getSupabaseAdmin();
  if (!client) {
    return { success: false, clearedTables: [], error: 'Supabase service role admin is not configured.' };
  }
  if (!isSupabaseServiceRoleConfigured()) {
    return {
      success: false,
      clearedTables: [],
      error:
        'Database reset requires SUPABASE_SERVICE_ROLE_KEY. The anon key cannot bypass RLS, so tables would not actually be purged.',
    };
  }

  const clearedTables: string[] = [];
  const failedOps: string[] = [];

  try {
    const recordDelete = (table: string, error: { message: string } | null | undefined) => {
      if (!error) {
        clearedTables.push(table);
        return;
      }
      failedOps.push(`${table}: ${error.message}`);
      console.warn(`[Supabase Admin Reset] ${table} purge warning:`, error.message);
    };

    // Optional: purge Cloudflare R2 uploads before DB deletion
    if (options.purgeR2MediaStorage) {
      clearLocalMediaCache();
      const purgeRes = await purgeR2MediaUploads({
        purgeAllUploads: Boolean(options.purgeAllR2Uploads),
        prefixes: Boolean(options.purgeAllR2Uploads)
          ? undefined
          : ['uploads/avatar/', 'uploads/gallery/', 'uploads/chat_media/', 'uploads/moment/', 'uploads/verification/'],
      });
      clearedTables.push(`r2_media_uploads (${purgeRes.deletedCount} objects)`);
    }

    // Virtual Gifts Catalog purge:
    // - reset system_configs.virtual_gifts_json to defaults
    // - remove "gift" messages from the chats (gift transaction logs)
    if (options.virtualGiftsCatalog) {
      try {
        const { error: giftMsgErr } = await (client as any)
          .from('messages')
          .delete()
          .eq('type', 'gift');
        recordDelete('gift_messages', giftMsgErr);
      } catch (err: any) {
        console.warn('[Supabase Admin Reset] gift message purge exception:', err?.message || err);
      }

      try {
        const { error: sysErr } = await (client as any)
          .from('system_configs')
          .update({
            enable_virtual_gifts: true,
            virtual_gifts_json: JSON.stringify(VIRTUAL_GIFTS),
          })
          .eq('id', 'default');
        recordDelete('system_configs.virtual_gifts_json', sysErr);
      } catch (err: any) {
        console.warn('[Supabase Admin Reset] system virtual gifts update exception:', err?.message || err);
      }
    }

    // PostgREST requires a filter on DELETE/UPDATE. PK columns are NOT NULL,
    // so `col IS NOT NULL` matches every row without fake UUID/text sentinels.
    const deleteAllRows = (table: string, notNullColumn: string) =>
      (client.from(table) as any).delete().not(notNullColumn, 'is', null);

    // 1. Delete Messages Table
    if (options.chatMessages) {
      const { error } = await deleteAllRows('messages', 'id');
      recordDelete('messages', error);
    }

    // 2. Delete Call Logs Table
    if (options.callLogs) {
      const { error } = await deleteAllRows('call_logs', 'id');
      recordDelete('call_logs', error);
    }

    // 3. Delete Matches Table
    if (options.callLogs || options.chatMessages) {
      const { error } = await deleteAllRows('matches', 'id');
      recordDelete('matches', error);
    }

    // 4. Delete Friend Requests Table
    if (options.friendRequests) {
      const { error } = await deleteAllRows('friend_requests', 'id');
      recordDelete('friend_requests', error);
    }

    // 5. Delete Payout Requests Table
    if (options.payoutRequests) {
      const { error } = await deleteAllRows('payout_requests', 'id');
      recordDelete('payout_requests', error);
    }

    // 6. Delete Moderation Reports Table
    if (options.moderationReports) {
      const { error } = await deleteAllRows('moderation_reports', 'id');
      recordDelete('moderation_reports', error);
    }

    // 7. Delete Feed Posts Table
    if (options.feedPosts) {
      const { error } = await deleteAllRows('feed_posts', 'id');
      recordDelete('feed_posts', error);
    }

    // 7a. Delete CMS / System Admin Tables
    if (options.homeBanners) {
      const { error } = await deleteAllRows('home_banners', 'id');
      recordDelete('home_banners', error);
    }

    if (options.homeQuickLinks) {
      const { error } = await deleteAllRows('home_quick_links', 'id');
      recordDelete('home_quick_links', error);
    }

    if (options.cmsPolicies) {
      const { error } = await deleteAllRows('cms_policies', 'id');
      recordDelete('cms_policies', error);
    }

    if (options.systemSettings) {
      const { error } = await deleteAllRows('system_configs', 'id');
      recordDelete('system_configs', error);
    }

    if (options.coinPackages) {
      const { error } = await deleteAllRows('coin_packages', 'id');
      recordDelete('coin_packages', error);
    }

    // 8. Delete Favorites Table
    if (options.favorites) {
      const { error } = await deleteAllRows('favorites', 'user_id');
      recordDelete('favorites', error);
    }

    // 9. Delete Blocked Users Table
    if (options.blockedUsers) {
      const { error } = await deleteAllRows('blocked_users', 'user_id');
      recordDelete('blocked_users', error);
    }

    // 10. Delete Creator Goals Table
    if (options.creatorGoals) {
      const { error } = await deleteAllRows('creator_goals', 'creator_id');
      recordDelete('creator_goals', error);
    }

    // 10a. Delete Creator Analytics / Metrics Table
    if (options.creatorAnalytics) {
      try {
        const { error } = await deleteAllRows('creator_metrics', 'creator_id');
        recordDelete('creator_metrics', error);
      } catch (err: any) {
        failedOps.push(`creator_metrics: ${err?.message || err}`);
        console.warn('[Supabase Admin Reset] creator_metrics purge exception:', err?.message || err);
      }
    }

    // 10b. Delete Taxonomies, Tags & Moderation Flags
    if (options.taxonomiesAndFlags) {
      try {
        const blocks: Array<{ table: string; filter: string }> = [
          { table: 'country_configs', filter: 'code' },
          { table: 'language_configs', filter: 'code' },
          { table: 'zodiac_configs', filter: 'key' },
          { table: 'interest_configs', filter: 'id' },
          { table: 'moderation_reports', filter: 'id' },
        ];

        for (const b of blocks) {
          const { error } = await deleteAllRows(b.table, b.filter);
          recordDelete(b.table, error);
        }
      } catch (err: any) {
        console.warn('[Supabase Admin Reset] taxonomiesAndFlags purge exception:', err?.message || err);
      }
    }

    // 10b. Delete User Daily Rewards Table
    if (options.clearAllUsers || options.creatorGoals || options.dailyRewardsAndQuests) {
      const { error } = await deleteAllRows('user_daily_rewards', 'user_id');
      recordDelete('user_daily_rewards', error);
    }

    // 11. Reset Financial Balances on Profiles Table
    if (options.resetBalances) {
      const updates: any = {};
      if (options.resetBalances.callerCoins) updates.coin_balance = 0;
      if (options.resetBalances.creatorEarnings) {
        updates.earnings_coins = 0;
        updates.total_lifetime_earned_usd = 0;
        updates.total_calls_hosted = 0;
        updates.total_call_minutes = 0;
      }
      if (options.resetBalances.vipTiers) updates.vip_tier = 'none';

      if (Object.keys(updates).length > 0) {
        const { error } = await (client.from('profiles') as any)
          .update(updates)
          .not('id', 'is', null);
        recordDelete('balances_reset', error);
      }
    }

    // 12. Delete User Profiles (Cascade order safe)
    if (options.mockIds && options.mockIds.length > 0) {
      const { error } = await client.from('profiles').delete().in('id', options.mockIds);
      recordDelete(`profiles (${options.mockIds.length} mock users)`, error);
    } else if (options.clearAllUsers) {
      const { error } = await client.from('profiles').delete().neq('role', 'admin');
      recordDelete('profiles (all non-admin users)', error);
    }

    // 13. Admin Account Restoration
    if (options.clearAdmin) {
      const passwordHash = await hashPassword('admin123');
      await (client.from('profiles') as any).upsert({
        id: 'admin_user',
        name: 'Super Admin',
        email: 'admin@livecall.app',
        gender: 'male',
        role: 'admin',
        password_hash: passwordHash,
        has_password_set: true,
        coin_balance: 999999,
        is_verified: true,
        online_status: 'online',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
      clearedTables.push('admin_restored');
    }

    if (failedOps.length > 0) {
      return {
        success: false,
        clearedTables,
        error: `Some reset operations failed: ${failedOps.join('; ')}`,
      };
    }

    return { success: true, clearedTables };
  } catch (err: any) {
    console.error('[Supabase Admin Reset] Exception during database reset:', err);
    return { success: false, clearedTables, error: err.message };
  }
}

/**
 * Partial profile update in Supabase PostgreSQL (by ID or matching email)
 */
export async function updateUserProfileAdmin(
  userId: string,
  updates: Record<string, any>
): Promise<{ success: boolean; data?: any; error?: string }> {
  const client = getSupabaseAdmin();
  if (!client) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const payload: Record<string, any> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.email !== undefined) payload.email = updates.email || null;
    if (updates.phone !== undefined) payload.phone = updates.phone || null;
    if (updates.gender !== undefined) payload.gender = updates.gender;
    if (updates.genderLocked !== undefined || updates.gender_locked !== undefined) {
      payload.gender_locked = updates.genderLocked ?? updates.gender_locked;
    }
    if (updates.age !== undefined) payload.age = Number(updates.age);
    if (updates.dob !== undefined) payload.dob = updates.dob;
    if (updates.nationality !== undefined) payload.nationality = updates.nationality;
    if (updates.countryCode !== undefined || updates.country_code !== undefined) {
      payload.country_code = String(updates.countryCode || updates.country_code).toUpperCase();
    }
    if (updates.bio !== undefined) payload.bio = updates.bio;
    if (updates.extendedBio !== undefined || updates.extended_bio !== undefined) {
      payload.extended_bio = updates.extendedBio || updates.extended_bio || null;
    }
    if (updates.locationCity !== undefined || updates.location_city !== undefined) {
      payload.location_city = updates.locationCity || updates.location_city || null;
    }
    if (updates.zodiac !== undefined) payload.zodiac = updates.zodiac || null;
    if (updates.spokenLanguages !== undefined || updates.spoken_languages !== undefined) {
      payload.spoken_languages = updates.spokenLanguages || updates.spoken_languages;
    }
    if (updates.interests !== undefined) payload.interests = updates.interests;
    if (updates.interestedIn !== undefined || updates.interested_in !== undefined) {
      payload.interested_in = updates.interestedIn || updates.interested_in;
    }
    if (updates.tags !== undefined) payload.tags = updates.tags;
    if (updates.avatarUrl !== undefined || updates.avatar_url !== undefined) {
      payload.avatar_url = updates.avatarUrl || updates.avatar_url;
    }
    if (updates.gallery !== undefined) payload.gallery = updates.gallery;
    if (updates.introVideoUrl !== undefined || updates.intro_video_url !== undefined) {
      payload.intro_video_url = updates.introVideoUrl ?? updates.intro_video_url ?? null;
    }
    if (updates.verificationVideoUrl !== undefined || updates.verification_video_url !== undefined) {
      payload.verification_video_url = updates.verificationVideoUrl ?? updates.verification_video_url ?? null;
    }
    if (updates.isVerified !== undefined || updates.is_verified !== undefined) {
      payload.is_verified = Boolean(updates.isVerified ?? updates.is_verified);
    }
    if (updates.isOnboarded !== undefined || updates.is_onboarded !== undefined) {
      payload.is_onboarded = Boolean(updates.isOnboarded ?? updates.is_onboarded);
    }
    if (updates.role !== undefined) {
      payload.role = updates.role === 'female_host' ? 'female_creator' : updates.role;
    }
    if (updates.coinBalance !== undefined || updates.coin_balance !== undefined) {
      payload.coin_balance = Number(updates.coinBalance ?? updates.coin_balance);
    }
    if (updates.hourlyCoinRate !== undefined || updates.hourly_coin_rate !== undefined) {
      payload.hourly_coin_rate = Number(updates.hourlyCoinRate ?? updates.hourly_coin_rate);
    }
    if (updates.earningsCoins !== undefined || updates.earnings_coins !== undefined) {
      payload.earnings_coins = Number(updates.earningsCoins ?? updates.earnings_coins);
    }
    if (updates.totalLifetimeEarnedUSD !== undefined || updates.total_lifetime_earned_usd !== undefined) {
      payload.total_lifetime_earned_usd = Number(updates.totalLifetimeEarnedUSD ?? updates.total_lifetime_earned_usd);
    }
    if (updates.onlineStatus !== undefined || updates.online_status !== undefined) {
      payload.online_status = updates.onlineStatus || updates.online_status;
    }
    if (updates.vipTier !== undefined || updates.vip_tier !== undefined) {
      payload.vip_tier = updates.vipTier || updates.vip_tier;
    }
    if (updates.teamLeaderId !== undefined || updates.team_leader_id !== undefined) {
      payload.team_leader_id = updates.teamLeaderId ?? updates.team_leader_id ?? null;
    }
    if (updates.createdById !== undefined || updates.created_by_id !== undefined) {
      payload.created_by_id = updates.createdById ?? updates.created_by_id ?? null;
    }
    if (updates.agencyName !== undefined || updates.agency_name !== undefined) {
      payload.agency_name = updates.agencyName ?? updates.agency_name ?? null;
    }
    if (updates.coinEarnOverrideRate !== undefined || updates.coin_earn_override_rate !== undefined) {
      payload.coin_earn_override_rate = updates.coinEarnOverrideRate ?? updates.coin_earn_override_rate ?? null;
    }
    if (updates.commissionPercent !== undefined || updates.commission_percent !== undefined) {
      payload.commission_percent = updates.commissionPercent ?? updates.commission_percent ?? null;
    }
    if (updates.isBanned !== undefined || updates.is_banned !== undefined) {
      payload.is_banned = Boolean(updates.isBanned ?? updates.is_banned);
    }
    if (updates.banReason !== undefined || updates.ban_reason !== undefined) {
      payload.ban_reason = updates.banReason ?? updates.ban_reason ?? null;
    }
    if (updates.isUsingMockLocation !== undefined || updates.is_using_mock_location !== undefined) {
      payload.is_using_mock_location = Boolean(updates.isUsingMockLocation ?? updates.is_using_mock_location);
    }
    if (updates.mockLocationCountry !== undefined || updates.mock_location_country !== undefined) {
      payload.mock_location_country = updates.mockLocationCountry ?? updates.mock_location_country ?? null;
    }
    if (updates.mockLocationCity !== undefined || updates.mock_location_city !== undefined) {
      payload.mock_location_city = updates.mockLocationCity ?? updates.mock_location_city ?? null;
    }
    if (updates.allowMockLocation !== undefined || updates.allow_mock_location !== undefined) {
      payload.allow_mock_location = Boolean(updates.allowMockLocation ?? updates.allow_mock_location);
    }
    if (updates.exactLocation?.latitude !== undefined || updates.latitude !== undefined) {
      payload.latitude = updates.exactLocation?.latitude ?? updates.latitude;
    }
    if (updates.exactLocation?.longitude !== undefined || updates.longitude !== undefined) {
      payload.longitude = updates.exactLocation?.longitude ?? updates.longitude;
    }
    payload.updated_at = new Date().toISOString();

    console.log(`[Supabase Admin] Updating profile columns for ${userId}:`, Object.keys(payload));

    // Try update by id first
    let res = await client.from('profiles').update(payload).eq('id', userId).select().maybeSingle();

    // If 0 rows updated, try matching by auth_id
    if (!res.data) {
      res = await client.from('profiles').update(payload).eq('auth_id', userId).select().maybeSingle();
    }

    // If 0 rows updated and email provided, update by email match
    const cleanEmail = (updates.email || payload.email) ? String(updates.email || payload.email).toLowerCase().trim() : null;
    if (!res.data && cleanEmail) {
      res = await client.from('profiles').update(payload).ilike('email', cleanEmail).select().maybeSingle();
    }

    if (res.error) {
      console.warn('[Supabase Admin] updateUserProfileAdmin error:', res.error.message);
      return { success: false, error: res.error.message };
    }

    return { success: true, data: res.data };
  } catch (err: any) {
    console.warn('[Supabase Admin] updateUserProfileAdmin exception:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Server-Side Admin: Fetch User Daily Rewards State
 */
export async function fetchUserDailyRewardsAdmin(userId: string): Promise<{ success: boolean; data?: any; error?: string }> {
  const client = getSupabaseAdmin();
  if (!client || !userId) return { success: false, error: 'Admin client not available' };
  try {
    const { data, error } = await client
      .from('user_daily_rewards')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Server-Side Admin: Upsert User Daily Rewards State
 */
export async function upsertUserDailyRewardsAdmin(record: any): Promise<{ success: boolean; data?: any; error?: string }> {
  const client = getSupabaseAdmin();
  if (!client || !record?.userId && !record?.user_id) return { success: false, error: 'Admin client not available' };
  try {
    const payload = {
      user_id: record.userId || record.user_id,
      last_login_date: record.lastLoginDate || record.last_login_date,
      streak_count: record.streakCount !== undefined ? record.streakCount : record.streak_count,
      streak_claimed_date: record.streakClaimedDate !== undefined ? record.streakClaimedDate : record.streak_claimed_date,
      tasks_date: record.tasksDate || record.tasks_date,
      task_chat_friends: record.taskChatFriends || record.task_chat_friends || [],
      task_chat_claimed: record.taskChatClaimed !== undefined ? record.taskChatClaimed : record.task_chat_claimed,
      task_quick_matches: record.taskQuickMatches !== undefined ? record.taskQuickMatches : record.task_quick_matches,
      task_quick_match_claimed: record.taskQuickMatchClaimed !== undefined ? record.taskQuickMatchClaimed : record.task_quick_match_claimed,
      task_video_call_seconds: record.taskVideoCallSeconds !== undefined ? record.taskVideoCallSeconds : record.task_video_call_seconds,
      task_video_call_claimed: record.taskVideoCallClaimed !== undefined ? record.taskVideoCallClaimed : record.task_video_call_claimed,
      task_moment_interactions: record.taskMomentInteractions !== undefined ? record.taskMomentInteractions : record.task_moment_interactions,
      task_moment_claimed: record.taskMomentClaimed !== undefined ? record.taskMomentClaimed : record.task_moment_claimed,
      task_gift_count: record.taskGiftCount !== undefined ? record.taskGiftCount : record.task_gift_count,
      task_gift_claimed: record.taskGiftClaimed !== undefined ? record.taskGiftClaimed : record.task_gift_claimed,
      master_chest_claimed: record.masterChestClaimed !== undefined ? record.masterChestClaimed : record.master_chest_claimed,
      total_coins_earned: record.totalCoinsEarned !== undefined ? record.totalCoinsEarned : record.total_coins_earned,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from('user_daily_rewards')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Server-Side Admin: Fetch Creator Metrics
 */
export async function fetchCreatorMetricsAdmin(creatorId?: string): Promise<{ success: boolean; data?: any; error?: string }> {
  const client = getSupabaseAdmin();
  if (!client) return { success: false, error: 'Admin client not available' };
  try {
    let query = client.from('creator_metrics').select('*');
    if (creatorId) {
      query = query.eq('creator_id', creatorId);
    }
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Server-Side Admin: Upsert Creator Metrics
 */
export async function upsertCreatorMetricsAdmin(record: any): Promise<{ success: boolean; data?: any; error?: string }> {
  const client = getSupabaseAdmin();
  if (!client || (!record?.creatorId && !record?.creator_id)) return { success: false, error: 'Admin client not available' };
  try {
    const activeSeconds = Number(record.activeOnlineSeconds !== undefined ? record.activeOnlineSeconds : (record.active_online_seconds || 0));
    const callsOffered = Number(record.totalCallsOffered !== undefined ? record.totalCallsOffered : (record.total_calls_offered || 0));
    const callsAnswered = Number(record.totalCallsAnswered !== undefined ? record.totalCallsAnswered : (record.total_calls_answered || 0));
    const rawHealthScore = callsOffered > 0 ? (callsAnswered / callsOffered) * 100 : Number(record.responseHealthScore ?? record.response_health_score ?? 100);

    const payload = {
      creator_id: record.creatorId || record.creator_id,
      agency_leader_id: record.agencyLeaderId || record.agency_leader_id || null,
      active_online_seconds: activeSeconds,
      active_online_hours: Number((activeSeconds / 3600).toFixed(2)),
      coins_earned_from_calls: Number(record.coinsEarnedFromCalls !== undefined ? record.coinsEarnedFromCalls : (record.coins_earned_from_calls || 0)),
      coins_earned_from_gifts: Number(record.coinsEarnedFromGifts !== undefined ? record.coinsEarnedFromGifts : (record.coins_earned_from_gifts || 0)),
      total_target_coins: Number(record.totalTargetCoins !== undefined ? record.totalTargetCoins : (record.total_target_coins || 0)),
      current_streak_days: Number(record.currentStreakDays !== undefined ? record.currentStreakDays : (record.current_streak_days || 0)),
      streak_boost_until: record.streakBoostUntil || record.streak_boost_until || null,
      last_active_date: record.lastActiveDate || record.last_active_date || new Date().toISOString().split('T')[0],
      first_call_bonus_claimed_date: record.firstCallBonusClaimedDate || record.first_call_bonus_claimed_date || null,
      total_calls_offered: callsOffered,
      total_calls_answered: callsAnswered,
      total_calls_declined: Number(record.totalCallsDeclined !== undefined ? record.totalCallsDeclined : (record.total_calls_declined || 0)),
      total_calls_missed: Number(record.totalCallsMissed !== undefined ? record.totalCallsMissed : (record.total_calls_missed || 0)),
      response_health_score: Number(rawHealthScore.toFixed(1)),
      performance_tier: record.performanceTier || record.performance_tier || 'bronze',
      is_ready_now_active: Boolean(record.isReadyNowActive ?? record.is_ready_now_active),
      ready_now_toggled_at: record.readyNowToggledAt || record.ready_now_toggled_at || null,
      target_period_start: record.targetPeriodStart || record.target_period_start || null,
      target_period_end: record.targetPeriodEnd || record.target_period_end || null,
      bonus_earned_coins: Number(record.bonusEarnedCoins !== undefined ? record.bonusEarnedCoins : (record.bonus_earned_coins || 0)),
      bonus_earned_usd: Number(record.bonusEarnedUSD !== undefined ? record.bonusEarnedUSD : (record.bonus_earned_usd || 0)),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from('creator_metrics')
      .upsert(payload, { onConflict: 'creator_id' })
      .select()
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}



