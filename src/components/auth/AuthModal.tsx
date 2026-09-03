import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Lock,
  CheckCircle2,
  Shield,
  Smartphone,
  Mail,
  User,
  Sparkles,
  ArrowRight,
  LogIn,
  KeyRound,
  AlertCircle,
  RefreshCw,
  Check,
  Copy,
  Loader2,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react';
import { UserRole, UserProfile } from '../../types';
import {
  signUpWithEmailOtp,
  verifyEmailOtp,
  signInWithEmailPassword,
  resendEmailOtp,
  requestPasswordResetOtp,
  resetPasswordWithOtp,
} from '../../services/supabaseAuthService';
import { OnboardingWizard } from '../onboarding/OnboardingWizard';
import { PasswordStrengthField } from './PasswordStrengthField';
import { evaluatePasswordStrength, getPasswordPolicyError } from '../../../shared/passwordPolicy';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  defaultRole?: UserRole;
  onNavigateToTab?: (tab: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  defaultRole = 'male_user',
  onNavigateToTab,
}) => {
  const { completeAuthenticatedLogin, showToast, updateUserProfile } = useApp();

  const [mode, setMode] = useState<'login' | 'register' | 'reset'>(initialMode);
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');

  // Register Form State
  const [selectedRole, setSelectedRole] = useState<UserRole>(defaultRole);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dob, setDob] = useState('2000-01-01');
  const [age, setAge] = useState(24);

  // OTP Verification State
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpTimer, setOtpTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [receivedOtpCode, setReceivedOtpCode] = useState<string | null>(null);
  const [copiedOtp, setCopiedOtp] = useState(false);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Onboarding Screen State
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingProfile, setOnboardingProfile] = useState<UserProfile | null>(null);

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPhoneOtp, setLoginPhoneOtp] = useState('');
  const [loginPhoneOtpSent, setLoginPhoneOtpSent] = useState(false);

  // Password reset
  const [resetEmail, setResetEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetOtpSent, setResetOtpSent] = useState(false);

  // UI / Error / Loading States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setSelectedRole(defaultRole);
      setShowOtpScreen(false);
      setShowOnboarding(false);
      setErrorMessage(null);
      setSuccessMessage(null);
      setShowLoginPassword(false);
      setReceivedOtpCode(null);
      setCopiedOtp(false);
      setIsLoading(false);
      setResetOtpSent(false);
      setResetPassword('');
      setResetConfirmPassword('');
      setAuthMethod('email');
    }
  }, [isOpen, initialMode, defaultRole]);

  // OTP Timer countdown (registration OTP screen + password reset)
  useEffect(() => {
    let interval: any = null;
    const otpActive = showOtpScreen || (mode === 'reset' && resetOtpSent);
    if (otpActive && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    } else if (otpTimer === 0) {
      setCanResend(true);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showOtpScreen, resetOtpSent, mode, otpTimer]);

  if (!isOpen) return null;

  // ============================================================================
  // REGISTRATION & OTP HANDLERS
  // ============================================================================

  const handleStartRegistration = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validation
    if (!name.trim()) {
      setErrorMessage('Please enter your full name or display handle.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please provide a valid email address.');
      return;
    }
    const passwordError = getPasswordPolicyError(password);
    if (passwordError) {
      setErrorMessage(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please check again.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await signUpWithEmailOtp({
        email: email.trim(),
        password,
        name: name.trim(),
        role: selectedRole,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Registration failed. Please try again.');
        setIsLoading(false);
        return;
      }

      if (res.otpCode) {
        setReceivedOtpCode(res.otpCode);
      }

      setSuccessMessage(`A 6-digit verification code has been dispatched to ${email}. Please check your inbox.`);
      setShowOtpScreen(true);
      setOtpTimer(60);
      setCanResend(false);
      setOtpDigits(['', '', '', '', '', '']);

      // Focus first OTP box
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
    } catch (err: any) {
      console.error('Registration exception:', err);
      setErrorMessage(err.message || 'An error occurred during account creation.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpDigitChange = (index: number, val: string) => {
    if (val.length > 1) {
      // User pasted multiple characters (e.g. 6-digit code)
      const cleaned = val.replace(/\D/g, '').slice(0, 6);
      if (cleaned.length > 0) {
        const newDigits = [...otpDigits];
        for (let i = 0; i < 6; i++) {
          newDigits[i] = cleaned[i] || '';
        }
        setOtpDigits(newDigits);
        const nextIndex = Math.min(cleaned.length, 5);
        otpInputRefs.current[nextIndex]?.focus();
        if (cleaned.length === 6 && mode !== 'reset') {
          handleVerifyOtpCode(cleaned);
        }
        return;
      }
    }

    const singleDigit = val.slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = singleDigit;
    setOtpDigits(newDigits);

    if (singleDigit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    const fullCode = newDigits.join('');
    if (fullCode.length === 6 && !newDigits.includes('') && mode !== 'reset') {
      handleVerifyOtpCode(fullCode);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtpCode = async (tokenString?: string) => {
    const token = tokenString || otpDigits.join('');
    if (token.length < 6) {
      setErrorMessage('Please enter the complete 6-digit code received in your email.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await verifyEmailOtp(email.trim(), token, selectedRole, name.trim());
      if (!res.success || !res.user) {
        setErrorMessage(res.error || 'Invalid or expired verification code. Please check your email inbox.');
        setIsLoading(false);
        return;
      }

      showToast('Email Verified Successfully! 🟢', 'Proceeding to Profile Setup...', 'success');
      
      // Check if user is already onboarded or needs wizard
      if (res.user.isOnboarded) {
        completeAuthenticatedLogin(res.user);
        if (onNavigateToTab) {
          if (res.user.role === 'admin') {
            onNavigateToTab('admin');
          } else if (res.user.role === 'team_leader') {
            onNavigateToTab('team_leader');
          } else {
            onNavigateToTab('profile');
          }
        }
        onClose();
      } else {
        setOnboardingProfile({
          ...res.user,
          dob: dob || res.user.dob || '2000-01-01',
          age: age || res.user.age || 24,
        });
        setShowOnboarding(true);
      }
    } catch (err: any) {
      console.error('Verify OTP exception:', err);
      setErrorMessage(err.message || 'OTP verification failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend || !email) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await resendEmailOtp(email);
      if (res.success) {
        if (res.otpCode) {
          setReceivedOtpCode(res.otpCode);
        }
        setSuccessMessage('A fresh 6-digit verification code has been dispatched to your email inbox.');
        setOtpTimer(60);
        setCanResend(false);
      } else {
        setErrorMessage(res.error || 'Failed to resend code.');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Resend failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // LOGIN HANDLERS
  // ============================================================================

  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (authMethod === 'phone') {
      setErrorMessage('Phone login is disabled. Please sign in with email and password.');
      return;
    }

    if (!loginEmail.trim()) {
      setErrorMessage('Please enter your Email or Username.');
      return;
    }
    if (!loginPassword) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await signInWithEmailPassword(loginEmail.trim(), loginPassword);
      if (!res.success || !res.user) {
        setErrorMessage(res.error || 'Invalid email or password. Please check your credentials.');
        setIsLoading(false);
        return;
      }

      // Check onboarding state
      if (!res.user.isOnboarded) {
        setOnboardingProfile(res.user);
        setShowOnboarding(true);
      } else {
        completeAuthenticatedLogin(res.user);
        showToast('Welcome Back! 👋', `Logged in as ${res.user.name}`, 'success');
        if (onNavigateToTab) {
          if (res.user.role === 'admin') {
            onNavigateToTab('admin');
          } else if (res.user.role === 'team_leader') {
            onNavigateToTab('team_leader');
          } else {
            onNavigateToTab('profile');
          }
        }
        onClose();
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMessage(err.message || 'Authentication error.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestResetOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    const targetEmail = resetEmail.trim().toLowerCase();
    if (!targetEmail.includes('@')) {
      setErrorMessage('Please provide a valid email address.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await requestPasswordResetOtp(targetEmail);
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to send reset code.');
        return;
      }
      if (res.otpCode) setReceivedOtpCode(res.otpCode);
      setResetOtpSent(true);
      setOtpDigits(['', '', '', '', '', '']);
      setOtpTimer(60);
      setCanResend(false);
      setSuccessMessage(`A 6-digit reset code was sent to ${targetEmail}.`);
      setTimeout(() => otpInputRefs.current[0]?.focus(), 150);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send reset code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompletePasswordReset = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    const code = otpDigits.join('');
    if (code.length !== 6) {
      setErrorMessage('Please enter the full 6-digit verification code.');
      return;
    }
    const passwordError = getPasswordPolicyError(resetPassword);
    if (passwordError) {
      setErrorMessage(passwordError);
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      setErrorMessage('Passwords do not match. Please check again.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await resetPasswordWithOtp({
        email: resetEmail.trim(),
        token: code,
        newPassword: resetPassword,
      });
      if (!res.success) {
        setErrorMessage(res.error || 'Password reset failed.');
        return;
      }
      setSuccessMessage(res.message || 'Password updated. You can sign in now.');
      showToast('Password Reset', 'Your password was updated. Please sign in.', 'success');
      setMode('login');
      setLoginEmail(resetEmail.trim());
      setLoginPassword('');
      setResetOtpSent(false);
      setResetPassword('');
      setResetConfirmPassword('');
      setReceivedOtpCode(null);
      setOtpDigits(['', '', '', '', '', '']);
    } catch (err: any) {
      setErrorMessage(err.message || 'Password reset failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // If in Onboarding flow, render full Onboarding Wizard
  if (showOnboarding && onboardingProfile) {
    return (
      <OnboardingWizard
        user={onboardingProfile}
        onComplete={(updated) => {
          updateUserProfile(updated.id, updated);
          completeAuthenticatedLogin(updated);
          if (onNavigateToTab) {
            onNavigateToTab('profile');
          }
          onClose();
        }}
        onCancel={() => {
          setShowOnboarding(false);
          onClose();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#12141A] border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden my-auto">
        {/* Top Header */}
        <div className="px-5 pt-5 pb-4 bg-slate-950/90 border-b border-slate-800 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 via-pink-500 to-indigo-600 text-white flex items-center justify-center font-bold shadow-lg shadow-rose-500/20 shrink-0">
                {mode === 'login' ? <LogIn className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-base font-extrabold text-white">
                  {showOtpScreen
                    ? 'Confirm Email OTP'
                    : mode === 'login'
                    ? 'Account Sign In'
                    : mode === 'reset'
                    ? 'Reset Password'
                    : '18+ Member Registration'}
                </h2>
                {showOtpScreen ? (
                  <p className="text-xs text-slate-400">Enter 6-digit code sent to {email}</p>
                ) : mode === 'login' ? (
                  <p className="text-xs text-slate-400">Access private calls, creator hosts & coin balances</p>
                ) : mode === 'reset' ? (
                  <p className="text-xs text-slate-400">Verify your email, then set a strong new password</p>
                ) : null}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Switcher Tabs (Hidden during OTP / reset) */}
          {!showOtpScreen && mode !== 'reset' && (
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#090A0D] rounded-xl border border-slate-800/80 mt-4">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                }}
                className={`py-2 rounded-lg text-xs font-bold transition-all ${
                  mode === 'login'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMessage(null);
                }}
                className={`py-2 rounded-lg text-xs font-bold transition-all ${
                  mode === 'register'
                    ? 'bg-gradient-to-r from-rose-600 to-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>
          )}
          {mode === 'reset' && !showOtpScreen && (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setResetOtpSent(false);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className="mt-3 text-xs text-slate-400 hover:text-white font-mono"
            >
              ← Back to Sign In
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto max-h-[75vh] space-y-4">
          {/* Notifications */}
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start space-x-2.5 text-rose-300 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start space-x-2.5 text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* OTP VERIFICATION VIEW                                                     */}
          {/* ========================================================================= */}
          {showOtpScreen ? (
            <div className="space-y-5 py-2">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <Mail className="w-7 h-7 animate-bounce" />
                </div>
                <h3 className="text-base font-bold text-white">Enter 6-Digit Verification Code</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  We've dispatched a 6-digit OTP code & confirmation link to <strong className="text-white">{email}</strong>.
                </p>
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-slate-800/80 border border-slate-700 rounded-full text-[11px] text-slate-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Dual Verification: 6-Digit OTP + Instant Email Link</span>
                </div>
              </div>

              {/* Testing Mode OTP Display Box (Visible during testing / when OTP is returned) */}
              {receivedOtpCode && (
                <div className="p-3.5 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border border-emerald-500/40 rounded-2xl space-y-2.5 shadow-lg shadow-emerald-950/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                        Live Test OTP Code
                      </span>
                    </div>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono font-semibold">
                      Testing Mode
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#0B0D11] border border-slate-700/80 rounded-xl p-2.5 gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-slate-400 font-mono">OTP:</span>
                      <span className="text-xl font-mono font-black tracking-widest text-emerald-300">
                        {receivedOtpCode}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(receivedOtpCode);
                          setCopiedOtp(true);
                          setTimeout(() => setCopiedOtp(false), 2000);
                        }}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-mono flex items-center space-x-1 transition-colors cursor-pointer"
                        title="Copy Code"
                      >
                        {copiedOtp ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedOtp ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const digits = receivedOtpCode.split('').slice(0, 6);
                          setOtpDigits(digits);
                          handleVerifyOtpCode(receivedOtpCode);
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[11px] flex items-center space-x-1 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Auto-fill & Verify</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 flex items-center space-x-1">
                    <span>💡 <em>Test Mode: Click "Auto-fill & Verify" to instantly register. The real email was also sent to {email}.</em></span>
                  </p>
                </div>
              )}

              {/* 6 OTP Input Boxes */}
              <div className="flex justify-center space-x-2 sm:space-x-2.5">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpInputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-11 h-13 sm:w-12 sm:h-14 bg-[#0B0D11] border-2 border-slate-700 focus:border-rose-500 rounded-xl text-center text-lg sm:text-xl font-bold font-mono text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30 transition-all"
                  />
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span className="flex items-center space-x-1.5">
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>
                    {otpTimer > 0 ? (
                      `Resend code in ${otpTimer}s`
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        className="text-rose-400 font-bold hover:underline cursor-pointer"
                        disabled={isLoading}
                      >
                        Resend Verification Code
                      </button>
                    )}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowOtpScreen(false)}
                  className="text-slate-400 hover:text-white hover:underline cursor-pointer"
                >
                  Change Email
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleVerifyOtpCode()}
                disabled={isLoading || otpDigits.join('').length < 6}
                className="w-full py-3 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying 6-Digit Code...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Code & Proceed to Profile Setup</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          ) : mode === 'register' ? (
            /* ========================================================================= */
            /* REGISTRATION FORM: ROLE SELECTION + ACCOUNT CREATION                      */
            /* ========================================================================= */
            <form onSubmit={handleStartRegistration} className="space-y-4">
              {/* Role Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase font-mono tracking-wider mb-2">
                  CHOOSE YOUR ACCOUNT TYPE *
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('male_user')}
                    className={`py-3 px-2 rounded-2xl border text-center transition-all relative overflow-hidden flex items-center justify-center space-x-1.5 ${
                      selectedRole === 'male_user'
                        ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/40'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-base">👨</span>
                    <span className="text-xs font-bold text-white">Male User</span>
                    {selectedRole === 'male_user' && (
                      <Check className="w-3 h-3 text-indigo-400 absolute top-2 right-2" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('female_user')}
                    className={`py-3 px-2 rounded-2xl border text-center transition-all relative overflow-hidden flex items-center justify-center space-x-1.5 ${
                      selectedRole === 'female_user' || selectedRole === 'female_creator'
                        ? 'bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/40'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-base">👩</span>
                    <span className="text-xs font-bold text-white">Female User</span>
                    {(selectedRole === 'female_user' || selectedRole === 'female_creator') && (
                      <Check className="w-3 h-3 text-rose-400 absolute top-2 right-2" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('other_user')}
                    className={`py-3 px-2 rounded-2xl border text-center transition-all relative overflow-hidden flex items-center justify-center space-x-1.5 ${
                      selectedRole === 'other_user'
                        ? 'bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/40'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-base">✨</span>
                    <span className="text-xs font-bold text-white">Other User</span>
                    {selectedRole === 'other_user' && (
                      <Check className="w-3 h-3 text-purple-400 absolute top-2 right-2" />
                    )}
                  </button>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase font-mono tracking-wider mb-1">
                  FULL NAME / DISPLAY HANDLE *
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jessica Sterling or Alex Hunter"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase font-mono tracking-wider mb-1">
                  EMAIL ADDRESS (FOR SUPABASE OTP) *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Password & Confirm Password */}
              <div className="space-y-3">
                <PasswordStrengthField
                  id="auth-register-password"
                  label="PASSWORD"
                  value={password}
                  onChange={setPassword}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                />
                <PasswordStrengthField
                  id="auth-register-confirm"
                  label="CONFIRM PASSWORD"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  showStrengthUi={false}
                  matchAgainst={password}
                  showMatchStatus
                />
              </div>

              {/* Security & Zero KYC Notice */}
              <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-xl flex items-start space-x-2.5 text-[11px] text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Seamless Zero-Friction Onboarding:</strong> An email OTP will be sent to confirm your identity. After email OTP, you configure your bio & Cloudflare R2 media. KYC documents are only requested when requesting your first earnings payout.
                </div>
              </div>

              <button
                type="submit"
                disabled={
                  isLoading ||
                  !evaluatePasswordStrength(password).isValid ||
                  password !== confirmPassword
                }
                className="w-full py-3 bg-gradient-to-r from-rose-600 via-pink-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending Supabase Email OTP...</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Email & Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : mode === 'reset' ? (
            /* ========================================================================= */
            /* PASSWORD RESET: EMAIL OTP + NEW PASSWORD                                  */
            /* ========================================================================= */
            <div className="space-y-4">
              {!resetOtpSent ? (
                <form onSubmit={handleRequestResetOtp} className="space-y-3.5">
                  <p className="text-xs text-slate-400">
                    Enter the email on your account. We will send a 6-digit code so you can set a new password.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase font-mono tracking-wider mb-1">
                      EMAIL ADDRESS
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="w-full bg-[#0B0D11] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
                        autoFocus
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending Reset Code...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        <span>Send Reset Code</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleCompletePasswordReset} className="space-y-4">
                  <div className="text-center space-y-1">
                    <p className="text-xs text-slate-400">
                      Enter the code sent to <strong className="text-white">{resetEmail}</strong>, then choose a strong password.
                    </p>
                  </div>

                  {receivedOtpCode && (
                    <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-center justify-between gap-2">
                      <span className="text-[11px] text-emerald-300 font-mono">
                        Test OTP: <strong className="tracking-widest">{receivedOtpCode}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(receivedOtpCode);
                          setCopiedOtp(true);
                          setTimeout(() => setCopiedOtp(false), 1500);
                        }}
                        className="text-[10px] text-emerald-400 hover:text-white flex items-center gap-1"
                      >
                        {copiedOtp ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedOtp ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase font-mono tracking-wider mb-2">
                      6-DIGIT CODE
                    </label>
                    <div className="flex justify-between gap-2">
                      {otpDigits.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => {
                            otpInputRefs.current[idx] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={digit}
                          onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                          className="w-10 h-11 sm:w-11 sm:h-12 text-center text-base font-bold font-mono bg-[#0B0D11] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-rose-500"
                          aria-label={`Digit ${idx + 1}`}
                        />
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span>{canResend ? 'Code expired — resend available' : `Resend in ${otpTimer}s`}</span>
                      <button
                        type="button"
                        disabled={!canResend || isLoading}
                        onClick={async () => {
                          setIsLoading(true);
                          const res = await requestPasswordResetOtp(resetEmail.trim());
                          setIsLoading(false);
                          if (res.success) {
                            if (res.otpCode) setReceivedOtpCode(res.otpCode);
                            setOtpTimer(60);
                            setCanResend(false);
                            setSuccessMessage('A new reset code was sent.');
                          } else {
                            setErrorMessage(res.error || 'Failed to resend code.');
                          }
                        }}
                        className="text-rose-400 hover:text-rose-300 disabled:opacity-40"
                      >
                        Resend code
                      </button>
                    </div>
                  </div>

                  <PasswordStrengthField
                    id="auth-reset-password"
                    label="New Password"
                    value={resetPassword}
                    onChange={setResetPassword}
                    placeholder="Create a strong password"
                    autoComplete="new-password"
                  />
                  <PasswordStrengthField
                    id="auth-reset-confirm"
                    label="Confirm New Password"
                    value={resetConfirmPassword}
                    onChange={setResetConfirmPassword}
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    showStrengthUi={false}
                    matchAgainst={resetPassword}
                    showMatchStatus
                  />

                  <button
                    type="submit"
                    disabled={
                      isLoading ||
                      otpDigits.join('').length < 6 ||
                      !evaluatePasswordStrength(resetPassword).isValid ||
                      resetPassword !== resetConfirmPassword
                    }
                    className="w-full py-3 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Reset Password</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* ========================================================================= */
            /* LOGIN FORM (EMAIL / PHONE)                                                */
            /* ========================================================================= */
            <div className="space-y-4">
              {/* Method Selector Tabs */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAuthMethod('email')}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                    authMethod === 'email'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                      : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAuthMethod('phone')}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                    authMethod === 'phone'
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50'
                      : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Phone OTP</span>
                </button>
              </div>

              {/* Email Login */}
              {authMethod === 'email' && (
                <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase font-mono tracking-wider mb-1">
                      EMAIL ADDRESS OR USERNAME
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        required
                        placeholder="alex@example.com or Alex Hunter"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="w-full bg-[#0B0D11] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-300 uppercase font-mono tracking-wider">
                        PASSWORD
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('reset');
                          setResetEmail(loginEmail.includes('@') ? loginEmail.trim() : '');
                          setResetOtpSent(false);
                          setErrorMessage(null);
                          setSuccessMessage(null);
                        }}
                        className="text-[11px] text-rose-400 hover:text-rose-300 font-mono"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        autoComplete="current-password"
                        className="w-full bg-[#0B0D11] border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                        title={showLoginPassword ? 'Hide password' : 'Show password'}
                        aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                      >
                        {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Signing In to Supabase...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>Sign In</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Phone OTP Login */}
              {authMethod === 'phone' && (
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase font-mono tracking-wider mb-1">
                      MOBILE PHONE NUMBER
                    </label>
                    <div className="flex space-x-2">
                      <div className="relative flex-1">
                        <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          type="tel"
                          placeholder="+1 (555) 019-2834"
                          value={loginPhone}
                          onChange={(e) => setLoginPhone(e.target.value)}
                          className="w-full bg-[#0B0D11] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!loginPhone) {
                            setErrorMessage('Please enter your mobile phone number.');
                            return;
                          }
                          setLoginPhoneOtpSent(true);
                          setLoginPhoneOtp('123456');
                          showToast('SMS OTP Code: 123456', 'Simulated 6-digit verification code.', 'info');
                        }}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shrink-0 cursor-pointer"
                      >
                        {loginPhoneOtpSent ? 'Resend' : 'Send Code'}
                      </button>
                    </div>
                  </div>

                  {loginPhoneOtpSent && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase font-mono tracking-wider mb-1">
                        ENTER 6-DIGIT SMS CODE
                      </label>
                      <input
                        type="text"
                        placeholder="123456"
                        value={loginPhoneOtp}
                        onChange={(e) => setLoginPhoneOtp(e.target.value)}
                        className="w-full px-3 py-2.5 bg-[#0B0D11] border border-slate-800 rounded-xl text-xs text-white text-center tracking-widest font-mono text-base placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleLoginSubmit()}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Verify & Sign In</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default AuthModal;
