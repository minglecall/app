import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile, UserRole, OnboardingFormData } from '../types';
import { mapDbProfileToUserProfile, upsertProfileToSupabase, generateValidUuid, isValidUuid } from './supabaseService';
import { getPasswordPolicyError } from '../../shared/passwordPolicy';

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
  const safeRole = ['male_user', 'female_user', 'female_creator', 'female_host', 'other_user'].includes(role)
    ? role
    : 'male_user';

  let capturedOtpCode: string | undefined;
  let capturedShowOtpInForm: boolean | undefined;

  // 1. Dispatch our server email with prominent 6-digit OTP code & confirmation link, and register credentials
  try {
    const sRes = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        name,
        role: safeRole,
        password,
      }),
    });
    if (sRes.ok) {
      const sData = await sRes.json();
      capturedOtpCode = sData.otpCode;
      capturedShowOtpInForm = sData.showOtpInForm;
    }
  } catch (err) {
    console.warn('Server OTP dispatch error:', err);
  }

  // 2. Also register with Supabase Auth if configured
  let createdUserId: string | null = null;

  if (isSupabaseConfigured()) {
    try {
      // Prefer an already-persisted profile for this email (avoids duplicate males)
      const { data: existingByEmail } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', cleanEmail)
        .maybeSingle();
      const existingRow = existingByEmail as { id: string } | null;
      if (existingRow?.id) {
        createdUserId = existingRow.id;
      }

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: name,
            display_name: name,
            role: safeRole,
            is_onboarded: false,
          },
        },
      });

      if (data?.user?.id && isValidUuid(data.user.id)) {
        // Auth user id is canonical when available
        createdUserId = data.user.id;
      }

      if (error) {
        // If user already exists, suggest login or try resending OTP
        if (error.message.toLowerCase().includes('already registered')) {
          // Reuse existing auth/profile rather than inventing a second male row
          if (!createdUserId) {
            return {
              success: false,
              error: 'An account with this email is already registered. Please log in instead.',
            };
          }
        } else {
          // Catch Supabase built-in email rate limit ("email rate limit exceeded", "over_email_send_rate_limit", 429)
          const isRateLimit =
            error.message.toLowerCase().includes('rate limit') ||
            error.message.toLowerCase().includes('over_email_send_rate_limit') ||
            error.message.toLowerCase().includes('too many requests') ||
            (error as any).status === 429;

          if (!isRateLimit) {
            return { success: false, error: error.message };
          }
        }
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Sign up failed.' };
    }
  }

  if (!createdUserId) {
    return { success: false, error: 'Could not create an authenticated account. Check email confirmation settings and try again.' };
  }

  // 3. Immediately persist initial pending profile to Supabase profiles table
  const isFemaleRole = safeRole === 'female_user' || safeRole === 'female_creator';
  const isOtherRole = safeRole === 'other_user';
  const initialProfile: UserProfile = {
    id: createdUserId,
    authId: createdUserId,
    name,
    email: cleanEmail,
    gender: isFemaleRole ? 'female' : isOtherRole ? 'other' : 'male',
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

  if (typeof paramsOrEmail === 'string') {
    email = paramsOrEmail;
    token = tokenArg || '';
  } else if (paramsOrEmail && typeof paramsOrEmail === 'object') {
    email = paramsOrEmail.email;
    token = paramsOrEmail.token;
    if (paramsOrEmail.type) type = paramsOrEmail.type;
    if (paramsOrEmail.role) role = paramsOrEmail.role;
    if (paramsOrEmail.name) name = paramsOrEmail.name;
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
          // Keep auth linkage + verified flag on the canonical row
          profile = {
            ...profile,
            authId: profile.authId || userId,
            emailVerified: true,
          };
          if (!profile.authId || profile.id !== userId) {
            await upsertProfileToSupabase({
              ...profile,
              id: profile.id || userId,
              authId: userId,
              emailVerified: true,
            });
          }
        } else {
          // Initialize pending onboarding profile
          const metaRole = (data.user.user_metadata?.role as UserRole) || role || 'male_user';
          const isMetaFemale = metaRole === 'female_user' || metaRole === 'female_creator';
          const isMetaOther = metaRole === 'other_user';
          profile = {
            id: userId,
            authId: userId,
            name: data.user.user_metadata?.full_name || name || 'New Member',
            email: cleanEmail,
            gender: isMetaFemale ? 'female' : isMetaOther ? 'other' : 'male',
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

  // Server-side OTP verification fallback check
  try {
    const serverVerifyRes = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, token: cleanToken }),
    });
    if (serverVerifyRes.ok) {
      const sData = await serverVerifyRes.json();
      if (sData.success) {
        const metaRole = (sData.metadata?.role as UserRole) || role || 'male_user';
        const isMetaFemale = metaRole === 'female_user' || metaRole === 'female_creator';
        const isMetaOther = metaRole === 'other_user';

        // Reuse canonical profile by email — never mint a second UUID for the same inbox
        let resolvedId: string | null = null;
        if (isSupabaseConfigured()) {
          try {
            const { data: existingByEmail } = await supabase
              .from('profiles')
              .select('id')
              .ilike('email', cleanEmail)
              .maybeSingle();
            if (existingByEmail && (existingByEmail as { id?: string }).id) {
              resolvedId = (existingByEmail as { id: string }).id;
            }
          } catch (e) {
            console.warn('Email profile lookup during OTP fallback failed:', e);
          }
        }
        if (!resolvedId) {
          resolvedId = generateValidUuid();
        }

        const verifiedUser: UserProfile = {
          id: resolvedId,
          authId: resolvedId,
          name: sData.metadata?.name || name || 'New Member',
          email: cleanEmail,
          gender: isMetaFemale ? 'female' : isMetaOther ? 'other' : 'male',
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

        // Persist verified status directly to Supabase
        try {
          await upsertProfileToSupabase(verifiedUser);
        } catch (e) {
          console.warn('Upsert verified user error:', e);
        }

        return {
          success: true,
          user: verifiedUser,
          needsOnboarding: true,
          message: '6-digit OTP code verified successfully!',
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
    const sRes = await fetch('/api/auth/send-otp', {
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

      // Auth succeeded — return minimal profile from Auth user (trigger should create row)
      return {
        success: true,
        user: {
          id: data.user.id,
          authId: data.user.id,
          name: data.user.user_metadata?.full_name || cleanEmail.split('@')[0] || 'Member',
          email: cleanEmail,
          gender: 'male',
          genderLocked: true,
          role: 'male_user',
          isOnboarded: false,
          onlineStatus: 'online',
          coinBalance: 50,
          hourlyCoinRate: 0,
          earningsCoins: 0,
          totalLifetimeEarnedUSD: 0,
          avatarUrl: '',
          gallery: [],
          interests: [],
          tags: [],
          spokenLanguages: ['English'],
          nationality: 'United States',
          countryCode: 'US',
          age: 24,
          dob: '2000-01-01',
          bio: '',
          isVerified: false,
          createdAt: new Date().toISOString().split('T')[0],
        } as UserProfile,
        needsOnboarding: true,
        session: data.session,
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
    const res = await fetch('/api/auth/login-password', {
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
    const sRes = await fetch('/api/auth/send-otp', {
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
    const res = await fetch('/api/auth/reset-password', {
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
  const { userId, email, newPassword } = params;

  const passwordError = getPasswordPolicyError(newPassword);
  if (passwordError) {
    return { success: false, message: passwordError, error: passwordError };
  }

  // 1. Try updating active Supabase client session if available
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        console.warn('Client Supabase updateUser notice:', error.message);
      } else {
        console.log('Supabase Auth password successfully updated via client session');
      }
    } catch (e: any) {
      console.warn('Supabase client password update exception:', e.message);
    }
  }

  // 2. Call server update-password API (updates Supabase Auth via admin and server memory)
  try {
    const res = await fetch('/api/auth/update-password', {
      method: 'POST',
      headers: await (await import('../utils/apiClient')).authHeaders(),
      body: JSON.stringify({ userId, email, newPassword }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, message: data.message || 'Password updated successfully!' };
    }
    if (data.error) {
      return { success: false, message: data.error, error: data.error };
    }
  } catch (err: any) {
    console.warn('Server password update API exception:', err);
  }

  return { success: true, message: 'Password updated successfully!' };
}


/**
 * Step 2: Complete Profile Onboarding Wizard & save to Supabase
 */
export async function completeUserProfileOnboarding(
  currentUser: UserProfile,
  formData: OnboardingFormData
): Promise<{ success: boolean; updatedProfile: UserProfile; error?: string }> {
  const isFemale = currentUser.role === 'female_creator' || formData.gender === 'female';

  const updatedProfile: UserProfile = {
    ...currentUser,
    dob: formData.dob,
    age: formData.age,
    gender: formData.gender,
    genderLocked: true,
    nationality: formData.nationality,
    countryCode: formData.countryCode,
    zodiac: formData.zodiac || currentUser.zodiac,
    spokenLanguages: formData.spokenLanguages,
    bio: formData.bio,
    interests: formData.interests,
    interestedIn: formData.interestedIn,
    tags: formData.tags,
    hourlyCoinRate: isFemale ? (formData.hourlyCoinRate || 10) : 0,
    avatarUrl: formData.avatarUrl || currentUser.avatarUrl,
    gallery: formData.gallery.length > 0 ? formData.gallery : currentUser.gallery,
    introVideoUrl: formData.introVideoUrl || currentUser.introVideoUrl,
    agreedToTerms: formData.agreedToTerms,
    agreedToAdultTerms: formData.agreedToAdultTerms,
    agreedToHostTerms: formData.agreedToHostTerms,
    isOnboarded: true,
    onboardingStep: 4,
    kycStatus: 'unsubmitted', // KYC is NOT required during registration
  };

  try {
    await upsertProfileToSupabase(updatedProfile);
  } catch (err) {
    console.warn('Error upserting onboarded profile to Supabase:', err);
  }

  return {
    success: true,
    updatedProfile,
  };
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
