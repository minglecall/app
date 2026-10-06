import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile, UserRole, OnboardingFormData } from '../types';
import { mapDbProfileToUserProfile, upsertProfileToSupabase, isValidUuid } from './supabaseService';
import { getPasswordPolicyError } from '../../shared/passwordPolicy';
import { authFetch, getAccessToken, apiFetch } from '../utils/apiClient';

export interface SupabaseAuthResult {
  success: boolean;
  user?: UserProfile | null;
  needsOnboarding?: boolean;
  message?: string;
  error?: string;
  session?: any;
  otpCode?: string;
  showOtpInForm?: boolean;
}

const PUBLIC_SIGNUP_ROLES: UserRole[] = [
  'male_user',
  'female_user',
  'female_creator',
  'female_host',
  'other_user',
];

function sanitizeClientSignupRole(role: UserRole | string | undefined): UserRole {
  return PUBLIC_SIGNUP_ROLES.includes(role as UserRole) ? (role as UserRole) : 'male_user';
}

function lockedGenderFromRole(role: UserRole): UserProfile['gender'] {
  if (role === 'female_user' || role === 'female_creator' || role === 'female_host') return 'female';
  if (role === 'other_user') return 'other';
  return 'male';
}

function userSafeAuthError(err: unknown, fallback: string): string {
  if (!err) return fallback;
  const message = typeof err === 'string' ? err : (err as any)?.message;
  if (typeof message !== 'string' || !message.trim()) return fallback;
  const lower = message.toLowerCase();
  if (
    lower.includes('stack') ||
    lower.includes('supabase') ||
    lower.includes('postgres') ||
    lower.includes('smtp') ||
    lower.includes('service_role') ||
    lower.includes('econn') ||
    lower.includes('enotfound') ||
    message.length > 180
  ) {
    return fallback;
  }
  return message;
}

/**
 * Step 1: Register user with Supabase Auth & Trigger Mandatory 6-Digit OTP Email
 */
export async function signUpWithEmailOtp(params: {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
}): Promise<SupabaseAuthResult> {
  const { name, email, password, role } = params;
  const passwordError = getPasswordPolicyError(password);
  if (passwordError || typeof password !== 'string') {
    return { success: false, error: passwordError ?? 'Password is required.' };
  }
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail.includes('@')) {
    return { success: false, error: 'Please provide a valid email address.' };
  }
  const safeRole = sanitizeClientSignupRole(role);
  const lockedGender = lockedGenderFromRole(safeRole);

  // 1. Create Supabase Auth user with the submitted password BEFORE sending OTP
  let createdUserId: string | null = null;
  let capturedOtpCode: string | undefined;
  let capturedShowOtpInForm: boolean | undefined;
  let clientSignUpFailedForBootstrap = false;

  if (isSupabaseConfigured()) {
    try {
      // Existing profile for this email → user must log in / reset password (do not soft-continue)
      const { data: existingByEmail } = await supabase
        .from('profiles')
        .select('id, is_onboarded')
        .ilike('email', cleanEmail)
        .maybeSingle();
      const existingRow = existingByEmail as { id: string; is_onboarded?: boolean } | null;
      if (existingRow?.id) {
        return {
          success: false,
          error: 'An account with this email is already registered. Please log in or use Forgot Password.',
        };
      }

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: name,
            display_name: name,
            name,
            role: safeRole,
            gender: lockedGender,
            is_onboarded: false,
          },
        },
      });

      if ((import.meta as any)?.env?.DEV) {
        console.debug('[signUpWithEmailOtp] signUp result', {
          error: error?.message,
          status: (error as any)?.status,
          userId: data?.user?.id,
          identitiesLen: Array.isArray((data?.user as any)?.identities)
            ? (data?.user as any).identities.length
            : null,
        });
      }

      if (error) {
        const lower = (error.message || '').toLowerCase();
        if (lower.includes('already registered') || lower.includes('already been registered')) {
          return {
            success: false,
            error: 'An account with this email is already registered. Please log in or use Forgot Password.',
          };
        }

        const isRateLimit =
          lower.includes('rate limit') ||
          lower.includes('over_email_send_rate_limit') ||
          lower.includes('too many requests') ||
          (error as any).status === 429;

        const isDbTriggerError =
          lower.includes('database error saving new user') ||
          lower.includes('database error') ||
          lower.includes('unexpected_failure');

        if (isRateLimit || isDbTriggerError) {
          // Prefer server bootstrap rather than the confirmation-settings dead-end
          // Still use user id if Supabase returned one despite the error/rate-limit.
          if (data?.user?.id && isValidUuid(data.user.id)) {
            const identities = (data.user as any).identities;
            if (!(Array.isArray(identities) && identities.length === 0)) {
              createdUserId = data.user.id;
            }
          }
          if (!createdUserId) {
            clientSignUpFailedForBootstrap = true;
            console.warn('[signUpWithEmailOtp] Client signUp recoverable failure:', error.message);
          }
        } else {
          return {
            success: false,
            error: userSafeAuthError(error.message, 'Sign up failed. Please try again.'),
          };
        }
      }

      if (!clientSignUpFailedForBootstrap && data?.user?.id && isValidUuid(data.user.id)) {
        // Supabase may return a user object without identities when the email is already
        // registered (anti-enumeration). That path does NOT set the submitted password.
        const identities = (data.user as any).identities;
        if (Array.isArray(identities) && identities.length === 0) {
          return {
            success: false,
            error: 'An account with this email is already registered. Please log in or use Forgot Password.',
          };
        }
        createdUserId = data.user.id;
      } else if (!clientSignUpFailedForBootstrap && !data?.user) {
        // Empty user without error — treat as already-registered / orphan Auth
        clientSignUpFailedForBootstrap = true;
        console.warn('[signUpWithEmailOtp] signUp returned no user; trying register-bootstrap');
      }
    } catch (err: any) {
      console.warn('[signUpWithEmailOtp] exception:', err);
      clientSignUpFailedForBootstrap = true;
    }

    // Resilient path: service-role bootstrap for orphan Auth / trigger / empty-user cases
    if (!createdUserId && (clientSignUpFailedForBootstrap || !createdUserId)) {
      try {
        const bootRes = await apiFetch('/api/auth/register-bootstrap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            password,
            name,
            role: safeRole,
          }),
        });
        const bootData = await bootRes.json().catch(() => ({}));
        if (bootRes.ok && bootData?.success && bootData?.userId && isValidUuid(bootData.userId)) {
          createdUserId = bootData.userId;
        } else if (bootData?.code === 'ALREADY_REGISTERED' || /already registered/i.test(String(bootData?.error || ''))) {
          return {
            success: false,
            error: 'An account with this email is already registered. Please log in or use Forgot Password.',
          };
        } else if (!createdUserId) {
          return {
            success: false,
            error: userSafeAuthError(
              bootData?.error,
              'Could not create an authenticated account. Please try again or use Forgot Password if you already registered.'
            ),
          };
        }
      } catch (bootErr) {
        console.warn('[signUpWithEmailOtp] register-bootstrap failed:', bootErr);
        return {
          success: false,
          error:
            'Could not create an authenticated account. Please try again or use Forgot Password if you already registered.',
        };
      }
    }

    if (!createdUserId) {
      return {
        success: false,
        error:
          'Could not create an authenticated account. Please try again or use Forgot Password if you already registered.',
      };
    }
  }

  // 2. Dispatch custom 6-digit OTP (also stores pending password for post-verify Auth confirm)
  try {
    const sRes = await apiFetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        name,
        role: safeRole,
        password,
      }),
    });
    const sData = await sRes.json().catch(() => ({}));
    if (!sRes.ok) {
      return {
        success: false,
        error: userSafeAuthError(sData.error, 'Could not send verification email. Please try again.'),
      };
    }
    capturedOtpCode = sData.otpCode;
    capturedShowOtpInForm = sData.showOtpInForm;
  } catch (err) {
    console.warn('Server OTP dispatch error:', err);
    return { success: false, error: 'Could not send verification email. Please try again.' };
  }

  if (!createdUserId && !isSupabaseConfigured()) {
    return {
      success: true,
      message: `A 6-digit verification code has been dispatched to ${cleanEmail}. Please check your email inbox.`,
      needsOnboarding: true,
      otpCode: capturedOtpCode,
      showOtpInForm: capturedShowOtpInForm,
    };
  }

  if (!createdUserId) {
    return {
      success: false,
      error:
        'Could not create an authenticated account. Please try again or use Forgot Password if you already registered.',
    };
  }

  // 3. Persist a minimal pending profile — force sanitized public role/gender (overwrite stale TL)
  const isFemaleRole = lockedGender === 'female';
  const initialProfile: UserProfile = {
    id: createdUserId,
    authId: createdUserId,
    name,
    email: cleanEmail,
    gender: lockedGender,
    genderLocked: true,
    role: safeRole,
    age: 24,
    dob: '2000-01-01',
    nationality: 'United States',
    countryCode: 'US',
    spokenLanguages: ['English'],
    bio: '',
    interests: [],
    avatarUrl: isFemaleRole
      ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400'
      : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=400',
    gallery: [],
    isVerified: false,
    isOnboarded: false,
    onlineStatus: 'online',
    createdAt: new Date().toISOString().split('T')[0],
    coinBalance: isFemaleRole ? 0 : 50,
    hourlyCoinRate: safeRole === 'female_creator' ? 10 : 0,
    earningsCoins: 0,
    totalLifetimeEarnedUSD: 0,
    emailVerified: false,
    agencyName: undefined,
    commissionPercent: undefined,
  };

  try {
    await upsertProfileToSupabase(initialProfile);
  } catch (err) {
    console.warn('Initial profile Supabase upsert error:', err);
  }

  return {
    success: true,
    message: `A 6-digit verification code has been dispatched to ${cleanEmail}. Please check your email inbox.`,
    needsOnboarding: true,
    user: initialProfile,
    otpCode: capturedOtpCode,
    showOtpInForm: capturedShowOtpInForm,
  };
}

/**
 * Step 1b: Verify 6-digit Email OTP code
 */
export async function verifyEmailOtp(
  paramsOrEmail:
    | {
        email: string;
        token: string;
        type?: 'signup' | 'email' | 'recovery';
        role?: UserRole;
        name?: string;
        password?: string;
      }
    | string,
  tokenArg?: string,
  roleArg?: UserRole,
  nameArg?: string
): Promise<SupabaseAuthResult> {
  let email = '';
  let token = '';
  let type: 'signup' | 'email' | 'recovery' = 'signup';
  let role: UserRole | undefined = roleArg;
  let name: string | undefined = nameArg;
  let password: string | undefined;

  if (typeof paramsOrEmail === 'string') {
    email = paramsOrEmail;
    token = tokenArg || '';
  } else if (paramsOrEmail && typeof paramsOrEmail === 'object') {
    email = paramsOrEmail.email;
    token = paramsOrEmail.token;
    if (paramsOrEmail.type) type = paramsOrEmail.type;
    if (paramsOrEmail.role) role = paramsOrEmail.role;
    if (paramsOrEmail.name) name = paramsOrEmail.name;
    if (paramsOrEmail.password) password = paramsOrEmail.password;
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanToken = token.trim();

  // Try real Supabase OTP verification
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: type as any,
      });

      if (!error && data.user) {
        const userId = data.user.id;

        // Fetch profile by auth id OR email (never create a second male for the same inbox)
        let dbProfile: any = null;
        const { data: byId } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (byId) {
          dbProfile = byId;
        } else {
          const { data: byAuth } = await supabase
            .from('profiles')
            .select('*')
            .eq('auth_id', userId)
            .maybeSingle();
          if (byAuth) {
            dbProfile = byAuth;
          } else {
            const { data: byEmail } = await supabase
              .from('profiles')
              .select('*')
              .ilike('email', cleanEmail)
              .maybeSingle();
            dbProfile = byEmail;
          }
        }

        let profile: UserProfile;
        if (dbProfile) {
          profile = mapDbProfileToUserProfile(dbProfile);
          // Public signup verify: force sanitized role/gender (overwrite stale team_leader)
          const forcedRole = role ? sanitizeClientSignupRole(role) : null;
          profile = {
            ...profile,
            authId: userId,
            emailVerified: true,
            ...(forcedRole
              ? {
                  role: forcedRole,
                  gender: lockedGenderFromRole(forcedRole),
                  genderLocked: true,
                  agencyName: undefined,
                  commissionPercent: undefined,
                }
              : {}),
          };
          const needsRoleFix =
            Boolean(forcedRole) &&
            (dbProfile.role !== forcedRole || dbProfile.gender !== lockedGenderFromRole(forcedRole!));
          if (!dbProfile.auth_id || dbProfile.auth_id !== userId || needsRoleFix) {
            await upsertProfileToSupabase({
              ...profile,
              id: profile.id || userId,
              authId: userId,
              emailVerified: true,
            });
          }
        } else {
          // Initialize pending onboarding profile — never trust privileged metadata from client
          const metaRole = sanitizeClientSignupRole(
            (role as UserRole) || (data.user.user_metadata?.role as UserRole) || 'male_user'
          );
          const lockedGender = lockedGenderFromRole(metaRole);
          const isMetaFemale = lockedGender === 'female';
          profile = {
            id: userId,
            authId: userId,
            name: data.user.user_metadata?.full_name || name || cleanEmail.split('@')[0] || 'User',
            email: cleanEmail,
            gender: lockedGender,
            genderLocked: true,
            role: metaRole,
            age: 21,
            dob: '2003-01-01',
            nationality: 'United States',
            countryCode: 'US',
            spokenLanguages: ['English'],
            bio: '',
            interests: [],
            avatarUrl: isMetaFemale
              ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400'
              : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=400',
            gallery: [],
            isVerified: false,
            isOnboarded: false,
            onlineStatus: 'online',
            createdAt: new Date().toISOString().split('T')[0],
            coinBalance: isMetaFemale ? 0 : 50,
            hourlyCoinRate: metaRole === 'female_creator' ? 10 : 0,
            earningsCoins: 0,
            totalLifetimeEarnedUSD: 0,
            emailVerified: true,
          };
          await upsertProfileToSupabase(profile);
        }

        return {
          success: true,
          user: profile,
          needsOnboarding: !profile.isOnboarded,
          message: 'Email successfully verified!',
          session: data.session,
        };
      }

      if (error) {
        console.warn('Supabase verifyOtp error, falling back to server verification:', error.message);
      }
    } catch (err: any) {
      console.warn('Supabase verifyOtp exception:', err);
    }
  }

  // Server-side OTP verification fallback (custom email OTP when Supabase verifyOtp fails)
  try {
    const serverVerifyRes = await apiFetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        token: cleanToken,
        // Activates Auth password + email_confirm for pending signups (required for first login)
        ...(password ? { password } : {}),
      }),
    });
    if (serverVerifyRes.ok) {
      const sData = await serverVerifyRes.json();
      if (sData.success) {
        const metaRole = sanitizeClientSignupRole(
          (role as UserRole) || (sData.metadata?.role as UserRole) || 'male_user'
        );
        const lockedGender = lockedGenderFromRole(metaRole);
        const isMetaFemale = lockedGender === 'female';
        const isMetaOther = lockedGender === 'other';

        // Require a real auth/profile identity — never mint orphan UUIDs for the same inbox
        let resolvedId: string | null = null;
        let existingProfile: UserProfile | null = null;

        if (isSupabaseConfigured()) {
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData.session?.user?.id) {
              resolvedId = sessionData.session.user.id;
            }

            const { data: existingByEmail } = await supabase
              .from('profiles')
              .select('*')
              .ilike('email', cleanEmail)
              .maybeSingle();
            if (existingByEmail) {
              existingProfile = mapDbProfileToUserProfile(existingByEmail);
              resolvedId = resolvedId || existingProfile.id || existingProfile.authId || null;
            }

            if (!resolvedId) {
              const { data: listData } = await supabase.auth.getUser();
              if (listData.user?.id && listData.user.email?.toLowerCase() === cleanEmail) {
                resolvedId = listData.user.id;
              }
            }
          } catch (e) {
            console.warn('Email profile lookup during OTP fallback failed:', e);
          }
        }

        if (!resolvedId || !isValidUuid(resolvedId)) {
          return {
            success: false,
            error:
              'Email code verified, but no authenticated account was found. Please complete registration again or sign in.',
          };
        }

        const displayName =
          existingProfile?.name ||
          sData.metadata?.name ||
          name ||
          cleanEmail.split('@')[0] ||
          'User';

        const verifiedUser: UserProfile = existingProfile
          ? {
              ...existingProfile,
              id: existingProfile.id || resolvedId,
              authId: existingProfile.authId || resolvedId,
              name: existingProfile.name && existingProfile.name !== 'New Member' && existingProfile.name !== 'Member'
                ? existingProfile.name
                : displayName,
              // Force public signup role over stale TL/admin rows
              role: metaRole,
              gender: lockedGender,
              genderLocked: true,
              agencyName: undefined,
              commissionPercent: undefined,
              emailVerified: true,
              isOnboarded: Boolean(existingProfile.isOnboarded),
            }
          : {
              id: resolvedId,
              authId: resolvedId,
              name: displayName,
              email: cleanEmail,
              gender: lockedGender,
              genderLocked: true,
              role: metaRole,
              age: 21,
              dob: '2003-01-01',
              nationality: 'United States',
              countryCode: 'US',
              spokenLanguages: ['English'],
              bio: '',
              interests: [],
              avatarUrl: isMetaFemale
                ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400'
                : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=400',
              gallery: [],
              isVerified: false,
              isOnboarded: false,
              onlineStatus: 'online',
              createdAt: new Date().toISOString().split('T')[0],
              coinBalance: isMetaFemale ? 0 : 50,
              hourlyCoinRate: metaRole === 'female_creator' ? 10 : 0,
              earningsCoins: 0,
              totalLifetimeEarnedUSD: 0,
              emailVerified: true,
            };

        try {
          await upsertProfileToSupabase({
            ...verifiedUser,
            role: metaRole,
            gender: lockedGender,
            emailVerified: true,
          });
        } catch (e) {
          console.warn('Upsert verified user error:', e);
        }

        return {
          success: true,
          user: verifiedUser,
          needsOnboarding: !verifiedUser.isOnboarded,
          message: '6-digit OTP code verified successfully!',
        };
      }
    } else {
      const failData = await serverVerifyRes.json().catch(() => ({}));
      if (failData?.error) {
        return {
          success: false,
          error: userSafeAuthError(failData.error, 'Invalid or expired 6-digit verification code.'),
        };
      }
    }
  } catch (e) {
    console.warn('Server verify check error:', e);
  }

  return {
    success: false,
    error: 'Invalid or expired 6-digit verification code. Please check your email inbox.',
  };
}

/**
 * Resend OTP Code
 */
export async function resendEmailOtp(email: string): Promise<{ success: boolean; message: string; error?: string; otpCode?: string; showOtpInForm?: boolean }> {
  const cleanEmail = email.trim().toLowerCase();
  let serverOtpCode: string | undefined;
  let serverShowOtpInForm: boolean | undefined;

  // 1. Trigger server email dispatch
  try {
    const sRes = await apiFetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail }),
    });
    if (sRes.ok) {
      const data = await sRes.json();
      serverOtpCode = data.otpCode;
      serverShowOtpInForm = data.showOtpInForm;
      return {
        success: true,
        message: data.message || `A fresh 6-digit verification code has been dispatched to ${cleanEmail}.`,
        otpCode: data.otpCode,
        showOtpInForm: data.showOtpInForm,
      };
    }
  } catch (e) {
    console.warn('Server resend error:', e);
  }

  // 2. Trigger Supabase resend if configured
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
      });

      if (!error) {
        return {
          success: true,
          message: 'A fresh 6-digit verification code & confirmation link have been dispatched to your email.',
          otpCode: serverOtpCode,
          showOtpInForm: serverShowOtpInForm,
        };
      }
      
      const isRateLimit =
        error.message.toLowerCase().includes('rate limit') ||
        error.message.toLowerCase().includes('over_email_send_rate_limit') ||
        (error as any).status === 429;
      
      if (isRateLimit) {
        return {
          success: true,
          message: `A fresh 6-digit verification code has been dispatched to ${cleanEmail}.`,
          otpCode: serverOtpCode,
          showOtpInForm: serverShowOtpInForm,
        };
      }
    } catch (e) {
      console.warn('Resend OTP error:', e);
    }
  }

  return {
    success: true,
    message: `Verification code sent to ${cleanEmail}. Please check your inbox.`,
    otpCode: serverOtpCode,
    showOtpInForm: serverShowOtpInForm,
  };
}

/**
 * Password Login with Supabase / Server backend
 */
export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<SupabaseAuthResult> {
  const cleanEmail = email.trim().toLowerCase();
  if (!password || password.trim().length === 0) {
    return { success: false, error: 'Invalid email or password. Please check your credentials.' };
  }

  // Prefer native Supabase Auth — exact password required (no hash fallback, no padding tricks)
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error || !data?.user) {
        const raw = (error?.message || '').toLowerCase();
        if (raw.includes('email not confirmed') || raw.includes('not confirmed')) {
          return {
            success: false,
            error:
              'Please verify your email with the 6-digit code we sent before signing in. You can also use Forgot Password.',
          };
        }
        return {
          success: false,
          error: 'Invalid email or password. Please check your credentials.',
        };
      }

      let dbProfile: any = null;
      const { data: byEmail } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (byEmail) {
        dbProfile = byEmail;
      } else {
        const { data: byId } = await supabase
          .from('profiles')
          .select('*')
          .or(`id.eq.${data.user.id},auth_id.eq.${data.user.id}`)
          .maybeSingle();
        dbProfile = byId;
      }

      if (dbProfile) {
        const profile = mapDbProfileToUserProfile(dbProfile);
        if (!profile.authId || profile.authId !== data.user.id) {
          profile.authId = data.user.id;
          (supabase.from('profiles') as any).update({ auth_id: data.user.id }).eq('id', profile.id).then(() => {});
        }

        if (profile.isBanned) {
          const bannedUntil = profile.bannedUntil;
          if (bannedUntil && new Date(bannedUntil).getTime() > Date.now()) {
            const banner = profile.bannedByRole === 'team_leader' ? 'your Team Leader' : 'Administration';
            const reason = profile.banReason || 'Policy review';
            await supabase.auth.signOut();
            return {
              success: false,
              error: `Your host account has been suspended by ${banner} until ${new Date(bannedUntil).toLocaleString()}.\nReason: "${reason}". Please contact your agency manager.`,
            };
          } else if (!bannedUntil) {
            await supabase.auth.signOut();
            return {
              success: false,
              error: `Your account has been permanently suspended. Reason: "${profile.banReason || 'Policy violation'}"`,
            };
          }
        }

        return {
          success: true,
          user: profile,
          needsOnboarding: !profile.isOnboarded,
          session: data.session,
        };
      }

      // Auth OK but no profiles row — deleted / orphan Auth. Never invent a synthetic profile.
      await supabase.auth.signOut();
      return {
        success: false,
        error: 'Account not found or was deleted. Please register again.',
      };
    } catch (err: any) {
      console.warn('Supabase signIn exception:', err);
      return {
        success: false,
        error: 'Unable to connect to authentication server.',
      };
    }
  }

  // Server Auth-only verification when client Supabase is not configured
  try {
    const res = await apiFetch('/api/auth/login-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password }),
    });

    const data = await res.json();
    if (res.ok && data.success && data.user) {
      if (data.session?.access_token && data.session?.refresh_token && isSupabaseConfigured()) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        if (sessionError) {
          console.warn('Could not persist auth session after password login:', sessionError.message);
        }
      }
      return {
        success: true,
        user: data.user,
        needsOnboarding: !data.user.isOnboarded,
        session: data.session,
      };
    }
    return {
      success: false,
      error: data.error || 'Invalid email or password. Please check your credentials.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'Unable to connect to authentication server.',
    };
  }
}

/**
 * Request a password-reset OTP email (no password change until /reset-password).
 */
export async function requestPasswordResetOtp(email: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  otpCode?: string;
  showOtpInForm?: boolean;
}> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail.includes('@')) {
    return { success: false, error: 'Please provide a valid email address.' };
  }

  try {
    const sRes = await apiFetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        name: 'User',
        role: 'male_user',
      }),
    });
    const data = await sRes.json().catch(() => ({}));
    if (!sRes.ok) {
      return {
        success: false,
        error: data.error || 'Failed to send password reset code.',
      };
    }
    return {
      success: true,
      message: data.message || `A reset code was sent to ${cleanEmail}.`,
      otpCode: data.otpCode,
      showOtpInForm: data.showOtpInForm,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to send password reset code.' };
  }
}

/**
 * Complete password reset after OTP verification (server enforces policy + OTP).
 */
export async function resetPasswordWithOtp(params: {
  email: string;
  token: string;
  newPassword: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  const policyError = getPasswordPolicyError(params.newPassword);
  if (policyError) {
    return { success: false, error: policyError, message: policyError };
  }

  try {
    const res = await apiFetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: params.email.trim().toLowerCase(),
        token: params.token.trim(),
        newPassword: params.newPassword,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Password reset failed.',
        message: data.error || 'Password reset failed.',
      };
    }
    return {
      success: true,
      message: data.message || 'Password reset successfully.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Password reset failed.',
      message: err?.message || 'Password reset failed.',
    };
  }
}

/**
 * Update user password across client Supabase session and server backend
 */
export async function updateUserPassword(params: {
  userId: string;
  email?: string;
  newPassword: string;
}): Promise<{ success: boolean; message: string; error?: string }> {
  const { newPassword } = params;

  const passwordError = getPasswordPolicyError(newPassword);
  if (passwordError) {
    return { success: false, message: passwordError, error: passwordError };
  }

  const token = await getAccessToken();
  if (!token && isSupabaseConfigured()) {
    return {
      success: false,
      message: 'You must be signed in to change your password.',
      error: 'You must be signed in to change your password.',
    };
  }

  let clientUpdated = false;

  // 1. Try updating active Supabase client session if available
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        console.warn('Client Supabase updateUser notice:', error.message);
      } else {
        clientUpdated = true;
      }
    } catch (e: any) {
      console.warn('Supabase client password update exception:', e?.message || e);
    }
  }

  // 2. Call server update-password API (updates Supabase Auth via admin and server memory)
  try {
    const res = await apiFetch('/api/auth/update-password', {
      method: 'POST',
      headers: await (await import('../utils/apiClient')).authHeaders(),
      body: JSON.stringify({ newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return { success: true, message: data.message || 'Password updated successfully!' };
    }
    if (!clientUpdated) {
      const errMsg = userSafeAuthError(data.error, 'Failed to update password.');
      return { success: false, message: errMsg, error: errMsg };
    }
    // Client session updated even if server echo failed
    return { success: true, message: 'Password updated successfully!' };
  } catch (err: any) {
    console.warn('Server password update API exception:', err);
    if (clientUpdated) {
      return { success: true, message: 'Password updated successfully!' };
    }
    return {
      success: false,
      message: 'Failed to update password. Please try again.',
      error: 'Failed to update password. Please try again.',
    };
  }
}


/**
 * Step 2: Complete Profile Onboarding Wizard & save to Supabase (via authenticated Express path)
 */
export async function completeUserProfileOnboarding(
  currentUser: UserProfile,
  formData: OnboardingFormData
): Promise<{ success: boolean; updatedProfile?: UserProfile; error?: string }> {
  if (!currentUser?.id) {
    return { success: false, error: 'Missing authenticated user. Please sign in again.' };
  }

  if (isSupabaseConfigured()) {
    const token = await getAccessToken();
    if (!token) {
      return {
        success: false,
        error: 'Your session expired. Please sign in again to finish profile setup.',
      };
    }
  }

  if (!formData.agreedToTerms) {
    return { success: false, error: 'You must agree to the Platform Terms of Service.' };
  }

  const lockedRole = sanitizeClientSignupRole(currentUser.role);
  const lockedGender = lockedGenderFromRole(lockedRole);
  const isFemaleHost = lockedRole === 'female_creator' || lockedRole === 'female_host';

  if (formData.age < 18) {
    return { success: false, error: 'You must be 18 years or older to use this service.' };
  }

  if (!isFemaleHost && !formData.agreedToAdultTerms) {
    return { success: false, error: 'You must acknowledge the 18+ Adult & Content Policy.' };
  }

  if (isFemaleHost && !formData.agreedToHostTerms) {
    return { success: false, error: 'You must accept the Host Code of Conduct.' };
  }

  // Safe onboarding fields only — never send wallet/role/ban privileged mutations
  const safeUpdates: Partial<UserProfile> = {
    dob: formData.dob,
    age: formData.age,
    gender: lockedGender,
    genderLocked: true,
    nationality: formData.nationality,
    countryCode: formData.countryCode,
    zodiac: formData.zodiac || currentUser.zodiac,
    spokenLanguages: formData.spokenLanguages,
    bio: formData.bio,
    interests: formData.interests,
    interestedIn: formData.interestedIn,
    tags: formData.tags,
    avatarUrl: formData.avatarUrl || currentUser.avatarUrl,
    gallery: formData.gallery.length > 0 ? formData.gallery : currentUser.gallery,
    introVideoUrl: formData.introVideoUrl || currentUser.introVideoUrl,
    agreedToTerms: formData.agreedToTerms,
    agreedToAdultTerms: formData.agreedToAdultTerms,
    agreedToHostTerms: formData.agreedToHostTerms,
    isOnboarded: true,
    onboardingStep: 4,
    kycStatus: 'unsubmitted',
  };

  // Host rate may be set during onboarding; stripPrivileged keeps role/wallet/ban off the wire
  if (isFemaleHost) {
    safeUpdates.hourlyCoinRate = formData.hourlyCoinRate || currentUser.hourlyCoinRate || 10;
  }

  const updatedProfile: UserProfile = {
    ...currentUser,
    ...safeUpdates,
    role: lockedRole,
    gender: lockedGender,
    genderLocked: true,
    // Preserve authoritative privileged fields from existing profile — do not invent client values
    coinBalance: currentUser.coinBalance,
    earningsCoins: currentUser.earningsCoins,
    totalLifetimeEarnedUSD: currentUser.totalLifetimeEarnedUSD,
    isBanned: currentUser.isBanned,
    isVerified: currentUser.isVerified,
    isOnboarded: true,
  };

  try {
    const res = await authFetch('/api/supabase/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        updates: safeUpdates,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      // Fallback: authenticated upsert (also strips privileged fields server-side for non-admins)
      const upsertRes = await authFetch('/api/supabase/upsert-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProfile),
      });
      const upsertData = await upsertRes.json().catch(() => ({}));
      if (!upsertRes.ok || !upsertData.success) {
        return {
          success: false,
          error: userSafeAuthError(
            data.error || upsertData.error,
            'Could not save your profile. Please try again.'
          ),
        };
      }
      const persisted = upsertData.user
        ? { ...updatedProfile, ...upsertData.user, isOnboarded: true, role: lockedRole }
        : updatedProfile;
      return { success: true, updatedProfile: persisted };
    }

    return { success: true, updatedProfile };
  } catch (err) {
    console.error('Error completing onboarding profile:', err);
    return {
      success: false,
      error: 'Could not save your profile. Please try again.',
    };
  }
}

/**
 * Sign Out
 */
export async function signOutSupabase(): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Sign out warning:', e);
    }
  }
}
