import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { getCoinUsdPeg, coinsToUsd } from '../../../shared/finance/fx';
import {
  User,
  MapPin,
  Navigation,
  Globe,
  Compass,
  Sparkles,
  Coins,
  Crown,
  DollarSign,
  PhoneCall,
  Video,
  ShieldCheck,
  Lock,
  Unlock,
  Camera,
  Edit3,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  Sliders,
  Heart,
  MessageCircle,
  Share2,
  Calendar,
  Layers,
  Award,
  Zap,
  Info,
  ChevronRight,
  TrendingUp,
  KeyRound,
  EyeOff,
  Check,
  Shield,
  Mail,
  Upload,
  Cloud,
  Image as ImageIcon,
  Copy,
  Plus,
  Trash2,
  X,
  FileText,
} from 'lucide-react';
import {
  POPULAR_MOCK_LOCATIONS,
  detectExactBrowserLocation,
  getUserEffectiveLocation,
} from '../../utils/location';
import { getCountryFlag } from '../../utils/flags';
import { uploadMediaDirectlyToR2, normalizeMediaUrl, isPersistableMediaUrl } from '../../utils/r2Storage';
import { getUserRoleLabel, getFemaleRoleMark } from '../../types';
import { UnifiedImageUploader } from '../common/UnifiedImageUploader';
import { getFallbackAvatar } from '../../utils/avatars';
import { CountrySelector } from '../common/CountrySelector';
import { LanguageSelector } from '../common/LanguageSelector';
import { ZodiacSelector } from '../common/ZodiacSelector';
import { InterestSelector } from '../common/InterestSelector';
import { SvgFlag } from '../common/SvgFlag';
import { ZodiacIcon } from '../common/ZodiacIcon';
import { PasswordStrengthField } from '../auth/PasswordStrengthField';
import { getPasswordPolicyError, isPasswordPolicyValid } from '../../../shared/passwordPolicy';
import { authFetch } from '../../utils/apiClient';
import { signOutSupabase } from '../../services/supabaseAuthService';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=400',
];

interface UserProfilePageProps {
  onOpenStore?: () => void;
  onOpenChat?: (userId?: string) => void;
  onNavigateToTab?: (tab: string) => void;
}

export const UserProfilePage: React.FC<UserProfilePageProps> = ({
  onOpenStore,
  onOpenChat,
  onNavigateToTab,
}) => {
  const {
    currentUser,
    systemSettings,
    updateUserProfile,
    changeUserPassword,
    showToast,
    toggleUserStatus,
    claimDailyBonus,
    dailyBonusClaimed,
    feedPosts,
    callLogs,
    logoutUser,
  } = useApp();

  const isTeamLeader = currentUser.role === 'team_leader' || currentUser.role === 'agency_manager';
  const isFemale =
    !isTeamLeader &&
    (currentUser.gender === 'female' ||
      currentUser.role === 'female_creator' ||
      currentUser.role === 'female_host');
  const isMale = !isTeamLeader && (currentUser.gender === 'male' || currentUser.role === 'male_user');
  const isAdmin = currentUser.role === 'admin';
  const canEarnCoins = isFemale
    ? Boolean(currentUser.teamLeaderId) || Boolean(systemSettings.enableRegularFemaleCoinEarning)
    : false;

  // Navigation tab inside profile
  const [profileSection, setProfileSection] = useState<
    'overview' | 'location' | 'edit_bio' | 'rates_earnings' | 'media' | 'security'
  >('overview');

  // Password change state
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  // Self-delete account state (hidden for admin)
  const [deleteConfirmPhrase, setDeleteConfirmPhrase] = useState('');
  const [deletePasswordInput, setDeletePasswordInput] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Avatar upload & R2 storage modal state
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUploadProgress, setAvatarUploadProgress] = useState(0);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [customAvatarUrlInput, setCustomAvatarUrlInput] = useState('');
  const [isAvatarDragOver, setIsAvatarDragOver] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  const [isAddGalleryModalOpen, setIsAddGalleryModalOpen] = useState(false);

  // Direct file upload to Cloudflare R2
  const handleUploadAvatarFile = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Invalid File Type', 'Please select an image file (PNG, JPG, WEBP, GIF)', 'error');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      showToast('File Too Large', 'Avatar image must be under 15MB', 'error');
      return;
    }

    setIsUploadingAvatar(true);
    setAvatarUploadProgress(15);

    try {
      const result = await uploadMediaDirectlyToR2({
        file,
        userId: currentUser.id,
        category: 'avatar',
        onProgress: (percent) => setAvatarUploadProgress(Math.max(15, percent)),
      });

      if (result?.publicUrl && isPersistableMediaUrl(result.publicUrl)) {
        updateUserProfile(currentUser.id, {
          avatarUrl: result.publicUrl,
        });

        setFormData((prev) => ({
          ...prev,
          avatarUrl: result.publicUrl,
        }));

        showToast(
          'Profile Picture Updated',
          'Your new profile picture was uploaded to Cloudflare R2.',
          'success'
        );
        setIsAvatarModalOpen(false);
      } else {
        throw new Error('Upload completed but no cloud storage URL was returned');
      }
    } catch (err: any) {
      console.error('Avatar upload failed:', err?.message || err);
      showToast(
        'Upload Failed',
        err?.message || 'Could not upload your profile photo to Cloudflare R2. Please try again.',
        'error'
      );
    } finally {
      setIsUploadingAvatar(false);
      setAvatarUploadProgress(0);
    }
  };

  const handleAddGalleryPhoto = (newUrl: string) => {
    const currentGallery = currentUser.gallery || [];
    const updatedGallery = [...currentGallery, newUrl];
    updateUserProfile(currentUser.id, { gallery: updatedGallery });
    showToast('Gallery Updated 🖼️', 'New photo added to your gallery and stored in R2!', 'success');
    setIsAddGalleryModalOpen(false);
  };

  const handleRemoveGalleryPhoto = (indexToRemove: number) => {
    const currentGallery = currentUser.gallery || [];
    const updatedGallery = currentGallery.filter((_, i) => i !== indexToRemove);
    updateUserProfile(currentUser.id, { gallery: updatedGallery });
    showToast('Photo Removed', 'Gallery updated.', 'info');
  };

  const handleAvatarFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUploadAvatarFile(e.target.files[0]);
    }
  };

  const handleAvatarDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsAvatarDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUploadAvatarFile(e.dataTransfer.files[0]);
    }
  };

  const handleSelectPresetAvatar = (presetUrl: string) => {
    updateUserProfile(currentUser.id, {
      avatarUrl: presetUrl,
    });
    setFormData((prev) => ({ ...prev, avatarUrl: presetUrl }));
    showToast('Profile Picture Updated ✨', 'Avatar preset applied successfully!', 'success');
    setIsAvatarModalOpen(false);
  };

  const handleSaveCustomAvatarUrl = () => {
    if (!customAvatarUrlInput.trim()) {
      showToast('Input Required', 'Please enter a valid image URL', 'warning');
      return;
    }
    updateUserProfile(currentUser.id, {
      avatarUrl: customAvatarUrlInput.trim(),
    });
    setFormData((prev) => ({ ...prev, avatarUrl: customAvatarUrlInput.trim() }));
    showToast('Profile Picture Updated ✨', 'Custom avatar URL applied and saved!', 'success');
    setCustomAvatarUrlInput('');
    setIsAvatarModalOpen(false);
  };

  const handleCopyEmail = () => {
    const emailToCopy = currentUser.email || `${currentUser.id.slice(0, 8)}@livecall.app`;
    navigator.clipboard.writeText(emailToCopy);
    showToast('Email Copied', `${emailToCopy} copied to clipboard!`, 'info');
  };

  // Handle password submission
  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const policyError = getPasswordPolicyError(newPasswordInput);
    if (policyError) {
      showToast('Password Requirements', policyError, 'error');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      showToast('Password Mismatch', 'New password and confirmation password do not match.', 'error');
      return;
    }

    setPasswordSubmitting(true);
    const result = changeUserPassword(currentUser.id, currentPasswordInput, newPasswordInput);
    setPasswordSubmitting(false);

    if (result.success) {
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
    }
  };

  const handleSelfDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdmin) return;

    const phrase = deleteConfirmPhrase.trim();
    const email = (currentUser.email || '').trim().toLowerCase();
    const phraseOk =
      phrase.toUpperCase() === 'DELETE' || (email && phrase.toLowerCase() === email);
    if (!phraseOk) {
      showToast('Confirmation Required', 'Type DELETE or your account email to continue.', 'warning');
      return;
    }
    if (!deletePasswordInput.trim()) {
      showToast('Password Required', 'Enter your password to permanently delete this account.', 'warning');
      return;
    }

    const ok = window.confirm(
      'This permanently deletes your account, login, and profile data. This cannot be undone. Continue?'
    );
    if (!ok) return;

    setDeleteSubmitting(true);
    try {
      const res = await authFetch('/api/users/me/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmPhrase: phrase,
          password: deletePasswordInput,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        const errMsg =
          (typeof data?.error === 'string' && data.error) ||
          data?.error?.message ||
          'Could not delete your account.';
        showToast('Delete Failed', errMsg, 'error');
        return;
      }

      showToast('Account Deleted', 'Your account has been permanently removed.', 'success');
      setDeleteConfirmPhrase('');
      setDeletePasswordInput('');
      try {
        await signOutSupabase();
      } catch {
        /* ignore */
      }
      logoutUser();
      try {
        localStorage.removeItem('livecall_logged_in');
        localStorage.removeItem('livecall_current_user_id');
      } catch {
        /* ignore */
      }
      if (typeof window !== 'undefined') {
        window.location.assign('/');
      }
    } catch (err: any) {
      showToast('Delete Failed', err?.message || 'Network error during account deletion.', 'error');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Location detection states
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Track whether user has active uncommitted edits in the form to prevent heartbeat wipes
  const isDirtyRef = useRef<boolean>(false);
  const lastUserIdRef = useRef<string>(currentUser.id);

  // Editable Bio form fields
  const [formData, setFormData] = useState({
    name: currentUser.name || '',
    bio: currentUser.bio || '',
    extendedBio: currentUser.extendedBio || '',
    locationCity: currentUser.locationCity || '',
    zodiac: currentUser.zodiac || '',
    nationality: currentUser.nationality || '',
    countryCode: currentUser.countryCode || '',
    hourlyCoinRate: currentUser.hourlyCoinRate || 10,
    avatarUrl: currentUser.avatarUrl || '',
    responseRate: currentUser.responseRate || '98% instant',
    interestedIn: currentUser.interestedIn && currentUser.interestedIn.length > 0 ? currentUser.interestedIn[0] : (isFemale ? 'male' : 'female'),
    spokenLanguages: currentUser.spokenLanguages && currentUser.spokenLanguages.length > 0 ? currentUser.spokenLanguages : ['English'],
    interests: currentUser.interests && currentUser.interests.length > 0 ? currentUser.interests : [],
  });

  // Synchronize when switching accounts OR when initial profile data loads (never overwrite while user is editing)
  useEffect(() => {
    const isUserSwitch = lastUserIdRef.current !== currentUser.id;
    if (isUserSwitch) {
      lastUserIdRef.current = currentUser.id;
      isDirtyRef.current = false;
    }

    // Only update formData from currentUser if user has not made uncommitted edits
    if (!isDirtyRef.current) {
      setFormData({
        name: currentUser.name || '',
        bio: currentUser.bio || '',
        extendedBio: currentUser.extendedBio || '',
        locationCity: currentUser.locationCity || '',
        zodiac: currentUser.zodiac || '',
        nationality: currentUser.nationality || '',
        countryCode: currentUser.countryCode || '',
        hourlyCoinRate: currentUser.hourlyCoinRate || 10,
        avatarUrl: currentUser.avatarUrl || '',
        responseRate: currentUser.responseRate || '98% instant',
        interestedIn: currentUser.interestedIn && currentUser.interestedIn.length > 0 ? currentUser.interestedIn[0] : (isFemale ? 'male' : 'female'),
        spokenLanguages: currentUser.spokenLanguages && currentUser.spokenLanguages.length > 0 ? currentUser.spokenLanguages : ['English'],
        interests: currentUser.interests && currentUser.interests.length > 0 ? currentUser.interests : [],
      });
    }
  }, [
    currentUser.id,
    currentUser.name,
    currentUser.bio,
    currentUser.extendedBio,
    currentUser.locationCity,
    currentUser.zodiac,
    currentUser.nationality,
    currentUser.countryCode,
    currentUser.hourlyCoinRate,
    currentUser.avatarUrl,
    currentUser.responseRate,
    currentUser.interestedIn,
    currentUser.spokenLanguages,
    currentUser.interests,
    isFemale,
  ]);

  // Current effective location
  const effectiveLocation = getUserEffectiveLocation(currentUser);

  // Handle GPS location detection
  const handleDetectExactLocation = async () => {
    setIsDetectingGps(true);
    setGpsError(null);
    try {
      const detected = await detectExactBrowserLocation();
      updateUserProfile(currentUser.id, {
        exactLocation: {
          latitude: detected.latitude,
          longitude: detected.longitude,
          city: detected.city,
          country: detected.country,
          countryCode: detected.countryCode,
          accuracyMeters: detected.accuracyMeters,
          detectedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        locationCity: `${detected.city}, ${detected.country}`,
        countryCode: detected.countryCode,
        nationality: detected.country,
      });
      showToast(
        'GPS Location Detected! 📍',
        `Successfully locked exact coordinates: ${detected.city}, ${detected.country}`,
        'success'
      );
    } catch (err: any) {
      setGpsError(err.message || 'Could not acquire browser GPS location.');
      showToast('Location Detection Error', err.message || 'Please allow GPS access', 'error');
    } finally {
      setIsDetectingGps(false);
    }
  };

  // Toggle Mock Location state (For female host)
  const handleToggleMockLocation = (enabled: boolean) => {
    if (!currentUser.allowMockLocation) {
      showToast(
        'Permission Denied',
        'Platform Admin has not granted mock location permissions to your account.',
        'warning'
      );
      return;
    }

    updateUserProfile(currentUser.id, {
      isUsingMockLocation: enabled,
      mockLocationCity: currentUser.mockLocationCity || 'Miami',
      mockLocationCountry: currentUser.mockLocationCountry || 'United States',
      mockLocationCountryCode: currentUser.mockLocationCountryCode || 'US',
    });

    showToast(
      enabled ? 'Mock Location Active 🎭' : 'Real Location Restored 📍',
      enabled
        ? `Callers will now see your location as ${currentUser.mockLocationCity || 'Miami'}`
        : 'Displaying your original profile/GPS location.',
      'info'
    );
  };

  // Select Preset Mock Location
  const handleSelectMockPreset = (preset: typeof POPULAR_MOCK_LOCATIONS[0]) => {
    if (!currentUser.allowMockLocation) {
      showToast('Action Locked', 'Admin permission required to use mock locations.', 'warning');
      return;
    }

    updateUserProfile(currentUser.id, {
      isUsingMockLocation: true,
      mockLocationCity: preset.city,
      mockLocationCountry: preset.country,
      mockLocationCountryCode: preset.countryCode,
    });

    showToast(
      'Virtual Location Updated ✈️',
      `Your public host location set to ${preset.city}, ${preset.country} ${preset.flag}`,
      'success'
    );
  };

  // Save general profile edits
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    isDirtyRef.current = false;

    const newNationality = formData.nationality || currentUser.nationality || 'United States';
    const newCountryCode = (formData.countryCode || currentUser.countryCode || 'US').toUpperCase();

    // Dynamically identify what changed for intuitive user toast feedback
    const changes: string[] = [];
    if (formData.name && formData.name !== currentUser.name) changes.push(`Name set to "${formData.name}"`);
    if (newNationality !== (currentUser.nationality || 'United States') || newCountryCode !== (currentUser.countryCode || 'US').toUpperCase()) {
      changes.push(`Country set to ${newNationality} (${newCountryCode})`);
    }
    if (formData.zodiac !== (currentUser.zodiac || '')) {
      changes.push(`Zodiac set to ${formData.zodiac || 'None'}`);
    }
    if (formData.locationCity !== (currentUser.locationCity || '')) changes.push('Location updated');
    if (formData.bio !== (currentUser.bio || '') || formData.extendedBio !== (currentUser.extendedBio || '')) changes.push('Bio updated');
    if (JSON.stringify(formData.spokenLanguages || []) !== JSON.stringify(currentUser.spokenLanguages || [])) changes.push('Languages updated');
    if (JSON.stringify(formData.interests || []) !== JSON.stringify(currentUser.interests || [])) changes.push('Interests updated');
    if (formData.avatarUrl && formData.avatarUrl !== currentUser.avatarUrl) changes.push('Profile picture updated');
    if (formData.responseRate !== (currentUser.responseRate || '98% instant')) changes.push('Response rate updated');

    const toastMsg = changes.length > 0
      ? `Profile updated: ${changes.join(' • ')}`
      : 'Profile updated successfully!';

    updateUserProfile(currentUser.id, {
      name: formData.name,
      bio: formData.bio,
      extendedBio: formData.extendedBio,
      locationCity: formData.locationCity || newNationality,
      zodiac: formData.zodiac,
      nationality: newNationality,
      countryCode: newCountryCode,
      hourlyCoinRate: currentUser.hourlyCoinRate,
      avatarUrl: formData.avatarUrl,
      responseRate: formData.responseRate,
      interestedIn: [formData.interestedIn],
      spokenLanguages: formData.spokenLanguages,
      interests: formData.interests,
      exactLocation: currentUser.exactLocation ? {
        ...currentUser.exactLocation,
        country: newNationality,
        countryCode: newCountryCode,
        city: formData.locationCity || currentUser.exactLocation.city || newNationality,
      } : undefined,
    });
    showToast('Profile Saved ✨', toastMsg, 'success');
  };

  return (
    <div id="dedicated-user-profile-page" className="max-w-6xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* Hidden file input for fast avatar upload */}
      <input
        type="file"
        ref={avatarFileInputRef}
        onChange={handleAvatarFileInputChange}
        accept="image/*"
        className="hidden"
      />

      {/* 1. Header Banner & Profile Hero Card */}
      <div className="relative rounded-3xl bg-app-card border border-hairline p-5 sm:p-7 shadow-app-lg overflow-hidden">
        {/* Glow ambient decoration */}
        <div
          className={`absolute -top-24 -right-24 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-20 ${
            isFemale ? 'bg-pink-500' : 'bg-indigo-500'
          }`}
        />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Avatar and Essential Info */}
          <div className="flex items-start sm:items-center space-x-4 sm:space-x-5 min-w-0">
            {/* Interactive Avatar with R2 Upload Trigger */}
            <div className="relative shrink-0 group">
              <img
                src={normalizeMediaUrl(currentUser.avatarUrl)}
                alt={currentUser.name}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getFallbackAvatar(currentUser.name, currentUser.gender, currentUser.role);
                }}
                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover ring-4 shadow-xl transition-all group-hover:brightness-75 bg-app-input ${
                  isFemale ? 'ring-pink-500/50' : 'ring-indigo-500/50'
                }`}
              />

              {/* Hover / Tap Overlay Button for Avatar Change */}
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(true)}
                disabled={isUploadingAvatar}
                className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white cursor-pointer backdrop-blur-[2px]"
                title="Change profile picture (Uploads to Cloudflare R2)"
              >
                {isUploadingAvatar ? (
                  <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
                ) : (
                  <>
                    <Camera className="w-5 h-5 text-indigo-300 drop-shadow" />
                    <span className="text-[10px] font-mono font-bold mt-1 text-app-heading">Change</span>
                  </>
                )}
              </button>

              {/* Online status indicator */}
              <span
                className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[var(--app-card)] shadow-sm z-10 ${
                  currentUser.onlineStatus === 'online'
                    ? 'bg-emerald-400'
                    : currentUser.onlineStatus === 'busy' || currentUser.onlineStatus === 'in_call'
                    ? 'bg-amber-400'
                    : 'bg-rose-500'
                }`}
                title={`Status: ${currentUser.onlineStatus}`}
              />

              {/* Cloudflare R2 Badge */}
              <div
                onClick={() => setIsAvatarModalOpen(true)}
                className="absolute -top-1.5 -left-1.5 p-1 rounded-full bg-app-input border border-indigo-500/40 text-indigo-300 shadow-md cursor-pointer hover:scale-110 transition-transform"
                title="Cloudflare R2 Synced Avatar"
              >
                <Cloud className="w-3 h-3" />
              </div>
            </div>

            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h1 className="text-xl sm:text-2xl font-black text-app-heading tracking-tight truncate">
                  {currentUser.name}
                </h1>
                {currentUser.isVerified && (
                  <span className="px-1.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-300 font-mono text-[10px] font-bold flex items-center space-x-1">
                    <span>✓</span>
                    <span>Verified</span>
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider border inline-flex items-center gap-1 ${
                    getFemaleRoleMark(currentUser) === 'creator'
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                      : getFemaleRoleMark(currentUser) === 'user'
                      ? 'bg-pink-500/20 border-pink-500/40 text-pink-300'
                      : getUserRoleLabel(currentUser) === 'Male User'
                      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                      : getUserRoleLabel(currentUser) === 'Team Leader'
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : getUserRoleLabel(currentUser) === 'Admin'
                      ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                      : 'bg-teal-500/20 border-teal-500/40 text-teal-300'
                  }`}
                >
                  {getUserRoleLabel(currentUser)}
                  {getFemaleRoleMark(currentUser) === 'creator' && (
                    <span className="opacity-80 normal-case">· Creator</span>
                  )}
                </span>

                {/* Quick Avatar Change Button */}
                <button
                  type="button"
                  onClick={() => setIsAvatarModalOpen(true)}
                  className="px-2 py-0.5 rounded-lg bg-app-input hover:bg-brand-soft text-app-muted border border-hairline text-[10px] font-mono font-bold flex items-center space-x-1 cursor-pointer transition-all hover:text-app-heading"
                >
                  <Camera className="w-3 h-3 text-indigo-400" />
                  <span>Change Photo</span>
                </button>
              </div>

              {/* User Email Display in Header with Copy button */}
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-indigo-200 text-xs font-mono">
                  <Mail className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="font-semibold truncate max-w-[200px] sm:max-w-xs">
                    {currentUser.email || `${currentUser.id.slice(0, 8)}@livecall.app`}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    className="p-0.5 hover:text-app-heading transition-colors"
                    title="Copy Email Address"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Effective Location Banner & Zodiac with Vector Graphics */}
              <div className="flex items-center space-x-2 text-xs text-app-muted flex-wrap gap-y-1">
                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-app-input border border-hairline">
                  <MapPin className={`w-3.5 h-3.5 ${effectiveLocation.isMock ? 'text-pink-400' : 'text-emerald-400'}`} />
                  <span className="font-semibold text-app-heading">
                    {effectiveLocation.displayCity}
                  </span>
                  <SvgFlag
                    countryCode={currentUser.countryCode}
                    nationality={effectiveLocation.country || currentUser.nationality}
                    size="md"
                    rounded={true}
                  />
                  {effectiveLocation.isMock && (
                    <span className="ml-1 px-1.5 py-0.2 rounded bg-pink-500/20 border border-pink-500/30 text-pink-300 text-[9px] font-mono font-bold">
                      MOCK
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2 text-app-muted font-mono text-xs">
                  <span>Age: <strong className="text-app-heading">{currentUser.age || 24}</strong></span>
                  {currentUser.zodiac && (
                    <ZodiacIcon sign={currentUser.zodiac} withBadge={true} size="xs" />
                  )}
                </div>
              </div>

              <p className="text-xs text-app-muted line-clamp-2 max-w-xl pt-0.5">
                {currentUser.bio || 'No bio yet. Click edit profile to add your introduction!'}
              </p>
            </div>
          </div>

          {/* Quick Action Badges (Gender Differentiated) */}
          <div className="flex flex-row md:flex-col items-center md:items-end gap-2 shrink-0 w-full md:w-auto justify-between md:justify-start pt-3 md:pt-0 border-t md:border-t-0 border-hairline">
            {/* Team Leader Agency Badge */}
            {isTeamLeader && (
              <div className="flex items-center space-x-2">
                <div className="text-right">
                  <div className="text-[10px] text-amber-400/90 font-mono uppercase font-bold">Agency Management</div>
                  <div className="text-xs font-bold text-amber-200 font-mono">
                    {currentUser.agencyName || 'Talent Agency'} • {currentUser.commissionPercent || 15}% Commission
                  </div>
                </div>
                {onNavigateToTab && (
                  <button
                    onClick={() => onNavigateToTab('team_leader')}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-mono font-bold text-xs transition-all shadow-sm flex items-center space-x-1 cursor-pointer"
                  >
                    <Crown className="w-3.5 h-3.5" />
                    <span>Agency Hub</span>
                  </button>
                )}
              </div>
            )}

            {/* Female Host Stats / Earnings (opens host earnings dashboard) */}
            {isFemale && (
              <div className="flex items-center space-x-2">
                {canEarnCoins ? (
                  <>
                    <div className="text-right">
                      <div className="text-[10px] text-app-muted font-mono uppercase">Call Host Rate</div>
                      <div className="text-sm font-black text-pink-300 font-mono flex items-center space-x-1">
                        <span>🪙</span>
                        <span>{systemSettings.coinBurnRatePerMin || 120} coins/min</span>
                      </div>
                    </div>
                    {onNavigateToTab && (
                      <button
                        id="profile-host-earnings-amount-btn"
                        type="button"
                        onClick={() => onNavigateToTab('earnings')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-mono font-bold text-xs transition-all shadow-sm flex items-center space-x-1.5 cursor-pointer"
                        title="Open host earnings dashboard"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>${(currentUser.totalLifetimeEarnedUSD || 0).toFixed(2)}</span>
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-right">
                    <div className="text-[10px] text-app-muted font-mono uppercase">Host Account</div>
                    <div className="text-xs font-bold text-pink-300 font-mono">
                      Community Creator
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Male User Wallet */}
            {isMale && (
              <div className="flex items-center space-x-2">
                <div className="text-right">
                  <div className="text-[10px] text-app-muted font-mono uppercase">My Wallet</div>
                  <div className="text-sm font-black text-amber-300 font-mono flex items-center space-x-1">
                    <span>🪙</span>
                    <span>{currentUser.coinBalance} coins</span>
                  </div>
                </div>
                {onNavigateToTab && (
                  <button
                    onClick={() => onNavigateToTab('earnings')}
                    className="px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 font-mono font-bold text-xs transition-all shadow-sm flex items-center space-x-1"
                    title="View Coin Spending & Habits Analytics"
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>Analytics</span>
                  </button>
                )}
                {onOpenStore && (
                  <button
                    onClick={onOpenStore}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs transition-all shadow-md shadow-amber-500/20 hover:brightness-110 flex items-center space-x-1"
                  >
                    <span>+ Top Up</span>
                  </button>
                )}
              </div>
            )}

              {/* Availability Status Switcher */}
            <div className="flex items-center space-x-1 bg-app-input p-1 rounded-xl border border-hairline">
              <button
                onClick={() => toggleUserStatus(currentUser.id, 'online')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono transition-all ${
                  currentUser.onlineStatus === 'online'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                    : 'text-app-muted hover:text-app-heading'
                }`}
              >
                Online
              </button>
              <button
                onClick={() => toggleUserStatus(currentUser.id, 'busy')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono transition-all ${
                  currentUser.onlineStatus === 'busy' || currentUser.onlineStatus === 'in_call'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                    : 'text-app-muted hover:text-app-heading'
                }`}
              >
                Busy
              </button>
              <button
                onClick={() => toggleUserStatus(currentUser.id, 'offline')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono transition-all ${
                  currentUser.onlineStatus === 'offline'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                    : 'text-app-muted hover:text-app-heading'
                }`}
              >
                Offline
              </button>
            </div>
          </div>
        </div>

        {/* Section Navigation Tabs Bar */}
        <div className="flex items-center space-x-1 mt-6 pt-4 border-t border-hairline overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setProfileSection('overview')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all shrink-0 flex items-center space-x-1.5 ${
              profileSection === 'overview'
                ? 'bg-app-card text-app-heading shadow-app-sm border border-hairline'
                : 'text-app-muted hover:text-app-heading hover:bg-app-input'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile Overview</span>
          </button>

          <button
            onClick={() => setProfileSection('location')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all shrink-0 flex items-center space-x-1.5 ${
              profileSection === 'location'
                ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                : 'text-app-muted hover:text-app-heading hover:bg-app-input'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-pink-400" />
            <span>Location & Geolocation</span>
            {isFemale && currentUser.allowMockLocation && (
              <span className="px-1.5 py-0.2 rounded bg-pink-500/30 text-white text-[9px] font-mono font-bold">
                MOCK READY
              </span>
            )}
          </button>

          <button
            onClick={() => setProfileSection('edit_bio')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all shrink-0 flex items-center space-x-1.5 ${
              profileSection === 'edit_bio'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-app-muted hover:text-app-heading hover:bg-app-input'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Edit Bio & Info</span>
          </button>

          {isFemale ? (
            canEarnCoins ? (
              <button
                id="profile-menu-host-earnings-btn"
                type="button"
                onClick={() => {
                  if (onNavigateToTab) {
                    onNavigateToTab('earnings');
                    return;
                  }
                  setProfileSection('rates_earnings');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all shrink-0 flex items-center space-x-1.5 ${
                  profileSection === 'rates_earnings'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-app-muted hover:text-app-heading hover:bg-app-input'
                }`}
                title="Open host earnings dashboard"
              >
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>Earnings</span>
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
                  ${(currentUser.totalLifetimeEarnedUSD || 0).toFixed(2)}
                </span>
              </button>
            ) : null
          ) : (
            <button
              onClick={() => setProfileSection('rates_earnings')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all shrink-0 flex items-center space-x-1.5 ${
                profileSection === 'rates_earnings'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : 'text-app-muted hover:text-app-heading hover:bg-app-input'
              }`}
            >
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>Wallet</span>
            </button>
          )}

          <button
            onClick={() => setProfileSection('media')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all shrink-0 flex items-center space-x-1.5 ${
              profileSection === 'media'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-app-muted hover:text-app-heading hover:bg-app-input'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-purple-400" />
            <span>Gallery & Moments</span>
          </button>

          <button
            id="profile-security-tab-btn"
            onClick={() => setProfileSection('security')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all shrink-0 flex items-center space-x-1.5 ${
              profileSection === 'security'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'text-app-muted hover:text-app-heading hover:bg-app-input'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-rose-400" />
            <span>Security & Password</span>
          </button>
        </div>
      </div>

      {/* 2. TAB CONTENT 1: OVERVIEW */}
      {profileSection === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns: Bio, Demographics & Highlights */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* About Me / Creator Story Card */}
            <div className="p-5 sm:p-6 bg-app-card border border-hairline rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-app-heading font-mono uppercase tracking-wider flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>{isFemale ? 'Creator Bio & Story' : 'Member Introduction'}</span>
                </h3>
                <button
                  onClick={() => setProfileSection('edit_bio')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-mono font-semibold flex items-center space-x-1"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              </div>

              <div className="space-y-3 text-xs leading-relaxed text-app-muted">
                <div className="p-3.5 rounded-xl bg-app-input border border-hairline text-app-heading italic font-serif text-sm">
                  "{currentUser.bio || 'No short bio provided.'}"
                </div>

                {currentUser.extendedBio && (
                  <div className="space-y-1">
                    <h4 className="text-[11px] font-bold text-app-muted font-mono uppercase">Full Story & Background</h4>
                    <p className="whitespace-pre-line text-app-muted text-xs bg-app-input p-3 rounded-xl border border-hairline">
                      {currentUser.extendedBio}
                    </p>
                  </div>
                )}
              </div>

              {/* Tags & Spoken Languages */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-hairline">
                <div>
                  <h4 className="text-[11px] font-bold text-app-muted font-mono uppercase mb-2 flex items-center space-x-1.5">
                    <span>Spoken Languages</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(currentUser.spokenLanguages || ['English']).map((lang, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-app-input border border-hairline text-app-heading text-xs font-mono"
                      >
                        🗣️ {lang}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-[11px] font-bold text-app-muted font-mono uppercase mb-2">Interests & Topics</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(currentUser.interests || ['Music', 'Travel']).map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs"
                      >
                        ✨ {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Highlights / Performance Grid */}
            <div className="space-y-1.5">
              <div className="flex items-center space-x-1.5 px-1">
                <span className="text-[11px] font-bold text-app-muted font-mono uppercase">Activity & Highlights</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {isFemale ? (
                  <>
                    <div className="p-4 bg-app-card border border-hairline rounded-2xl">
                      <div className="text-[10px] text-app-muted font-mono uppercase">Calls Hosted</div>
                      <div className="text-lg font-black text-pink-400 font-mono mt-0.5">
                        {currentUser.totalCallsHosted || 142}
                      </div>
                    </div>
                    <div className="p-4 bg-app-card border border-hairline rounded-2xl">
                      <div className="text-[10px] text-app-muted font-mono uppercase">Call Minutes</div>
                      <div className="text-lg font-black text-indigo-400 font-mono mt-0.5">
                        {currentUser.totalCallMinutes || 840}m
                      </div>
                    </div>
                    <div className="p-4 bg-app-card border border-hairline rounded-2xl">
                      <div className="text-[10px] text-app-muted font-mono uppercase">Gifts Received</div>
                      <div className="text-lg font-black text-amber-400 font-mono mt-0.5">
                        {currentUser.totalGiftsReceivedCount || 95}
                      </div>
                    </div>
                    <div className="p-4 bg-app-card border border-hairline rounded-2xl">
                      <div className="text-[10px] text-app-muted font-mono uppercase">Response Rate</div>
                      <div className="text-xs font-bold text-emerald-400 font-mono mt-1">
                        {currentUser.responseRate || '99% (< 1m)'}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-4 bg-app-card border border-hairline rounded-2xl">
                      <div className="text-[10px] text-app-muted font-mono uppercase">Coins Balance</div>
                      <div className="text-lg font-black text-amber-400 font-mono mt-0.5">
                        {currentUser.coinBalance} 🪙
                      </div>
                    </div>
                    <div className="p-4 bg-app-card border border-hairline rounded-2xl">
                      <div className="text-[10px] text-app-muted font-mono uppercase">Member Since</div>
                      <div className="text-xs font-bold text-app-muted font-mono mt-1">
                        {currentUser.createdAt || '2026-01-10'}
                      </div>
                    </div>
                    <div className="p-4 bg-app-card border border-hairline rounded-2xl">
                      <div className="text-[10px] text-app-muted font-mono uppercase">Account Security</div>
                      <div className="text-xs font-bold text-emerald-400 font-mono mt-1 flex items-center space-x-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Protected</span>
                      </div>
                    </div>
                    <div className="p-4 bg-app-card border border-hairline rounded-2xl">
                      <div className="text-[10px] text-app-muted font-mono uppercase">Friend Call Rate</div>
                      <div className="text-xs font-bold text-indigo-300 font-mono mt-1">
                        Discounted when friends
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Location Quick Card & Account Governance */}
          <div className="space-y-6">
            {/* Location Status Card */}
            <div className="p-5 bg-app-card border border-hairline rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-app-heading font-mono uppercase tracking-wider flex items-center space-x-1.5">
                  <MapPin className="w-4 h-4 text-pink-400" />
                  <span>Broadcast Location</span>
                </h3>
                <button
                  onClick={() => setProfileSection('location')}
                  className="text-[11px] text-pink-400 hover:text-pink-300 font-mono font-semibold"
                >
                  Configure ➔
                </button>
              </div>

              <div className="p-4 rounded-xl bg-app-input border border-hairline space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-app-muted font-mono uppercase">Display City</span>
                  {effectiveLocation.isMock && (
                    <span className="px-1.5 py-0.2 rounded bg-pink-500/20 text-pink-300 font-mono font-bold text-[9px] border border-pink-500/40">
                      MOCK ACTIVE
                    </span>
                  )}
                </div>
                <div className="text-base font-bold text-app-heading flex items-center space-x-2">
                  <span>{effectiveLocation.displayCity}</span>
                  <SvgFlag
                    countryCode={currentUser.countryCode}
                    nationality={effectiveLocation.country || currentUser.nationality}
                    size="sm"
                    rounded={true}
                  />
                </div>
                <div className="text-[11px] text-app-muted">
                  {effectiveLocation.isMock
                    ? 'Virtual location is broadcast on Discovery, Quick Match & Calls.'
                    : 'Real device / profile location is displayed.'}
                </div>
              </div>

              {/* Quick GPS Detector Trigger */}
              <button
                onClick={handleDetectExactLocation}
                disabled={isDetectingGps}
                className="w-full py-2.5 px-3 rounded-xl bg-app-input hover:bg-brand-soft text-app-heading text-xs font-mono font-bold transition-all flex items-center justify-center space-x-2 border border-hairline cursor-pointer"
              >
                <Navigation className={`w-3.5 h-3.5 text-indigo-400 ${isDetectingGps ? 'animate-spin' : ''}`} />
                <span>{isDetectingGps ? 'Querying GPS Satellite...' : 'Detect Exact GPS Location'}</span>
              </button>
            </div>

            {/* Registered Account Email & Cloud Sync Card */}
            <div className="p-5 bg-app-card border border-hairline rounded-2xl space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-app-heading font-mono font-bold">
                  <Mail className="w-4 h-4 text-indigo-400" />
                  <span>Account Email</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold">
                  Verified
                </span>
              </div>
              <div className="p-3 bg-app-input rounded-xl border border-hairline flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <div className="text-[10px] text-app-muted font-mono uppercase">Primary Address</div>
                  <div className="text-xs font-mono font-bold text-app-heading truncate">
                    {currentUser.email || `${currentUser.id.slice(0, 8)}@livecall.app`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="px-2.5 py-1.5 rounded-lg bg-app-input hover:bg-brand-soft text-app-heading font-mono text-[10px] font-bold flex items-center space-x-1 shrink-0 border border-hairline transition-colors"
                  title="Copy email to clipboard"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </button>
              </div>
              <div className="flex items-center space-x-1.5 text-[10px] font-mono text-app-muted">
                <Cloud className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>Synced with Cloudflare R2 & Supabase Auth</span>
              </div>
            </div>

            {/* Permanent Gender Lock & Policy Card */}
            <div className="p-5 bg-app-card border border-hairline rounded-2xl space-y-3 text-xs">
              <div className="flex items-center space-x-2 text-app-heading font-mono font-bold">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span>Gender Lock Status</span>
              </div>
              <p className="text-app-muted leading-relaxed text-[11px]">
                Your registered gender is locked to <strong className="text-app-heading uppercase">{currentUser.gender}</strong> to protect the 1-on-1 coin economy and prevent fraudulent role switching.
              </p>
              <div className="p-2.5 rounded-lg bg-app-input border border-hairline text-[10px] text-app-muted font-mono flex items-center justify-between">
                <span>Lock Protocol:</span>
                <span className="text-emerald-400 font-bold">ACTIVE & VERIFIED</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. TAB CONTENT 2: LOCATION & GEOLOCATION (CORE USER REQUIREMENT) */}
      {profileSection === 'location' && (
        <div className="space-y-6">
          
          {/* Header Description */}
          <div className="p-5 bg-app-card border border-hairline rounded-2xl space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-app-heading font-mono uppercase tracking-wider">
                    Geolocation & Mock Location Studio
                  </h2>
                  <p className="text-xs text-app-muted">
                    Manage your exact physical GPS telemetry and virtual broadcast coordinates.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono text-app-muted">Current Broadcast:</span>
                <span className="px-3 py-1 rounded-xl bg-app-input border border-hairline text-app-heading font-bold text-xs flex items-center space-x-1.5 shadow-sm">
                  <span>{effectiveLocation.displayCity}</span>
                  <span>{effectiveLocation.flag}</span>
                  {effectiveLocation.isMock && (
                    <span className="px-1 py-0.2 rounded bg-pink-600 text-white text-[8px] font-mono">
                      MOCK
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* SECTION A: EXACT DEVICE GPS TELEMETRY (For All Users) */}
            <div className="p-5 sm:p-6 bg-app-card border border-hairline rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Navigation className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-app-heading font-mono uppercase tracking-wider">
                    Real Device GPS Coordinates
                  </h3>
                </div>
                {currentUser.exactLocation && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold">
                    GPS LOCKED
                  </span>
                )}
              </div>

              <p className="text-xs text-app-muted leading-relaxed">
                Connects with your device's browser Geolocation API to fetch physical latitude, longitude, and country ISO data with satellite precision.
              </p>

              {/* Exact Location Card Display */}
              {currentUser.exactLocation ? (
                <div className="p-4 rounded-xl bg-app-input border border-hairline space-y-3 font-mono text-xs">
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-app-muted block">Latitude:</span>
                      <span className="text-app-heading font-bold">{(currentUser.exactLocation.latitude ?? 0).toFixed(5)}° N</span>
                    </div>
                    <div>
                      <span className="text-app-muted block">Longitude:</span>
                      <span className="text-app-heading font-bold">{(currentUser.exactLocation.longitude ?? 0).toFixed(5)}° E</span>
                    </div>
                    <div>
                      <span className="text-app-muted block">Detected City:</span>
                      <span className="text-emerald-400 font-bold">{currentUser.exactLocation.city}, {currentUser.exactLocation.country}</span>
                    </div>
                    <div>
                      <span className="text-app-muted block">Accuracy Radius:</span>
                      <span className="text-indigo-400 font-bold">±{currentUser.exactLocation.accuracyMeters || 15} meters</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-hairline text-[10px] text-app-muted flex items-center justify-between">
                    <span>Detected: {currentUser.exactLocation.detectedAt || 'Just now'}</span>
                    <span className="text-emerald-400 flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Verified Signal</span>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-app-input border border-dashed border-hairline text-center space-y-2 py-6">
                  <Compass className="w-8 h-8 text-app-muted mx-auto" />
                  <p className="text-xs text-app-muted">No exact GPS coordinates stored yet.</p>
                  <p className="text-[11px] text-app-muted">
                    Click the button below to allow your browser to detect your current city and location.
                  </p>
                </div>
              )}

              {gpsError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{gpsError}</span>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleDetectExactLocation}
                disabled={isDetectingGps}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-mono font-bold text-xs transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isDetectingGps ? 'animate-spin' : ''}`} />
                <span>{isDetectingGps ? 'Acquiring GPS Fix...' : 'Acquire Exact Real GPS Location'}</span>
              </button>
            </div>

            {/* SECTION B: FEMALE HOST MOCK LOCATION (Special Feature) */}
            <div className="p-5 sm:p-6 bg-app-card border border-hairline rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-pink-400" />
                  <h3 className="text-xs font-bold text-app-heading font-mono uppercase tracking-wider">
                    Female Host Mock Location Spoof
                  </h3>
                </div>
                {isFemale && (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                      currentUser.allowMockLocation
                        ? 'bg-pink-500/20 border-pink-500/40 text-pink-300'
                        : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    }`}
                  >
                    {currentUser.allowMockLocation ? 'ADMIN ALLOWED' : 'ADMIN PERMISSION REQUIRED'}
                  </span>
                )}
              </div>

              {isFemale ? (
                currentUser.allowMockLocation ? (
                  <div className="space-y-4">
                    <p className="text-xs text-app-muted leading-relaxed">
                      As an authorized female host, you can choose a virtual location (e.g. Miami, Paris, Tokyo) to protect your real physical privacy and match with callers from specific countries.
                    </p>

                    {/* Mock Location Master Switch */}
                    <div className="p-4 rounded-xl bg-app-input border border-pink-500/30 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-app-heading text-xs flex items-center space-x-2">
                          <span>Enable Virtual Mock Location</span>
                          {currentUser.isUsingMockLocation && (
                            <span className="px-1.5 py-0.2 rounded bg-pink-600 text-white font-mono text-[9px]">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-app-muted mt-0.5">
                          {currentUser.isUsingMockLocation
                            ? `Broadcasting: ${currentUser.mockLocationCity || 'Miami'}, ${currentUser.mockLocationCountry || 'United States'}`
                            : 'Currently using your real profile location.'}
                        </p>
                      </div>

                      <button
                        onClick={() => handleToggleMockLocation(!currentUser.isUsingMockLocation)}
                        className={`px-3 py-1.5 rounded-xl font-mono font-bold text-xs transition-all cursor-pointer ${
                          currentUser.isUsingMockLocation
                            ? 'bg-pink-600 text-white border border-pink-500 shadow-md shadow-pink-600/30'
                            : 'bg-app-input text-app-muted border border-hairline hover:text-app-heading'
                        }`}
                      >
                        {currentUser.isUsingMockLocation ? '✓ Mock ON' : '○ Mock OFF'}
                      </button>
                    </div>

                    {/* Popular City Preset Grid */}
                    <div className="space-y-2">
                      <label className="block text-[11px] font-bold text-app-muted font-mono uppercase flex items-center space-x-1.5">
                        <span>Quick Mock Location Presets</span>
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {POPULAR_MOCK_LOCATIONS.map((preset) => {
                          const isSelected =
                            currentUser.isUsingMockLocation &&
                            currentUser.mockLocationCity === preset.city;
                          return (
                            <button
                              key={preset.id}
                              onClick={() => handleSelectMockPreset(preset)}
                              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-pink-500/20 border-pink-500 text-app-heading ring-1 ring-pink-500/40 shadow-sm'
                                  : 'bg-app-input border-hairline text-app-muted hover:border-hairline hover:bg-app-input'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm">{preset.flag}</span>
                                <span className="text-[9px] font-mono text-app-muted uppercase">
                                  {preset.countryCode}
                                </span>
                              </div>
                              <div className="mt-1">
                                <div className="font-bold text-xs truncate">{preset.city}</div>
                                <div className="text-[10px] text-app-muted truncate">{preset.country}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom Mock City Input */}
                    <div className="pt-3 border-t border-hairline space-y-2">
                      <label className="block text-[11px] font-bold text-app-muted font-mono uppercase">
                        Or Enter Custom Virtual Location
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={currentUser.mockLocationCity || ''}
                          onChange={(e) =>
                            updateUserProfile(currentUser.id, {
                              mockLocationCity: e.target.value,
                              isUsingMockLocation: true,
                            })
                          }
                          placeholder="City name (e.g. Rome)"
                          className="px-3 py-2 bg-app-input border border-hairline rounded-xl text-app-heading font-mono text-xs focus:outline-none focus:border-pink-500"
                        />
                        <input
                          type="text"
                          value={currentUser.mockLocationCountry || ''}
                          onChange={(e) =>
                            updateUserProfile(currentUser.id, {
                              mockLocationCountry: e.target.value,
                              isUsingMockLocation: true,
                            })
                          }
                          placeholder="Country (e.g. Italy)"
                          className="px-3 py-2 bg-app-input border border-hairline rounded-xl text-app-heading font-mono text-xs focus:outline-none focus:border-pink-500"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 rounded-2xl bg-app-input border border-hairline text-center space-y-3 py-8">
                    <Lock className="w-8 h-8 text-amber-400 mx-auto" />
                    <h4 className="font-bold text-app-heading text-xs">Mock Location Permission Locked</h4>
                    <p className="text-[11px] text-app-muted max-w-sm mx-auto leading-relaxed">
                      To activate the virtual location spoofer, the platform admin must toggle <strong className="text-app-heading font-mono">"Allow Mock Location"</strong> on your creator account in the Admin Terminal.
                    </p>
                    <div className="inline-block px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-bold">
                      Status: Waiting for Admin Enablement
                    </div>
                  </div>
                )
              ) : (
                <div className="p-5 rounded-2xl bg-app-input border border-hairline text-center space-y-3 py-8">
                  <ShieldCheck className="w-8 h-8 text-indigo-400 mx-auto" />
                  <h4 className="font-bold text-app-heading text-xs">Caller Real Location Policy</h4>
                  <p className="text-[11px] text-app-muted max-w-sm mx-auto leading-relaxed">
                    Mock locations are exclusively reserved for verified female creators to protect creator privacy. Male callers broadcast their genuine device location.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB CONTENT 3: EDIT BIO & PROFILE INFORMATION */}
      {profileSection === 'edit_bio' && (
        <form onSubmit={handleSaveProfile} className="p-5 sm:p-7 bg-app-card border border-hairline rounded-2xl space-y-5">
          <div className="flex items-center justify-between border-b border-hairline pb-4">
            <div className="flex items-center space-x-2">
              <div>
                <h2 className="text-sm font-bold text-app-heading font-mono uppercase tracking-wider">
                  Edit Bio & Profile Information
                </h2>
                <p className="text-xs text-app-muted">
                  Update your public introduction, languages, and personal details.
                </p>
              </div>
            </div>

            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-bold text-xs transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>

          {/* Avatar & Email Profile Controls */}
          <div className="p-4 bg-app-input border border-hairline rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Camera className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-app-heading font-mono uppercase">
                  Profile Picture & Cloudflare R2 Storage
                </span>
              </div>
              <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 rounded-full flex items-center space-x-1">
                <Cloud className="w-3 h-3" />
                <span>R2 Cloud Synced</span>
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="relative shrink-0 group">
                <img
                  src={formData.avatarUrl || currentUser.avatarUrl}
                  alt="Avatar preview"
                  className="w-16 h-16 rounded-2xl object-cover ring-2 ring-indigo-500/50 shadow-md"
                />
                <button
                  type="button"
                  onClick={() => setIsAvatarModalOpen(true)}
                  className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-mono font-bold cursor-pointer"
                >
                  Change
                </button>
              </div>

              <div className="flex-1 min-w-0 space-y-2 w-full">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => avatarFileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-bold text-xs transition-all shadow-sm flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isUploadingAvatar ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading to R2 ({avatarUploadProgress}%)...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload New Photo (R2)</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAvatarModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-app-input hover:bg-brand-soft text-app-heading font-mono font-bold text-xs transition-all border border-hairline cursor-pointer"
                  >
                    <span>Choose Preset or URL</span>
                  </button>
                </div>

                <div className="text-[11px] text-app-muted font-mono flex items-center space-x-1">
                  <span>Image URL:</span>
                  <span className="text-app-muted truncate max-w-md">
                    {formData.avatarUrl || currentUser.avatarUrl}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-bold text-app-muted font-mono uppercase">Demographics & Taxonomies</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-app-muted font-mono mb-1">
                  Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => {
                    isDirtyRef.current = true;
                    setFormData({ ...formData, name: e.target.value });
                  }}
                  className="w-full px-3 py-2 bg-app-input border border-hairline rounded-xl text-app-heading font-semibold text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-app-muted font-mono mb-1">
                  Account Email (Registered)
                </label>
                <div className="relative">
                  <input
                    type="email"
                    disabled
                    value={currentUser.email || `${currentUser.id.slice(0, 8)}@livecall.app`}
                    className="w-full px-3 py-2 bg-app-input border border-hairline rounded-xl text-app-muted font-mono text-xs cursor-not-allowed pr-16"
                  />
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded bg-app-input hover:bg-brand-soft text-[10px] font-mono font-bold text-app-muted"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <CountrySelector
                  value={formData.countryCode || formData.nationality}
                  onChange={(c) => {
                    isDirtyRef.current = true;
                    const newNationality = c.name;
                    const newCountryCode = c.code.toUpperCase();
                    setFormData((prev) => ({
                      ...prev,
                      nationality: newNationality,
                      countryCode: newCountryCode,
                      locationCity: prev.locationCity === prev.nationality || !prev.locationCity ? newNationality : prev.locationCity,
                    }));
                  }}
                  label="Country / Nationality (Real SVG Flag)"
                />
              </div>

              <div>
                <ZodiacSelector
                  value={formData.zodiac}
                  onChange={(z) => {
                    isDirtyRef.current = true;
                    setFormData((prev) => ({
                      ...prev,
                      zodiac: z ? z.name : '',
                    }));
                  }}
                  label="Zodiac Sign (Real Vector Glyph)"
                />
              </div>
            </div>
          </div>

          {/* Spoken Languages Multi-Select */}
          <div>
            <LanguageSelector
              selectedLanguages={formData.spokenLanguages}
              onChange={(langs) => {
                isDirtyRef.current = true;
                setFormData((prev) => ({
                  ...prev,
                  spokenLanguages: langs,
                }));
              }}
              label="Spoken Languages (Click & Add Multiple)"
            />
          </div>

          {/* Categorized Interests Multi-Select */}
          <div>
            <InterestSelector
              selectedInterests={formData.interests}
              onChange={(ints) => {
                isDirtyRef.current = true;
                setFormData((prev) => ({
                  ...prev,
                  interests: ints,
                }));
              }}
              label="Interests & Passions (Categorized Multi-Select)"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-bold text-app-muted font-mono uppercase">Story & Tagline</span>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-app-muted font-mono mb-1">
                Catchy Tagline / Short Bio
              </label>
              <input
                type="text"
                value={formData.bio}
                onChange={(e) => {
                  isDirtyRef.current = true;
                  setFormData({ ...formData, bio: e.target.value });
                }}
                className="w-full px-3 py-2 bg-app-input border border-hairline rounded-xl text-app-heading text-xs focus:outline-none focus:border-indigo-500"
                placeholder="A short sentence summarizing your vibe..."
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-app-muted font-mono mb-1">
                Extended About Me Story
              </label>
              <textarea
                rows={4}
                value={formData.extendedBio}
                onChange={(e) => {
                  isDirtyRef.current = true;
                  setFormData({ ...formData, extendedBio: e.target.value });
                }}
                className="w-full px-3 py-2 bg-app-input border border-hairline rounded-xl text-app-heading text-xs focus:outline-none focus:border-indigo-500 resize-none"
                placeholder="Tell callers about your background, hobbies, stream schedule, languages, and what you enjoy discussing..."
              />
            </div>
          </div>

          {/* Connection / Gender Preference */}
          <div>
            <label className="block text-[11px] font-bold text-app-muted font-mono mb-2 uppercase flex items-center space-x-1.5">
              <span>Interested in Connecting With (Dating & Match Preferences)</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'female', label: 'Women', sub: 'Creators & Users', icon: '👩' },
                { id: 'male', label: 'Men', sub: 'Male Users', icon: '👨' },
                { id: 'everyone', label: 'Everyone', sub: 'All Members', icon: '👥' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    isDirtyRef.current = true;
                    setFormData({ ...formData, interestedIn: opt.id });
                  }}
                  className={`p-3 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                    formData.interestedIn === opt.id
                      ? 'bg-indigo-600/25 border-indigo-500 text-app-heading shadow-md shadow-indigo-500/20'
                      : 'bg-app-input border-hairline text-app-muted hover:border-hairline'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-base">{opt.icon}</span>
                      <div>
                        <div className="text-app-heading font-bold">{opt.label}</div>
                        <div className="text-[10px] text-app-muted font-normal">{opt.sub}</div>
                      </div>
                    </div>
                    {formData.interestedIn === opt.id && <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {isFemale && canEarnCoins && (
            <div className="p-4 bg-app-input border border-pink-500/20 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Platform Governed Call Rate (Read-Only) */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-pink-300 font-mono mb-1 flex items-center space-x-1.5">
                  <span>1-on-1 Call & Earning Rate</span>
                  <span className="px-1.5 py-0.2 rounded bg-app-input border border-hairline text-app-muted text-[9px] font-normal">
                    🔒 Admin Governed
                  </span>
                </label>
                <div className="p-2.5 bg-app-input border border-hairline rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-app-muted font-mono uppercase">Caller Burn Rate</div>
                    <div className="text-sm font-bold text-amber-300 font-mono">
                      🪙 {systemSettings.coinBurnRatePerMin ?? 120} / min
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-app-muted font-mono uppercase">Your Host Earning</div>
                    <div className="text-sm font-bold text-emerald-400 font-mono">
                      🪙 {currentUser.coinEarnOverrideRate ?? systemSettings.femaleEarningRatePerMin ?? 48} / min
                    </div>
                  </div>
                </div>
              </div>

              {/* Response Rate Guarantee Label */}
              <div>
                <label className="block text-[11px] font-bold text-pink-300 font-mono mb-1">
                  Response Rate Guarantee Label
                </label>
                <input
                  type="text"
                  value={formData.responseRate}
                  onChange={(e) => {
                    isDirtyRef.current = true;
                    setFormData({ ...formData, responseRate: e.target.value });
                  }}
                  className="w-full px-3 py-2 bg-app-input border border-hairline rounded-xl text-app-heading font-mono text-xs focus:outline-none focus:border-pink-500"
                  placeholder="e.g. 99% Instant Reply"
                />
                <p className="text-[10px] text-app-muted mt-1">
                  Custom badge displayed on your profile card (e.g. "99% Instant Reply", "⚡ Fast Pickup").
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-pink-600 hover:brightness-110 text-white font-mono font-bold text-xs transition-all shadow-lg flex items-center space-x-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save & Publish Profile</span>
            </button>
          </div>
        </form>
      )}

      {/* 5. TAB CONTENT 4: RATES, WALLET & EARNINGS */}
      {profileSection === 'rates_earnings' && (
        <div className="space-y-6">
          {isFemale ? (
            /* Female Creator Studio & Payouts Card */
            <div className="p-5 sm:p-7 bg-app-card border border-hairline rounded-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-hairline pb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-app-heading font-mono uppercase tracking-wider">
                      Female Creator Earnings & Payouts Studio
                    </h2>
                    <p className="text-xs text-app-muted">
                      Real-time coin conversion, hosted call logs, and payout requests.
                    </p>
                  </div>
                </div>

                {onNavigateToTab && (
                  <button
                    onClick={() => onNavigateToTab('earnings')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs transition-all shadow-md flex items-center space-x-1"
                  >
                    <span>Full Dashboard ➔</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-app-input border border-hairline rounded-xl space-y-1">
                  <div className="text-[10px] text-app-muted font-mono uppercase">Unclaimed Coins</div>
                  <div className="text-2xl font-black text-amber-400 font-mono flex items-center space-x-1">
                    <span>🪙</span>
                    <span>{currentUser.earningsCoins || 8400}</span>
                  </div>
                  <div className="text-[11px] text-app-muted">
                    Value: ~${coinsToUsd(currentUser.earningsCoins || 8400, getCoinUsdPeg(systemSettings)).toFixed(2)} USD
                  </div>
                </div>

                <div className="p-4 bg-app-input border border-hairline rounded-xl space-y-1">
                  <div className="text-[10px] text-app-muted font-mono uppercase">Lifetime USD Earned</div>
                  <div className="text-2xl font-black text-emerald-400 font-mono">
                    ${(currentUser.totalLifetimeEarnedUSD || 672.00).toFixed(2)}
                  </div>
                  <div className="text-[11px] text-emerald-400 flex items-center space-x-1">
                    <TrendingUp className="w-3 h-3" />
                    <span>Fixed Peg: ${getCoinUsdPeg(systemSettings)} / coin</span>
                  </div>
                </div>

                <div className="p-4 bg-app-input border border-hairline rounded-xl space-y-1">
                  <div className="text-[10px] text-app-muted font-mono uppercase">Call Host Rate</div>
                  <div className="text-2xl font-black text-pink-400 font-mono">
                    {systemSettings.coinBurnRatePerMin || 120} 🪙/min
                  </div>
                  <div className="text-[11px] text-app-muted">Shares from Economy config (call + gift %)</div>
                </div>
              </div>
            </div>
          ) : (
            /* Male User Wallet */
            <div className="p-5 sm:p-7 bg-app-card border border-hairline rounded-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-hairline pb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <Coins className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-app-heading font-mono uppercase tracking-wider">
                      Coin Wallet
                    </h2>
                    <p className="text-xs text-app-muted">
                      Manage your call balance and top-ups.
                    </p>
                  </div>
                </div>

                {onOpenStore && (
                  <button
                    onClick={onOpenStore}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md"
                  >
                    + Top Up Coins
                  </button>
                )}
              </div>

              <div className="p-5 bg-app-input border border-amber-500/30 rounded-2xl space-y-3 max-w-lg">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-app-muted font-mono uppercase">Available Coins</span>
                  <span className="text-xs font-mono text-amber-400 font-bold">
                    Friend rates apply when matched as friends
                  </span>
                </div>
                <div className="text-3xl font-black text-amber-300 font-mono flex items-center space-x-2">
                  <span>🪙</span>
                  <span>{currentUser.coinBalance}</span>
                </div>
                <p className="text-xs text-app-muted">
                  Coins are spent per minute on 1-on-1 private video calls and for sending virtual gifts.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. TAB CONTENT 5: MEDIA & GALLERY */}
      {profileSection === 'media' && (
        <div className="p-5 sm:p-7 bg-app-card border border-hairline rounded-2xl space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-hairline pb-4">
            <div className="flex items-center space-x-2">
              <div>
                <h2 className="text-sm font-bold text-app-heading font-mono uppercase tracking-wider flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-pink-400" />
                  <span>Photo Gallery & Moments Feed</span>
                </h2>
                <p className="text-xs text-app-muted">
                  High-resolution pictures uploaded directly to Cloudflare R2 and synced with your public profile.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAddGalleryModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-mono font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-pink-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Photo (R2)</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {/* 1. Add Photo Quick Card */}
            <button
              type="button"
              onClick={() => setIsAddGalleryModalOpen(true)}
              className="aspect-square rounded-2xl border-2 border-dashed border-hairline hover:border-pink-500/60 bg-app-input hover:bg-app-input flex flex-col items-center justify-center text-center p-3 transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 group-hover:bg-pink-500/20 text-pink-400 flex items-center justify-center mb-1.5 transition-colors">
                <Plus className="w-5 h-5" />
              </div>
              <span className="font-bold text-app-heading text-xs">Upload Photo</span>
              <span className="text-[10px] text-app-muted font-mono">Cloudflare R2</span>
            </button>

            {/* 2. Gallery Images */}
            {(currentUser.gallery && currentUser.gallery.length > 0
              ? currentUser.gallery
              : [currentUser.avatarUrl]
            ).map((img, idx) => (
              <div
                key={idx}
                className="relative aspect-square rounded-2xl overflow-hidden border border-hairline group shadow-md bg-app-input"
              >
                <img src={img} alt="gallery" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2.5">
                  <span className="text-[10px] text-app-heading font-mono font-bold">Photo #{idx + 1}</span>
                  {currentUser.gallery && currentUser.gallery.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveGalleryPhoto(idx)}
                      className="p-1 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white transition-colors cursor-pointer"
                      title="Remove from gallery"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* 6. TAB CONTENT 5: SECURITY & PASSWORD MANAGEMENT */}
      {profileSection === 'security' && (
        <div id="profile-security-section" className="space-y-6">
          {/* Main Password Change Card */}
          <div className="p-5 sm:p-7 bg-app-card border border-hairline rounded-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-app-heading font-mono uppercase tracking-wider">
                    Change Account Password
                  </h2>
                  <p className="text-xs text-app-muted">
                    Update your security credentials for profile protection and seamless login.
                  </p>
                </div>
              </div>

              <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase ${
                currentUser.hasPasswordSet
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
              }`}>
                {currentUser.hasPasswordSet ? '🔒 Password Active' : '⚠️ Password Not Set'}
              </span>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4 max-w-xl">
              {currentUser.hasPasswordSet && (
                <div>
                  <label className="block text-[11px] font-bold text-app-muted font-mono mb-1">
                    Current Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      required
                      value={currentPasswordInput}
                      onChange={(e) => setCurrentPasswordInput(e.target.value)}
                      placeholder="Enter your current password"
                      className="w-full px-3 py-2.5 bg-app-input border border-hairline rounded-xl text-app-heading font-mono text-xs focus:outline-none focus:border-rose-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted hover:text-app-heading"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <PasswordStrengthField
                id="profile-new-password"
                label="New Password"
                value={newPasswordInput}
                onChange={setNewPasswordInput}
                placeholder="Create a strong password"
                autoComplete="new-password"
                inputClassName="w-full px-3 py-2.5 bg-app-input border border-hairline rounded-xl text-app-heading font-mono text-xs focus:outline-none focus:border-rose-500 pl-10 pr-10"
              />

              <PasswordStrengthField
                id="profile-confirm-password"
                label="Confirm New Password"
                value={confirmPasswordInput}
                onChange={setConfirmPasswordInput}
                placeholder="Re-type new password"
                autoComplete="new-password"
                showStrengthUi={false}
                matchAgainst={newPasswordInput}
                showMatchStatus
                inputClassName="w-full px-3 py-2.5 bg-app-input border border-hairline rounded-xl text-app-heading font-mono text-xs focus:outline-none focus:border-rose-500 pl-10 pr-10"
              />

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={
                    passwordSubmitting ||
                    !isPasswordPolicyValid(newPasswordInput) ||
                    newPasswordInput !== confirmPasswordInput
                  }
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-mono font-bold text-xs transition-all shadow-lg flex items-center space-x-2 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{passwordSubmitting ? 'Updating Password...' : 'Save New Password'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Account Security Overview Matrix */}
          <div className="space-y-1.5">
            <div className="flex items-center space-x-1.5 px-1">
              <span className="text-[11px] font-bold text-app-muted font-mono uppercase">Security Standards Matrix</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-4 bg-app-card border border-hairline rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-app-muted font-mono">Gender Lock</span>
                  <Lock className="w-4 h-4 text-pink-400" />
                </div>
                <div className="text-sm font-bold text-app-heading capitalize">{currentUser.gender} Profile</div>
                <p className="text-[11px] text-app-muted leading-relaxed">
                  Gender identity is permanently locked to protect video match integrity and creator payouts.
                </p>
              </div>

              <div className="p-4 bg-app-card border border-hairline rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-app-muted font-mono">End-to-End Encryption</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-sm font-bold text-emerald-400">WebRTC DTLS / SRTP</div>
                <p className="text-[11px] text-app-muted leading-relaxed">
                  All 1-on-1 video streams, live audio, and direct chat messages are securely peer-encrypted.
                </p>
              </div>

              <div className="p-4 bg-app-card border border-hairline rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-app-muted font-mono">Account ID & Token</span>
                  <User className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-xs font-mono font-bold text-app-heading truncate">{currentUser.id}</div>
                <p className="text-[11px] text-app-muted leading-relaxed">
                  Unique persistent account identifier synced with Cloud / Supabase database.
                </p>
              </div>
            </div>
          </div>

          {!isAdmin && (
            <div className="p-5 sm:p-7 bg-app-card border border-rose-900/60 rounded-2xl space-y-4">
              <div className="flex items-start space-x-3 border-b border-rose-900/40 pb-4">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-rose-200 font-mono uppercase tracking-wider">
                    Delete Account
                  </h2>
                  <p className="text-xs text-app-muted mt-1 leading-relaxed">
                    Permanently removes your profile, login, and associated data. This cannot be undone.
                    You will not be able to sign in with this email afterward.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSelfDeleteAccount} className="space-y-3 max-w-xl">
                <div>
                  <label className="block text-[11px] font-bold text-app-muted font-mono mb-1">
                    Type DELETE or your email to confirm
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmPhrase}
                    onChange={(e) => setDeleteConfirmPhrase(e.target.value)}
                    placeholder="DELETE"
                    autoComplete="off"
                    className="w-full px-3 py-2.5 bg-app-input border border-rose-900/50 rounded-xl text-app-heading font-mono text-xs focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-app-muted font-mono mb-1">
                    Current password
                  </label>
                  <div className="relative">
                    <input
                      type={showDeletePassword ? 'text' : 'password'}
                      value={deletePasswordInput}
                      onChange={(e) => setDeletePasswordInput(e.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      className="w-full px-3 py-2.5 bg-app-input border border-rose-900/50 rounded-xl text-app-heading font-mono text-xs focus:outline-none focus:border-rose-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDeletePassword(!showDeletePassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted hover:text-app-heading"
                    >
                      {showDeletePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={deleteSubmitting || !deleteConfirmPhrase.trim() || !deletePasswordInput.trim()}
                  className="px-6 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-mono font-bold text-xs transition-all flex items-center space-x-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deleteSubmitting ? 'Deleting Account...' : 'Permanently Delete My Account'}</span>
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* 7. AVATAR & CLOUDFLARE R2 UPLOAD MODAL DIALOG */}
      {isAvatarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div
            className="bg-app-card border border-hairline rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-app-heading font-mono flex items-center space-x-2">
                    <span>Update Profile Picture</span>
                  </h3>
                  <div className="flex items-center space-x-1.5 text-[11px] text-app-muted">
                    <Cloud className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Cloudflare R2 Bucket Storage Sync</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(false)}
                className="p-2 rounded-xl bg-app-input hover:bg-brand-soft text-app-muted hover:text-app-heading transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Avatar Preview */}
            <div className="flex items-center space-x-4 p-3.5 bg-app-input border border-hairline rounded-2xl">
              <img
                src={normalizeMediaUrl(currentUser.avatarUrl)}
                alt={currentUser.name}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getFallbackAvatar(currentUser.name, currentUser.gender, currentUser.role);
                }}
                className="w-14 h-14 rounded-2xl object-cover ring-2 ring-indigo-500/50 shadow-md shrink-0 bg-app-input"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-app-heading truncate">{currentUser.name}</div>
                <div className="text-[11px] text-app-muted font-mono truncate">{currentUser.email || `${currentUser.id.slice(0, 8)}@livecall.app`}</div>
                <div className="text-[10px] text-emerald-400 font-mono flex items-center space-x-1 mt-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Current Active Photo</span>
                </div>
              </div>
            </div>

            {/* Interactive Unified Avatar Uploader & Cloudflare R2 Upload */}
            <UnifiedImageUploader
              currentImageUrl={formData.avatarUrl || currentUser.avatarUrl}
              onImageUploaded={(newUrl) => {
                if (!isPersistableMediaUrl(newUrl)) {
                  showToast(
                    'Upload Failed',
                    'Photo preview was shown locally, but the file was not saved to Cloudflare R2.',
                    'error'
                  );
                  return;
                }
                updateUserProfile(currentUser.id, { avatarUrl: newUrl });
                setFormData((prev) => ({ ...prev, avatarUrl: newUrl }));
                showToast('Profile Picture Updated', 'New photo uploaded to Cloudflare R2 and saved to your profile.', 'success');
              }}
              userId={currentUser.id}
              category="avatar"
              aspectRatio="1:1"
              targetRole={currentUser.role}
              targetName={currentUser.name}
              accentColor={currentUser.role === 'team_leader' ? 'amber' : currentUser.gender === 'female' ? 'pink' : 'indigo'}
              title="Profile Picture (Avatar)"
              subtitle="Drag & drop your photo or browse files (Cloudflare R2 Direct Upload)"
              showPresets={true}
              showUrlInput={true}
            />

            {/* Footer Close */}
            <div className="pt-3 border-t border-hairline flex justify-end">
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-app-input hover:bg-brand-soft text-app-muted text-xs font-mono font-bold cursor-pointer transition-colors"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. GALLERY PHOTO UPLOAD MODAL DIALOG */}
      {isAddGalleryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div
            className="bg-app-card border border-hairline rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-app-heading font-mono">Add Photo to Gallery</h3>
                  <p className="text-[11px] text-app-muted">Cloudflare R2 Bucket High-Speed CDN</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddGalleryModalOpen(false)}
                className="p-2 rounded-xl bg-app-input hover:bg-brand-soft text-app-muted hover:text-app-heading transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <UnifiedImageUploader
              onImageUploaded={handleAddGalleryPhoto}
              userId={currentUser.id}
              category="gallery"
              aspectRatio="4:5"
              targetRole={currentUser.role}
              targetName={currentUser.name}
              accentColor="pink"
              title="Gallery Photo"
              subtitle="Upload portrait or landscape photos to your profile gallery"
              showPresets={false}
              showUrlInput={true}
            />

            <div className="pt-3 border-t border-hairline flex justify-end">
              <button
                type="button"
                onClick={() => setIsAddGalleryModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-app-input hover:bg-brand-soft text-app-muted text-xs font-mono font-bold cursor-pointer transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
