import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import {
  UserProfile,
  CoinPackage,
  VirtualGift,
  CallSession,
  PayoutRequest,
  ChatMessage,
  FeedPost,
  SystemSettings,
  UserRole,
  CallLogItem,
  FriendRequest,
  HomeBanner,
  PolicyDocument,
  HomeQuickLink,
  AdminActiveCall,
  IncidentEvidence,
  ResetDataOptions,
  ResetResult,
  CreatorReview,
  QuickMatchItem,
  DailyRewardRecord,
  CreatorMetrics,
  CreatorTier,
} from '../types';
import {
  INITIAL_SYSTEM_SETTINGS,
  INITIAL_COIN_PACKAGES,
  VIRTUAL_GIFTS,
  DEFAULT_ADMIN_USER,
  DEFAULT_TEAM_LEADER_USER,
  INITIAL_HOME_BANNERS,
  INITIAL_POLICY_DOCUMENTS,
  INITIAL_HOME_QUICK_LINKS,
  INITIAL_CREATOR_REVIEWS,
} from '../constants/appDefaults';
import {
  fetchProfilesFromSupabase,
  upsertProfileToSupabase,
  updateUserProfileInSupabase,
  bulkUpsertProfilesToSupabase,
  deleteProfileFromSupabase,
  updateUserStatusInSupabase,
  fetchUserStatusesFromSupabase,
  purgeMockProfilesFromSupabase,
  purgeMessagesFromSupabase,
  purgeMatchesFromSupabase,
  purgeCallLogsFromSupabase,
  purgeFriendRequestsFromSupabase,
  purgePayoutRequestsFromSupabase,
  purgeFeedPostsFromSupabase,
  purgeFavoritesFromSupabase,
  purgeBlockedUsersFromSupabase,
  purgeCreatorGoalsFromSupabase,
  resetFinancialBalancesInSupabase,
  purgeModerationReportsFromSupabase,
  purgeAllProfilesFromSupabase,
  subscribeToRealtimeProfiles,
  saveMessageToSupabase,
  subscribeToRealtimeChat,
  fetchRecentMessagesForUser,
  fetchPayoutRequestsFromSupabase,
  upsertPayoutRequestToSupabase,
  fetchCallLogsFromSupabase,
  insertCallLogToSupabase,
  fetchFriendRequestsFromSupabase,
  upsertFriendRequestToSupabase,
  removeFriendInSupabase,
  fetchSystemConfigsFromSupabase,
  updateSystemConfigsInSupabase,
  fetchHomeBannersFromSupabase,
  upsertHomeBannerToSupabase,
  deleteHomeBannerFromSupabase,
  fetchCmsPoliciesFromSupabase,
  upsertCmsPolicy,
  deleteCmsPolicyFromSupabase,
  fetchHomeQuickLinksFromSupabase,
  upsertHomeQuickLinkToSupabase,
  deleteHomeQuickLinkFromSupabase,
  fetchFeedPostsFromSupabase,
  upsertFeedPostToSupabase,
  deleteFeedPostFromSupabase,
  fetchCoinPackagesFromSupabase,
  upsertCoinPackageToSupabase,
  deleteCoinPackageFromSupabase,
  fetchFavoritesFromSupabase,
  addFavoriteToSupabase,
  removeFavoriteFromSupabase,
  fetchBlockedUsersFromSupabase,
  addBlockedUserToSupabase,
  removeBlockedUserFromSupabase,
  upsertMatchToSupabase,
  fetchMatchesForUser,
  deleteMatchFromSupabase,
  isSupabaseConfigured,
  generateValidUuid,
  isValidUuid,
  pushAllTaxonomiesAndSettingsToSupabase,
  fetchUserDailyRewardsFromSupabase,
  upsertUserDailyRewardsInSupabase,
  mapDbProfileToUserProfile,
} from '../services/supabaseService';
import { updateUserPassword, signOutSupabase } from '../services/supabaseAuthService';
import { getUserEffectiveLocation } from '../utils/location';
import { supabase } from '../lib/supabase';
import type { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';


const DEFAULT_FALLBACK_USER: UserProfile = {
  id: 'guest_user',
  name: 'New Member',
  email: '',
  gender: 'male',
  genderLocked: true,
  age: 21,
  dob: '2000-01-01',
  nationality: 'United States',
  countryCode: 'US',
  spokenLanguages: ['English'],
  bio: '',
  avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=400',
  gallery: [],
  isVerified: false,
  isOnboarded: false,
  agreedToTerms: true,
  onlineStatus: 'online',
  role: 'male_user',
  createdAt: new Date().toISOString().split('T')[0],
  coinBalance: 50,
  hourlyCoinRate: 10,
  earningsCoins: 0,
  totalLifetimeEarnedUSD: 0,
  interests: [],
  tags: [],
};

interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
}

interface AppContextType {
  // State
  users: UserProfile[];
  currentUser: UserProfile;
  isLoggedIn: boolean;
  systemSettings: SystemSettings;
  coinPackages: CoinPackage[];
  virtualGifts: VirtualGift[];
  payoutRequests: PayoutRequest[];
  activeCall: CallSession | null;
  chatMessages: ChatMessage[];
  unreadMessagesCount: number;
  pendingFriendRequestsCount: number;
  readMessageIds: string[];
  markChatAsRead: (otherUserId: string) => void;
  markAllChatsAsRead: () => void;
  feedPosts: FeedPost[];
  callLogs: CallLogItem[];
  friendRequests: FriendRequest[];
  toast: ToastNotification | null;
  fastTestMode: boolean; // Fast 3-second coin burn timer for instant test
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;

  // Home & Policies CMS
  homeBanners: HomeBanner[];
  policyDocuments: PolicyDocument[];
  homeQuickLinks: HomeQuickLink[];
  activePolicyDoc: PolicyDocument | null;
  openPolicyModal: (policyIdOrSlug: string) => void;
  closePolicyModal: () => void;
  saveHomeBanner: (banner: Partial<HomeBanner> & { id?: string }) => void;
  deleteHomeBanner: (bannerId: string) => void;
  toggleBannerActive: (bannerId: string) => void;
  savePolicyDocument: (policy: Partial<PolicyDocument> & { id?: string }) => void;
  deletePolicyDocument: (policyId: string) => void;
  saveHomeQuickLink: (link: Partial<HomeQuickLink> & { id?: string }) => void;
  deleteHomeQuickLink: (linkId: string) => void;

  // Handlers
  showToast: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  hideToast: () => void;
  switchUser: (userOrId: string | UserProfile) => void;
  switchRolePersona: (role: UserRole) => void;
  loginUser: (identifier: string) => boolean;
  logoutUser: () => void;
  registerUser: (userData: Partial<UserProfile>) => UserProfile;
  updateUserProfile: (userId: string, updates: Partial<UserProfile>) => void;
  changeUserPassword: (userId: string, currentPassword: string, newPassword: string) => { success: boolean; message: string };

  // Economy & Store
  buyCoinPackage: (packageId: string) => void;
  purchaseVip: (tier: 'bronze' | 'silver' | 'gold' | 'diamond') => void;
  claimDailyBonus: () => void;
  dailyBonusClaimed: boolean;

  // Daily Rewards & Quests
  dailyRewardRecord: DailyRewardRecord | null;
  isDailyRewardsModalOpen: boolean;
  openDailyRewardsModal: () => void;
  closeDailyRewardsModal: () => void;
  claimDailyStreak: () => Promise<boolean>;
  claimDailyMission: (missionKey: string) => Promise<boolean>;
  claimDailyMasterChest: () => Promise<boolean>;
  hasUnclaimedDailyRewards: boolean;
  recordChatFriendInteraction: (receiverId: string) => void;
  recordQuickMatchInteraction: () => void;
  recordVideoCallDuration: (seconds: number) => void;
  recordMomentInteraction: () => void;
  recordGiftSentInteraction: () => void;

  // Calls
  startCall: (receiverId: string) => boolean;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
  sendGiftInCall: (giftId: string) => boolean;
  toggleFastTestMode: () => void;
  getEffectiveCallRate: (hostId?: string, callerId?: string) => number;

  // Chat & Social
  sendMessage: (
    receiverId: string,
    text: string,
    targetLang?: string,
    mediaUrl?: string,
    type?: 'text' | 'gift' | 'system' | 'friend_request'
  ) => void;
  clearChatHistory: (otherUserId: string) => void;
  favorites: string[];
  friends: string[];
  blockedUserIds: string[];
  creatorGoals: Record<string, { title: string; currentCoins: number; targetCoins: number }>;
  toggleFavorite: (userId: string) => void;
  toggleFriend: (userId: string) => void;
  addFriend: (userId: string) => void;
  removeFriend: (userId: string) => void;
  isFriend: (userId: string) => boolean;
  sendFriendRequest: (femaleId: string, maleId: string, callLogId?: string) => void;
  acceptFriendRequest: (requestId: string) => void;
  declineFriendRequest: (requestId: string) => void;
  blockUser: (userId: string, reason?: string) => void;
  unblockUser: (userId: string) => void;
  reportUser: (userId: string, reason: string) => void;
  contributeToGoal: (creatorId: string, coins: number) => boolean;

  // Creator Reviews & Ratings
  creatorReviews: CreatorReview[];
  submitCreatorReview: (reviewData: Omit<CreatorReview, 'id' | 'createdAt'>) => void;
  sendRatingRequest: (creatorId: string, callerId: string) => void;
  pendingRatingCall: {
    creatorId: string;
    creatorName: string;
    creatorAvatar: string;
    callLogId: string;
    durationSeconds: number;
  } | null;
  setPendingRatingCall: (call: {
    creatorId: string;
    creatorName: string;
    creatorAvatar: string;
    callLogId: string;
    durationSeconds: number;
  } | null) => void;

  // Female Creator Performance Metrics & Intelligence
  creatorMetricsMap: Record<string, CreatorMetrics>;
  myCreatorMetrics: CreatorMetrics | null;
  toggleReadyNow: (creatorIdOrActive?: string | boolean) => Promise<boolean>;
  sendCreatorHeartbeat: () => Promise<void>;
  claimDailyFirstCallBonus: () => Promise<boolean>;

  // Payouts
  submitPayoutRequest: (amountCoins: number, payoutMethod: string, accountDetails: string) => boolean;

  // Quick Match Live Host Pool & Matches (Last 50)
  liveHostIds: string[];
  activeQuickMatchCallerIds: string[];
  connectedCallersByHost: Record<string, UserProfile[]>;
  connectCallerToHost: (callerProfile: UserProfile, hostId: string) => void;
  disconnectCallerFromHost: (callerId: string, hostId?: string) => void;
  setCallerQuickMatchBrowsing: (isBrowsing: boolean) => void;
  toggleGoLiveQuickMatch: (targetUserId?: string, forceState?: boolean) => boolean;
  isHostLive: (userId: string) => boolean;
  quickMatches: QuickMatchItem[];
  recordQuickMatch: (matchedUser: UserProfile, giftsCoins?: number) => void;
  sendQuickMatchGift: (targetUserId: string, giftKey: string, giftCost: number, giftName: string) => boolean;

  // Admin Operations
  updateSystemSettings: (newSettings: Partial<SystemSettings>) => void;
  updateLiveKitConfig: (config: { apiKey: string; apiSecret: string; wsUrl: string }) => Promise<boolean>;
  saveCoinPackage: (pkg: Partial<CoinPackage> & { id?: string }) => void;
  deleteCoinPackage: (packageId: string) => void;
  saveVirtualGift: (gift: Partial<VirtualGift> & { id?: string }) => void;
  deleteVirtualGift: (giftId: string) => void;
  resetVirtualGifts: () => void;
  adminApprovePayout: (requestId: string, note?: string) => void;
  adminRejectPayout: (requestId: string, note?: string) => void;
  adminUpdateUser: (userId: string, updates: Partial<UserProfile>) => void;
  adminDeleteUser: (userId: string) => void;
  toggleVerifyUser: (userId: string) => void;
  toggleUserStatus: (userId: string, newStatus: 'online' | 'busy' | 'offline' | 'in_call') => void;
  manualGrantCoins: (userId: string, amount: number, reason?: string) => void;
  syncAllProfilesToSupabase: () => Promise<{ success: boolean; count: number; error?: string }>;
  syncUsersFromSupabase: (showNotification?: boolean) => Promise<{ success: boolean; count: number; users?: UserProfile[] }>;
  purgeAllMockData: () => Promise<{ success: boolean; deletedCount: number; message: string }>;
  resetMockDataGranular: (options: ResetDataOptions) => Promise<ResetResult>;
  likePost: (postId: string) => void;
  likeUserMoment: (userId: string, momentId: string) => boolean;
  tipMomentCreator: (creatorId: string, coinAmount?: number) => boolean;
  addFeedPost: (post: Omit<FeedPost, 'id' | 'createdAt' | 'likes' | 'commentsCount'>) => void;

  // Team Leader Operations
  createTeamLeader: (leaderData: Partial<UserProfile>) => UserProfile;
  createCreatorByTeamLeader: (creatorData: Partial<UserProfile>, leaderId?: string) => UserProfile;
  updateCreatorCoinEarnOverride: (creatorId: string, overrideRate: number) => void;
  banCreatorByTeamLeader: (creatorId: string, days: number, reason: string) => Promise<boolean>;
  unbanCreatorByTeamLeader: (creatorId: string) => Promise<boolean>;
  deleteCreatorByTeamLeader: (creatorId: string) => Promise<boolean>;

  // Silent Admin Video Call Monitoring
  adminActiveCalls: AdminActiveCall[];
  incidentEvidenceLogs: IncidentEvidence[];
  refreshAdminActiveCalls: () => void;
  adminTerminateCall: (callId: string, reason?: string) => Promise<boolean>;
  adminIssueCallWarning: (callId: string, warningText: string) => Promise<boolean>;
  adminCaptureEvidence: (callId: string, note?: string, snapshotUrl?: string) => void;
  adminSpawnDemoCall: (hostId?: string, callerId?: string) => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Load state — authoritative social data starts empty and is hydrated from Supabase/server
  const [users, setUsers] = useState<UserProfile[]>(() => []);

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    const saved = localStorage.getItem('livecall_current_user_id');
    return saved || '';
  });

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    const saved = localStorage.getItem('livecall_logged_in');
    if (saved === 'false') return false;
    if (saved === 'true') return true;
    return false;
  });

  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() => {
    const saved = localStorage.getItem('livecall_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migrate legacy 1080p test defaults to system default 720p
        const resolution = parsed.livekitCaptureResolution === '1080p' && !parsed.livekitExplicitlySet ? '720p' : (parsed.livekitCaptureResolution || '720p');
        const profile = resolution === '4k' ? 'ultra_4k' : resolution === '1080p' ? 'hd_1080p' : resolution === '480p' ? 'standard_480p' : 'high_720p';
        const bitrate = resolution === '4k' ? 8500 : resolution === '1080p' ? 5500 : resolution === '480p' ? 1500 : 3500;

        return {
          ...INITIAL_SYSTEM_SETTINGS,
          ...parsed,
          quickMatchTimerSeconds: parsed.quickMatchTimerSeconds !== undefined ? Number(parsed.quickMatchTimerSeconds) : (INITIAL_SYSTEM_SETTINGS.quickMatchTimerSeconds || 5),
          quickMatchGiftPrices: {
            ...INITIAL_SYSTEM_SETTINGS.quickMatchGiftPrices,
            ...(parsed.quickMatchGiftPrices || {}),
          },
          livekitCaptureResolution: resolution,
          videoQualityProfile: profile,
          livekitMaxBitrateKbps: parsed.livekitMaxBitrateKbps && parsed.livekitCaptureResolution !== '1080p' ? parsed.livekitMaxBitrateKbps : bitrate,
        };
      } catch (e) {}
    }
    return INITIAL_SYSTEM_SETTINGS;
  });

  const [coinPackages, setCoinPackages] = useState<CoinPackage[]>(() => {
    const saved = localStorage.getItem('livecall_packages');
    return saved ? JSON.parse(saved) : INITIAL_COIN_PACKAGES;
  });

  const [virtualGifts, setVirtualGifts] = useState<VirtualGift[]>(() => {
    try {
      const saved = localStorage.getItem('livecall_virtual_gifts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { }
    return VIRTUAL_GIFTS;
  });

  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>(() => []);

  const [feedPosts, setFeedPosts] = useState<FeedPost[]>(() => []);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => []);

  const [callLogs, setCallLogs] = useState<CallLogItem[]>(() => []);

  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>(() => []);

  const [creatorReviews, setCreatorReviews] = useState<CreatorReview[]>(() => {
    try {
      const saved = localStorage.getItem('livecall_creator_reviews');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter(
            (r: any) =>
              r &&
              r.creatorId !== 'u1' &&
              r.creatorId !== 'u2' &&
              r.creatorId !== 'u3' &&
              r.callerId !== 'u5' &&
              r.callerId !== 'u6'
          );
        }
      }
    } catch { }
    return [];
  });

  const [pendingRatingCall, setPendingRatingCall] = useState<{
    creatorId: string;
    creatorName: string;
    creatorAvatar: string;
    callLogId: string;
    durationSeconds: number;
  } | null>(null);

  const [readMessageIds, setReadMessageIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('livecall_read_message_ids');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const [fastTestMode, setFastTestMode] = useState<boolean>(false);

  // Dark and Light Theme State
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    const savedUserTheme = localStorage.getItem('livecall_user_theme');
    if (savedUserTheme === 'dark' || savedUserTheme === 'light') {
      return savedUserTheme;
    }
    const savedSettings = localStorage.getItem('livecall_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed.defaultTheme === 'dark' || parsed.defaultTheme === 'light') {
          return parsed.defaultTheme;
        }
      } catch (e) { }
    }
    return INITIAL_SYSTEM_SETTINGS.defaultTheme || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.body.classList.add('dark');
      document.body.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      document.body.classList.add('light');
      document.body.classList.remove('dark');
    }
  }, [theme]);

  const setTheme = (newTheme: 'dark' | 'light') => {
    setThemeState(newTheme);
    localStorage.setItem('livecall_user_theme', newTheme);
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    showToast(
      `${nextTheme === 'dark' ? 'Dark Mode 🌙' : 'Light Mode ☀️'} Active`,
      `Switched application theme to ${nextTheme} mode.`,
      'info'
    );
  };

  // Social & Goals State (Live from Database)
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('livecall_favorites');
    return saved ? JSON.parse(saved) : [];
  });

  const [friends, setFriends] = useState<string[]>(() => []);

  const [blockedUserIds, setBlockedUserIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('livecall_blocked');
    return saved ? JSON.parse(saved) : [];
  });

  const [dailyBonusClaimed, setDailyBonusClaimed] = useState<boolean>(false);
  const [dailyRewardRecord, setDailyRewardRecord] = useState<DailyRewardRecord | null>(null);
  const [isDailyRewardsModalOpen, setIsDailyRewardsModalOpen] = useState<boolean>(false);

  const [creatorGoals, setCreatorGoals] = useState<Record<string, { title: string; currentCoins: number; targetCoins: number }>>({});

  // Quick Match Live Host Pool (Authoritative real-time live host IDs, initial state is empty [])
  const [liveHostIds, setLiveHostIds] = useState<string[]>([]);
  const [activeQuickMatchCallerIds, setActiveQuickMatchCallerIds] = useState<string[]>([]);
  const [connectedCallersByHost, setConnectedCallersByHost] = useState<Record<string, UserProfile[]>>({});

  // Sync live hosts to local storage
  useEffect(() => {
    localStorage.setItem('livecall_live_host_ids_v2', JSON.stringify(liveHostIds));
  }, [liveHostIds]);

  // Home Banners, Policies & Quick Links CMS State
  const [homeBanners, setHomeBanners] = useState<HomeBanner[]>(() => {
    const saved = localStorage.getItem('livecall_home_banners');
    return saved ? JSON.parse(saved) : INITIAL_HOME_BANNERS;
  });

  const [policyDocuments, setPolicyDocuments] = useState<PolicyDocument[]>(() => {
    const saved = localStorage.getItem('livecall_policy_documents');
    return saved ? JSON.parse(saved) : INITIAL_POLICY_DOCUMENTS;
  });

  const [homeQuickLinks, setHomeQuickLinks] = useState<HomeQuickLink[]>(() => {
    const saved = localStorage.getItem('livecall_home_quick_links');
    return saved ? JSON.parse(saved) : INITIAL_HOME_QUICK_LINKS;
  });

  const [activePolicyDoc, setActivePolicyDoc] = useState<PolicyDocument | null>(null);

  // Silent Admin Video Call Monitoring State (Real-time active calls ONLY)
  const [adminActiveCalls, setAdminActiveCalls] = useState<AdminActiveCall[]>(() => {
    const saved = localStorage.getItem('livecall_admin_active_calls');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Strictly filter out any mock demo IDs
          return parsed.filter((c: any) => c.id && !c.id.startsWith('call_live_78219') && !c.id.startsWith('call_live_44901'));
        }
      } catch (e) { }
    }
    return [];
  });

  const [incidentEvidenceLogs, setIncidentEvidenceLogs] = useState<IncidentEvidence[]>(() => {
    const saved = localStorage.getItem('livecall_incident_logs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) { }
    }
    return [];
  });

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('livecall_admin_active_calls', JSON.stringify(adminActiveCalls));
  }, [adminActiveCalls]);

  useEffect(() => {
    localStorage.setItem('livecall_incident_logs', JSON.stringify(incidentEvidenceLogs));
  }, [incidentEvidenceLogs]);

  // Live Timer & Decibel Pulse for Admin Active Call Monitoring
  useEffect(() => {
    if (adminActiveCalls.length === 0) return;

    const timer = setInterval(() => {
      setAdminActiveCalls((prevCalls) =>
        prevCalls.map((call) => {
          if (call.status !== 'active') return call;
          const newDuration = call.durationSeconds + 1;
          const coinsPerMin = call.burnRatePerMin || 10;
          const totalSpent = Math.max(0, Math.floor((newDuration / 60) * coinsPerMin));
          const totalEarned = Math.floor(totalSpent * 0.6); // 60% creator share

          // Realistic audio decibel fluctuations for spectator HUD
          const randomHostDecibel = Math.floor(40 + Math.random() * 45);
          const randomCallerDecibel = Math.floor(25 + Math.random() * 50);

          return {
            ...call,
            durationSeconds: newDuration,
            coinsSpent: totalSpent,
            coinsEarned: totalEarned,
            hostAudioLevel: randomHostDecibel,
            callerAudioLevel: randomCallerDecibel,
          };
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [adminActiveCalls.length]);

  // Persist non-authoritative UI preferences only (not user/social/business data)
  useEffect(() => {
    localStorage.setItem('livecall_current_user_id', currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    localStorage.setItem('livecall_settings', JSON.stringify(systemSettings));
  }, [systemSettings]);

  useEffect(() => {
    localStorage.setItem('livecall_home_banners', JSON.stringify(homeBanners));
  }, [homeBanners]);

  useEffect(() => {
    localStorage.setItem('livecall_creator_reviews', JSON.stringify(creatorReviews));
  }, [creatorReviews]);

  useEffect(() => {
    localStorage.setItem('livecall_policy_documents', JSON.stringify(policyDocuments));
  }, [policyDocuments]);

  useEffect(() => {
    localStorage.setItem('livecall_home_quick_links', JSON.stringify(homeQuickLinks));
  }, [homeQuickLinks]);

  useEffect(() => {
    localStorage.setItem('livecall_packages', JSON.stringify(coinPackages));
  }, [coinPackages]);

  useEffect(() => {
    localStorage.setItem('livecall_read_message_ids', JSON.stringify(readMessageIds));
  }, [readMessageIds]);

  // Real-time cross-tab synchronization listener (UI preferences / ephemeral match signals only)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'livecall_read_message_ids' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setReadMessageIds(parsed);
        } catch {}
      }
      if (e.key === 'livecall_quick_matches_sync' && e.newValue) {
        try {
          const syncData = JSON.parse(e.newValue);
          const myUid = currentUserIdRef.current;
          if (myUid && (myUid === syncData.userA || myUid === syncData.userB)) {
            const saved = localStorage.getItem('livecall_quick_matches_v4_' + myUid);
            if (saved) {
              setQuickMatches(JSON.parse(saved));
            }
          }
        } catch {}
      }
      if (e.key === 'livecall_live_host_ids_v2' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setLiveHostIds(parsed);
        } catch {}
      }
      if (e.key === 'livecall_quick_match_callers_sync' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setActiveQuickMatchCallerIds(parsed);
        } catch {}
      }
      if (e.key === 'livecall_quick_match_caller_connected_sync' && e.newValue) {
        try {
          const payload = JSON.parse(e.newValue);
          if (payload.type === 'connect' && payload.hostId && payload.callerProfile) {
            setConnectedCallersByHost((prev) => {
              const existing = prev[payload.hostId] || [];
              if (existing.some((u) => u.id === payload.callerProfile.id)) return prev;
              return { ...prev, [payload.hostId]: [payload.callerProfile, ...existing] };
            });
          } else if (payload.type === 'disconnect' && payload.callerId) {
            setConnectedCallersByHost((prev) => {
              const next: Record<string, UserProfile[]> = {};
              for (const [hId, callers] of Object.entries(prev)) {
                if (payload.hostId && hId !== payload.hostId) {
                  next[hId] = callers;
                } else {
                  next[hId] = callers.filter((c) => c.id !== payload.callerId);
                }
              }
              return next;
            });
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const currentUser =
    (currentUserId
      ? users.find((u) => u.id === currentUserId) ||
        users.find((u) => u.authId && u.authId === currentUserId) ||
        users.find((u) => u.email && currentUserId && u.email.toLowerCase() === currentUserId.toLowerCase())
      : undefined) ||
    (isLoggedIn ? users[0] : undefined) ||
    DEFAULT_FALLBACK_USER;

  // Unread messages count for current user
  const unreadMessagesCount = chatMessages.filter(
    (m) => m.receiverId === currentUser.id && !readMessageIds.includes(m.id)
  ).length;

  // Pending incoming friend requests count for current user
  const pendingFriendRequestsCount = friendRequests.filter(
    (r) => r.receiverId === currentUser.id && r.status === 'pending'
  ).length;

  // Real-time WebSockets Engine for Multi-Device Signaling & Presence
  const wsRef = useRef<WebSocket | null>(null);
  const usersRef = useRef<UserProfile[]>(users);
  const prevUserIdRef = useRef<string | null>(null);
  const isLoggedInRef = useRef<boolean>(isLoggedIn);
  const currentUserIdRef = useRef<string>(currentUserId);
  const adminActiveCallsRef = useRef<AdminActiveCall[]>(adminActiveCalls);
  const activeCallRef = useRef<CallSession | null>(activeCall);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  useEffect(() => {
    isLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  // -------------------------------------------------------------------------
  // Supabase Auth rehydration — session.user.id is the identity source of truth
  // when a valid session exists. localStorage remains a fallback for offline /
  // persona / custom-OTP flows that have no Supabase session yet.
  // -------------------------------------------------------------------------
  const authHydratingRef = useRef(false);
  const supabaseAuthUserIdRef = useRef<string | null>(null);

  const clearLocalAuthState = useCallback((prevId?: string) => {
    const clearedId = prevId || currentUserIdRef.current;
    isLoggedInRef.current = false;
    currentUserIdRef.current = '';
    supabaseAuthUserIdRef.current = null;
    setIsLoggedIn(false);
    setCurrentUserId('');
    localStorage.setItem('livecall_logged_in', 'false');
    localStorage.removeItem('livecall_current_user_id');

    if (clearedId) {
      setUsers((prev) =>
        prev.map((u) => (u.id === clearedId || u.authId === clearedId ? { ...u, onlineStatus: 'offline' as const } : u))
      );
    }
  }, []);

  const applySupabaseSessionUser = useCallback(async (authUser: SupabaseAuthUser) => {
    const authUserId = String(authUser.id || '').trim();
    if (!authUserId) return;

    authHydratingRef.current = true;
    supabaseAuthUserIdRef.current = authUserId;

    try {
      const email = (authUser.email || '').trim().toLowerCase();
      const meta = authUser.user_metadata || {};
      let profile =
        usersRef.current.find((u) => u.id === authUserId) ||
        usersRef.current.find((u) => u.authId === authUserId) ||
        (email
          ? usersRef.current.find((u) => u.email && u.email.toLowerCase().trim() === email)
          : undefined);

      // Fetch authoritative profile from Supabase when not already in memory
      if (!profile && isSupabaseConfigured()) {
        try {
          let dbProfile: any = null;
          const { data: byAuth } = await supabase
            .from('profiles')
            .select('*')
            .eq('auth_id', authUserId)
            .maybeSingle();
          if (byAuth) {
            dbProfile = byAuth;
          } else {
            const { data: byId } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', authUserId)
              .maybeSingle();
            if (byId) {
              dbProfile = byId;
            } else if (email) {
              const { data: byEmail } = await supabase
                .from('profiles')
                .select('*')
                .ilike('email', email)
                .maybeSingle();
              dbProfile = byEmail;
            }
          }
          if (dbProfile) {
            profile = mapDbProfileToUserProfile(dbProfile);
            if (!profile.authId) profile.authId = authUserId;
          }
        } catch (err) {
          console.warn('[Auth Rehydrate] Profile fetch warning:', err);
        }
      }

      // Minimal safe stub so UI never crashes while profile sync catches up
      if (!profile) {
        const metaRole = (meta.role as UserRole) || 'male_user';
        const isFemale = metaRole === 'female_user' || metaRole === 'female_creator';
        profile = {
          ...DEFAULT_FALLBACK_USER,
          id: authUserId,
          authId: authUserId,
          name: meta.full_name || meta.display_name || meta.name || (email ? email.split('@')[0] : 'Member'),
          email: email || '',
          gender: isFemale ? 'female' : metaRole === 'other_user' ? 'other' : 'male',
          role: metaRole,
          isOnboarded: Boolean(meta.is_onboarded),
          onlineStatus: 'online',
          coinBalance: isFemale ? 0 : 50,
        };
      }

      // Prefer the persistent profile id when present; keep authId linked
      const activeId = profile.id || authUserId;
      profile = {
        ...profile,
        id: activeId,
        authId: profile.authId || authUserId,
        onlineStatus: 'online',
      };

      isLoggedInRef.current = true;
      currentUserIdRef.current = activeId;
      setCurrentUserId(activeId);
      setIsLoggedIn(true);
      localStorage.setItem('livecall_logged_in', 'true');
      localStorage.setItem('livecall_current_user_id', activeId);

      setUsers((prev) => {
        const cleanEmail = profile!.email ? profile!.email.toLowerCase().trim() : null;
        const remaining = prev.filter((u) => {
          if (u.id === activeId || u.id === authUserId) return false;
          if (u.authId && (u.authId === authUserId || u.authId === activeId)) return false;
          if (cleanEmail && u.email && u.email.toLowerCase().trim() === cleanEmail) return false;
          return true;
        });
        const next = [profile!, ...remaining];
        usersRef.current = next;
        try {
        } catch {}
        return next;
      });
    } finally {
      authHydratingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | null = null;

    const bootstrapAuth = async () => {
      if (!isSupabaseConfigured()) {
        // No Supabase — keep localStorage identity for offline / persona mode
        return;
      }

      try {
        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;

        if (error) {
          console.warn('[Auth Rehydrate] getSession error:', error.message);
        }

        const session = data?.session as Session | null;
        if (session?.user?.id) {
          await applySupabaseSessionUser(session.user);
        } else {
          // No live session: soft-rehydrate legacy/custom OTP flows that persist
          // a profile id without a Supabase Auth JWT. Do not invent identity.
          const savedLoggedIn = localStorage.getItem('livecall_logged_in');
          const savedUserId = localStorage.getItem('livecall_current_user_id');
          if (savedLoggedIn === 'true' && savedUserId) {
            isLoggedInRef.current = true;
            currentUserIdRef.current = savedUserId;
            setCurrentUserId(savedUserId);
            setIsLoggedIn(true);
          } else if (savedLoggedIn === 'true' && !savedUserId) {
            clearLocalAuthState();
          }
        }
      } catch (err) {
        console.warn('[Auth Rehydrate] bootstrap exception:', err);
      }
    };

    bootstrapAuth();

    if (isSupabaseConfigured()) {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (cancelled) return;

        if (event === 'SIGNED_OUT') {
          clearLocalAuthState();
          return;
        }

        if (
          (event === 'SIGNED_IN' ||
            event === 'TOKEN_REFRESHED' ||
            event === 'USER_UPDATED' ||
            event === 'INITIAL_SESSION') &&
          session?.user?.id
        ) {
          // Avoid fighting an in-progress hydrate from getSession()
          if (authHydratingRef.current && event === 'INITIAL_SESSION') return;
          await applySupabaseSessionUser(session.user);
        }
      });
      subscription = data.subscription;
    }

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [applySupabaseSessionUser, clearLocalAuthState]);

  useEffect(() => {
    adminActiveCallsRef.current = adminActiveCalls;
  }, [adminActiveCalls]);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  // Helper to ensure users who are actively in a call are consistently locked to 'in_call' across all presence updates
  const getUserCallStatus = (uid: string, fallbackStatus: 'online' | 'busy' | 'offline' | 'in_call'): 'online' | 'busy' | 'offline' | 'in_call' => {
    if (activeCallRef.current && (activeCallRef.current.callerId === uid || activeCallRef.current.receiverId === uid) && activeCallRef.current.status !== 'ended') {
      return 'in_call';
    }
    if (adminActiveCallsRef.current.some((ac) => (ac.hostId === uid || ac.callerId === uid) && ac.status === 'active')) {
      return 'in_call';
    }
    return fallbackStatus;
  };

  // Unified helper to calculate effective coin burn rate per minute for any host/caller pair
  const getEffectiveCallRate = (hostId?: string, callerId?: string): number => {
    if (!hostId) return systemSettings.coinBurnRatePerMin ?? 120;
    
    // Determine if the caller and host have an active, accepted friendship
    let isFriendPair = false;
    if (callerId && hostId) {
      const activeReq = friendRequests.find(
        (r) =>
          r.status === 'accepted' &&
          ((r.senderId === callerId && r.receiverId === hostId) ||
            (r.senderId === hostId && r.receiverId === callerId))
      );
      if (activeReq) {
        isFriendPair = true;
      }
    } else if (hostId) {
      isFriendPair = isFriend(hostId);
    }

    if (isFriendPair) {
      return systemSettings.coinBurnRateFriendPerMin ?? 80;
    }
    return systemSettings.coinBurnRatePerMin ?? 120;
  };

  // Live Supabase User Synchronization function (callable from DiscoveryGrid, Admin, and on mount)
  const syncUsersFromSupabase = async (showNotification: boolean = false): Promise<{
    success: boolean;
    count: number;
    users?: UserProfile[];
  }> => {
    try {
      if (isSupabaseConfigured()) {
        const supabaseProfiles = await fetchProfilesFromSupabase();
        if (supabaseProfiles !== null) {
          // Merge Supabase profiles with local users so locally registered users are never wiped
          const localUsers = usersRef.current && usersRef.current.length > 0 ? usersRef.current : [];
          const mergedMap = new Map<string, UserProfile>();
          const emailMap = new Map<string, string>(); // lowercase email -> profileId

          // Add Supabase profiles first (strictly preserving live in-memory presence and active user edits)
          supabaseProfiles.forEach((p) => {
            const localUser = localUsers.find(
              (u) =>
                u.id === p.id ||
                (p.email && u.email && u.email.toLowerCase().trim() === p.email.toLowerCase().trim())
            );
            const isCurrentLoggedIn =
              localUser &&
              (localUser.id === currentUserIdRef.current ||
                (localUser.email && p.email && localUser.email.toLowerCase().trim() === p.email.toLowerCase().trim()));

            if (isCurrentLoggedIn && localUser) {
              // Preserve active logged-in user's profile and location state so background sync never reverts local edits
              mergedMap.set(p.id, {
                ...p,
                name: localUser.name || p.name,
                nationality: localUser.nationality || p.nationality,
                countryCode: (localUser.countryCode || p.countryCode || 'US').toUpperCase(),
                locationCity: localUser.locationCity || p.locationCity,
                bio: localUser.bio !== undefined ? localUser.bio : p.bio,
                extendedBio: localUser.extendedBio !== undefined ? localUser.extendedBio : p.extendedBio,
                avatarUrl: localUser.avatarUrl || p.avatarUrl,
                zodiac: localUser.zodiac || p.zodiac,
                spokenLanguages: localUser.spokenLanguages || p.spokenLanguages,
                interests: localUser.interests || p.interests,
                exactLocation: localUser.exactLocation || p.exactLocation,
                allowMockLocation: localUser.allowMockLocation ?? p.allowMockLocation,
                isUsingMockLocation: localUser.isUsingMockLocation ?? p.isUsingMockLocation,
                mockLocationCity: localUser.mockLocationCity ?? p.mockLocationCity,
                mockLocationCountry: localUser.mockLocationCountry ?? p.mockLocationCountry,
                mockLocationCountryCode: localUser.mockLocationCountryCode ?? p.mockLocationCountryCode,
                onlineStatus: getUserCallStatus(p.id, localUser.onlineStatus),
              });
            } else {
              const liveStatus = localUser ? localUser.onlineStatus : (p.onlineStatus || 'offline');
              mergedMap.set(p.id, {
                ...p,
                onlineStatus: getUserCallStatus(p.id, liveStatus),
              });
            }
            if (p.email) {
              emailMap.set(p.email.toLowerCase().trim(), p.id);
            }
          });

          // Check if there is already an admin profile from Supabase
          const hasSupabaseAdmin = Array.from(mergedMap.values()).some((u) => u.role === 'admin');

          // Preserve any custom newly registered local profiles not yet in Supabase
          localUsers.forEach((lu) => {
            const cleanEmail = lu.email ? lu.email.toLowerCase().trim() : null;

            // If a profile with the same email already exists, merge fields without creating duplicate
            if (cleanEmail && emailMap.has(cleanEmail)) {
              const existingId = emailMap.get(cleanEmail)!;
              const existing = mergedMap.get(existingId);
              if (existing) {
                mergedMap.set(existingId, {
                  ...existing,
                  teamLeaderId: existing.teamLeaderId || lu.teamLeaderId,
                  createdById: existing.createdById || lu.createdById,
                  agencyName: existing.agencyName || lu.agencyName,
                  coinEarnOverrideRate: existing.coinEarnOverrideRate ?? lu.coinEarnOverrideRate,
                  commissionPercent: existing.commissionPercent ?? lu.commissionPercent,
                  teamLeaderNote: existing.teamLeaderNote || lu.teamLeaderNote,
                  hasPasswordSet: lu.hasPasswordSet || existing.hasPasswordSet,
                });
              }
              return;
            }

            // Skip legacy mock placeholder admin IDs if a real admin exists
            if (
              (lu.id === 'admin_user' || lu.id === '00000000-0000-0000-0000-000000000001') &&
              hasSupabaseAdmin
            ) {
              return;
            }

            if (!mergedMap.has(lu.id)) {
              mergedMap.set(lu.id, lu);
              if (cleanEmail) {
                emailMap.set(cleanEmail, lu.id);
              }
              // Asynchronously push to Supabase to ensure cloud persistence
              upsertProfileToSupabase(lu).catch(() => { });
            }
          });


          const finalProfiles = mergedMap.size > 0 ? Array.from(mergedMap.values()) : supabaseProfiles;

          setUsers(finalProfiles);
          usersRef.current = finalProfiles;

          // Sync with server memory so WebSocket and WebRTC signaling have all live profiles
          fetch('/api/users/sync-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ users: finalProfiles, overwrite: true }),
          }).catch((e) => console.warn('Server memory sync notice:', e));

          if (showNotification) {
            showToast(
              'Supabase Synchronized 🟢',
              `Synced ${finalProfiles.length} user profiles with Supabase PostgreSQL.`,
              'success'
            );
          }
          return { success: true, count: finalProfiles.length, users: finalProfiles };
        }
      }

      // If Supabase not reachable or unconfigured, pull latest from server database
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.users)) {
          setUsers(data.users);
          usersRef.current = data.users;
          if (showNotification) {
            showToast('User Directory Synced', `Loaded ${data.users.length} active users from server.`, 'info');
          }
          return { success: true, count: data.users.length, users: data.users };
        }
      }

      return { success: false, count: 0 };
    } catch (e: any) {
      console.warn('Sync from Supabase notice:', e);
      if (showNotification) {
        showToast('Sync Notice', e.message || 'Could not reach Supabase database.', 'warning');
      }
      return { success: false, count: 0 };
    }
  };

  // Initial user directory fetch from server & Supabase for multi-device sync
  const fetchUsersFromServer = async () => {
    await syncUsersFromSupabase(false);
  };

  // Granular Reset: Selective or Full Wipe of Application & Storage State
  const resetMockDataGranular = async (options: ResetDataOptions): Promise<ResetResult> => {
    try {
      const categoriesCleared: string[] = [];
      let currentUsersList = [...users];

      // 1. Users & Accounts
      const mockFemaleIds = currentUsersList.filter((u) => u.gender === 'female' || u.role === 'female_creator').map((u) => u.id);
      const mockMaleIds = currentUsersList.filter((u) => u.gender === 'male' && u.role === 'male_user').map((u) => u.id);
      const adminDefault = currentUsersList.find((u) => u.role === 'admin') || DEFAULT_ADMIN_USER;

      const idsToRemove: string[] = [];

      if (options.mockFemaleCreators) {
        idsToRemove.push(...mockFemaleIds);
        categoriesCleared.push('Female Creators');
      }
      if (options.mockMaleCallers) {
        idsToRemove.push(...mockMaleIds);
        categoriesCleared.push('Male Callers');
      }
      if (options.customUsers) {
        const nonAdminIds = currentUsersList.filter((u) => u.role !== 'admin').map((u) => u.id);
        idsToRemove.push(...nonAdminIds);
        categoriesCleared.push('Users');
      }

      if (idsToRemove.length > 0) {
        const removeSet = new Set(idsToRemove);
        currentUsersList = currentUsersList.filter((u) => !removeSet.has(u.id));
      }

      if (options.adminAccount) {
        const adminIndex = currentUsersList.findIndex((u) => u.role === 'admin' || u.id === 'admin_user');
        if (adminIndex >= 0) {
          currentUsersList[adminIndex] = { ...adminDefault, password: adminDefault.password || 'admin123' };
        } else {
          currentUsersList.push({ ...adminDefault, password: 'admin123' });
        }
        categoriesCleared.push('Admin Account');
      }

      // 2. Profiles & Media
      if (options.profilesMedia) {
        currentUsersList = currentUsersList.map((u) => {
          return {
            ...u,
            verificationVideoUrl: undefined,
            isUsingMockLocation: false,
            mockLocationCity: undefined,
            mockLocationCountry: undefined,
          };
        });
        categoriesCleared.push('Profiles & Media');
      }

      // 3. Coins & Wallet Balances
      if (options.userCoins) {
        currentUsersList = currentUsersList.map((u) =>
          u.role === 'male_user' ? { ...u, coinBalance: 0 } : u
        );
        categoriesCleared.push('Caller Coins');
      }
      if (options.creatorEarnings) {
        currentUsersList = currentUsersList.map((u) =>
          u.role === 'female_creator'
            ? { ...u, earningsCoins: 0, totalLifetimeEarnedUSD: 0, totalCallsHosted: 0, totalCallMinutes: 0 }
            : u
        );
        categoriesCleared.push('Creator Earnings');
      }
      if (options.vipTiers) {
        currentUsersList = currentUsersList.map((u) => ({ ...u, vipTier: 'none' as const }));
        categoriesCleared.push('VIP Memberships');
      }

      // Ensure at least admin exists if all users were wiped
      if (currentUsersList.length === 0) {
        currentUsersList = [{ ...adminDefault, password: 'admin123' }];
      }

      // If current user was removed, switch to admin or next available user
      const isCurrentUserStillPresent = currentUsersList.some((u) => u.id === currentUserId);
      if (!isCurrentUserStillPresent) {
        const nextUser = currentUsersList.find((u) => u.role === 'admin') || currentUsersList[0];
        setCurrentUserId(nextUser.id);
        localStorage.setItem('livecall_current_user_id', nextUser.id);
      }

      // Save users to state & localStorage
      setUsers(currentUsersList);
      usersRef.current = currentUsersList;

      // 4. Transactions & Store
      if (options.payoutRequests) {
        setPayoutRequests([]);
        localStorage.removeItem('livecall_payouts');
        categoriesCleared.push('Payout Requests');
      }
      if (options.coinPackages) {
        setCoinPackages(INITIAL_COIN_PACKAGES);
        localStorage.setItem('livecall_packages', JSON.stringify(INITIAL_COIN_PACKAGES));
        categoriesCleared.push('Coin Store Packages');
      }

      // 5. Chats & Social
      if (options.chatMessages) {
        setChatMessages([]);
        setReadMessageIds([]);
        localStorage.removeItem('livecall_chat');
        localStorage.removeItem('livecall_read_message_ids');
        categoriesCleared.push('Chat Messages');
      }
      if (options.friendRequests) {
        setFriendRequests([]);
        localStorage.removeItem('livecall_friend_requests');
        categoriesCleared.push('Friend Requests');
      }
      if (options.friendsList) {
        setFriends([]);
        localStorage.removeItem('livecall_friends');
        categoriesCleared.push('Friends List');
      }
      if (options.favoritesList) {
        setFavorites([]);
        localStorage.removeItem('livecall_favorites');
        categoriesCleared.push('Favorites');
      }
      if (options.blockedList) {
        setBlockedUserIds([]);
        localStorage.removeItem('livecall_blocked');
        categoriesCleared.push('Blocked Users');
      }

      // 6. Matches & Activity Calls
      if (options.callLogs) {
        setCallLogs([]);
        localStorage.removeItem('livecall_call_logs');
        categoriesCleared.push('Call History Logs');
      }
      if (options.liveHostsPool) {
        setLiveHostIds([]);
        localStorage.removeItem('livecall_live_host_ids_v2');
        categoriesCleared.push('Live Hosts Pool');
      }
      if (options.surveillanceLogs) {
        setIncidentEvidenceLogs([]);
        setAdminActiveCalls([]);
        localStorage.removeItem('livecall_incident_logs');
        localStorage.removeItem('livecall_admin_active_calls');
        categoriesCleared.push('Surveillance Evidence');
      }

      // 7. Feed & Community
      if (options.feedPosts) {
        setFeedPosts([]);
        localStorage.removeItem('livecall_posts');
        categoriesCleared.push('Feed Moments');
      }
      if (options.creatorGoals) {
        setCreatorGoals({});
        categoriesCleared.push('Creator Goals');
      }

      // 8. CMS & Settings
      if (options.homeBanners) {
        setHomeBanners(INITIAL_HOME_BANNERS);
        localStorage.setItem('livecall_home_banners', JSON.stringify(INITIAL_HOME_BANNERS));
        categoriesCleared.push('Home Banners');
      }
      if (options.policyDocuments) {
        setPolicyDocuments(INITIAL_POLICY_DOCUMENTS);
        localStorage.setItem('livecall_policy_documents', JSON.stringify(INITIAL_POLICY_DOCUMENTS));
        categoriesCleared.push('Policy Documents');
      }
      if (options.quickLinks) {
        setHomeQuickLinks(INITIAL_HOME_QUICK_LINKS);
        localStorage.setItem('livecall_home_quick_links', JSON.stringify(INITIAL_HOME_QUICK_LINKS));
        categoriesCleared.push('Quick Links');
      }
      if (options.systemSettings) {
        setSystemSettings(INITIAL_SYSTEM_SETTINGS);
        localStorage.setItem('livecall_settings', JSON.stringify(INITIAL_SYSTEM_SETTINGS));
        categoriesCleared.push('System Settings');
      }

      // 9. Sync with Server
      if (options.syncWithServer !== false) {
        try {
          await fetch('/api/admin/granular-reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clearMockUsers: Boolean(options.mockFemaleCreators || options.mockMaleCallers),
              clearAllUsers: Boolean(options.customUsers && (options.mockFemaleCreators || options.mockMaleCallers)),
              clearAdmin: Boolean(options.adminAccount),
              clearActiveCalls: Boolean(options.surveillanceLogs || options.callLogs),
              clearPresence: true,
              mockIds: idsToRemove,
              chatMessages: Boolean(options.chatMessages),
              callLogs: Boolean(options.callLogs),
              friendRequests: Boolean(options.friendRequests || options.friendsList),
              payoutRequests: Boolean(options.payoutRequests),
              moderationReports: Boolean(options.surveillanceLogs),
              feedPosts: Boolean(options.feedPosts),
              favorites: Boolean(options.favoritesList),
              blockedUsers: Boolean(options.blockedList),
              creatorGoals: Boolean(options.creatorGoals),
              resetBalances: {
                callerCoins: Boolean(options.userCoins),
                creatorEarnings: Boolean(options.creatorEarnings),
                vipTiers: Boolean(options.vipTiers),
              },
            }),
          });
          await fetch('/api/users/sync-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ users: currentUsersList, overwrite: true }),
          });
        } catch (e) {
          console.warn('Server sync warning during granular reset:', e);
        }
      }

      // 10. Sync with Supabase (if checked and configured)
      if (options.syncWithSupabase && isSupabaseConfigured()) {
        try {
          const promises: Promise<any>[] = [];

          if (options.chatMessages) {
            promises.push(purgeMessagesFromSupabase());
          }
          if (options.callLogs) {
            promises.push(purgeCallLogsFromSupabase());
          }
          if (options.callLogs || options.liveHostsPool) {
            promises.push(purgeMatchesFromSupabase());
          }
          if (options.friendRequests || options.friendsList) {
            promises.push(purgeFriendRequestsFromSupabase());
          }
          if (options.payoutRequests) {
            promises.push(purgePayoutRequestsFromSupabase());
          }
          if (options.surveillanceLogs) {
            promises.push(purgeModerationReportsFromSupabase());
          }
          if (options.feedPosts) {
            promises.push(purgeFeedPostsFromSupabase());
          }
          if (options.favoritesList) {
            promises.push(purgeFavoritesFromSupabase());
          }
          if (options.blockedList) {
            promises.push(purgeBlockedUsersFromSupabase());
          }
          if (options.creatorGoals) {
            promises.push(purgeCreatorGoalsFromSupabase());
          }
          if (options.userCoins) {
            promises.push(resetFinancialBalancesInSupabase('caller_coins'));
          }
          if (options.creatorEarnings) {
            promises.push(resetFinancialBalancesInSupabase('creator_earnings'));
          }
          if (options.vipTiers) {
            promises.push(resetFinancialBalancesInSupabase('vip'));
          }

          // Await relation table purges first before deleting profiles to prevent FK constraint violations
          await Promise.allSettled(promises);

          if (idsToRemove.length > 0) {
            await purgeMockProfilesFromSupabase(idsToRemove);
          } else if (options.customUsers && (options.mockFemaleCreators || options.mockMaleCallers)) {
            await purgeAllProfilesFromSupabase(true);
          }
        } catch (e) {
          console.warn('Supabase sync warning during granular reset:', e);
        }
      }

      const summaryText = categoriesCleared.length > 0
        ? `Successfully reset: ${categoriesCleared.join(', ')}.`
        : 'No categories were selected for reset.';

      showToast('Data Reset Applied 🧹', summaryText, 'success');

      return {
        success: true,
        categoriesCleared,
        summary: summaryText,
      };
    } catch (err: any) {
      showToast('Reset Error', err.message || 'Failed to complete data reset.', 'error');
      return {
        success: false,
        categoriesCleared: [],
        summary: 'Error during reset',
        error: err.message,
      };
    }
  };

  // Full Wipe: Resets all mock data categories across storage and runtime
  const purgeAllMockData = async (): Promise<{
    success: boolean;
    deletedCount: number;
    message: string;
  }> => {
    const result = await resetMockDataGranular({
      mockFemaleCreators: true,
      mockMaleCallers: true,
      adminAccount: true,
      customUsers: true,
      profilesMedia: true,
      userCoins: true,
      creatorEarnings: true,
      vipTiers: true,
      payoutRequests: true,
      coinPackages: true,
      chatMessages: true,
      friendRequests: true,
      friendsList: true,
      favoritesList: true,
      blockedList: true,
      callLogs: true,
      liveHostsPool: true,
      surveillanceLogs: true,
      feedPosts: true,
      creatorGoals: true,
      homeBanners: true,
      policyDocuments: true,
      quickLinks: true,
      systemSettings: true,
      syncWithSupabase: isSupabaseConfigured(),
      syncWithServer: true,
    });

    return {
      success: result.success,
      deletedCount: result.categoriesCleared.length,
      message: result.summary,
    };
  };

  // Sync / seed all user profiles to Supabase on demand
  const syncAllProfilesToSupabase = async (): Promise<{ success: boolean; count: number; error?: string }> => {
    try {
      const profilesToSync = usersRef.current && usersRef.current.length > 0 ? usersRef.current : (currentUser ? [currentUser] : [DEFAULT_ADMIN_USER]);
      const res = await bulkUpsertProfilesToSupabase(profilesToSync);
      if (res.success) {
        showToast('Supabase Synced 🟢', `Successfully populated ${res.count} profiles into Supabase database!`, 'success');
      } else {
        showToast('Supabase Sync Failed', res.error || 'Failed to sync profiles to Supabase.', 'error');
      }
      return res;
    } catch (err: any) {
      showToast('Supabase Sync Error', err.message || 'Exception during bulk upsert.', 'error');
      return { success: false, count: 0, error: err.message };
    }
  };

  // Realtime Supabase Profiles Listener: Instant multi-device registration & update sync
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const unsubscribe = subscribeToRealtimeProfiles((event) => {
      try {
        if (event.eventType === 'DELETE') {
          if (event.userId) {
            setUsers((prev) => prev.filter((u) => u.id !== event.userId));
          }
        } else if (event.profile) {
          const liveProfile = event.profile;
          setUsers((prev) => {
            const exists = prev.some((u) => u.id === liveProfile.id);
            if (exists) {
              return prev.map((u) => {
                if (u.id === liveProfile.id) {
                  return {
                    ...u,
                    ...liveProfile,
                    onlineStatus: getUserCallStatus(u.id, u.onlineStatus),
                  };
                }
                return u;
              });
            }
            return [{ ...liveProfile, onlineStatus: getUserCallStatus(liveProfile.id, 'offline') }, ...prev];
          });
        }
      } catch (err) {
        console.warn('Realtime Supabase profiles sync exception:', err);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentUserId || !isSupabaseConfigured()) return;
    let cancelled = false;
    fetchRecentMessagesForUser(currentUserId)
      .then((msgs) => {
        if (!cancelled && msgs && msgs.length > 0) {
          setChatMessages(msgs);
        }
      })
      .catch((e) => console.warn('Supabase messages hydrate note:', e));
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  useEffect(() => {
    fetchUsersFromServer();
    syncUsersFromSupabase();

    if (isSupabaseConfigured()) {
      fetchPayoutRequestsFromSupabase()
        .then((data) => {
          if (data && data.length > 0) {
            setPayoutRequests(data);
          }
        })
        .catch((e) => console.warn('Supabase initial payout fetch note:', e));

      fetchCallLogsFromSupabase()
        .then((data) => {
          if (data && data.length > 0) {
            setCallLogs(data);
          }
        })
        .catch((e) => console.warn('Supabase initial call logs fetch note:', e));

      fetchFriendRequestsFromSupabase()
        .then((data) => {
          if (data && data.length > 0) {
            setFriendRequests(data);
            const uid = currentUserIdRef.current;
            if (uid) {
              const friendIds = data
                .filter((r: any) => r.status === 'accepted' && (r.senderId === uid || r.receiverId === uid))
                .map((r: any) => (r.senderId === uid ? r.receiverId : r.senderId));
              setFriends(Array.from(new Set(friendIds)));
            }
          }
        })
        .catch((e) => console.warn('Supabase initial friend requests fetch note:', e));

      const msgUid = currentUserIdRef.current;
      if (msgUid) {
        fetchRecentMessagesForUser(msgUid)
          .then((msgs) => {
            if (msgs && msgs.length > 0) {
              setChatMessages(msgs);
            }
          })
          .catch((e) => console.warn('Supabase initial messages fetch note:', e));
      }

      fetchSystemConfigsFromSupabase()
        .then((data) => {
          if (data) {
            setSystemSettings((prev) => ({
              ...prev,
              coinBurnRatePerMin: data.coin_burn_rate_per_min ?? prev.coinBurnRatePerMin,
              coinBurnRateFriendPerMin: data.coin_burn_rate_friend_per_min ?? prev.coinBurnRateFriendPerMin,
              femaleHostSharePercent: data.female_host_share_percent ?? prev.femaleHostSharePercent ?? 40,
              teamLeaderSharePercent: data.team_leader_share_percent ?? prev.teamLeaderSharePercent ?? 10,
              giftFemaleHostSharePercent: data.gift_female_host_share_percent ?? prev.giftFemaleHostSharePercent ?? 70,
              giftTeamLeaderSharePercent: data.gift_team_leader_share_percent ?? prev.giftTeamLeaderSharePercent ?? 10,
              enableVirtualGifts: data.enable_virtual_gifts !== undefined ? data.enable_virtual_gifts : (prev.enableVirtualGifts ?? true),
              femaleEarningRatePerMin: data.female_earning_rate_per_min ?? prev.femaleEarningRatePerMin,
              femalePayoutRatioUSD: data.female_payout_ratio_usd ?? prev.femalePayoutRatioUSD,
              minPayoutThresholdUSD: data.min_payout_threshold_usd ?? prev.minPayoutThresholdUSD,
              aiNudityShieldEnabled: data.ai_nudity_shield_enabled !== undefined ? data.ai_nudity_shield_enabled : prev.aiNudityShieldEnabled,
              screenRecordingProtection: data.screen_recording_protection !== undefined ? data.screen_recording_protection : prev.screenRecordingProtection,
              showDevPersonaBar: data.show_dev_persona_bar !== undefined ? data.show_dev_persona_bar : prev.showDevPersonaBar,
              allowedCountryCodes: data.allowed_country_codes && data.allowed_country_codes.length > 0 ? data.allowed_country_codes : prev.allowedCountryCodes,
              allowedLanguages: (data as any).allowed_languages && (data as any).allowed_languages.length > 0 ? (data as any).allowed_languages : prev.allowedLanguages,
              allowedZodiacSigns: (data as any).allowed_zodiac_signs && (data as any).allowed_zodiac_signs.length > 0 ? (data as any).allowed_zodiac_signs : prev.allowedZodiacSigns,
              allowedInterests: (data as any).allowed_interests && (data as any).allowed_interests.length > 0 ? (data as any).allowed_interests : prev.allowedInterests,
              flagSizes: (data as any).flag_sizes_json
                ? (typeof (data as any).flag_sizes_json === 'string'
                    ? JSON.parse((data as any).flag_sizes_json)
                    : (data as any).flag_sizes_json)
                : prev.flagSizes,
              creatorTargetCycle: (data as any).creator_target_cycle ?? prev.creatorTargetCycle,
              creatorTargetBronzeHours: (data as any).creator_target_bronze_hours ?? prev.creatorTargetBronzeHours,
              creatorTargetBronzeCoins: (data as any).creator_target_bronze_coins ?? prev.creatorTargetBronzeCoins,
              creatorTargetBronzeBonusUSD: (data as any).creator_target_bronze_bonus_usd ?? prev.creatorTargetBronzeBonusUSD,
              creatorTargetSilverHours: (data as any).creator_target_silver_hours ?? prev.creatorTargetSilverHours,
              creatorTargetSilverCoins: (data as any).creator_target_silver_coins ?? prev.creatorTargetSilverCoins,
              creatorTargetSilverBonusUSD: (data as any).creator_target_silver_bonus_usd ?? prev.creatorTargetSilverBonusUSD,
              creatorTargetGoldHours: (data as any).creator_target_gold_hours ?? prev.creatorTargetGoldHours,
              creatorTargetGoldCoins: (data as any).creator_target_gold_coins ?? prev.creatorTargetGoldCoins,
              creatorTargetGoldBonusUSD: (data as any).creator_target_gold_bonus_usd ?? prev.creatorTargetGoldBonusUSD,
              peakHoursStart: (data as any).peak_hours_start ?? prev.peakHoursStart,
              peakHoursEnd: (data as any).peak_hours_end ?? prev.peakHoursEnd,
              peakHoursEnabled: (data as any).peak_hours_enabled !== undefined ? (data as any).peak_hours_enabled : prev.peakHoursEnabled,
              callRingTimeoutSeconds: (data as any).call_ring_timeout_seconds ?? prev.callRingTimeoutSeconds,
              dailyFirstCallBonusCoins: (data as any).daily_first_call_bonus_coins ?? prev.dailyFirstCallBonusCoins,
              dailyFirstCallBonusUSD: (data as any).daily_first_call_bonus_usd ?? prev.dailyFirstCallBonusUSD,
              dailyFirstCallMinDurationSec: (data as any).daily_first_call_min_duration_sec ?? prev.dailyFirstCallMinDurationSec,
              streakTargetDays: (data as any).streak_target_days ?? prev.streakTargetDays,
              streakBoostDurationDays: (data as any).streak_boost_duration_days ?? prev.streakBoostDurationDays,
              minDailyActiveHoursForStreak: (data as any).min_daily_active_hours_for_streak ?? prev.minDailyActiveHoursForStreak,
            }));

            if (data.virtual_gifts_json) {
              try {
                const parsed = typeof data.virtual_gifts_json === 'string'
                  ? JSON.parse(data.virtual_gifts_json)
                  : data.virtual_gifts_json;
                if (Array.isArray(parsed) && parsed.length > 0) {
                  setVirtualGifts(parsed);
                  localStorage.setItem('livecall_virtual_gifts', JSON.stringify(parsed));
                }
              } catch { }
            }
          }
        })
        .catch((e) => console.warn('Supabase initial system config fetch note:', e));

      fetchHomeBannersFromSupabase()
        .then((banners) => {
          if (banners && banners.length > 0) {
            setHomeBanners(banners);
            localStorage.setItem('livecall_home_banners', JSON.stringify(banners));
          }
        })
        .catch(() => { });

      fetchCmsPoliciesFromSupabase()
        .then((policies) => {
          if (policies && policies.length > 0) {
            setPolicyDocuments(policies);
            localStorage.setItem('livecall_policy_documents', JSON.stringify(policies));
          }
        })
        .catch(() => { });

      fetchHomeQuickLinksFromSupabase()
        .then((links) => {
          if (links && links.length > 0) {
            setHomeQuickLinks(links);
            localStorage.setItem('livecall_home_quick_links', JSON.stringify(links));
          }
        })
        .catch(() => { });

      fetchFeedPostsFromSupabase()
        .then((posts) => {
          if (posts && posts.length > 0) {
            setFeedPosts(posts);
          }
        })
        .catch(() => { });

      fetchCoinPackagesFromSupabase()
        .then((pkgs) => {
          if (pkgs && pkgs.length > 0) {
            setCoinPackages(pkgs);
            localStorage.setItem('livecall_packages', JSON.stringify(pkgs));
          }
        })
        .catch(() => { });
    }

    // Check for email confirmation link in URL params or hash
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const isAuthVerify = urlParams.get('auth_verify') === '1';
      const verifyEmail = urlParams.get('email');
      const verifyCode = urlParams.get('code');

      if (isAuthVerify && verifyEmail && verifyCode) {
        // Auto verify from email link
        fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: verifyEmail, code: verifyCode }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              showToast(
                'Email Confirmed! 🎉',
                `Your email ${verifyEmail} has been successfully verified. Welcome!`,
                'success'
              );
            }
          })
          .catch((e) => {
            console.warn('URL auto-verify error:', e);
          })
          .finally(() => {
            // Clean URL query parameters
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
          });
      }
    } catch (e) {
      console.warn('URL auth check exception:', e);
    }
  }, []);

  // Helper to map server-side active calls into AdminActiveCall
  const mapServerCallToAdminCall = (sc: any, userList: UserProfile[]): AdminActiveCall => {
    const host =
      userList.find((u) => u.id === sc.receiverId) ||
      userList.find((u) => u.id === sc.callerId && (u.gender === 'female' || u.role === 'female_creator')) ||
      userList.find((u) => u.gender === 'female') ||
      userList[1] || {
        id: sc.receiverId,
        name: 'Elena Petrov',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400',
        hourlyCoinRate: 12,
        nationality: 'Spain',
        countryCode: 'ES',
        age: 24,
        earningsCoins: 7500,
        gender: 'female',
        role: 'female_creator',
      };

    const caller =
      userList.find((u) => u.id === sc.callerId) ||
      userList.find((u) => u.id === sc.receiverId && (u.gender === 'male' || u.role === 'male_user')) ||
      userList.find((u) => u.gender === 'male') ||
      userList[0] || {
        id: sc.callerId,
        name: 'Alex Vance',
        avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=400',
        nationality: 'United States',
        countryCode: 'US',
        vipTier: 'gold',
        coinBalance: 350,
        gender: 'male',
        role: 'male_user',
      };

    const durationSec =
      sc.durationSeconds !== undefined
        ? sc.durationSeconds
        : sc.startTime
          ? Math.max(0, Math.floor((Date.now() - sc.startTime) / 1000))
          : 0;
    const burnRate = host.hourlyCoinRate || 10;
    const coinsSpent = Math.floor((durationSec / 60) * burnRate);
    const coinsEarned = Math.floor(coinsSpent * 0.6);

    return {
      id: sc.id,
      hostId: host.id,
      hostName: host.name,
      hostAvatar: host.avatarUrl,
      hostCountry: host.nationality || 'Spain',
      hostCountryCode: host.countryCode || 'ES',
      hostHourlyRate: host.hourlyCoinRate || 10,
      hostRating: 4.97,
      hostAge: host.age || 24,
      hostEarningsCoins: host.earningsCoins || 7500,
      callerId: caller.id,
      callerName: caller.name,
      callerAvatar: caller.avatarUrl,
      callerCountry: caller.nationality || 'United States',
      callerCountryCode: caller.countryCode || 'US',
      callerVipTier: caller.vipTier || 'gold',
      callerCoinBalance: caller.coinBalance || 350,
      startTime: sc.startTime || Date.now(),
      durationSeconds: durationSec,
      coinsSpent,
      coinsEarned,
      status: sc.status || 'active',
      burnRatePerMin: burnRate,
      videoQuality: systemSettings.livekitCaptureResolution === '4k' ? '4K Ultra HD' : systemSettings.livekitCaptureResolution === '1080p' ? '1080p FHD' : systemSettings.livekitCaptureResolution === '480p' ? '480p SD' : '720p HD',
      fps: 60,
      bitrateKbps: 2400,
      latencyMs: 35,
      packetLoss: 0.01,
      safetyScore: 99.9,
      safetyFlag: 'clean',
      aiShieldActive: false,
      hostAudioLevel: 55,
      callerAudioLevel: 40,
    };
  };

  const refreshAdminActiveCalls = async () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'admin:get_active_calls' }));
    }
    try {
      const res = await fetch('/api/admin/active-calls');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.activeCalls)) {
          if (data.activeCalls.length === 0) {
            setAdminActiveCalls([]);
          } else {
            const mapped = data.activeCalls.map((sc: any) => mapServerCallToAdminCall(sc, usersRef.current));
            setAdminActiveCalls(mapped);
          }
        }
      }
    } catch (e) {
      // quiet fallback
    }
  };

  // Periodic polling for active calls to guarantee 100% sync across incognito/mobile sessions
  useEffect(() => {
    refreshAdminActiveCalls();
    const timer = setInterval(() => {
      refreshAdminActiveCalls();
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let isCancelled = false;
    let ws: WebSocket | null = null;
    let heartbeatTimer: any = null;
    let presenceSyncTimer: any = null;
    let userDirectoryTimer: any = null;
    let supabaseStatusTimer: any = null;

    // Direct HTTP heartbeat & presence sync (guarantees sync even if WS reconnects or across separate tabs/devices)
    const syncPresenceDirect = async () => {
      if (isCancelled) return;
      try {
        const activeUid = currentUserIdRef.current;
        const currentProfile = activeUid ? usersRef.current.find((u) => u.id === activeUid) : null;
        const myStatus = (isLoggedInRef.current && activeUid) ? (currentProfile?.onlineStatus || 'online') : 'offline';

        const res = await fetch('/api/presence/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: activeUid, status: myStatus }),
        });

        if (res.ok && !isCancelled) {
          const data = await res.json();
          if (data.success && data.presence) {
            const presence: Record<string, 'online' | 'busy' | 'offline'> = data.presence;
            setUsers((prev) => {
              let hasChanged = false;
              const next = prev.map((u) => {
                if (u.id === currentUserIdRef.current && isLoggedInRef.current) {
                  const liveCallStatus = getUserCallStatus(u.id, myStatus);
                  if (u.onlineStatus !== liveCallStatus) {
                    hasChanged = true;
                    return { ...u, onlineStatus: liveCallStatus };
                  }
                  return u;
                }
                const liveStatus = getUserCallStatus(u.id, presence[u.id] || 'offline');
                if (u.onlineStatus !== liveStatus) {
                  hasChanged = true;
                  return { ...u, onlineStatus: liveStatus };
                }
                return u;
              });
              return hasChanged ? next : prev;
            });
          }
        }
      } catch (e) {
        // WS takes over seamlessly
      }
    };

    // Dedicated Supabase Social & Friend Requests Synchronizer (preserves server authoritative presence)
    const syncSupabaseStatusCycle = async () => {
      if (isCancelled) return;
      try {
        // 1. Push current user's active status to Supabase for persistence
        if (isLoggedInRef.current && currentUserIdRef.current) {
          const currentProfile = usersRef.current.find((u) => u.id === currentUserIdRef.current);
          const myStatus = currentProfile?.onlineStatus || 'online';
          updateUserStatusInSupabase(currentUserIdRef.current, myStatus).catch(() => { });
        }

        // 2. Sync friend requests from Supabase database
        const dbRequests = await fetchFriendRequestsFromSupabase();
        if (dbRequests && Array.isArray(dbRequests) && !isCancelled) {
          setFriendRequests(dbRequests);
          const uid = currentUserIdRef.current;
          if (uid) {
            const friendIds = dbRequests
              .filter((r: any) => r.status === 'accepted' && (r.senderId === uid || r.receiverId === uid))
              .map((r: any) => (r.senderId === uid ? r.receiverId : r.senderId));
            setFriends(Array.from(new Set(friendIds)));
          }
        }
      } catch (e) {
        // Continue silently
      }
    };

    // User directory sync to pick up new accounts created in other tabs or devices (preserves live presence)
    const syncUserDirectory = async () => {
      if (isCancelled) return;
      try {
        const res = await fetch('/api/users');
        if (res.ok && !isCancelled) {
          const data = await res.json();
          if (data.success && Array.isArray(data.users)) {
            setUsers((prev) => {
              const serverUsersMap = new Map<string, UserProfile>(data.users.map((u: UserProfile) => [u.id, u]));
              const updated = prev.map((u) => {
                // NEVER overwrite current logged-in user profile details with stale server data
                if (u.id === currentUserIdRef.current && isLoggedInRef.current) {
                  return u;
                }
                const sUser = serverUsersMap.get(u.id);
                if (sUser) {
                  // Preserve live presence status tracked authoritatively by the server
                  return { ...u, ...sUser, onlineStatus: getUserCallStatus(u.id, u.onlineStatus) };
                }
                return u;
              });
              data.users.forEach((su: UserProfile) => {
                if (!updated.some((u) => u.id === su.id)) {
                  updated.push({ ...su, onlineStatus: getUserCallStatus(su.id, 'offline') });
                }
              });
              return updated;
            });
          }
        }
      } catch (e) {
        // silent
      }
    };

    function connect() {
      if (isCancelled) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isCancelled) return;
        const prevUser = prevUserIdRef.current;
        const currentProfile = usersRef.current.find((u) => u.id === currentUserId);

        ws?.send(
          JSON.stringify({
            type: 'auth',
            userId: currentUserId,
            prevUserId: prevUser,
            userProfile: currentProfile,
          })
        );
        prevUserIdRef.current = currentUserId;

        ws?.send(JSON.stringify({ type: 'admin:get_active_calls' }));

        // Send instant heartbeat
        ws?.send(JSON.stringify({ type: 'heartbeat', userId: currentUserId }));
      };

      ws.onmessage = (event) => {
        if (isCancelled) return;
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'presence:all') {
            const presence: Record<string, 'online' | 'busy' | 'offline'> = data.presence || {};
            setUsers((prev) => {
              let changed = false;
              const next = prev.map((u) => {
                if (u.id === currentUserIdRef.current && isLoggedInRef.current) {
                  return u;
                }
                const liveStatus = getUserCallStatus(u.id, presence[u.id] || 'offline');
                if (u.onlineStatus !== liveStatus) {
                  changed = true;
                  return { ...u, onlineStatus: liveStatus };
                }
                return u;
              });
              return changed ? next : prev;
            });
          } else if (data.type === 'users:all') {
            if (Array.isArray(data.users) && data.users.length > 0) {
              setUsers((prev) => {
                const serverMap = new Map<string, UserProfile>(data.users.map((u: UserProfile) => [u.id, u]));
                const merged = prev.map((u) => {
                  // Never overwrite active logged-in user profile with stale background server broadcast
                  if (u.id === currentUserIdRef.current) {
                    return u;
                  }
                  const serverUser = serverMap.get(u.id);
                  if (!serverUser) return u;
                  const callStatus = getUserCallStatus(u.id, serverUser.onlineStatus || u.onlineStatus || 'offline');
                  return { ...u, ...serverUser, onlineStatus: callStatus };
                });
                data.users.forEach((su: UserProfile) => {
                  if (!merged.some((u) => u.id === su.id)) {
                    merged.push({ ...su, onlineStatus: getUserCallStatus(su.id, 'offline') });
                  }
                });
                return merged;
              });
            }
          } else if (data.type === 'users:updated') {
            if (data.user) {
              setUsers((prev) => {
                const exists = prev.some((u) => u.id === data.user.id);
                if (exists) {
                  return prev.map((u) => {
                    if (u.id === data.user.id) {
                      if (u.id === currentUserIdRef.current) {
                        return { ...u, ...data.user, onlineStatus: u.onlineStatus };
                      }
                      return { ...u, ...data.user };
                    }
                    return u;
                  });
                }
                return [data.user, ...prev];
              });
            }
          } else if (data.type === 'call:incoming') {
            const { callId, callerId, receiverId } = data;
            setActiveCall({
              id: callId,
              callerId,
              receiverId,
              startTime: Date.now(),
              durationSeconds: 0,
              coinsSpent: 0,
              coinsEarned: 0,
              giftsSent: [],
              status: 'ringing',
            });
            showToast('Incoming Video Call 📹', 'Incoming call ringing on your device!', 'info');
          } else if (data.type === 'call:ringing') {
            const { callId, callerId, receiverId } = data;
            setActiveCall({
              id: callId,
              callerId,
              receiverId,
              startTime: Date.now(),
              durationSeconds: 0,
              coinsSpent: 0,
              coinsEarned: 0,
              giftsSent: [],
              status: 'ringing',
            });
          } else if (data.type === 'call:accepted') {
            const { startTime } = data;
            setActiveCall((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                status: 'active',
                startTime: startTime || Date.now(),
              };
            });
            showToast('Call Connected! 📹', '1-on-1 WebRTC Video Call connected live.', 'success');
          } else if (data.type === 'call:ended') {
            setActiveCall(null);
            showToast('Call Ended', 'The call was ended or declined.', 'info');
          } else if (data.type === 'call:failed') {
            setActiveCall(null);
            showToast('Call Unavailable 🚫', data.reason || 'User is offline or unavailable.', 'error');
          } else if (data.type === 'admin:active_calls_update') {
            const serverCalls: Array<{ id: string; callerId: string; receiverId: string; status: 'active' | 'ringing'; startTime: number; durationSeconds: number }> = data.activeCalls || [];
            if (serverCalls.length === 0) {
              setAdminActiveCalls([]);
            } else {
              const mappedCalls = serverCalls.map((sc) => mapServerCallToAdminCall(sc, usersRef.current));
              setAdminActiveCalls(mappedCalls);
            }
          } else if (data.type === 'chat:message') {
            if (data.message) {
              setChatMessages((prev) => {
                if (prev.some((m) => m.id === data.message.id)) return prev;
                return [...prev, data.message];
              });
            }
          } else if (data.type === 'match:created') {
            const { senderId, receiverId, matchItem } = data;
            const myUid = currentUserIdRef.current;
            if (myUid && (myUid === receiverId || myUid === senderId)) {
              const otherUserId = myUid === receiverId ? senderId : receiverId;
              const otherUser = usersRef.current.find((u) => u.id === otherUserId);
              if (otherUser) {
                const loc = getUserEffectiveLocation(otherUser);
                const newMatch: QuickMatchItem = {
                  id: matchItem?.id || `qm_${Date.now()}_${otherUser.id}`,
                  matchedUserId: otherUser.id,
                  matchedUserName: otherUser.name,
                  matchedUserAvatar: otherUser.avatarUrl,
                  matchedUserGender: otherUser.gender,
                  matchedUserAge: otherUser.age,
                  matchedUserCountryCode: otherUser.countryCode,
                  matchedUserCity: loc.displayCity,
                  matchedAt: matchItem?.matchedAt || new Date().toISOString(),
                  giftsExchangedCoins: matchItem?.giftsExchangedCoins || 0,
                };

                setQuickMatches((prev) => {
                  const filtered = prev.filter((m) => m.matchedUserId !== otherUser.id);
                  const next = [newMatch, ...filtered].slice(0, 50);
                  try {
                    localStorage.setItem('livecall_quick_matches_v4_' + myUid, JSON.stringify(next));
                  } catch (e) {}
                  return next;
                });

                if (myUid === receiverId) {
                  showToast('🎉 Mutual Match!', `${otherUser.name} matched with you in Quick Match!`, 'success');
                }
              }
            }
          } else if (data.type === 'quick_match:live_hosts') {
            if (Array.isArray(data.liveHostIds)) {
              setLiveHostIds(data.liveHostIds);
            }
          } else if (data.type === 'quick_match:active_callers') {
            if (Array.isArray(data.activeCallerIds)) {
              setActiveQuickMatchCallerIds(data.activeCallerIds);
            }
          } else if (data.type === 'quick_match:caller_connected_to_host') {
            const { callerId, hostId, callerProfile } = data;
            if (hostId && (callerProfile || callerId)) {
              const profileToAdd = callerProfile || users.find((u) => u.id === callerId);
              if (profileToAdd) {
                setConnectedCallersByHost((prev) => {
                  const existing = prev[hostId] || [];
                  if (existing.some((u) => u.id === profileToAdd.id)) return prev;
                  return { ...prev, [hostId]: [profileToAdd, ...existing] };
                });
              }
            }
          } else if (data.type === 'quick_match:caller_disconnected_from_host') {
            const { callerId, hostId } = data;
            if (callerId) {
              setConnectedCallersByHost((prev) => {
                const next: Record<string, UserProfile[]> = {};
                for (const [hId, callers] of Object.entries(prev)) {
                  if (hostId && hId !== hostId) {
                    next[hId] = callers;
                  } else {
                    next[hId] = callers.filter((c) => c.id !== callerId);
                  }
                }
                return next;
              });
            }
          } else if (data.type === 'friend_request:incoming') {
            if (data.request) {
              setFriendRequests((prev) => {
                if (prev.some((r) => r.id === data.request.id)) return prev;
                return [data.request, ...prev];
              });
              if (data.request.receiverId === currentUserIdRef.current) {
                showToast(
                  '🌸 Friend Request Received!',
                  `${data.request.senderName} sent you a Friend Request! Accept to unlock discounted Friend Call Rates.`,
                  'success'
                );
              }
            }
          } else if (data.type === 'friend_request:accepted') {
            const { requestId, senderId, receiverId } = data;
            if (requestId) {
              setFriendRequests((prev) =>
                prev.map((r) => (r.id === requestId ? { ...r, status: 'accepted' } : r))
              );
              setChatMessages((prev) =>
                prev.map((m) => {
                  if (m.friendRequestInfo && m.friendRequestInfo.id === requestId) {
                    return {
                      ...m,
                      friendRequestInfo: { ...m.friendRequestInfo, status: 'accepted' },
                      text: `✓ Friend Request Accepted! Special Friend Rate is active for video calls.`,
                    };
                  }
                  return m;
                })
              );
            }
            if (senderId && receiverId) {
              const otherId = senderId === currentUserIdRef.current ? receiverId : senderId;
              setFriends((prev) => {
                const next = Array.from(new Set([...prev, senderId, receiverId, otherId]));
                return next;
              });
            }
          } else if (data.type === 'friend_request:declined') {
            const { requestId } = data;
            if (requestId) {
              setFriendRequests((prev) =>
                prev.map((r) => (r.id === requestId ? { ...r, status: 'declined' } : r))
              );
              setChatMessages((prev) =>
                prev.map((m) => {
                  if (m.friendRequestInfo && m.friendRequestInfo.id === requestId) {
                    return {
                      ...m,
                      friendRequestInfo: { ...m.friendRequestInfo, status: 'declined' },
                      text: `Friend Request declined. Standard call rates remain active.`,
                    };
                  }
                  return m;
                })
              );
            }
          } else if (data.type === 'friend_request:removed') {
            const { userA, userB } = data;
            if (userA === currentUserIdRef.current || userB === currentUserIdRef.current) {
              const otherId = userA === currentUserIdRef.current ? userB : userA;
              setFriends((prev) => {
                const next = prev.filter((id) => id !== otherId && id !== userA && id !== userB);
                return next;
              });
              setFriendRequests((prev) => {
                const next = prev.filter(
                  (r) =>
                    !(
                      (r.senderId === userA && r.receiverId === userB) ||
                      (r.senderId === userB && r.receiverId === userA)
                    )
                );
                return next;
              });
            }
          }
        } catch (e) {
          console.error('WS Parse Error:', e);
        }
      };

      ws.onclose = () => {
        if (!isCancelled) {
          setTimeout(connect, 3000);
        }
      };

      ws.onerror = (err) => {
        console.warn('WebSocket connection warning:', err);
      };
    }

    // Connect WebSocket
    connect();

    // Initial presence + Supabase status push (authoritative DB sync; not a tight poll loop)
    syncPresenceDirect();
    syncSupabaseStatusCycle();
    syncUserDirectory();

    // 1. WebSocket heartbeat — primary liveness signal to the signaling server
    heartbeatTimer = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'heartbeat', userId: currentUserId }));
      }
    }, 5000);

    // 2. HTTP presence fallback only when WS is down (avoids fragile 3s poll spam)
    presenceSyncTimer = setInterval(() => {
      const wsOpen = wsRef.current && wsRef.current.readyState === WebSocket.OPEN;
      if (!wsOpen) {
        syncPresenceDirect();
      }
    }, 15000);

    // 3. User directory refresh from server (authoritative listings)
    userDirectoryTimer = setInterval(() => {
      syncUserDirectory();
    }, 30000);

    // 4. Push own status to Supabase periodically; friend requests hydrate from DB
    supabaseStatusTimer = setInterval(() => {
      syncSupabaseStatusCycle();
    }, 20000);

    // Cross-tab Synchronization using BroadcastChannel (presence only; no social data dumps)
    let broadcastChannel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        broadcastChannel = new BroadcastChannel('livecall_presence_sync_channel');
        broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'presence_updated' || event.data?.type === 'user_switched') {
            // Prefer WS; HTTP only as reconnect aid
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
              syncPresenceDirect();
            }
            syncSupabaseStatusCycle();
          }
        };
        broadcastChannel.postMessage({ type: 'presence_updated', userId: currentUserId });
      }
    } catch (e) { }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'livecall_presence_trigger' || e.key === 'livecall_current_user_id') {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          syncPresenceDirect();
        }
        syncSupabaseStatusCycle();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'heartbeat', userId: currentUserIdRef.current }));
        } else {
          syncPresenceDirect();
        }
        syncSupabaseStatusCycle();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Browser close / tab close / navigation away handler (beacon offline status to server & Supabase)
    const handleUnload = () => {
      const activeUid = currentUserIdRef.current;
      if (activeUid) {
        const payload = JSON.stringify({ userId: activeUid, status: 'offline' });
        try {
          if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/supabase/update-status', payload);
            navigator.sendBeacon('/api/presence', payload);
          } else {
            fetch('/api/supabase/update-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: payload,
              keepalive: true,
            }).catch(() => { });
          }
        } catch (e) { }
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    // Supabase Realtime channel subscription for multi-device broadcast redundancy
    let unsubscribeSupabaseChat = () => { };
    if (isSupabaseConfigured()) {
      unsubscribeSupabaseChat = subscribeToRealtimeChat(currentUserId, (incomingMsg) => {
        setChatMessages((prev) => {
          if (prev.some((m) => m.id === incomingMsg.id)) return prev;
          return [...prev, incomingMsg];
        });
      });
    }

    return () => {
      isCancelled = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (presenceSyncTimer) clearInterval(presenceSyncTimer);
      if (userDirectoryTimer) clearInterval(userDirectoryTimer);
      if (supabaseStatusTimer) clearInterval(supabaseStatusTimer);
      if (broadcastChannel) broadcastChannel.close();
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      if (ws) ws.close();
      unsubscribeSupabaseChat();
    };
  }, [currentUserId]);

  const toastTimerRef = useRef<any>(null);

  const hideToast = () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  };

  const showToast = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    const id = Date.now().toString();
    setToast({ id, title, message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3000);
  };

  const switchUser = (userOrId: string | UserProfile) => {
    let target: UserProfile | undefined;
    let userId: string = '';

    if (typeof userOrId === 'object' && userOrId !== null) {
      target = userOrId;
      userId = userOrId.id;
    } else {
      const searchStr = String(userOrId).trim();
      target = users.find(
        (u) =>
          u.id === searchStr ||
          (u.email && u.email.toLowerCase() === searchStr.toLowerCase()) ||
          u.name.toLowerCase() === searchStr.toLowerCase()
      );
      userId = target ? target.id : searchStr;
    }

    if (!target) {
      console.warn('User target not found for switchUser:', userOrId);
      return;
    }

    if (target.isBanned) {
      const bannedUntil = target.bannedUntil;
      if (bannedUntil) {
        const expiryTime = new Date(bannedUntil).getTime();
        if (Date.now() < expiryTime) {
          const banner = target.bannedByRole === 'team_leader' ? 'your Team Leader' : 'Administration';
          const reason = target.banReason || 'Policy review';
          showToast(
            'Account Suspended 🚫',
            `This host is suspended by ${banner} until ${new Date(bannedUntil).toLocaleString()}. Reason: "${reason}". Login blocked.`,
            'error'
          );
          return;
        }
      } else {
        showToast(
          'Account Suspended 🚫',
          `This account is permanently suspended. Reason: "${target.banReason || 'Violation'}"`,
          'error'
        );
        return;
      }
    }

    const oldId = currentUserId;
    if (oldId && oldId !== userId) {
      updateUserStatusInSupabase(oldId, 'offline').catch(() => { });
      fetch('/api/supabase/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: oldId, status: 'offline' }),
      }).catch(() => { });
    }

    isLoggedInRef.current = true;
    currentUserIdRef.current = userId;
    setCurrentUserId(userId);
    setIsLoggedIn(true);
    localStorage.setItem('livecall_logged_in', 'true');
    localStorage.setItem('livecall_current_user_id', userId);

    const activeProfile: UserProfile = { ...(target as UserProfile), id: userId, onlineStatus: 'online' as const };

    setUsers((prev) => {
      const cleanEmail = activeProfile.email ? activeProfile.email.toLowerCase().trim() : null;
      // Filter out previous occurrences by ID or email
      const remaining = prev.filter((u) => {
        if (u.id === userId) return false;
        if (cleanEmail && u.email && u.email.toLowerCase().trim() === cleanEmail) return false;
        return true;
      });

      const next = [
        activeProfile,
        ...remaining.map((u) => (oldId && u.id === oldId && oldId !== userId ? { ...u, onlineStatus: 'offline' as const } : u)),
      ];
      usersRef.current = next;
      return next;
    });

    updateUserStatusInSupabase(userId, 'online').catch(() => { });
    fetch('/api/supabase/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userId, status: 'online' }),
    }).catch(() => { });

    try {
      localStorage.setItem('livecall_presence_trigger', `${userId}_switch_${Date.now()}`);
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('livecall_presence_sync_channel');
        bc.postMessage({ type: 'user_switched', userId });
        bc.close();
      }
    } catch (e) { }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'auth',
          userId: userId,
          prevUserId: oldId,
          userProfile: target,
        })
      );
    }
  };

  const switchRolePersona = (role: UserRole) => {
    let target = users.find((u) => u.role === role);
    if (!target && role === 'team_leader') {
      target = DEFAULT_TEAM_LEADER_USER;
      setUsers((prev) => [DEFAULT_TEAM_LEADER_USER, ...prev]);
    }
    if (target) {
      const oldId = currentUserId;
      if (oldId && oldId !== target.id) {
        updateUserStatusInSupabase(oldId, 'offline').catch(() => { });
        fetch('/api/supabase/update-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: oldId, status: 'offline' }),
        }).catch(() => { });
      }
      isLoggedInRef.current = true;
      currentUserIdRef.current = target.id;
      setCurrentUserId(target.id);
      setIsLoggedIn(true);
      localStorage.setItem('livecall_logged_in', 'true');
      localStorage.setItem('livecall_current_user_id', target.id);
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id === target.id) return { ...u, onlineStatus: 'online' };
          if (oldId && u.id === oldId && oldId !== target.id) return { ...u, onlineStatus: 'offline' };
          return u;
        })
      );
      updateUserStatusInSupabase(target.id, 'online').catch(() => { });
      fetch('/api/supabase/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: target.id, status: 'online' }),
      }).catch(() => { });
      try {
        localStorage.setItem('livecall_presence_trigger', `${target.id}_switch_${Date.now()}`);
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel('livecall_presence_sync_channel');
          bc.postMessage({ type: 'user_switched', userId: target.id });
          bc.close();
        }
      } catch (e) { }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'auth',
            userId: target.id,
            prevUserId: oldId,
            userProfile: target,
          })
        );
      }
      showToast('Persona Switched', `Active Mode: ${(role || '').toUpperCase().replace('_', ' ')}`, 'info');
    }
  };

  const loginUser = (identifier: string): boolean => {
    const cleanId = identifier.trim().toLowerCase();
    const found = users.find(
      (u) =>
        u.id.toLowerCase() === cleanId ||
        (u.email && u.email.toLowerCase() === cleanId) ||
        u.name.toLowerCase() === cleanId ||
        (u.phone && u.phone === cleanId)
    );
    if (found) {
      const oldId = currentUserId;
      if (oldId && oldId !== found.id) {
        updateUserStatusInSupabase(oldId, 'offline').catch(() => { });
        fetch('/api/supabase/update-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: oldId, status: 'offline' }),
        }).catch(() => { });
      }
      isLoggedInRef.current = true;
      currentUserIdRef.current = found.id;
      setCurrentUserId(found.id);
      setIsLoggedIn(true);
      localStorage.setItem('livecall_logged_in', 'true');
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id === found.id) return { ...u, onlineStatus: 'online' };
          if (oldId && u.id === oldId && oldId !== found.id) return { ...u, onlineStatus: 'offline' };
          return u;
        })
      );
      updateUserStatusInSupabase(found.id, 'online').catch(() => { });
      fetch('/api/supabase/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: found.id, status: 'online' }),
      }).catch(() => { });
      localStorage.setItem('livecall_current_user_id', found.id);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'auth',
            userId: found.id,
            prevUserId: oldId,
            userProfile: found,
          })
        );
      }
      showToast('Welcome Back! 👋', `Logged in as ${found.name}`, 'success');
      return true;
    }
    return false;
  };

  const logoutUser = () => {
    const prevId = currentUserId;
    if (activeCall) {
      endCall();
    }
    isLoggedInRef.current = false;
    currentUserIdRef.current = '';

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'presence:update',
          userId: prevId,
          status: 'offline',
        })
      );
    }
    updateUserStatusInSupabase(prevId, 'offline').catch(() => { });
    fetch('/api/supabase/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: prevId, status: 'offline' }),
    }).catch(() => { });
    fetch('/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: prevId, status: 'offline' }),
    }).catch(() => { });

    try {
      localStorage.setItem('livecall_presence_trigger', `${prevId}_offline_${Date.now()}`);
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('livecall_presence_sync_channel');
        bc.postMessage({ type: 'presence_updated', userId: prevId, status: 'offline' });
        bc.close();
      }
    } catch (e) { }

    setUsers((prev) =>
      prev.map((u) => (u.id === prevId ? { ...u, onlineStatus: 'offline' } : u))
    );
    setIsLoggedIn(false);
    localStorage.setItem('livecall_logged_in', 'false');
    localStorage.removeItem('livecall_current_user_id');
    signOutSupabase().catch(() => { });
    showToast('Logged Out 👋', 'You have been safely logged out of your session.', 'info');
  };

  const registerUser = (userData: Partial<UserProfile>): UserProfile => {
    const newId = (userData.id && isValidUuid(userData.id)) ? userData.id : generateValidUuid();
    const isFemale = userData.gender === 'female';
    const role: UserRole = userData.role || (isFemale ? 'female_creator' : 'male_user');

    const newUser: UserProfile = {
      id: newId,
      authId: userData.authId || newId,
      name: userData.name || 'New Member',
      email: userData.email || 'user@example.com',
      gender: userData.gender || (role === 'female_creator' ? 'female' : 'male'),
      genderLocked: true, // Permanent Gender Lock
      role: role,
      age: userData.age || 21,
      dob: userData.dob || '2003-01-01',
      nationality: userData.nationality || 'United States',
      countryCode: userData.countryCode || 'US',
      spokenLanguages: userData.spokenLanguages || ['English'],
      bio: userData.bio || 'Excited to make friends and chat!',
      interests: userData.interests || ['Music', 'Travel'],
      interestedIn: userData.interestedIn || (isFemale ? ['male'] : ['female']),
      tags: userData.tags || [],
      avatarUrl: userData.avatarUrl || (isFemale ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400' : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=400'),
      gallery: userData.gallery || [],
      introVideoUrl: userData.introVideoUrl || undefined,
      isVerified: userData.isVerified || false,
      isOnboarded: userData.isOnboarded ?? false,
      agreedToTerms: userData.agreedToTerms ?? true,
      agreedToAdultTerms: userData.agreedToAdultTerms ?? (!isFemale),
      agreedToHostTerms: userData.agreedToHostTerms ?? (isFemale),
      kycStatus: userData.kycStatus || 'unsubmitted',
      onlineStatus: 'online',
      createdAt: new Date().toISOString().split('T')[0],
      coinBalance: isFemale ? 0 : 50, // 50 bonus coins for new male sign up
      hourlyCoinRate: isFemale ? (userData.hourlyCoinRate || systemSettings.coinBurnRatePerMin) : 0,
      earningsCoins: 0,
      totalLifetimeEarnedUSD: 0,
      emailVerified: userData.emailVerified ?? true,
    };

    setUsers((prev) => [newUser, ...prev]);
    usersRef.current = [newUser, ...usersRef.current];
    setCurrentUserId(newId);
    setIsLoggedIn(true);
    localStorage.setItem('livecall_logged_in', 'true');
    localStorage.setItem('livecall_current_user_id', newId);

    // Sync new registered user immediately to server
    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    }).catch((e) => console.warn('User server sync warning:', e));

    if (isSupabaseConfigured()) {
      upsertProfileToSupabase(newUser).then((success) => {
        if (success) {
          console.log(`Registered user ${newUser.name} successfully upserted to Supabase.`);
        }
      }).catch((e) =>
        console.warn('User registration Supabase sync warning:', e)
      );
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'auth',
          userId: newId,
          prevUserId: currentUserId,
          userProfile: newUser,
        })
      );
    }

    showToast(
      'Registration Complete',
      `Welcome ${newUser.name}! Your gender (${(newUser.gender || 'male').toUpperCase()}) is permanently locked to protect the coin economy.`,
      'success'
    );
    return newUser;
  };

  const updateUserProfile = (userId: string, updates: Partial<UserProfile>) => {
    let genderLockAttempted = false;
    let updatedProfile: UserProfile | null = null;

    setUsers((prev) => {
      const targetUser = prev.find((u) => u.id === userId);
      const targetEmail = targetUser?.email ? targetUser.email.toLowerCase().trim() : null;

      const next = prev.map((u) => {
        const isMatch = u.id === userId || (targetEmail && u.email && u.email.toLowerCase().trim() === targetEmail);
        if (isMatch) {
          // Guard permanent gender lock
          if (u.genderLocked && updates.gender && updates.gender !== u.gender) {
            genderLockAttempted = true;
            delete updates.gender;
          }
          const merged = { ...u, ...updates };
          if (u.id === userId || !updatedProfile) {
            updatedProfile = merged;
          }
          return merged;
        }
        return u;
      });
      usersRef.current = next;
      return next;
    });

    if (updatedProfile) {
      // 1. Instant WebSocket broadcast to sync serverUsers in-memory immediately
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'user:update',
            userId,
            userProfile: updatedProfile,
          })
        );
      }

      // 2. Direct Supabase column update by user ID and by email
      if (isSupabaseConfigured()) {
        const enrichedUpdates: Partial<UserProfile> = {
          ...updates,
          email: updates.email || (updatedProfile as UserProfile).email,
          authId: (updatedProfile as UserProfile).authId,
        };
        updateUserProfileInSupabase(userId, enrichedUpdates).catch((e) =>
          console.warn('Direct Supabase update user notice:', e)
        );
        upsertProfileToSupabase(updatedProfile).catch((e) =>
          console.warn('Update user profile Supabase sync notice:', e)
        );
      }

      // 3. Sync to node server & broadcast
      fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProfile),
      }).catch((e) => console.warn('Update user profile server sync notice:', e));
    }

    if (genderLockAttempted) {
      showToast('Gender Lock Active', 'Gender cannot be modified after registration.', 'warning');
    }
    showToast('Profile Updated', 'Changes saved successfully', 'success');
  };

  // Change User Password
  const changeUserPassword = (
    userId: string,
    currentPassword: string,
    newPassword: string
  ): { success: boolean; message: string } => {
    if (!newPassword || newPassword.trim().length < 6) {
      const msg = 'New password must be at least 6 characters long.';
      showToast('Password Error', msg, 'error');
      return { success: false, message: msg };
    }

    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) {
      const msg = 'User account not found.';
      showToast('User Not Found', msg, 'error');
      return { success: false, message: msg };
    }

    let updatedObj: UserProfile | null = null;
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const updated = {
            ...u,
            hasPasswordSet: true,
          };
          updatedObj = updated;
          return updated;
        }
        return u;
      })
    );

    // Call Supabase Auth & server password update
    updateUserPassword({
      userId,
      email: targetUser.email,
      newPassword,
    }).catch((e) => console.warn('Supabase Auth password update warning:', e));

    if (updatedObj) {
      fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedObj),
      }).catch((e) => console.warn('Password update server sync notice:', e));

      if (isSupabaseConfigured()) {
        upsertProfileToSupabase(updatedObj).catch((e) =>
          console.warn('Password update Supabase sync notice:', e)
        );
      }
    }


    showToast('Password Updated! 🔒', 'Your account password has been updated successfully.', 'success');
    return { success: true, message: 'Password updated successfully!' };
  };

  // Buy Coins
  const buyCoinPackage = (packageId: string) => {
    const pkg = coinPackages.find((p) => p.id === packageId);
    if (!pkg) return;

    const totalToAdd = pkg.coins + pkg.bonusCoins;

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === currentUser.id) {
          return { ...u, coinBalance: u.coinBalance + totalToAdd };
        }
        return u;
      })
    );

    showToast(
      'Coins Purchased! 🪙',
      `Successfully added ${totalToAdd} coins (${pkg.coins} + ${pkg.bonusCoins} bonus) to your wallet!`,
      'success'
    );
  };

  // Purchase VIP
  const purchaseVip = (tier: 'bronze' | 'silver' | 'gold' | 'diamond') => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === currentUser.id) {
          return { ...u, vipTier: tier, coinBalance: u.coinBalance + 100 };
        }
        return u;
      })
    );
    showToast('VIP Upgrade!', `Congratulations, you are now a ${(tier || 'gold').toUpperCase()} VIP member!`, 'success');
  };

  // Call System & Coin Burn Ticker
  const startCall = (receiverId: string): boolean => {
    // Team Leaders cannot make calls
    if (currentUser.role === 'team_leader' || currentUser.role === 'agency_manager') {
      showToast(
        'Agency Role Restriction',
        'Team Leaders cannot initiate calls. Your account is dedicated to managing female host teams and earning agency commission.',
        'warning'
      );
      return false;
    }

    const receiver = users.find((u) => u.id === receiverId);
    if (!receiver) {
      showToast('Call Error', 'User not found', 'error');
      return false;
    }

    // Team Leaders cannot receive calls
    if (receiver.role === 'team_leader' || receiver.role === 'agency_manager') {
      showToast(
        'Unavailable for Calls',
        'Team Leaders cannot receive live calls. Team Leaders only manage agency hosts.',
        'warning'
      );
      return false;
    }

    // Check if user is offline or busy
    if (receiver.onlineStatus === 'offline') {
      showToast('User Offline 🚫', `${receiver.name} is currently offline. Calls can only be placed when online.`, 'warning');
      return false;
    }
    if (receiver.onlineStatus === 'busy' || receiver.onlineStatus === 'in_call') {
      showToast('User Busy 🚫', `${receiver.name} is currently busy on another video call.`, 'warning');
      return false;
    }

    // Minimum balance check (Friend rate vs Standard rate using unified rate helper)
    const minRequired = getEffectiveCallRate(receiverId, currentUser.id);

    // Universal pre-call balance guard: any caller must have enough coins for at least 1 minute
    if (currentUser.coinBalance < minRequired) {
      showToast(
        'Insufficient Coins! 🪙',
        `You need at least ${minRequired} coins for 1 minute of video call. Please refill your wallet.`,
        'error'
      );
      return false;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'call:initiate',
          callerId: currentUser.id,
          receiverId: receiverId,
        })
      );
    } else {
      showToast('Reconnecting...', 'Connecting to signaling server. Please try again in 2 seconds.', 'warning');
      return false;
    }

    showToast(
      'Calling... 📞',
      `Ringing ${receiver.name}. Waiting for call acceptance...`,
      'info'
    );
    return true;
  };

  const acceptCall = () => {
    if (!activeCall) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'call:accept',
          callId: activeCall.id,
          userId: currentUser.id,
        })
      );
    }

    const callerId = activeCall.callerId;
    const receiverId = activeCall.receiverId;
    const ratePerMin = getEffectiveCallRate(receiverId, callerId);

    const receiverUser = users.find((u) => u.id === receiverId);
    const isReceiverTlCreated = Boolean(receiverUser?.teamLeaderId);
    // Strict Earning Policy: ONLY female creators or Team Leader managed hosts earn coins! Regular females & males earn 0.
    const isEligibleFemaleCreator = receiverUser?.role === 'female_creator' || receiverUser?.role === 'female_host' || isReceiverTlCreated;
    const canReceiverEarn = isEligibleFemaleCreator;
    const hostSharePercent = systemSettings.femaleHostSharePercent ?? 40;
    const tlSharePercent = systemSettings.teamLeaderSharePercent ?? 10;

    // Upfront Minute 1 Burn calculation
    const initialSpent = ratePerMin;
    const initialHostCoins = canReceiverEarn
      ? ((receiverUser?.coinEarnOverrideRate !== undefined && receiverUser.coinEarnOverrideRate !== null && receiverUser.coinEarnOverrideRate > 0)
        ? Math.min(initialSpent, receiverUser.coinEarnOverrideRate)
        : Math.max(1, Math.round(initialSpent * (hostSharePercent / 100))))
      : 0;

    const initialTlCoins = (isReceiverTlCreated && receiverUser?.teamLeaderId)
      ? Math.max(1, Math.round(initialSpent * (tlSharePercent / 100)))
      : 0;

    // Deduct Minute 1 from caller, credit host & TL in local state
    setUsers((prevUsers) =>
      prevUsers.map((u) => {
        if (u.id === callerId) {
          return { ...u, coinBalance: Math.max(0, u.coinBalance - initialSpent) };
        }
        if (u.id === receiverId) {
          const newCoins = canReceiverEarn ? (u.earningsCoins || 0) + initialHostCoins : (u.earningsCoins || 0);
          return {
            ...u,
            earningsCoins: newCoins,
            totalLifetimeEarnedUSD: newCoins * systemSettings.femalePayoutRatioUSD,
            totalCallMinutes: (u.totalCallMinutes || 0) + 1,
            totalCallsHosted: (u.totalCallsHosted || 0) + 1,
          };
        }
        if (initialTlCoins > 0 && receiverUser?.teamLeaderId && (u.id === receiverUser.teamLeaderId || u.id === receiverUser.createdById)) {
          const newTlCoins = (u.earningsCoins || 0) + initialTlCoins;
          return {
            ...u,
            earningsCoins: newTlCoins,
            totalLifetimeEarnedUSD: newTlCoins * systemSettings.femalePayoutRatioUSD,
          };
        }
        return u;
      })
    );

    // Sync upfront burn to backend server and Supabase Admin
    fetch('/api/calls/burn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callId: activeCall.id,
        callerId,
        receiverId,
        coinsBurned: initialSpent,
        hostCoinsEarned: initialHostCoins,
        tlCoinsEarned: initialTlCoins,
        tlId: receiverUser?.teamLeaderId || receiverUser?.createdById,
        durationSeconds: 0,
      }),
    }).catch(() => {});

    setActiveCall((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        status: 'active',
        startTime: Date.now(),
        coinsSpent: initialSpent,
        coinsEarned: initialHostCoins,
      };
    });

    const receiverName = receiverUser ? receiverUser.name : 'Creator';
    const isFriendCall = isFriend(activeCall.receiverId) || isFriend(activeCall.callerId);

    showToast(
      'Call Connected! 📹',
      `Live 1-on-1 Call connected with ${receiverName}. ${isFriendCall ? '✨ Friend Rate: ' + ratePerMin + ' 🪙/min' : '🪙 Rate: ' + ratePerMin + ' 🪙/min'} (Minute 1 billed).`,
      'success'
    );
  };

  const rejectCall = () => {
    if (!activeCall) return;
    const rejectedCall = activeCall;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'call:reject',
          callId: rejectedCall.id,
          userId: currentUser.id,
        })
      );
    }

    // Sync call end to backend signaling server
    fetch('/api/calls/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callId: rejectedCall.id,
        callerId: rejectedCall.callerId,
        receiverId: rejectedCall.receiverId,
        status: 'ended',
      }),
    }).catch(() => {});

    // Reset caller and receiver status back to online in memory
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === rejectedCall.callerId || u.id === rejectedCall.receiverId) {
          return { ...u, onlineStatus: 'online' };
        }
        return u;
      })
    );

    // Update Supabase Database status to online
    if (isSupabaseConfigured()) {
      updateUserStatusInSupabase(rejectedCall.callerId, 'online').catch(() => {});
      updateUserStatusInSupabase(rejectedCall.receiverId, 'online').catch(() => {});
    }

    setActiveCall(null);
    showToast('Call Declined 🚫', 'The call was declined or cancelled.', 'info');
  };

  const endCall = () => {
    if (!activeCall) return;
    const endedCall = activeCall;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'call:end',
          callId: endedCall.id,
          userId: currentUser.id,
        })
      );
    }

    // Sync call end to backend signaling server
    fetch('/api/calls/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callId: endedCall.id,
        callerId: endedCall.callerId,
        receiverId: endedCall.receiverId,
        status: 'ended',
      }),
    }).catch(() => {});

    // Reset caller and receiver status back to online in memory
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === endedCall.callerId || u.id === endedCall.receiverId) {
          return { ...u, onlineStatus: 'online' };
        }
        return u;
      })
    );

    // Update Supabase Database status to online immediately
    if (isSupabaseConfigured()) {
      updateUserStatusInSupabase(endedCall.callerId, 'online').catch(() => {});
      updateUserStatusInSupabase(endedCall.receiverId, 'online').catch(() => {});
    }

    if (endedCall.durationSeconds > 0) {
      recordVideoCallDuration(endedCall.durationSeconds);
    }

    const caller = users.find((u) => u.id === endedCall.callerId);
    const receiver = users.find((u) => u.id === endedCall.receiverId);
    const isFriendCall = isFriend(endedCall.receiverId) || isFriend(endedCall.callerId);

    if (caller && receiver) {
      const newLog: CallLogItem = {
        id: 'log_' + Date.now(),
        callerId: caller.id,
        callerName: caller.name,
        callerAvatar: caller.avatarUrl,
        callerCountry: caller.nationality,
        receiverId: receiver.id,
        receiverName: receiver.name,
        receiverAvatar: receiver.avatarUrl,
        startTime: endedCall.startTime,
        endTime: Date.now(),
        durationSeconds: endedCall.durationSeconds,
        coinsSpent: endedCall.coinsSpent,
        coinsEarned: endedCall.coinsEarned,
        timestamp: 'Just now',
        wasFriendCall: isFriendCall,
      };
      setCallLogs((prev) => [newLog, ...prev]);
      if (isSupabaseConfigured()) {
        insertCallLogToSupabase(newLog).catch((e) => console.warn('Supabase call log insert error:', e));
      }

      // Automatically send an interactive call rating message to the 1-on-1 chat
      const ratingMsg: ChatMessage = {
        id: 'msg_rating_' + Date.now(),
        senderId: receiver.id,
        receiverId: caller.id,
        text: `📞 Live Video Call Ended (${Math.max(1, Math.round(endedCall.durationSeconds / 60))}m) • How was your session with ${receiver.name}?`,
        originalLanguage: receiver.spokenLanguages[0] || 'English',
        type: 'call_rating',
        ratingInfo: {
          callLogId: newLog.id,
          callDurationSeconds: endedCall.durationSeconds,
          creatorId: receiver.id,
          creatorName: receiver.name,
          creatorAvatar: receiver.avatarUrl,
          callerId: caller.id,
          isSubmitted: false,
        },
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, ratingMsg]);

      // If logged in user was the caller, open the post-call rating modal immediately
      if (currentUser.id === caller.id) {
        setPendingRatingCall({
          creatorId: receiver.id,
          creatorName: receiver.name,
          creatorAvatar: receiver.avatarUrl,
          callLogId: newLog.id,
          durationSeconds: endedCall.durationSeconds,
        });
      }
    }

    showToast(
      'Call Ended',
      `Session duration: ${endedCall.durationSeconds}s. Total coins processed: ${endedCall.coinsSpent} 🪙. Logged to creator call history.`,
      'info'
    );

    // Remove from active admin call list
    setAdminActiveCalls((prev) => prev.filter((c) => c.id !== endedCall.id && c.hostId !== endedCall.receiverId && c.callerId !== endedCall.callerId));

    setActiveCall(null);
  };

  const toggleFastTestMode = () => {
    const next = !fastTestMode;
    setFastTestMode(next);
    showToast(
      'Test Timer Toggle',
      next ? 'Fast Test Mode ON: Coin burn ticks every 3 seconds!' : 'Normal Mode: Coin burn ticks every 60 seconds.',
      'warning'
    );
  };

  // Active call timer effect (Accurate recurring per-minute coin burning)
  useEffect(() => {
    if (!activeCall || activeCall.status !== 'active') return;

    const interval = setInterval(() => {
      setActiveCall((prevCall) => {
        if (!prevCall) return null;

        const newDuration = prevCall.durationSeconds + 1;
        const tickCheckSeconds = fastTestMode ? 3 : 60; // 3s in test mode, 60s in normal mode

        let additionalSpent = 0;
        let additionalEarned = 0;

        // Recurring minute burn occurs after each minute interval
        if (newDuration > 0 && newDuration % tickCheckSeconds === 0) {
          const ratePerMin = getEffectiveCallRate(prevCall.receiverId, prevCall.callerId);
          additionalSpent = ratePerMin;

          const hostSharePercent = systemSettings.femaleHostSharePercent ?? 40;
          const tlSharePercent = systemSettings.teamLeaderSharePercent ?? 10;

          // Deduct from caller, credit female creator (supporting custom Team Leader coin override rate & TL commission)
          setUsers((prevUsers) => {
            const caller = prevUsers.find((u) => u.id === prevCall.callerId);
            const receiver = prevUsers.find((u) => u.id === prevCall.receiverId);

            // Check if caller ran out of coins
            if (caller && caller.coinBalance < additionalSpent) {
              setTimeout(() => {
                showToast(
                  'Call Auto-Terminated',
                  'Caller coin balance reached 0 during active call.',
                  'error'
                );
                endCall();
              }, 10);
              return prevUsers;
            }

            const isReceiverTlCreated = Boolean(receiver?.teamLeaderId);
            // Strict Earning: only female creators or Team Leader managed hosts earn coins
            const isEligibleFemaleCreator = receiver?.role === 'female_creator' || receiver?.role === 'female_host' || isReceiverTlCreated;
            const canReceiverEarn = isEligibleFemaleCreator;

            // Calculate host earning from female host share % of burn rate (strictly capped to not exceed burn)
            const effectiveEarnRate = canReceiverEarn
              ? ((receiver?.coinEarnOverrideRate !== undefined && receiver.coinEarnOverrideRate !== null && receiver.coinEarnOverrideRate > 0)
                ? Math.min(additionalSpent, receiver.coinEarnOverrideRate)
                : Math.max(1, Math.round(additionalSpent * (hostSharePercent / 100))))
              : 0;
            additionalEarned = effectiveEarnRate;

            // Calculate Team Leader override commission if host belongs to a TL
            const tlCommission = (isReceiverTlCreated && receiver?.teamLeaderId)
              ? Math.max(1, Math.round(additionalSpent * (tlSharePercent / 100)))
              : 0;

            // Sync recurring burn to backend server & Supabase Admin
            fetch('/api/calls/burn', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                callId: prevCall.id,
                callerId: prevCall.callerId,
                receiverId: prevCall.receiverId,
                coinsBurned: additionalSpent,
                hostCoinsEarned: effectiveEarnRate,
                tlCoinsEarned: tlCommission,
                tlId: receiver?.teamLeaderId || receiver?.createdById,
                durationSeconds: newDuration,
              }),
            }).catch(() => {});

            return prevUsers.map((u) => {
              // 1. Male caller deduction
              if (u.id === prevCall.callerId) {
                return { ...u, coinBalance: Math.max(0, u.coinBalance - additionalSpent) };
              }
              // 2. Female host earning credit
              if (u.id === prevCall.receiverId) {
                const newCoins = canReceiverEarn ? (u.earningsCoins || 0) + effectiveEarnRate : (u.earningsCoins || 0);
                const newUSD = newCoins * systemSettings.femalePayoutRatioUSD;
                return {
                  ...u,
                  earningsCoins: newCoins,
                  totalLifetimeEarnedUSD: newUSD,
                  totalCallMinutes: (u.totalCallMinutes || 0) + 1,
                };
              }
              // 3. Team Leader override commission credit
              if (tlCommission > 0 && receiver?.teamLeaderId && (u.id === receiver.teamLeaderId || u.id === receiver.createdById)) {
                const newTlCoins = (u.earningsCoins || 0) + tlCommission;
                const newTlUSD = newTlCoins * systemSettings.femalePayoutRatioUSD;
                return {
                  ...u,
                  earningsCoins: newTlCoins,
                  totalLifetimeEarnedUSD: newTlUSD,
                };
              }
              return u;
            });
          });
        }

        return {
          ...prevCall,
          durationSeconds: newDuration,
          coinsSpent: prevCall.coinsSpent + additionalSpent,
          coinsEarned: prevCall.coinsEarned + additionalEarned,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeCall, fastTestMode, systemSettings, friends]);

  // Real-time synchronization of current activeCall with adminActiveCalls
  useEffect(() => {
    if (!activeCall || activeCall.status !== 'active') {
      return;
    }

    const host = users.find((u) => u.id === activeCall.receiverId) ||
      users.find((u) => u.id === activeCall.callerId && (u.gender === 'female' || u.role === 'female_creator')) ||
      users[1];

    const caller = users.find((u) => u.id === activeCall.callerId) ||
      users.find((u) => u.id === activeCall.receiverId && (u.gender === 'male' || u.role === 'male_user')) ||
      users[0];

    const currentBurnRate = getEffectiveCallRate(host?.id, caller?.id);

    setAdminActiveCalls((prev) => {
      const existingIdx = prev.findIndex((c) => c.id === activeCall.id);
      const callData: AdminActiveCall = {
        id: activeCall.id,
        hostId: host.id,
        hostName: host.name,
        hostAvatar: host.avatarUrl,
        hostCountry: host.nationality || 'Spain',
        hostCountryCode: host.countryCode || 'ES',
        hostHourlyRate: host.hourlyCoinRate || currentBurnRate,
        hostRating: 4.98,
        hostAge: host.age || 24,
        hostEarningsCoins: host.earningsCoins,
        callerId: caller.id,
        callerName: caller.name,
        callerAvatar: caller.avatarUrl,
        callerCountry: caller.nationality || 'United States',
        callerCountryCode: caller.countryCode || 'US',
        callerVipTier: caller.vipTier || 'gold',
        callerCoinBalance: caller.coinBalance,
        startTime: activeCall.startTime,
        durationSeconds: activeCall.durationSeconds,
        coinsSpent: activeCall.coinsSpent,
        coinsEarned: activeCall.coinsEarned,
        status: 'active',
        burnRatePerMin: currentBurnRate,
        videoQuality: systemSettings.livekitCaptureResolution === '4k' ? '4K Ultra HD' : systemSettings.livekitCaptureResolution === '1080p' ? '1080p FHD' : systemSettings.livekitCaptureResolution === '480p' ? '480p SD' : '720p HD',
        fps: 60,
        bitrateKbps: 2450,
        latencyMs: 36,
        packetLoss: 0.01,
        safetyScore: 100.0,
        safetyFlag: 'clean',
        aiShieldActive: false,
        hostAudioLevel: 62,
        callerAudioLevel: 44,
        warningMessage: activeCall.warningMessage,
      };

      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], ...callData };
        return updated;
      } else {
        return [callData, ...prev];
      }
    });
  }, [activeCall, users, systemSettings, friends]);

  // Send Gift in Call
  const sendGiftInCall = (giftId: string): boolean => {
    if (!activeCall) return false;
    const gift = virtualGifts.find((g) => g.id === giftId);
    if (!gift) return false;

    if (currentUser.coinBalance < gift.coinCost) {
      showToast('Insufficient Coins 🪙', `Sending ${gift.name} requires ${gift.coinCost} coins. Please buy coins!`, 'error');
      return false;
    }

    // Deduct coins from caller, credit female receiver (if eligible)
    const receiverUser = users.find((u) => u.id === activeCall.receiverId);
    const isReceiverTlCreated = Boolean(receiverUser?.teamLeaderId);
    // Strict Earning Policy: only female creators or Team Leader managed hosts earn coins
    const isEligibleFemaleCreator = receiverUser?.role === 'female_creator' || receiverUser?.role === 'female_host' || isReceiverTlCreated;
    const canReceiverEarn = isEligibleFemaleCreator;
    const hostGiftSharePercent = systemSettings.giftFemaleHostSharePercent ?? 70;
    const tlGiftSharePercent = systemSettings.giftTeamLeaderSharePercent ?? 10;

    const addedEarnedCoins = canReceiverEarn ? Math.max(1, Math.round(gift.coinCost * (hostGiftSharePercent / 100))) : 0;
    const addedTlCoins = (isReceiverTlCreated && receiverUser?.teamLeaderId)
      ? Math.max(1, Math.round(gift.coinCost * (tlGiftSharePercent / 100)))
      : 0;

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === currentUser.id) {
          return { ...u, coinBalance: Math.max(0, u.coinBalance - gift.coinCost) };
        }
        if (u.id === activeCall.receiverId) {
          const newCoins = (u.earningsCoins || 0) + addedEarnedCoins;
          return {
            ...u,
            earningsCoins: newCoins,
            totalLifetimeEarnedUSD: newCoins * systemSettings.femalePayoutRatioUSD,
            totalGiftsReceivedCount: (u.totalGiftsReceivedCount || 0) + 1,
          };
        }
        if (addedTlCoins > 0 && receiverUser?.teamLeaderId && (u.id === receiverUser.teamLeaderId || u.id === receiverUser.createdById)) {
          const newTlCoins = (u.earningsCoins || 0) + addedTlCoins;
          return {
            ...u,
            earningsCoins: newTlCoins,
            totalLifetimeEarnedUSD: newTlCoins * systemSettings.femalePayoutRatioUSD,
          };
        }
        return u;
      })
    );

    // Sync gift transaction to backend server & Supabase Admin
    fetch('/api/gifts/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: currentUser.id,
        receiverId: activeCall.receiverId,
        giftId: gift.id,
        giftCost: gift.coinCost,
        hostCoinsEarned: addedEarnedCoins,
        tlCoinsEarned: addedTlCoins,
        tlId: receiverUser?.teamLeaderId || receiverUser?.createdById,
      }),
    }).catch(() => {});

    // Update active call state
    setActiveCall((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        coinsSpent: prev.coinsSpent + gift.coinCost,
        coinsEarned: prev.coinsEarned + addedEarnedCoins,
        giftsSent: [
          ...prev.giftsSent,
          { giftId: gift.id, giftName: gift.name, cost: gift.coinCost, timestamp: Date.now() },
        ],
      };
    });

    recordGiftSentInteraction();

    showToast('Mega Gift Sent! 🎁', `You sent a ${gift.name} (${gift.coinCost} 🪙)!`, 'success');
    return true;
  };

  // Send Chat Message
  const sendMessage = (
    receiverId: string,
    text: string,
    targetLang: string = 'English',
    mediaUrl?: string,
    type: 'text' | 'gift' | 'system' | 'friend_request' = mediaUrl ? 'text' : 'text'
  ) => {
    const receiver = users.find((u) => u.id === receiverId);
    const receiverLang = receiver ? receiver.spokenLanguages[0] : 'English';

    // Auto-translation simulation
    const translations: Record<string, string> = {
      '¡Hola guapo, te estaba esperando!': 'Hello handsome, I was waiting for you!',
      '¿De dónde eres?': 'Where are you from?',
      'Me encanta tu perfil': 'I love your profile',
      'Hello handsome!': '¡Hola guapo!',
      'Can we video call?': '¿Podemos hacer videollamada?',
    };

    const translated = translations[text] || text;

    const newMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      senderId: currentUser.id,
      receiverId: receiverId,
      text: text,
      originalLanguage: currentUser.spokenLanguages[0] || 'English',
      translatedText: translated,
      targetLanguage: targetLang,
      mediaUrl: mediaUrl || undefined,
      type: type,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, newMsg]);

    // Track Daily Quests: Chat with friends / creators & Gift sending
    if (receiverId && receiverId !== currentUser.id) {
      recordChatFriendInteraction(receiverId);
    }
    if (type === 'gift') {
      recordGiftSentInteraction();
    }

    // Send real-time message via WebSocket to other devices
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'chat:send',
          senderId: currentUser.id,
          receiverId: receiverId,
          message: newMsg,
        })
      );
    }

    // Persist asynchronously to Supabase if configured
    saveMessageToSupabase(newMsg).catch((err) => {
      console.warn('Asynchronous Supabase saveMessage notice:', err);
    });
  };

  // Clear Chat History for a specific conversation
  const clearChatHistory = (otherUserId: string) => {
    setChatMessages((prev) =>
      prev.filter(
        (m) =>
          !(
            (m.senderId === currentUser.id && m.receiverId === otherUserId) ||
            (m.senderId === otherUserId && m.receiverId === currentUser.id)
          )
      )
    );
    showToast('Chat Cleared', 'Conversation history has been cleared.', 'info');
  };

  // Submit Creator Review
  const submitCreatorReview = (reviewData: Omit<CreatorReview, 'id' | 'createdAt'>) => {
    const newReview: CreatorReview = {
      ...reviewData,
      id: 'rev_' + Date.now(),
      createdAt: 'Just now',
    };

    setCreatorReviews((prev) => [newReview, ...prev]);

    // Update matching in-chat rating message
    setChatMessages((prev) =>
      prev.map((msg) => {
        if (
          msg.type === 'call_rating' &&
          msg.ratingInfo &&
          ((msg.ratingInfo.callLogId && msg.ratingInfo.callLogId === reviewData.callLogId) ||
            (msg.ratingInfo.creatorId === reviewData.creatorId && msg.ratingInfo.callerId === reviewData.callerId && !msg.ratingInfo.isSubmitted))
        ) {
          return {
            ...msg,
            ratingInfo: {
              ...msg.ratingInfo,
              stars: reviewData.stars,
              communication: reviewData.communication,
              friendliness: reviewData.friendliness,
              clarity: reviewData.clarity,
              energy: reviewData.energy,
              comment: reviewData.comment,
              tags: reviewData.tags,
              isSubmitted: true,
            },
          };
        }
        return msg;
      })
    );

    // Close post-call rating modal
    setPendingRatingCall(null);

    showToast(
      'Rating Submitted ⭐',
      `Thank you for rating ${reviewData.creatorName || 'creator'} with ${reviewData.stars} stars!`,
      'success'
    );
  };

  // Send Rating Request (Used by female creators in chat)
  const sendRatingRequest = (creatorId: string, callerId: string) => {
    const creator = users.find((u) => u.id === creatorId) || currentUser;
    const caller = users.find((u) => u.id === callerId);
    if (!caller) return;

    const newMsg: ChatMessage = {
      id: 'msg_rating_req_' + Date.now(),
      senderId: creator.id,
      receiverId: caller.id,
      text: `⭐ Rating Request: ${creator.name} would love your feedback on your recent video call session!`,
      originalLanguage: creator.spokenLanguages[0] || 'English',
      type: 'call_rating',
      ratingInfo: {
        creatorId: creator.id,
        creatorName: creator.name,
        creatorAvatar: creator.avatarUrl,
        callerId: caller.id,
        isSubmitted: false,
      },
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, newMsg]);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'chat:send',
          senderId: creator.id,
          receiverId: caller.id,
          message: newMsg,
        })
      );
    }

    showToast('Rating Request Sent ⭐', `Sent a rating invitation card to ${caller.name}!`, 'success');
  };

  // Mark chat messages from a user as read
  const markChatAsRead = (otherUserId: string) => {
    const idsToMark = chatMessages
      .filter((m) => m.senderId === otherUserId && m.receiverId === currentUser.id && !readMessageIds.includes(m.id))
      .map((m) => m.id);
    if (idsToMark.length > 0) {
      setReadMessageIds((prev) => Array.from(new Set([...prev, ...idsToMark])));
    }
  };

  // Mark all unread messages as read
  const markAllChatsAsRead = () => {
    const allReceivedIds = chatMessages
      .filter((m) => m.receiverId === currentUser.id)
      .map((m) => m.id);
    setReadMessageIds((prev) => Array.from(new Set([...prev, ...allReceivedIds])));
    showToast('Chats Marked as Read', 'All new message indicators have been cleared.', 'info');
  };

  // Payout Request
  const submitPayoutRequest = (amountCoins: number, payoutMethod: string, accountDetails: string): boolean => {
    const isTlCreated = Boolean(currentUser.teamLeaderId);
    const canEarnAndPayout = isTlCreated || Boolean(systemSettings.enableRegularFemaleCoinEarning) || currentUser.role === 'admin';
    if (!canEarnAndPayout && currentUser.gender === 'female') {
      showToast(
        'Payout Restricted',
        'Coin earning and payouts are currently restricted to Team Leader agency-managed hosts.',
        'error'
      );
      return false;
    }

    const amountUSD = amountCoins * systemSettings.femalePayoutRatioUSD;

    if (amountUSD < systemSettings.minPayoutThresholdUSD) {
      showToast(
        'Payout Threshold Error',
        `Minimum payout threshold is $${systemSettings.minPayoutThresholdUSD.toFixed(2)} USD (approx ${Math.ceil(systemSettings.minPayoutThresholdUSD / systemSettings.femalePayoutRatioUSD)} coins).`,
        'error'
      );
      return false;
    }

    if (currentUser.earningsCoins < amountCoins) {
      showToast('Insufficient Balance', 'You do not have enough coins in your earnings ledger.', 'error');
      return false;
    }

    // Deduct coins from user earnings balance
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === currentUser.id) {
          return { ...u, earningsCoins: u.earningsCoins - amountCoins };
        }
        return u;
      })
    );

    const leaderObj = currentUser.teamLeaderId ? users.find((u) => u.id === currentUser.teamLeaderId) : undefined;

    const newRequest: PayoutRequest = {
      id: 'pay_' + Date.now().toString().slice(-6),
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      amountCoins: amountCoins,
      amountUSD: amountUSD,
      payoutMethod: payoutMethod,
      accountDetails: accountDetails,
      status: 'pending',
      requestDate: new Date().toISOString().replace('T', ' ').slice(0, 16),
      teamLeaderId: currentUser.teamLeaderId,
      teamLeaderName: leaderObj?.name,
    };

    setPayoutRequests((prev) => [newRequest, ...prev]);
    if (isSupabaseConfigured()) {
      upsertPayoutRequestToSupabase(newRequest).catch((e) => console.warn('Supabase payout request save error:', e));
    }
    showToast('Payout Requested! 🏦', `Submitted request for ${amountUSD.toFixed(2)} via ${payoutMethod}. Pending admin approval.`, 'success');
    return true;
  };

  // Load initial LiveKit config from server on mount
  useEffect(() => {
    fetch('/api/livekit/config')
      .then((res) => res.json())
      .then((data) => {
        if (data && (data.apiKey || data.wsUrl)) {
          setSystemSettings((prev) => ({
            ...prev,
            livekitApiKey: data.apiKey || prev.livekitApiKey || '',
            livekitApiSecret: data.apiSecret || prev.livekitApiSecret || '',
            livekitWsUrl: data.wsUrl || prev.livekitWsUrl || 'wss://your-livekit-project.livekit.cloud',
          }));
        }
      })
      .catch(() => { });
  }, []);

  // Admin Actions
  const updateSystemSettings = (newSettings: Partial<SystemSettings>) => {
    setSystemSettings((prev) => {
      const mergedPrices = newSettings.quickMatchGiftPrices
        ? { ...(prev.quickMatchGiftPrices || INITIAL_SYSTEM_SETTINGS.quickMatchGiftPrices), ...newSettings.quickMatchGiftPrices }
        : prev.quickMatchGiftPrices;

      const updated: SystemSettings = {
        ...prev,
        ...newSettings,
        quickMatchGiftPrices: mergedPrices,
      };

      try {
        localStorage.setItem('livecall_settings', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save livecall_settings:', e);
      }

      return updated;
    });

    if (newSettings.defaultTheme) {
      setThemeState(newSettings.defaultTheme);
      localStorage.setItem('livecall_user_theme', newSettings.defaultTheme);
    }
    if (isSupabaseConfigured()) {
      updateSystemConfigsInSupabase(newSettings).catch((e) => console.warn('Supabase system settings update error:', e));
      if (
        newSettings.allowedCountryCodes !== undefined ||
        newSettings.allowedLanguages !== undefined ||
        newSettings.allowedZodiacSigns !== undefined ||
        newSettings.allowedInterests !== undefined
      ) {
        pushAllTaxonomiesAndSettingsToSupabase(newSettings).catch((e) =>
          console.warn('Taxonomies DB push exception:', e)
        );
      }
    }
    showToast('System Settings Saved ⚙️', 'Economy parameters, taxonomies, and platform settings saved live.', 'success');
  };

  const updateLiveKitConfig = async (config: { apiKey: string; apiSecret: string; wsUrl: string }): Promise<boolean> => {
    try {
      const res = await fetch('/api/livekit/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        setSystemSettings((prev) => ({
          ...prev,
          livekitApiKey: data.apiKey,
          livekitApiSecret: data.apiSecret,
          livekitWsUrl: data.wsUrl,
        }));
        showToast('LiveKit Keys Saved 🔑', 'LiveKit WebRTC credentials updated and active on server!', 'success');
        return true;
      } else {
        showToast('Error Saving LiveKit Keys', data.error || 'Failed to update credentials', 'error');
        return false;
      }
    } catch (err: any) {
      showToast('Connection Error', 'Could not reach server to update LiveKit keys.', 'error');
      return false;
    }
  };

  const saveCoinPackage = (pkg: Partial<CoinPackage> & { id?: string }) => {
    if (pkg.id) {
      const updated = coinPackages.map((p) => (p.id === pkg.id ? ({ ...p, ...pkg } as CoinPackage) : p));
      setCoinPackages(updated);
      localStorage.setItem('livecall_packages', JSON.stringify(updated));
      if (isSupabaseConfigured()) {
        upsertCoinPackageToSupabase(pkg).catch(() => { });
      }
      showToast('Package Updated', `Updated coin SKU: ${pkg.title}`, 'success');
    } else {
      const newPkg: CoinPackage = {
        id: 'pkg_' + Date.now(),
        title: pkg.title || 'New Package',
        coins: pkg.coins || 100,
        bonusCoins: pkg.bonusCoins || 0,
        priceUSD: pkg.priceUSD || 4.99,
        badgeTag: pkg.badgeTag,
        popular: pkg.popular,
      };
      const updated = [...coinPackages, newPkg];
      setCoinPackages(updated);
      localStorage.setItem('livecall_packages', JSON.stringify(updated));
      if (isSupabaseConfigured()) {
        upsertCoinPackageToSupabase(newPkg).catch(() => { });
      }
      showToast('New Package Added', `Created coin SKU: ${newPkg.title}`, 'success');
    }
  };

  const deleteCoinPackage = (packageId: string) => {
    const updated = coinPackages.filter((p) => p.id !== packageId);
    setCoinPackages(updated);
    localStorage.setItem('livecall_packages', JSON.stringify(updated));
    if (isSupabaseConfigured()) {
      deleteCoinPackageFromSupabase(packageId).catch(() => { });
    }
    showToast('Package Deleted', 'Coin bundle removed from store', 'info');
  };

  const saveVirtualGift = (gift: Partial<VirtualGift> & { id?: string }) => {
    if (gift.id) {
      setVirtualGifts((prev) => {
        const next = prev.map((g) => (g.id === gift.id ? ({ ...g, ...gift } as VirtualGift) : g));
        localStorage.setItem('livecall_virtual_gifts', JSON.stringify(next));
        if (isSupabaseConfigured()) {
          updateSystemConfigsInSupabase({ virtualGifts: next }).catch(() => { });
        }
        return next;
      });
      showToast('Virtual Gift Updated 🎁', `Updated ${gift.name || 'gift'} price to ${gift.coinCost} coins`, 'success');
    } else {
      const newGift: VirtualGift = {
        id: 'g_' + Date.now(),
        name: gift.name || 'New Gift',
        coinCost: gift.coinCost || 50,
        icon: gift.icon || '🎁',
        animationType: gift.animationType || 'heart',
        color: gift.color || 'from-pink-500 to-rose-600',
        isActive: gift.isActive !== false,
        category: gift.category || 'General',
      };
      setVirtualGifts((prev) => {
        const next = [...prev, newGift];
        localStorage.setItem('livecall_virtual_gifts', JSON.stringify(next));
        if (isSupabaseConfigured()) {
          updateSystemConfigsInSupabase({ virtualGifts: next }).catch(() => { });
        }
        return next;
      });
      showToast('New Gift Added 🎁', `Created virtual gift SKU: ${newGift.name}`, 'success');
    }
  };

  const deleteVirtualGift = (giftId: string) => {
    setVirtualGifts((prev) => {
      const next = prev.filter((g) => g.id !== giftId);
      localStorage.setItem('livecall_virtual_gifts', JSON.stringify(next));
      if (isSupabaseConfigured()) {
        updateSystemConfigsInSupabase({ virtualGifts: next }).catch(() => { });
      }
      return next;
    });
    showToast('Gift Removed', 'Virtual gift removed from store', 'info');
  };

  const resetVirtualGifts = () => {
    setVirtualGifts(VIRTUAL_GIFTS);
    localStorage.setItem('livecall_virtual_gifts', JSON.stringify(VIRTUAL_GIFTS));
    if (isSupabaseConfigured()) {
      updateSystemConfigsInSupabase({ virtualGifts: VIRTUAL_GIFTS }).catch(() => { });
    }
    showToast('Gifts Reset 🎁', 'Virtual gifts restored to default catalog.', 'info');
  };

  const adminApprovePayout = (requestId: string, note?: string) => {
    let approvedReq: PayoutRequest | null = null;
    setPayoutRequests((prev) =>
      prev.map((req) => {
        if (req.id === requestId) {
          const updated: PayoutRequest = {
            ...req,
            status: 'completed',
            processedDate: new Date().toISOString().replace('T', ' ').slice(0, 16),
            adminNote: note || 'Approved and dispatched by Admin',
          };
          approvedReq = updated;
          return updated;
        }
        return req;
      })
    );
    if (approvedReq && isSupabaseConfigured()) {
      upsertPayoutRequestToSupabase(approvedReq).catch((e) => console.warn('Supabase payout approve error:', e));
    }
    showToast('Payout Approved! 🟢', `Request #${requestId} marked as COMPLETED.`, 'success');
  };

  const adminRejectPayout = (requestId: string, note?: string) => {
    const target = payoutRequests.find((r) => r.id === requestId);
    if (target) {
      // Refund coins back to female creator
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id === target.userId) {
            return { ...u, earningsCoins: u.earningsCoins + target.amountCoins };
          }
          return u;
        })
      );
    }

    let rejectedReq: PayoutRequest | null = null;
    setPayoutRequests((prev) =>
      prev.map((req) => {
        if (req.id === requestId) {
          const updated: PayoutRequest = {
            ...req,
            status: 'rejected',
            processedDate: new Date().toISOString().replace('T', ' ').slice(0, 16),
            adminNote: note || 'Rejected by Admin. Coins refunded.',
          };
          rejectedReq = updated;
          return updated;
        }
        return req;
      })
    );
    if (rejectedReq && isSupabaseConfigured()) {
      upsertPayoutRequestToSupabase(rejectedReq).catch((e) => console.warn('Supabase payout reject error:', e));
    }
    showToast('Payout Rejected 🔴', `Request #${requestId} rejected and coins refunded to creator.`, 'warning');
  };

  const adminUpdateUser = (userId: string, updates: Partial<UserProfile>) => {
    const targetUser = usersRef.current.find((u) => u.id === userId) || users.find((u) => u.id === userId);
    if (!targetUser) return;

    const merged: UserProfile = { ...targetUser, ...updates };

    setUsers((prev) => {
      const next = prev.map((u) => (u.id === userId ? merged : u));
      usersRef.current = next;
      return next;
    });

    // 1. Instant WebSocket broadcast to sync serverUsers in-memory immediately
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'user:update',
          userId,
          userProfile: merged,
        })
      );
    }

    // 2. Direct column update in Supabase PostgreSQL by user ID
    if (isSupabaseConfigured()) {
      updateUserProfileInSupabase(userId, updates).catch((e) =>
        console.warn('Admin direct Supabase update error:', e)
      );
      upsertProfileToSupabase(merged).catch((e) =>
        console.warn('Admin user update Supabase sync notice:', e)
      );
    }

    // 3. Sync to node server & broadcast
    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged),
    }).catch((e) => console.warn('Admin user update sync notice:', e));

    showToast('User Updated 🛠️', `Admin changes saved for: ${updates.name || userId}`, 'success');
  };

  const adminDeleteUser = async (userId: string) => {
    const target = users.find((u) => u.id === userId);
    setUsers((prev) => {
      const next = prev.filter((u) => u.id !== userId);
      usersRef.current = next;
      return next;
    });

    // Delete from Supabase
    if (isSupabaseConfigured()) {
      deleteProfileFromSupabase(userId).catch((e) => console.warn('Supabase delete user notice:', e));
    }

    // Delete from server
    fetch(`/api/users/${userId}`, { method: 'DELETE' }).catch((e) =>
      console.warn('Server delete user notice:', e)
    );

    showToast('User Deleted 🗑️', `User ${target?.name || userId} has been permanently deleted from Supabase database.`, 'info');
  };

  const toggleVerifyUser = (userId: string) => {
    let targetName = '';
    let nextVerified = false;
    let updatedProfile: UserProfile | null = null;
    setUsers((prev) => {
      const next = prev.map((u) => {
        if (u.id === userId) {
          nextVerified = !u.isVerified;
          targetName = u.name;
          const merged = { ...u, isVerified: nextVerified };
          updatedProfile = merged;
          return merged;
        }
        return u;
      });
      usersRef.current = next;
      return next;
    });

    if (updatedProfile) {
      if (isSupabaseConfigured()) {
        updateUserProfileInSupabase(userId, { isVerified: nextVerified }).catch(() => {});
        upsertProfileToSupabase(updatedProfile).catch(() => {});
      }
      fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProfile),
      }).catch(() => {});
    }
    if (targetName) {
      showToast('Verification Status Changed', `${targetName} is now ${nextVerified ? 'VERIFIED ✓' : 'UNVERIFIED'}`, 'info');
    }
  };

  const toggleUserStatus = (userId: string, newStatus: 'online' | 'busy' | 'offline' | 'in_call') => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, onlineStatus: newStatus } : u))
    );

    // Direct Supabase status sync
    updateUserStatusInSupabase(userId, newStatus).catch((e) =>
      console.warn('Direct Supabase toggle status notice:', e)
    );

    try {
      localStorage.setItem('livecall_presence_trigger', `${userId}_${newStatus}_${Date.now()}`);
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('livecall_presence_sync_channel');
        bc.postMessage({ type: 'presence_updated', userId, status: newStatus });
        bc.close();
      }
    } catch (e) { }
    fetch('/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, status: newStatus }),
    }).catch((e) => console.warn('Presence API notice:', e));

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'presence:update',
          userId,
          status: newStatus,
        })
      );
    }
  };

  const manualGrantCoins = (userId: string, amount: number, reason: string = 'Manual Admin Credit') => {
    const targetUser = usersRef.current.find((u) => u.id === userId) || users.find((u) => u.id === userId);
    if (!targetUser) return;

    const currentBal = Number(targetUser.coinBalance) || 0;
    const updatedBal = Math.max(0, currentBal + Number(amount));
    const targetName = targetUser.name || targetUser.id;
    const updatedUserObj: UserProfile = { ...targetUser, coinBalance: updatedBal };

    // 1. Update React state & usersRef & localStorage
    setUsers((prev) => {
      const next = prev.map((u) => (u.id === userId ? updatedUserObj : u));
      usersRef.current = next;
      return next;
    });

    // 2. Direct Supabase coin balance update
    if (isSupabaseConfigured()) {
      updateUserProfileInSupabase(userId, { coinBalance: updatedBal }).catch((e) =>
        console.warn('Supabase manual coin grant save error:', e)
      );
      upsertProfileToSupabase(updatedUserObj).catch((e) =>
        console.warn('Supabase manual coin grant upsert error:', e)
      );
    }

    // 3. Server API Sync & Real-time WebSocket Broadcast
    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedUserObj),
    }).catch(() => {});

    showToast(
      'Coins Manual Credit 🪙',
      `${amount >= 0 ? '+' : ''}${amount} coins ${amount >= 0 ? 'added to' : 'deducted from'} ${targetName}. New balance: ${(updatedBal ?? 0).toLocaleString()} coins. (${reason})`,
      amount >= 0 ? 'success' : 'warning'
    );
  };

  const createTeamLeader = (leaderData: Partial<UserProfile>): UserProfile => {
    const newId = (leaderData.id && isValidUuid(leaderData.id)) ? leaderData.id : generateValidUuid();
    const leaderAvatar = leaderData.avatarUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400';
    const newLeader: UserProfile = {
      id: newId,
      authId: leaderData.authId || newId,
      name: leaderData.name || 'New Team Leader',
      email: leaderData.email || `teamleader_${Date.now().toString().slice(-4)}@livecall.app`,
      gender: 'female',
      genderLocked: true,
      role: 'team_leader',
      age: leaderData.age || 28,
      dob: leaderData.dob || '1998-05-12',
      nationality: leaderData.nationality || 'United States',
      countryCode: leaderData.countryCode || 'US',
      spokenLanguages: leaderData.spokenLanguages || ['English'],
      bio: leaderData.bio || 'Talent Management & Creator Agency Director',
      interests: ['Talent Growth', 'Creator Mentorship'],
      tags: leaderData.tags || ['Team Leader', 'VIP Agency'],
      avatarUrl: leaderAvatar,
      gallery: (leaderData.gallery && leaderData.gallery.length > 0) ? leaderData.gallery : [leaderAvatar],
      isVerified: true,
      isOnboarded: true,
      coinBalance: 5000,
      hourlyCoinRate: 10,
      earningsCoins: 0,
      totalLifetimeEarnedUSD: 0,
      vipTier: 'diamond',
      onlineStatus: 'online',
      hasPasswordSet: true,
      agencyName: leaderData.agencyName || 'Aurora Talent Management',
      commissionPercent: leaderData.commissionPercent || 15,
      teamLeaderNote: leaderData.teamLeaderNote || '',
      createdAt: new Date().toISOString(),
    };

    setUsers((prev) => {
      const next = [newLeader, ...prev];
      usersRef.current = next;
      return next;
    });

    const leaderPayload = {
      ...newLeader,
      password: (leaderData as any).password || 'leader123',
    };

    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leaderPayload),
    }).catch((e) => console.warn('Team leader server sync warning:', e));

    if (isSupabaseConfigured()) {
      upsertProfileToSupabase(newLeader).catch((e) =>
        console.warn('Team leader Supabase sync warning:', e)
      );
    }

    showToast('Team Leader Created! 👑', `Successfully registered Team Leader ${newLeader.name} (${newLeader.agencyName || 'Agency'}).`, 'success');
    return newLeader;
  };

  const createCreatorByTeamLeader = (creatorData: Partial<UserProfile>, leaderId?: string): UserProfile => {
    const activeLeaderId = leaderId || currentUser.id;
    const leader = users.find((u) => u.id === activeLeaderId);
    const newId = (creatorData.id && isValidUuid(creatorData.id)) ? creatorData.id : generateValidUuid();
    const overrideRate = creatorData.coinEarnOverrideRate ?? 8;
    const creatorAvatar = creatorData.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400';

    const newCreator: UserProfile = {
      id: newId,
      authId: creatorData.authId || newId,
      name: creatorData.name || 'New Creator Host',
      email: creatorData.email || `creator_${Date.now().toString().slice(-4)}@livecall.app`,
      gender: 'female',
      genderLocked: true,
      role: 'female_creator',
      age: creatorData.age || 23,
      dob: creatorData.dob || '2003-06-15',
      nationality: creatorData.nationality || 'Spain',
      countryCode: creatorData.countryCode || 'ES',
      spokenLanguages: creatorData.spokenLanguages || ['English', 'Spanish'],
      bio: creatorData.bio || 'Live video creator and conversationalist!',
      interests: creatorData.interests || ['Music', 'Travel', 'Fashion'],
      interestedIn: ['male'],
      tags: creatorData.tags || ['Talent Agency', 'HD Video', 'Friendly'],
      avatarUrl: creatorAvatar,
      gallery: (creatorData.gallery && creatorData.gallery.length > 0) ? creatorData.gallery : [creatorAvatar],
      isVerified: true,
      isOnboarded: true,
      coinBalance: 0,
      hourlyCoinRate: creatorData.hourlyCoinRate || 10,
      coinEarnOverrideRate: overrideRate,
      teamLeaderId: activeLeaderId,
      createdById: activeLeaderId,
      agencyName: leader?.agencyName || currentUser.agencyName || 'Agency Guild',
      earningsCoins: 0,
      totalLifetimeEarnedUSD: 0,
      totalCallsHosted: 0,
      totalCallMinutes: 0,
      vipTier: 'none',
      onlineStatus: 'online',
      hasPasswordSet: true,
      createdAt: new Date().toISOString(),
    };

    setUsers((prev) => {
      const next = [newCreator, ...prev.filter((u) => u.id !== newCreator.id && u.email !== newCreator.email)];
      usersRef.current = next;
      return next;
    });

    const creatorPayload = {
      ...newCreator,
      password: (creatorData as any).password || 'creator123',
    };

    // Send to server via dedicated Team Leader creator creation endpoint and standard users API
    fetch('/api/teamleader/creators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creatorPayload),
    }).catch((e) => console.warn('Team Leader creator sync notice:', e));

    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creatorPayload),
    }).catch((e) => console.warn('Creator server sync warning:', e));

    if (isSupabaseConfigured()) {
      upsertProfileToSupabase(newCreator).catch((e) =>
        console.warn('Creator Supabase sync warning:', e)
      );
    }

    showToast(
      'Creator Host Created! ✨',
      `Registered female host ${newCreator.name} with custom earn rate of ${overrideRate} 🪙/min.`,
      'success'
    );
    return newCreator;
  };

  const updateCreatorCoinEarnOverride = (creatorId: string, overrideRate: number) => {
    let targetName = '';
    setUsers((prev) => {
      const next = prev.map((u) => {
        if (u.id === creatorId) {
          targetName = u.name;
          const updated = { ...u, coinEarnOverrideRate: overrideRate };
          if (isSupabaseConfigured()) {
            upsertProfileToSupabase(updated).catch(() => { });
          }
          fetch('/api/teamleader/override-rate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creatorId, rate: overrideRate }),
          }).catch(() => { });
          fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated),
          }).catch(() => { });
          return updated;
        }
        return u;
      });
      usersRef.current = next;
      return next;
    });

    showToast(
      'Coin Earn Override Set ⚡',
      `${targetName || 'Creator'} will now earn ${overrideRate} 🪙/min on live video calls (Team Leader rate override).`,
      'success'
    );
  };

  const banCreatorByTeamLeader = async (creatorId: string, days: number, reason: string): Promise<boolean> => {
    try {
      const banDays = Number(days) || 7;
      const banReason = reason || 'Suspended by Team Leader';
      const bannedUntil = new Date(Date.now() + banDays * 24 * 60 * 60 * 1000).toISOString();
      let targetName = '';

      setUsers((prev) => {
        const next = prev.map((u) => {
          if (u.id === creatorId) {
            targetName = u.name;
            const updated: UserProfile = {
              ...u,
              isBanned: true,
              banReason,
              bannedUntil,
              bannedById: currentUser.id,
              bannedByRole: 'team_leader',
              onlineStatus: 'offline',
            };
            if (isSupabaseConfigured()) {
              upsertProfileToSupabase(updated).catch(() => { });
            }
            return updated;
          }
          return u;
        });
        usersRef.current = next;
        return next;
      });

      // Server sync
      fetch('/api/teamleader/ban-creator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaderId: currentUser.id,
          creatorId,
          days: banDays,
          reason: banReason,
        }),
      }).catch((e) => console.warn('Team leader ban server sync warning:', e));

      showToast(
        'Host Suspended 🚫',
        `${targetName || 'Female Host'} has been suspended for ${banDays} days until ${new Date(bannedUntil).toLocaleDateString()}. Login blocked.`,
        'warning'
      );
      return true;
    } catch (e: any) {
      showToast('Ban Error', e.message || 'Failed to suspend creator', 'error');
      return false;
    }
  };

  const unbanCreatorByTeamLeader = async (creatorId: string): Promise<boolean> => {
    try {
      let targetName = '';
      setUsers((prev) => {
        const next = prev.map((u) => {
          if (u.id === creatorId) {
            targetName = u.name;
            const updated: UserProfile = {
              ...u,
              isBanned: false,
              banReason: undefined,
              bannedUntil: undefined,
              bannedById: undefined,
              bannedByRole: undefined,
            };
            if (isSupabaseConfigured()) {
              upsertProfileToSupabase(updated).catch(() => { });
            }
            return updated;
          }
          return u;
        });
        usersRef.current = next;
        return next;
      });

      fetch('/api/teamleader/unban-creator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId }),
      }).catch((e) => console.warn('Team leader unban server sync warning:', e));

      showToast('Suspension Lifted ✅', `${targetName || 'Host'} has been unbanned and can now log in and host calls.`, 'success');
      return true;
    } catch (e: any) {
      showToast('Unban Error', e.message || 'Failed to unban creator', 'error');
      return false;
    }
  };

  const deleteCreatorByTeamLeader = async (creatorId: string): Promise<boolean> => {
    try {
      let targetName = '';
      setUsers((prev) => {
        const target = prev.find((u) => u.id === creatorId);
        targetName = target?.name || 'Host';
        const next = prev.filter((u) => u.id !== creatorId);
        usersRef.current = next;
        return next;
      });

      fetch('/api/teamleader/delete-creator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId }),
      }).catch((e) => console.warn('Team leader delete server sync warning:', e));

      showToast('Host Deleted 🗑️', `Permanently removed ${targetName} from your agency and the database.`, 'info');
      return true;
    } catch (e: any) {
      showToast('Delete Error', e.message || 'Failed to delete creator', 'error');
      return false;
    }
  };

  const likePost = (postId: string) => {
    setFeedPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const nextIsLiked = !p.isLiked;
          return {
            ...p,
            isLiked: nextIsLiked,
            likes: nextIsLiked ? p.likes + 1 : Math.max(0, p.likes - 1),
          };
        }
        return p;
      })
    );
  };

  const likeUserMoment = (userId: string, momentId: string): boolean => {
    let toggledState = false;

    setUsers((prevUsers) =>
      prevUsers.map((u) => {
        if (u.id === userId && u.moments && u.moments.length > 0) {
          const updatedMoments = u.moments.map((m) => {
            if (m.id === momentId) {
              const isLiked = !m.isLiked;
              toggledState = isLiked;
              const nextCount = isLiked ? (m.likes || 0) + 1 : Math.max(0, (m.likes || 0) - 1);
              return {
                ...m,
                isLiked,
                likes: nextCount,
              };
            }
            return m;
          });
          const updatedUser = { ...u, moments: updatedMoments };
          if (isSupabaseConfigured()) {
            upsertProfileToSupabase(updatedUser).catch(() => {});
          }
          return updatedUser;
        }
        return u;
      })
    );

    // Also toggle in feedPosts if it exists in global feed
    setFeedPosts((prev) =>
      prev.map((p) => {
        if (p.id === momentId || p.mediaUrl.includes(momentId)) {
          const isLiked = !p.isLiked;
          return {
            ...p,
            isLiked,
            likes: isLiked ? p.likes + 1 : Math.max(0, p.likes - 1),
          };
        }
        return p;
      })
    );

    if (toggledState) {
      recordMomentInteraction();
    }

    showToast(
      toggledState ? 'Liked Moment! ❤️' : 'Unliked Moment',
      toggledState ? 'Added to your liked moments.' : 'Removed from liked moments.',
      'info'
    );
    return toggledState;
  };

  const tipMomentCreator = (creatorId: string, coinAmount: number = 20): boolean => {
    if (currentUser.coinBalance < coinAmount) {
      showToast(
        'Insufficient Coins! 🪙',
        `You need at least ${coinAmount} coins to tip this moment. Please refill your balance.`,
        'error'
      );
      return false;
    }

    const creatorUser = users.find((u) => u.id === creatorId);
    const isCreatorTlCreated = Boolean(creatorUser?.teamLeaderId);
    const isEligibleFemaleCreator = creatorUser?.role === 'female_creator' || creatorUser?.role === 'female_host' || isCreatorTlCreated;
    const canCreatorEarn = isEligibleFemaleCreator;
    const hostGiftSharePercent = systemSettings.giftFemaleHostSharePercent ?? 70;
    const tlGiftSharePercent = systemSettings.giftTeamLeaderSharePercent ?? 10;

    const addedEarnedCoins = canCreatorEarn ? Math.max(1, Math.round(coinAmount * (hostGiftSharePercent / 100))) : 0;
    const addedTlCoins = (isCreatorTlCreated && creatorUser?.teamLeaderId)
      ? Math.max(1, Math.round(coinAmount * (tlGiftSharePercent / 100)))
      : 0;

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === currentUser.id) {
          return { ...u, coinBalance: Math.max(0, u.coinBalance - coinAmount) };
        }
        if (u.id === creatorId) {
          const newCoins = (u.earningsCoins || 0) + addedEarnedCoins;
          return {
            ...u,
            earningsCoins: newCoins,
            totalLifetimeEarnedUSD: newCoins * systemSettings.femalePayoutRatioUSD,
            totalGiftsReceivedCount: (u.totalGiftsReceivedCount || 0) + 1,
          };
        }
        if (addedTlCoins > 0 && creatorUser?.teamLeaderId && (u.id === creatorUser.teamLeaderId || u.id === creatorUser.createdById)) {
          const newTlCoins = (u.earningsCoins || 0) + addedTlCoins;
          return {
            ...u,
            earningsCoins: newTlCoins,
            totalLifetimeEarnedUSD: newTlCoins * systemSettings.femalePayoutRatioUSD,
          };
        }
        return u;
      })
    );

    // Sync transaction to server
    fetch('/api/gifts/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: currentUser.id,
        receiverId: creatorId,
        giftId: 'tip_moment',
        giftCost: coinAmount,
        hostCoinsEarned: addedEarnedCoins,
        tlCoinsEarned: addedTlCoins,
        tlId: creatorUser?.teamLeaderId || creatorUser?.createdById,
      }),
    }).catch(() => {});

    showToast(
      'Tip Sent! 🪙',
      `You tipped ${coinAmount} coins to ${creatorUser ? creatorUser.name : 'the creator'}!`,
      'success'
    );
    return true;
  };

  const addFeedPost = (post: Omit<FeedPost, 'id' | 'createdAt' | 'likes' | 'commentsCount'>) => {
    const newPost: FeedPost = {
      ...post,
      id: 'post_' + Date.now(),
      likes: 0,
      commentsCount: 0,
      createdAt: 'Just now',
    };
    const updated = [newPost, ...feedPosts];
    setFeedPosts(updated);
    if (isSupabaseConfigured()) {
      upsertFeedPostToSupabase(newPost).catch(() => { });
    }
    recordMomentInteraction();
    showToast('Moment Published! ✨', 'Your post is now live in the global feed.', 'success');
  };

  const toggleFavorite = (userId: string) => {
    const exists = favorites.includes(userId);
    const updated = exists ? favorites.filter((id) => id !== userId) : [...favorites, userId];
    setFavorites(updated);
    localStorage.setItem('livecall_favorites', JSON.stringify(updated));
    if (isSupabaseConfigured() && currentUser?.id) {
      if (exists) {
        removeFavoriteFromSupabase(currentUser.id, userId).catch(() => { });
      } else {
        addFavoriteToSupabase(currentUser.id, userId).catch(() => { });
      }
    }
    showToast(
      exists ? 'Removed from Favorites' : 'Added to Favorites ⭐',
      exists ? 'User removed from your favorites list.' : 'User added to your priority list.',
      'info'
    );
  };

  const isFriend = (userId: string): boolean => {
    if (!userId || !currentUserId) return false;
    if (userId === currentUserId || (currentUser && userId === currentUser.id)) return false;

    // Must have an active accepted request between current user and target user
    const req = friendRequests.find(
      (r) =>
        r.status === 'accepted' &&
        ((r.senderId === currentUserId && r.receiverId === userId) ||
          (r.senderId === userId && r.receiverId === currentUserId) ||
          (currentUser && r.senderId === currentUser.id && r.receiverId === userId) ||
          (currentUser && r.senderId === userId && r.receiverId === currentUser.id))
    );

    return Boolean(req);
  };

  const addFriend = (userId: string) => {
    const isFemale = currentUser.gender === 'female' || currentUser.role === 'female_creator' || currentUser.role === 'female_host';
    if (isFemale) {
      sendFriendRequest(currentUser.id, userId);
    } else {
      showToast(
        'Friend Request Info 🌸',
        'In this platform, Female Creators send Friend Requests to loyal callers. Start a chat or video call to connect with the creator!',
        'info'
      );
    }
  };

  const sendFriendRequest = (femaleId: string, targetUserId: string, callLogId?: string) => {
    const sender = users.find((u) => u.id === femaleId) || currentUser;
    const receiver = users.find((u) => u.id === targetUserId);
    if (!receiver) return;

    // Strict rule: Female creators/hosts can send Friend Requests to any user (male or female)
    if (sender.gender !== 'female' && sender.role !== 'female_creator' && sender.role !== 'female_host') {
      showToast(
        'Action Restricted',
        'Only female hosts can initiate Friend Requests to callers.',
        'warning'
      );
      return;
    }

    const female = sender;
    const targetUser = receiver;

    // Check if already friends
    if (isFriend(targetUser.id)) {
      showToast('Already Friends 👥', `You and ${targetUser.name} are already connected as friends!`, 'info');
      return;
    }

    // Check if request already exists
    const existing = friendRequests.find(
      (r) => r.senderId === female.id && r.receiverId === targetUser.id && r.status === 'pending'
    );
    if (existing) {
      showToast('Request Pending ⏳', `Friend request already sent to ${targetUser.name}. Waiting for approval.`, 'info');
      return;
    }

    const friendBurnRate = systemSettings.coinBurnRateFriendPerMin ?? 80;
    const standardBurnRate = systemSettings.coinBurnRatePerMin ?? 120;

    const newRequest: FriendRequest = {
      id: 'freq_' + Date.now(),
      senderId: female.id,
      senderName: female.name,
      senderAvatar: female.avatarUrl,
      receiverId: targetUser.id,
      receiverName: targetUser.name,
      receiverAvatar: targetUser.avatarUrl,
      status: 'pending',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      callLogId,
    };

    setFriendRequests((prev) => [newRequest, ...prev.filter((r) => !(r.senderId === female.id && r.receiverId === targetUser.id))]);
    if (isSupabaseConfigured()) {
      upsertFriendRequestToSupabase(newRequest).catch((e) => console.warn('Supabase friend request save error:', e));
    }

    // Send real-time WebSocket event
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'friend_request:send',
          receiverId: targetUser.id,
          request: newRequest,
        })
      );
    }

    showToast(
      'Friend Request Sent! 🌸',
      `Sent friend request to ${targetUser.name}. When accepted, friend call rates (${friendBurnRate} 🪙/min) will apply!`,
      'success'
    );
  };

  const acceptFriendRequest = (requestId: string) => {
    const targetReq = friendRequests.find((r) => r.id === requestId);
    if (!targetReq) return;

    const updatedReq: FriendRequest = { ...targetReq, status: 'accepted' };
    const friendBurnRate = systemSettings.coinBurnRateFriendPerMin ?? 80;

    // Update friend request status
    setFriendRequests((prev) =>
      prev.map((r) => (r.id === requestId ? updatedReq : r))
    );
    if (isSupabaseConfigured()) {
      upsertFriendRequestToSupabase(updatedReq).catch((e) => console.warn('Supabase accept friend request error:', e));
    }

    // Add to friends list (both locally and persist)
    const otherUserId = targetReq.senderId === currentUser.id ? targetReq.receiverId : targetReq.senderId;
    setFriends((prev) => {
      const next = Array.from(new Set([...prev, targetReq.senderId, targetReq.receiverId, otherUserId]));
      return next;
    });

    // Send real-time WebSocket update
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'friend_request:accept',
          requestId,
          senderId: targetReq.senderId,
          receiverId: targetReq.receiverId,
        })
      );
    }

    showToast(
      'Friend Request Accepted! 👥',
      `You are now Friends with ${targetReq.senderId === currentUser.id ? targetReq.receiverName : targetReq.senderName}! Special Friend Rate (${friendBurnRate} 🪙/min) is active for 1-on-1 video calls.`,
      'success'
    );
  };

  const declineFriendRequest = (requestId: string) => {
    const targetReq = friendRequests.find((r) => r.id === requestId);
    if (!targetReq) return;

    const updatedReq: FriendRequest = { ...targetReq, status: 'declined' };
    const standardBurnRate = systemSettings.coinBurnRatePerMin ?? 120;

    setFriendRequests((prev) =>
      prev.map((r) => (r.id === requestId ? updatedReq : r))
    );
    if (isSupabaseConfigured()) {
      upsertFriendRequestToSupabase(updatedReq).catch((e) => console.warn('Supabase decline friend request error:', e));
    }

    // Send real-time WebSocket decline update
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'friend_request:decline',
          requestId,
          senderId: targetReq.senderId,
          receiverId: targetReq.receiverId,
        })
      );
    }

    showToast(
      'Request Declined',
      `Friend request declined. Standard coin burn rate (${standardBurnRate} 🪙/min) remains active.`,
      'info'
    );
  };

  const removeFriend = (userId: string) => {
    const updatedFriends = friends.filter((id) => id !== userId);
    setFriends(updatedFriends);

    // Completely remove all friend requests between these two users
    setFriendRequests((prev) => {
      const next = prev.filter(
        (r) =>
          !(
            (r.senderId === currentUserId && r.receiverId === userId) ||
            (r.senderId === userId && r.receiverId === currentUserId) ||
            (currentUser && r.senderId === currentUser.id && r.receiverId === userId) ||
            (currentUser && r.senderId === userId && r.receiverId === currentUser.id)
          )
      );
      return next;
    });

    // Persist removal in Supabase
    if (isSupabaseConfigured() && currentUserId) {
      removeFriendInSupabase(currentUserId, userId).catch(() => {});
    }

    // Broadcast removal over WebSocket so the other user's client immediately syncs
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'friend_request:remove',
          userA: currentUserId,
          userB: userId,
        })
      );
    }

    const targetUser = users.find((u) => u.id === userId);
    const targetName = targetUser ? targetUser.name : 'User';
    showToast(
      'Removed from Friends 👥',
      `${targetName} removed from your Friends list. Standard call rate (${systemSettings.coinBurnRatePerMin ?? 120} 🪙/min) is now active.`,
      'info'
    );
  };

  const toggleFriend = (userId: string) => {
    if (isFriend(userId)) {
      removeFriend(userId);
    } else {
      addFriend(userId);
    }
  };

  const blockUser = (userId: string, reason: string = 'Inappropriate Behavior') => {
    if (!blockedUserIds.includes(userId)) {
      const updated = [...blockedUserIds, userId];
      setBlockedUserIds(updated);
      localStorage.setItem('livecall_blocked', JSON.stringify(updated));
      if (isSupabaseConfigured() && currentUser?.id) {
        addBlockedUserToSupabase(currentUser.id, userId, reason).catch(() => { });
      }

      // Auto-cleanup: remove from friends if previously friends
      if (friends.includes(userId)) {
        removeFriend(userId);
      }

      // Auto-cleanup: remove from favorites if saved
      if (favorites.includes(userId)) {
        toggleFavorite(userId);
      }

      // Auto-cleanup: dismiss any pending friend requests
      setFriendRequests((prev) =>
        prev.map((r) =>
          (r.senderId === userId && r.receiverId === currentUser.id) ||
          (r.senderId === currentUser.id && r.receiverId === userId)
            ? { ...r, status: 'declined' as const }
            : r
        )
      );

      showToast('User Blocked 🚫', `User has been blocked. Reason: ${reason}`, 'warning');
    }
  };

  const unblockUser = (userId: string) => {
    if (blockedUserIds.includes(userId)) {
      const updated = blockedUserIds.filter((id) => id !== userId);
      setBlockedUserIds(updated);
      localStorage.setItem('livecall_blocked', JSON.stringify(updated));
      if (isSupabaseConfigured() && currentUser?.id) {
        removeBlockedUserFromSupabase(currentUser.id, userId).catch(() => { });
      }
      showToast('User Unblocked 🔓', 'User has been unblocked successfully.', 'success');
    }
  };

  const reportUser = (userId: string, reason: string) => {
    showToast('Report Submitted 🛡️', `Thank you. Our AI moderation team is reviewing this report: "${reason}".`, 'info');
  };

  const contributeToGoal = (creatorId: string, coins: number): boolean => {
    if (currentUser.coinBalance < coins) {
      showToast('Insufficient Coins 🪙', 'Please top up your wallet to contribute to this goal.', 'error');
      return false;
    }

    // Deduct from male user
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === currentUser.id) {
          return { ...u, coinBalance: u.coinBalance - coins };
        }
        if (u.id === creatorId) {
          return { ...u, earningsCoins: (u.earningsCoins || 0) + coins };
        }
        return u;
      })
    );

    // Update goal
    setCreatorGoals((prev) => {
      const current = prev[creatorId] || { title: 'Creator Target Goal', currentCoins: 0, targetCoins: 10000 };
      const updatedCoins = current.currentCoins + coins;
      return {
        ...prev,
        [creatorId]: { ...current, currentCoins: updatedCoins },
      };
    });

    showToast('Goal Contribution Sent! 🎉', `Dropped ${coins} 🪙 into creator goal target!`, 'success');
    return true;
  };

  // ============================================================================
  // DAILY REWARDS & GAMIFIED ACTIVITY QUESTS ENGINE
  // ============================================================================
  const openDailyRewardsModal = () => setIsDailyRewardsModalOpen(true);
  const closeDailyRewardsModal = () => setIsDailyRewardsModalOpen(false);

  // VIP multiplier calculator for reward coins
  const getVipRewardMultiplier = () => {
    const vip = currentUser?.vipTier || 'none';
    if (vip === 'diamond') return 2.0;
    if (vip === 'gold') return 1.5;
    if (vip === 'silver') return 1.25;
    if (vip === 'bronze') return 1.1;
    return 1.0;
  };

  // Sync and initialize user daily rewards directly from Supabase
  useEffect(() => {
    if (!currentUser?.id || currentUser.id === 'guest_user') return;
    const currentUid = currentUser.id;
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

    let isMounted = true;

    async function initDailyRewards() {
      if (!isSupabaseConfigured()) return;
      try {
        const dbRec = await fetchUserDailyRewardsFromSupabase(currentUid);
        if (!isMounted) return;

        if (dbRec) {
          let updated: DailyRewardRecord = { ...dbRec };
          let changed = false;

          // Check day rollover for daily tasks
          if (updated.tasksDate !== todayStr) {
            updated.tasksDate = todayStr;
            updated.taskChatFriends = [];
            updated.taskChatClaimed = false;
            updated.taskQuickMatches = 0;
            updated.taskQuickMatchClaimed = false;
            updated.taskVideoCallSeconds = 0;
            updated.taskVideoCallClaimed = false;
            updated.taskMomentInteractions = 0;
            updated.taskMomentClaimed = false;
            updated.taskGiftCount = 0;
            updated.taskGiftClaimed = false;
            updated.masterChestClaimed = false;
            changed = true;
          }

          // Check login streak
          if (updated.lastLoginDate === yesterdayStr) {
            if (updated.streakClaimedDate === yesterdayStr) {
              updated.streakCount = (updated.streakCount >= 7) ? 1 : updated.streakCount + 1;
            }
            updated.lastLoginDate = todayStr;
            changed = true;
          } else if (updated.lastLoginDate !== todayStr) {
            // Missed streak: reset to 1
            updated.streakCount = 1;
            updated.lastLoginDate = todayStr;
            changed = true;
          }

          setDailyRewardRecord(updated);
          if (changed) {
            upsertUserDailyRewardsInSupabase(updated);
          }
        } else {
          // Brand new user daily rewards record
          const initialRecord: DailyRewardRecord = {
            userId: currentUid,
            lastLoginDate: todayStr,
            streakCount: 1,
            streakClaimedDate: null,
            tasksDate: todayStr,
            taskChatFriends: [],
            taskChatClaimed: false,
            taskQuickMatches: 0,
            taskQuickMatchClaimed: false,
            taskVideoCallSeconds: 0,
            taskVideoCallClaimed: false,
            taskMomentInteractions: 0,
            taskMomentClaimed: false,
            taskGiftCount: 0,
            taskGiftClaimed: false,
            masterChestClaimed: false,
            totalCoinsEarned: 0,
          };
          setDailyRewardRecord(initialRecord);
          upsertUserDailyRewardsInSupabase(initialRecord);
        }
      } catch (err) {
        console.warn('[AppContext] Daily rewards sync error:', err);
      }
    }

    initDailyRewards();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

  // Determine if there are unclaimed streak, missions, or master chest rewards
  const todayDateStr = new Date().toISOString().split('T')[0];
  const isStreakUnclaimed = Boolean(
    dailyRewardRecord &&
    dailyRewardRecord.streakClaimedDate !== todayDateStr
  );
  const activeMissionsCfg = systemSettings.dailyMissionsConfig || {
    chatFriends: { target: 3, reward: 25, enabled: true },
    quickMatches: { target: 10, reward: 30, enabled: true },
    videoCall: { target: 60, reward: 35, enabled: true },
    momentInteract: { target: 3, reward: 15, enabled: true },
    sendGift: { target: 1, reward: 20, enabled: true },
    masterChest: { target: 4, reward: 50, enabled: true },
  };

  const hasUnclaimedMissions = Boolean(
    dailyRewardRecord && (
      (!dailyRewardRecord.taskChatClaimed && (dailyRewardRecord.taskChatFriends?.length || 0) >= (activeMissionsCfg.chatFriends?.target || 3)) ||
      (!dailyRewardRecord.taskQuickMatchClaimed && (dailyRewardRecord.taskQuickMatches || 0) >= (activeMissionsCfg.quickMatches?.target || 10)) ||
      (!dailyRewardRecord.taskVideoCallClaimed && (dailyRewardRecord.taskVideoCallSeconds || 0) >= (activeMissionsCfg.videoCall?.target || 60)) ||
      (!dailyRewardRecord.taskMomentClaimed && (dailyRewardRecord.taskMomentInteractions || 0) >= (activeMissionsCfg.momentInteract?.target || 3)) ||
      (!dailyRewardRecord.taskGiftClaimed && (dailyRewardRecord.taskGiftCount || 0) >= (activeMissionsCfg.sendGift?.target || 1))
    )
  );

  const completedClaimedCount = dailyRewardRecord
    ? [
        dailyRewardRecord.taskChatClaimed,
        dailyRewardRecord.taskQuickMatchClaimed,
        dailyRewardRecord.taskVideoCallClaimed,
        dailyRewardRecord.taskMomentClaimed,
        dailyRewardRecord.taskGiftClaimed,
      ].filter(Boolean).length
    : 0;

  const hasUnclaimedMasterChest = Boolean(
    dailyRewardRecord &&
    !dailyRewardRecord.masterChestClaimed &&
    completedClaimedCount >= (activeMissionsCfg.masterChest?.target || 4)
  );

  const hasUnclaimedDailyRewards = isStreakUnclaimed || hasUnclaimedMissions || hasUnclaimedMasterChest;

  // Activity tracking hooks
  const recordChatFriendInteraction = (receiverId: string) => {
    if (!currentUser?.id || !receiverId || receiverId === currentUser.id) return;
    setDailyRewardRecord((prev) => {
      if (!prev || prev.taskChatClaimed) return prev;
      const existing = prev.taskChatFriends || [];
      if (existing.includes(receiverId)) return prev;
      const updated = { ...prev, taskChatFriends: [...existing, receiverId] };
      upsertUserDailyRewardsInSupabase(updated);
      return updated;
    });
  };

  const recordQuickMatchInteraction = () => {
    if (!currentUser?.id) return;
    setDailyRewardRecord((prev) => {
      if (!prev || prev.taskQuickMatchClaimed) return prev;
      const updated = { ...prev, taskQuickMatches: (prev.taskQuickMatches || 0) + 1 };
      upsertUserDailyRewardsInSupabase(updated);
      return updated;
    });
  };

  const recordVideoCallDuration = (seconds: number) => {
    if (!currentUser?.id || seconds <= 0) return;
    setDailyRewardRecord((prev) => {
      if (!prev || prev.taskVideoCallClaimed) return prev;
      const updated = { ...prev, taskVideoCallSeconds: (prev.taskVideoCallSeconds || 0) + seconds };
      upsertUserDailyRewardsInSupabase(updated);
      return updated;
    });
  };

  const recordMomentInteraction = () => {
    if (!currentUser?.id) return;
    setDailyRewardRecord((prev) => {
      if (!prev || prev.taskMomentClaimed) return prev;
      const updated = { ...prev, taskMomentInteractions: (prev.taskMomentInteractions || 0) + 1 };
      upsertUserDailyRewardsInSupabase(updated);
      return updated;
    });
  };

  const recordGiftSentInteraction = () => {
    if (!currentUser?.id) return;
    setDailyRewardRecord((prev) => {
      if (!prev || prev.taskGiftClaimed) return prev;
      const updated = { ...prev, taskGiftCount: (prev.taskGiftCount || 0) + 1 };
      upsertUserDailyRewardsInSupabase(updated);
      return updated;
    });
  };

  // Claim Daily Streak
  const claimDailyStreak = async (): Promise<boolean> => {
    if (!currentUser?.id || !dailyRewardRecord) return false;
    const todayStr = new Date().toISOString().split('T')[0];
    if (dailyRewardRecord.streakClaimedDate === todayStr) {
      showToast('Already Claimed', 'You have already claimed today’s streak reward!', 'info');
      return false;
    }

    const streakRewards = systemSettings.dailyStreakRewards || [10, 15, 20, 25, 35, 50, 100];
    const dayIndex = Math.min(Math.max(0, (dailyRewardRecord.streakCount || 1) - 1), 6);
    const baseCoins = streakRewards[dayIndex] || 20;
    const coins = Math.round(baseCoins * getVipRewardMultiplier());

    const updatedRecord: DailyRewardRecord = {
      ...dailyRewardRecord,
      streakClaimedDate: todayStr,
      totalCoinsEarned: (dailyRewardRecord.totalCoinsEarned || 0) + coins,
    };

    setDailyRewardRecord(updatedRecord);
    await upsertUserDailyRewardsInSupabase(updatedRecord);

    const newCoinBalance = (currentUser.coinBalance || 0) + coins;
    setUsers((prev) =>
      prev.map((u) => (u.id === currentUser.id ? { ...u, coinBalance: newCoinBalance } : u))
    );

    if (isSupabaseConfigured()) {
      updateUserProfileInSupabase(currentUser.id, { coinBalance: newCoinBalance }).catch(() => {});
    }

    showToast(
      'Daily Check-in Claimed! 🔥',
      `+${coins} Free Coins added to your wallet! (Day ${dailyRewardRecord.streakCount} Streak)`,
      'success'
    );
    return true;
  };

  // Claim Daily Mission
  const claimDailyMission = async (missionKey: string): Promise<boolean> => {
    if (!currentUser?.id || !dailyRewardRecord) return false;
    const missionsConfig = systemSettings.dailyMissionsConfig || {
      chatFriends: { target: 3, reward: 25, enabled: true },
      quickMatches: { target: 10, reward: 30, enabled: true },
      videoCall: { target: 60, reward: 35, enabled: true },
      momentInteract: { target: 3, reward: 15, enabled: true },
      sendGift: { target: 1, reward: 20, enabled: true },
      masterChest: { target: 4, reward: 50, enabled: true },
    };

    let baseReward = 0;
    const updated: DailyRewardRecord = { ...dailyRewardRecord };

    if (missionKey === 'chat_friends') {
      if (updated.taskChatClaimed || (updated.taskChatFriends?.length || 0) < (missionsConfig.chatFriends?.target || 3)) {
        return false;
      }
      updated.taskChatClaimed = true;
      baseReward = missionsConfig.chatFriends?.reward || 25;
    } else if (missionKey === 'quick_matches') {
      if (updated.taskQuickMatchClaimed || (updated.taskQuickMatches || 0) < (missionsConfig.quickMatches?.target || 10)) {
        return false;
      }
      updated.taskQuickMatchClaimed = true;
      baseReward = missionsConfig.quickMatches?.reward || 30;
    } else if (missionKey === 'video_call') {
      if (updated.taskVideoCallClaimed || (updated.taskVideoCallSeconds || 0) < (missionsConfig.videoCall?.target || 60)) {
        return false;
      }
      updated.taskVideoCallClaimed = true;
      baseReward = missionsConfig.videoCall?.reward || 35;
    } else if (missionKey === 'moment_interact') {
      if (updated.taskMomentClaimed || (updated.taskMomentInteractions || 0) < (missionsConfig.momentInteract?.target || 3)) {
        return false;
      }
      updated.taskMomentClaimed = true;
      baseReward = missionsConfig.momentInteract?.reward || 15;
    } else if (missionKey === 'send_gift') {
      if (updated.taskGiftClaimed || (updated.taskGiftCount || 0) < (missionsConfig.sendGift?.target || 1)) {
        return false;
      }
      updated.taskGiftClaimed = true;
      baseReward = missionsConfig.sendGift?.reward || 20;
    } else {
      return false;
    }

    const coins = Math.round(baseReward * getVipRewardMultiplier());
    updated.totalCoinsEarned = (updated.totalCoinsEarned || 0) + coins;

    setDailyRewardRecord(updated);
    await upsertUserDailyRewardsInSupabase(updated);

    const newCoinBalance = (currentUser.coinBalance || 0) + coins;
    setUsers((prev) =>
      prev.map((u) => (u.id === currentUser.id ? { ...u, coinBalance: newCoinBalance } : u))
    );

    if (isSupabaseConfigured()) {
      updateUserProfileInSupabase(currentUser.id, { coinBalance: newCoinBalance }).catch(() => {});
    }

    showToast('Quest Completed! ✨', `+${coins} Free Coins earned from daily mission!`, 'success');
    return true;
  };

  // Claim Daily Master Chest
  const claimDailyMasterChest = async (): Promise<boolean> => {
    if (!currentUser?.id || !dailyRewardRecord || dailyRewardRecord.masterChestClaimed) return false;
    const missionsConfig = systemSettings.dailyMissionsConfig || {
      chatFriends: { target: 3, reward: 25, enabled: true },
      quickMatches: { target: 10, reward: 30, enabled: true },
      videoCall: { target: 60, reward: 35, enabled: true },
      momentInteract: { target: 3, reward: 15, enabled: true },
      sendGift: { target: 1, reward: 20, enabled: true },
      masterChest: { target: 4, reward: 50, enabled: true },
    };

    const claimedCount = [
      dailyRewardRecord.taskChatClaimed,
      dailyRewardRecord.taskQuickMatchClaimed,
      dailyRewardRecord.taskVideoCallClaimed,
      dailyRewardRecord.taskMomentClaimed,
      dailyRewardRecord.taskGiftClaimed,
    ].filter(Boolean).length;

    const masterTarget = missionsConfig.masterChest?.target || 4;
    if (claimedCount < masterTarget) {
      showToast('Master Chest Locked', `Complete at least ${masterTarget} daily missions first!`, 'info');
      return false;
    }

    const baseReward = missionsConfig.masterChest?.reward || 50;
    const coins = Math.round(baseReward * getVipRewardMultiplier());

    const updated: DailyRewardRecord = {
      ...dailyRewardRecord,
      masterChestClaimed: true,
      totalCoinsEarned: (dailyRewardRecord.totalCoinsEarned || 0) + coins,
    };

    setDailyRewardRecord(updated);
    await upsertUserDailyRewardsInSupabase(updated);

    const newCoinBalance = (currentUser.coinBalance || 0) + coins;
    setUsers((prev) =>
      prev.map((u) => (u.id === currentUser.id ? { ...u, coinBalance: newCoinBalance } : u))
    );

    if (isSupabaseConfigured()) {
      updateUserProfileInSupabase(currentUser.id, { coinBalance: newCoinBalance }).catch(() => {});
    }

    showToast('🏆 Master Chest Unlocked!', `+${coins} Mega Bonus Coins added to your wallet!`, 'success');
    return true;
  };

  // Legacy bonus alias
  const claimDailyBonus = () => {
    if (!isStreakUnclaimed) {
      openDailyRewardsModal();
    } else {
      claimDailyStreak();
    }
  };

  const connectCallerToHost = useCallback((callerProfile: UserProfile, hostId: string) => {
    if (!callerProfile?.id || !hostId) return;

    setConnectedCallersByHost((prev) => {
      const existing = prev[hostId] || [];
      if (existing.some((u) => u.id === callerProfile.id)) return prev;
      const next = { ...prev, [hostId]: [callerProfile, ...existing] };
      try {
        localStorage.setItem(
          'livecall_quick_match_caller_connected_sync',
          JSON.stringify({
            type: 'connect',
            hostId,
            callerProfile,
            timestamp: Date.now(),
          })
        );
      } catch {}
      return next;
    });

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'quick_match:caller_connect',
          callerId: callerProfile.id,
          hostId,
          callerProfile,
        })
      );
    }
  }, []);

  const disconnectCallerFromHost = useCallback((callerId: string, hostId?: string) => {
    if (!callerId) return;

    setConnectedCallersByHost((prev) => {
      const next: Record<string, UserProfile[]> = {};
      for (const [hId, callers] of Object.entries(prev)) {
        if (hostId && hId !== hostId) {
          next[hId] = callers;
        } else {
          next[hId] = callers.filter((c) => c.id !== callerId);
        }
      }
      try {
        localStorage.setItem(
          'livecall_quick_match_caller_connected_sync',
          JSON.stringify({
            type: 'disconnect',
            hostId,
            callerId,
            timestamp: Date.now(),
          })
        );
      } catch {}
      return next;
    });

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'quick_match:caller_disconnect',
          callerId,
          hostId,
        })
      );
    }
  }, []);

  const setCallerQuickMatchBrowsing = useCallback((isBrowsing: boolean) => {
    if (!currentUser?.id) return;
    if (isBrowsing) {
      setActiveQuickMatchCallerIds((prev) => {
        const next = Array.from(new Set([...prev, currentUser.id]));
        try {
          localStorage.setItem('livecall_quick_match_callers_sync', JSON.stringify(next));
        } catch {}
        return next;
      });
    } else {
      setActiveQuickMatchCallerIds((prev) => {
        const next = prev.filter((id) => id !== currentUser.id);
        try {
          localStorage.setItem('livecall_quick_match_callers_sync', JSON.stringify(next));
        } catch {}
        return next;
      });
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'quick_match:caller_active',
          userId: currentUser.id,
          isBrowsing,
        })
      );
    }
  }, [currentUser?.id]);

  const isHostLive = (userId: string): boolean => {
    return liveHostIds.includes(userId);
  };

  const toggleGoLiveQuickMatch = (targetUserId?: string, forceState?: boolean): boolean => {
    const userToToggle = targetUserId ? users.find((u) => u.id === targetUserId) : currentUser;
    if (!userToToggle) return false;

    // Rule: Only female creators and regular females can go live as hosts
    const isFemale =
      userToToggle.gender === 'female' ||
      userToToggle.role === 'female_creator' ||
      userToToggle.role === 'female_host';

    if (!isFemale) {
      showToast(
        'Go Live Restricted',
        'Only female creators and female members can broadcast live in Quick Match. Male users can discover & match with live female hosts!',
        'warning'
      );
      return false;
    }

    const currentlyLive = liveHostIds.includes(userToToggle.id);
    const shouldBeLive = forceState !== undefined ? forceState : !currentlyLive;

    if (!shouldBeLive) {
      if (currentlyLive) {
        const updated = liveHostIds.filter((id) => id !== userToToggle.id);
        setLiveHostIds(updated);
        showToast(
          'Broadcast Ended',
          `${userToToggle.name} is no longer live in Quick Match.`,
          'info'
        );
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'quick_match:set_live', userId: userToToggle.id, isLive: false }));
      }
      return false;
    } else {
      if (!currentlyLive) {
        const updated = [...liveHostIds, userToToggle.id];
        setLiveHostIds(updated);
        showToast(
          '🔴 YOU ARE NOW LIVE!',
          `Live in Quick Match pool! Callers will discover your stream and can like/match with you.`,
          'success'
        );
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'quick_match:set_live', userId: userToToggle.id, isLive: true }));
      }
      return true;
    }
  };

  // Quick Match Successful Matches History (Preserves last 50 matches strictly per user)
  const [quickMatches, setQuickMatches] = useState<QuickMatchItem[]>(() => {
    try {
      const saved = currentUserId ? localStorage.getItem('livecall_quick_matches_v4_' + currentUserId) : null;
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Load and sync real matches directly from Supabase database scoped to currentUser
  useEffect(() => {
    if (!currentUser?.id) {
      setQuickMatches([]);
      return;
    }

    const currentUid = currentUser.id;

    // Load from local storage for this specific user
    try {
      const saved = localStorage.getItem('livecall_quick_matches_v4_' + currentUid);
      if (saved) {
        setQuickMatches(JSON.parse(saved));
      } else {
        setQuickMatches([]);
      }
    } catch {
      setQuickMatches([]);
    }

    async function loadMatchesFromSupabase() {
      if (!isSupabaseConfigured() || !currentUid) return;
      try {
        const dbMatches = await fetchMatchesForUser(currentUid);
        if (dbMatches && Array.isArray(dbMatches)) {
          const currentUsersList = usersRef.current || users;
          const formattedMatches: QuickMatchItem[] = dbMatches
            .filter((m: any) => m.status === 'matched')
            .map((m: any) => {
              const otherUserId = m.user_a_id === currentUid ? m.user_b_id : m.user_a_id;
              if (!otherUserId || otherUserId === currentUid) return null;

              const otherUser =
                currentUsersList.find((u) => u.id === otherUserId) ||
                (m.user_a_id === currentUid ? m.user_b : m.user_a);

              const name = otherUser?.name || 'Member';
              const avatar = otherUser?.avatarUrl || otherUser?.avatar_url || '';
              const gender = otherUser?.gender || 'male';
              const age = otherUser?.age;
              const countryCode = otherUser?.countryCode || otherUser?.country_code;
              const city = otherUser?.city || otherUser?.location_city || 'Online Member';

              return {
                id: m.id || `qm_${Date.now()}_${otherUserId}`,
                matchedUserId: otherUserId,
                matchedUserName: name,
                matchedUserAvatar: avatar,
                matchedUserGender: gender,
                matchedUserAge: age,
                matchedUserCountryCode: countryCode,
                matchedUserCity: city,
                matchedAt: m.matched_at || m.created_at || new Date().toISOString(),
                giftsExchangedCoins: 0,
              };
            })
            .filter(Boolean) as QuickMatchItem[];

          setQuickMatches(formattedMatches);
          try {
            localStorage.setItem('livecall_quick_matches_v4_' + currentUid, JSON.stringify(formattedMatches));
          } catch (e) {}
        }
      } catch (err) {
        console.warn('Error loading matches from Supabase:', err);
      }
    }

    loadMatchesFromSupabase();
  }, [currentUser?.id]);

  const recordQuickMatch = (matchedUser: UserProfile, giftsCoins = 0) => {
    if (!currentUser?.id || !matchedUser?.id) return;
    recordQuickMatchInteraction();
    const currentUid = currentUser.id;
    const loc = getUserEffectiveLocation(matchedUser);
    const matchItem: QuickMatchItem = {
      id: `qm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      matchedUserId: matchedUser.id,
      matchedUserName: matchedUser.name,
      matchedUserAvatar: matchedUser.avatarUrl,
      matchedUserGender: matchedUser.gender,
      matchedUserAge: matchedUser.age,
      matchedUserCountryCode: matchedUser.countryCode,
      matchedUserCity: loc.displayCity,
      matchedAt: new Date().toISOString(),
      giftsExchangedCoins: giftsCoins,
    };

    setQuickMatches((prev) => {
      const filtered = prev.filter((m) => m.matchedUserId !== matchedUser.id);
      const updated = [matchItem, ...filtered].slice(0, 50);
      try {
        localStorage.setItem('livecall_quick_matches_v4_' + currentUid, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // Also sync matchedUser's storage for same-device/multi-tab persona testing
    try {
      const otherLoc = getUserEffectiveLocation(currentUser);
      const otherMatchItem: QuickMatchItem = {
        id: matchItem.id,
        matchedUserId: currentUid,
        matchedUserName: currentUser.name,
        matchedUserAvatar: currentUser.avatarUrl,
        matchedUserGender: currentUser.gender,
        matchedUserAge: currentUser.age,
        matchedUserCountryCode: currentUser.countryCode,
        matchedUserCity: otherLoc.displayCity,
        matchedAt: matchItem.matchedAt,
        giftsExchangedCoins: giftsCoins,
      };
      const existingOther = localStorage.getItem('livecall_quick_matches_v4_' + matchedUser.id);
      const otherList: QuickMatchItem[] = existingOther ? JSON.parse(existingOther) : [];
      const nextOther = [otherMatchItem, ...otherList.filter((m) => m.matchedUserId !== currentUid)].slice(0, 50);
      localStorage.setItem('livecall_quick_matches_v4_' + matchedUser.id, JSON.stringify(nextOther));
      localStorage.setItem('livecall_quick_matches_sync', JSON.stringify({ timestamp: Date.now(), userA: currentUid, userB: matchedUser.id }));
    } catch (e) {}

    // Broadcast over WebSocket in real-time
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'match:created',
          senderId: currentUid,
          receiverId: matchedUser.id,
          matchItem,
        })
      );
    }

    // Directly persist match to Supabase matches table
    if (isSupabaseConfigured()) {
      upsertMatchToSupabase(currentUid, matchedUser.id, 'matched', currentUid).catch((e) =>
        console.warn('Supabase match upsert error:', e)
      );
    }
  };

  const sendQuickMatchGift = (
    targetUserId: string,
    giftKey: string,
    giftCost: number,
    giftName: string
  ): boolean => {
    const sender = users.find((u) => u.id === currentUser.id) || currentUser;
    if (sender.coinBalance < giftCost) {
      showToast(
        'Insufficient Coins! 🪙',
        `Sending ${giftName} requires ${giftCost} coins. Please refill your wallet.`,
        'error'
      );
      return false;
    }

    const receiver = users.find((u) => u.id === targetUserId);
    if (!receiver) {
      showToast('Recipient Not Found', 'Could not locate recipient user.', 'error');
      return false;
    }

    // Role check for earning split
    const isFemaleCreatorOrHost =
      receiver.gender === 'female' ||
      receiver.role === 'female_creator' ||
      receiver.role === 'female_host';

    const creatorSplit = systemSettings.quickMatchGiftSplitFemaleCreator ?? 60;
    const tlSplit = systemSettings.quickMatchGiftSplitTL ?? 10;

    let addedCreatorCoins = 0;
    let addedTlCoins = 0;

    if (isFemaleCreatorOrHost && (receiver.role === 'female_creator' || receiver.role === 'female_host' || systemSettings.enableRegularFemaleCoinEarning)) {
      addedCreatorCoins = Math.max(1, Math.round(giftCost * (creatorSplit / 100)));
      if (receiver.teamLeaderId) {
        addedTlCoins = Math.max(1, Math.round(giftCost * (tlSplit / 100)));
      }
    } else {
      // Regular male or regular female user: 100% goes to Platform (0 user earnings)
      addedCreatorCoins = 0;
      addedTlCoins = 0;
    }

    // Update users state
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === currentUser.id) {
          return { ...u, coinBalance: Math.max(0, u.coinBalance - giftCost) };
        }
        if (u.id === targetUserId && addedCreatorCoins > 0) {
          return {
            ...u,
            earningsCoins: (u.earningsCoins || 0) + addedCreatorCoins,
            totalLifetimeEarnedUSD: (u.totalLifetimeEarnedUSD || 0) + addedCreatorCoins * (systemSettings.femalePayoutRatioUSD || 0.008),
            totalGiftsReceivedCount: (u.totalGiftsReceivedCount || 0) + 1,
          };
        }
        if (receiver.teamLeaderId && u.id === receiver.teamLeaderId && addedTlCoins > 0) {
          return {
            ...u,
            earningsCoins: (u.earningsCoins || 0) + addedTlCoins,
            totalLifetimeEarnedUSD: (u.totalLifetimeEarnedUSD || 0) + addedTlCoins * (systemSettings.femalePayoutRatioUSD || 0.008),
          };
        }
        return u;
      })
    );

    // Update quick match record if present
    setQuickMatches((prev) =>
      prev.map((m) =>
        m.matchedUserId === targetUserId
          ? { ...m, giftsExchangedCoins: (m.giftsExchangedCoins || 0) + giftCost }
          : m
      )
    );

    recordGiftSentInteraction();

    showToast(
      'Quick Gift Sent! ✨',
      `Sent ${giftName} (${giftCost} 🪙) to ${receiver.name}!`,
      'success'
    );
    return true;
  };

  // Home & Policies CMS Handlers
  const openPolicyModal = (policyIdOrSlug: string) => {
    const found = policyDocuments.find((p) => p.id === policyIdOrSlug || p.slug === policyIdOrSlug);
    if (found) {
      setActivePolicyDoc(found);
    } else {
      setActivePolicyDoc(policyDocuments[0] || null);
    }
  };

  const closePolicyModal = () => {
    setActivePolicyDoc(null);
  };

  const saveHomeBanner = (banner: Partial<HomeBanner> & { id?: string }) => {
    if (banner.id) {
      const updatedList = homeBanners.map((b) => (b.id === banner.id ? ({ ...b, ...banner } as HomeBanner) : b));
      setHomeBanners(updatedList);
      localStorage.setItem('livecall_home_banners', JSON.stringify(updatedList));
      if (isSupabaseConfigured()) {
        upsertHomeBannerToSupabase(banner).catch(() => { });
      }
      showToast('Banner Updated 🖼️', `Updated promo banner: ${banner.title || banner.id}`, 'success');
    } else {
      const newBanner: HomeBanner = {
        id: 'banner_' + Date.now(),
        title: banner.title || 'New Live Promo',
        subtitle: banner.subtitle || 'Discover exciting video matches today.',
        tagText: banner.tagText || 'FEATURED',
        tagColor: banner.tagColor || 'bg-indigo-600 text-white',
        imageUrl: banner.imageUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=1200',
        ctaText: banner.ctaText || 'Explore Now',
        actionType: banner.actionType || 'tab',
        actionTarget: banner.actionTarget || 'discovery',
        active: banner.active ?? true,
        order: homeBanners.length + 1,
        bgGradient: banner.bgGradient || 'from-indigo-950/90 via-purple-950/70 to-slate-900/90',
      };
      const updatedList = [...homeBanners, newBanner];
      setHomeBanners(updatedList);
      localStorage.setItem('livecall_home_banners', JSON.stringify(updatedList));
      if (isSupabaseConfigured()) {
        upsertHomeBannerToSupabase(newBanner).catch(() => { });
      }
      showToast('Banner Created 🖼️', `Added new promo banner: ${newBanner.title}`, 'success');
    }
  };

  const deleteHomeBanner = (bannerId: string) => {
    const updated = homeBanners.filter((b) => b.id !== bannerId);
    setHomeBanners(updated);
    localStorage.setItem('livecall_home_banners', JSON.stringify(updated));
    if (isSupabaseConfigured()) {
      deleteHomeBannerFromSupabase(bannerId).catch(() => { });
    }
    showToast('Banner Deleted', 'Promo banner removed from Home page', 'info');
  };

  const toggleBannerActive = (bannerId: string) => {
    const target = homeBanners.find((b) => b.id === bannerId);
    const nextActive = target ? !target.active : true;
    const updated = homeBanners.map((b) => (b.id === bannerId ? { ...b, active: nextActive } : b));
    setHomeBanners(updated);
    localStorage.setItem('livecall_home_banners', JSON.stringify(updated));
    if (isSupabaseConfigured() && target) {
      upsertHomeBannerToSupabase({ ...target, active: nextActive }).catch(() => { });
    }
  };

  const savePolicyDocument = (policy: Partial<PolicyDocument> & { id?: string }) => {
    if (policy.id) {
      const updatedDoc = {
        ...policy,
        lastUpdated: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      };
      const updated = policyDocuments.map((p) => (p.id === policy.id ? ({ ...p, ...updatedDoc } as PolicyDocument) : p));
      setPolicyDocuments(updated);
      localStorage.setItem('livecall_policy_documents', JSON.stringify(updated));
      if (isSupabaseConfigured()) {
        upsertCmsPolicy({
          id: policy.id,
          slug: policy.slug || (policy.title || 'policy').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          title: policy.title || 'Policy',
          category: policy.category || 'safety',
          icon: policy.icon || 'ShieldCheck',
          content: policy.content || '',
          summary: policy.summary || '',
          effectiveDate: updatedDoc.lastUpdated,
          order: policy.order,
          isFeaturedOnHome: policy.isFeaturedOnHome,
          externalUrl: policy.externalUrl,
        }).catch(() => { });
      }
      showToast('Policy Updated 📜', `Updated policy document: ${policy.title || policy.id}`, 'success');
    } else {
      const newDoc: PolicyDocument = {
        id: 'policy_' + Date.now(),
        slug: (policy.title || 'policy').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        title: policy.title || 'Platform Policy',
        category: policy.category || 'safety',
        icon: policy.icon || 'ShieldCheck',
        summary: policy.summary || 'Platform safety and regulatory guidelines.',
        content: policy.content || '### Policy Details\n\nPolicy compliance guidelines and terms.',
        lastUpdated: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        order: policyDocuments.length + 1,
        isFeaturedOnHome: policy.isFeaturedOnHome ?? true,
        externalUrl: policy.externalUrl,
      };
      const updated = [...policyDocuments, newDoc];
      setPolicyDocuments(updated);
      localStorage.setItem('livecall_policy_documents', JSON.stringify(updated));
      if (isSupabaseConfigured()) {
        upsertCmsPolicy(newDoc).catch(() => { });
      }
      showToast('Policy Published 📜', `Created new policy: ${newDoc.title}`, 'success');
    }
  };

  const deletePolicyDocument = (policyId: string) => {
    const updated = policyDocuments.filter((p) => p.id !== policyId);
    setPolicyDocuments(updated);
    localStorage.setItem('livecall_policy_documents', JSON.stringify(updated));
    if (isSupabaseConfigured()) {
      deleteCmsPolicyFromSupabase(policyId).catch(() => { });
    }
    showToast('Policy Deleted', 'Policy document removed', 'info');
  };

  const saveHomeQuickLink = (link: Partial<HomeQuickLink> & { id?: string }) => {
    if (link.id) {
      const updated = homeQuickLinks.map((l) => (l.id === link.id ? ({ ...l, ...link } as HomeQuickLink) : l));
      setHomeQuickLinks(updated);
      localStorage.setItem('livecall_home_quick_links', JSON.stringify(updated));
      if (isSupabaseConfigured()) {
        upsertHomeQuickLinkToSupabase(link).catch(() => { });
      }
      showToast('Shortcut Updated', `Updated shortcut: ${link.title}`, 'success');
    } else {
      const newLink: HomeQuickLink = {
        id: 'link_' + Date.now(),
        title: link.title || 'Quick Action',
        subtitle: link.subtitle || 'Explore feature',
        icon: link.icon || 'Zap',
        badge: link.badge,
        actionType: link.actionType || 'tab',
        actionTarget: link.actionTarget || 'discovery',
        colorGradient: link.colorGradient || 'from-indigo-500 to-purple-600',
        order: homeQuickLinks.length + 1,
        active: link.active ?? true,
      };
      const updated = [...homeQuickLinks, newLink];
      setHomeQuickLinks(updated);
      localStorage.setItem('livecall_home_quick_links', JSON.stringify(updated));
      if (isSupabaseConfigured()) {
        upsertHomeQuickLinkToSupabase(newLink).catch(() => { });
      }
      showToast('Shortcut Added', `Added shortcut: ${newLink.title}`, 'success');
    }
  };

  const deleteHomeQuickLink = (linkId: string) => {
    const updated = homeQuickLinks.filter((l) => l.id !== linkId);
    setHomeQuickLinks(updated);
    localStorage.setItem('livecall_home_quick_links', JSON.stringify(updated));
    if (isSupabaseConfigured()) {
      deleteHomeQuickLinkFromSupabase(linkId).catch(() => { });
    }
    showToast('Shortcut Removed', 'Quick shortcut removed from Home page', 'info');
  };

  // =========================================================================
  // SILENT ADMIN VIDEO CALL MONITORING & QA COMPLIANCE CONTROLLERS
  // =========================================================================

  const adminTerminateCall = async (callId: string, reason?: string): Promise<boolean> => {
    try {
      const targetCall = adminActiveCalls.find((c) => c.id === callId);
      const terminationReason = reason || 'Safety & Compliance Violation: Call terminated by Platform Administration.';

      // Dispatch to server endpoint for WebRTC / WebSocket broadcast
      try {
        await fetch('/api/admin/terminate-call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callId,
            reason: terminationReason,
            adminId: currentUser.id,
          }),
        });

        await fetch('/api/calls/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callId,
            callerId: targetCall?.callerId,
            receiverId: targetCall?.hostId,
            status: 'ended',
          }),
        });
      } catch (err) {
        console.warn('Backend terminate-call sync error:', err);
      }

      // If the current active user in UI was in this call, terminate local session
      if (activeCall && (activeCall.id === callId || (targetCall && (activeCall.callerId === targetCall.callerId || activeCall.receiverId === targetCall.hostId)))) {
        setActiveCall(null);
      }

      // Remove from active surveillance calls
      setAdminActiveCalls((prev) => prev.filter((c) => c.id !== callId));

      // Reset user statuses back to online
      if (targetCall) {
        setUsers((prev) =>
          prev.map((u) => {
            if (u.id === targetCall.hostId || u.id === targetCall.callerId) {
              return { ...u, onlineStatus: 'online' };
            }
            return u;
          })
        );

        if (isSupabaseConfigured()) {
          updateUserStatusInSupabase(targetCall.hostId, 'online').catch(() => {});
          updateUserStatusInSupabase(targetCall.callerId, 'online').catch(() => {});
        }

        // Record official audit log in incident evidence
        const newEvidence: IncidentEvidence = {
          id: 'inc_' + Date.now(),
          callId: targetCall.id,
          hostName: targetCall.hostName,
          callerName: targetCall.callerName,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actionTaken: 'Emergency Termination (Killswitch Triggered)',
          adminNote: `Session forcefully halted. Reason: "${terminationReason}"`,
        };
        setIncidentEvidenceLogs((prev) => [newEvidence, ...prev]);
      }

      showToast(
        'Call Terminated (Admin Killswitch) 🚨',
        `Live video call ${callId} has been successfully disconnected and participants notified.`,
        'success'
      );
      return true;
    } catch (err: any) {
      showToast('Termination Failed', err.message || 'Could not terminate call session.', 'error');
      return false;
    }
  };

  const adminIssueCallWarning = async (callId: string, warningText: string): Promise<boolean> => {
    try {
      const targetCall = adminActiveCalls.find((c) => c.id === callId);
      const text = warningText.trim() || 'Automated Safety Advisory: Please maintain respectful conduct.';

      try {
        await fetch('/api/admin/issue-warning', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callId,
            warningText: text,
          }),
        });
      } catch (err) {
        console.warn('Backend warning dispatch error:', err);
      }

      if (targetCall) {
        const newEvidence: IncidentEvidence = {
          id: 'inc_' + Date.now(),
          callId: targetCall.id,
          hostName: targetCall.hostName,
          callerName: targetCall.callerName,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actionTaken: 'Safety Advisory Warning Dispatched',
          adminNote: `Dispatched warning to room: "${text}" without revealing admin spectator presence.`,
        };
        setIncidentEvidenceLogs((prev) => [newEvidence, ...prev]);
      }

      showToast(
        'Safety Advisory Dispatched ⚠️',
        `Discreet compliance warning delivered to participants: "${text}".`,
        'info'
      );
      return true;
    } catch (err: any) {
      showToast('Warning Failed', err.message || 'Could not send safety warning.', 'error');
      return false;
    }
  };

  const adminCaptureEvidence = (callId: string, note?: string, snapshotUrl?: string) => {
    const targetCall = adminActiveCalls.find((c) => c.id === callId);
    if (!targetCall) return;

    const newEvidence: IncidentEvidence = {
      id: 'inc_' + Date.now(),
      callId: targetCall.id,
      hostName: targetCall.hostName,
      callerName: targetCall.callerName,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actionTaken: 'Evidence Snapshot Captured',
      snapshotUrl: snapshotUrl || targetCall.hostAvatar,
      adminNote: note || `Stream snapshot & QA telemetry saved at ${targetCall.durationSeconds}s runtime. Safety score: ${targetCall.safetyScore ?? 99}%.`,
    };

    setIncidentEvidenceLogs((prev) => [newEvidence, ...prev]);
    showToast(
      'Evidence Snapshot Captured 📸',
      `Telemetry timestamp & video frame saved to QA audit report for ${targetCall.hostName} & ${targetCall.callerName}.`,
      'success'
    );
  };

  const adminSpawnDemoCall = (hostId?: string, callerId?: string): string => {
    // Find female host and male caller
    const femaleHosts = users.filter((u) => u.gender === 'female' || u.role === 'female_creator');
    const maleCallers = users.filter((u) => u.gender === 'male' || u.role === 'male_user');

    const host = (hostId ? users.find((u) => u.id === hostId) : null) ||
      femaleHosts.find((h) => !adminActiveCalls.some((c) => c.hostId === h.id)) ||
      femaleHosts[0] ||
      users[1];

    const caller = (callerId ? users.find((u) => u.id === callerId) : null) ||
      maleCallers.find((m) => !adminActiveCalls.some((c) => c.callerId === m.id)) ||
      maleCallers[0] ||
      users[0];

    const newCallId = 'call_live_' + Math.floor(10000 + Math.random() * 90000);

    const newCall: AdminActiveCall = {
      id: newCallId,
      hostId: host.id,
      hostName: host.name,
      hostAvatar: host.avatarUrl,
      hostCountry: host.nationality || 'Spain',
      hostCountryCode: host.countryCode || 'ES',
      hostHourlyRate: host.hourlyCoinRate || getEffectiveCallRate(host.id, caller.id),
      hostRating: 4.97,
      hostAge: host.age || 24,
      hostEarningsCoins: host.earningsCoins || 7500,
      callerId: caller.id,
      callerName: caller.name,
      callerAvatar: caller.avatarUrl,
      callerCountry: caller.nationality || 'United States',
      callerCountryCode: caller.countryCode || 'US',
      callerVipTier: caller.vipTier || 'gold',
      callerCoinBalance: caller.coinBalance || 350,
      startTime: Date.now() - 45000,
      durationSeconds: 45,
      coinsSpent: 8,
      coinsEarned: 4,
      status: 'active',
      burnRatePerMin: getEffectiveCallRate(host.id, caller.id),
      videoQuality: systemSettings.livekitCaptureResolution === '4k' ? '4K Ultra HD' : systemSettings.livekitCaptureResolution === '1080p' ? '1080p FHD' : systemSettings.livekitCaptureResolution === '480p' ? '480p SD' : '720p HD',
      fps: 60,
      bitrateKbps: 2340,
      latencyMs: 44,
      packetLoss: 0.01,
      safetyScore: 99.9,
      safetyFlag: 'clean',
      aiShieldActive: false,
      hostAudioLevel: 62,
      callerAudioLevel: 38,
    };

    // Update host online status to in_call
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === host.id) return { ...u, onlineStatus: 'in_call' };
        if (u.id === caller.id) return { ...u, onlineStatus: 'in_call' };
        return u;
      })
    );

    // Sync call to backend signaling server so server presence marks both users busy
    fetch('/api/calls/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callId: newCallId,
        callerId: caller.id,
        receiverId: host.id,
        status: 'active',
        startTime: Date.now() - 45000,
      }),
    }).catch(() => {});

    setAdminActiveCalls((prev) => [newCall, ...prev]);

    showToast(
      'Test Live Call Spawned 🟢',
      `Live call started between ${host.name} and ${caller.name}. Ready for Silent Admin Monitoring!`,
      'success'
    );

    return newCallId;
  };

  // Female Creator Performance Metrics & Intelligence
  const [creatorMetricsMap, setCreatorMetricsMap] = useState<Record<string, CreatorMetrics>>({});

  const myCreatorMetrics = useMemo<CreatorMetrics | null>(() => {
    if (!currentUser || currentUser.gender !== 'female') return null;
    return creatorMetricsMap[currentUser.id] || {
      creatorId: currentUser.id,
      creatorName: currentUser.name,
      creatorAvatar: currentUser.avatarUrl,
      agencyLeaderId: currentUser.teamLeaderId || null,
      agencyName: currentUser.agencyName || null,
      activeOnlineSeconds: (currentUser.totalCallMinutes || 0) * 60,
      activeOnlineHours: Number(((currentUser.totalCallMinutes || 0) / 60).toFixed(2)),
      coinsEarnedFromCalls: currentUser.earningsCoins || 0,
      coinsEarnedFromGifts: 0,
      totalTargetCoins: currentUser.earningsCoins || 0,
      currentStreakDays: 1,
      streakBoostUntil: null,
      lastActiveDate: new Date().toISOString().split('T')[0],
      firstCallBonusClaimedDate: undefined,
      totalCallsOffered: currentUser.totalCallsHosted || 0,
      totalCallsAnswered: currentUser.totalCallsHosted || 0,
      totalCallsDeclined: 0,
      totalCallsMissed: 0,
      responseHealthScore: 100,
      performanceTier: 'bronze' as CreatorTier,
      isReadyNowActive: false,
      readyNowToggledAt: null,
      targetPeriodStart: new Date().toISOString().split('T')[0],
      targetPeriodEnd: null,
      bonusEarnedCoins: 0,
      bonusEarnedUSD: 0,
      updatedAt: new Date().toISOString(),
    };
  }, [currentUser, creatorMetricsMap]);

  const toggleReadyNow = async (creatorIdOrActive?: string | boolean): Promise<boolean> => {
    const targetId = typeof creatorIdOrActive === 'string' ? creatorIdOrActive : currentUser?.id;
    if (!targetId) return false;
    setCreatorMetricsMap((prev) => {
      const existing = prev[targetId] || {
        creatorId: targetId,
        activeOnlineSeconds: 0,
        activeOnlineHours: 0,
        coinsEarnedFromCalls: 0,
        coinsEarnedFromGifts: 0,
        totalTargetCoins: 0,
        currentStreakDays: 1,
        totalCallsOffered: 0,
        totalCallsAnswered: 0,
        totalCallsDeclined: 0,
        totalCallsMissed: 0,
        responseHealthScore: 100,
        performanceTier: 'bronze' as CreatorTier,
        isReadyNowActive: false,
        bonusEarnedCoins: 0,
        bonusEarnedUSD: 0,
      };
      const nextActive = typeof creatorIdOrActive === 'boolean' ? creatorIdOrActive : !existing.isReadyNowActive;
      const updated: CreatorMetrics = {
        ...existing,
        isReadyNowActive: nextActive,
        readyNowToggledAt: nextActive ? new Date().toISOString() : null,
      };
      showToast(
        nextActive ? 'Ready Now Surge Active! ⚡' : 'Ready Now Deactivated',
        nextActive ? '+100 pts discovery rank surge applied.' : 'Returned to standard discovery ranking.',
        'info'
      );
      return { ...prev, [targetId]: updated };
    });
    return true;
  };

  const sendCreatorHeartbeat = async (): Promise<void> => {
    if (!currentUser || currentUser.gender !== 'female') return;
    setCreatorMetricsMap((prev) => {
      const existing = prev[currentUser.id] || {
        creatorId: currentUser.id,
        activeOnlineSeconds: 0,
        activeOnlineHours: 0,
        coinsEarnedFromCalls: 0,
        coinsEarnedFromGifts: 0,
        totalTargetCoins: 0,
        currentStreakDays: 1,
        totalCallsOffered: 0,
        totalCallsAnswered: 0,
        totalCallsDeclined: 0,
        totalCallsMissed: 0,
        responseHealthScore: 100,
        performanceTier: 'bronze' as CreatorTier,
        isReadyNowActive: false,
        bonusEarnedCoins: 0,
        bonusEarnedUSD: 0,
      };
      const newSecs = (existing.activeOnlineSeconds || 0) + 15;
      return {
        ...prev,
        [currentUser.id]: {
          ...existing,
          activeOnlineSeconds: newSecs,
          activeOnlineHours: Number((newSecs / 3600).toFixed(2)),
          lastActiveDate: new Date().toISOString().split('T')[0],
        },
      };
    });
  };

  const claimDailyFirstCallBonus = async (): Promise<boolean> => {
    if (!currentUser || currentUser.gender !== 'female') return false;
    const bonusCoins = systemSettings.dailyFirstCallBonusCoins ?? 100;
    const bonusUSD = systemSettings.dailyFirstCallBonusUSD ?? 1.00;
    const todayStr = new Date().toISOString().split('T')[0];

    setCreatorMetricsMap((prev) => {
      const existing = prev[currentUser.id] || {
        creatorId: currentUser.id,
        activeOnlineSeconds: 0,
        activeOnlineHours: 0,
        coinsEarnedFromCalls: 0,
        coinsEarnedFromGifts: 0,
        totalTargetCoins: 0,
        currentStreakDays: 1,
        totalCallsOffered: 0,
        totalCallsAnswered: 0,
        totalCallsDeclined: 0,
        totalCallsMissed: 0,
        responseHealthScore: 100,
        performanceTier: 'bronze' as CreatorTier,
        isReadyNowActive: false,
        bonusEarnedCoins: 0,
        bonusEarnedUSD: 0,
      };
      if (existing.firstCallBonusClaimedDate === todayStr) {
        showToast('Already Claimed', 'You have already claimed today\'s first call speed bonus.', 'info');
        return prev;
      }
      const updated: CreatorMetrics = {
        ...existing,
        firstCallBonusClaimedDate: todayStr,
        bonusEarnedCoins: (existing.bonusEarnedCoins || 0) + bonusCoins,
        bonusEarnedUSD: (existing.bonusEarnedUSD || 0) + bonusUSD,
      };
      showToast('First Call Speed Bonus Claimed! ⚡', `+${bonusCoins} 🪙 (+$${bonusUSD.toFixed(2)} USD) added to your earnings!`, 'success');
      return { ...prev, [currentUser.id]: updated };
    });

    // Also credit coins to currentUser
    if (currentUser?.id) {
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id === currentUser.id) {
            return {
              ...u,
              earningsCoins: (u.earningsCoins || 0) + bonusCoins,
              totalLifetimeEarnedUSD: (u.totalLifetimeEarnedUSD || 0) + bonusUSD,
            };
          }
          return u;
        })
      );
    }
    return true;
  };

  return (
    <AppContext.Provider
      value={{
        users,
        currentUser,
        isLoggedIn,
        systemSettings,
        creatorMetricsMap,
        myCreatorMetrics,
        toggleReadyNow,
        sendCreatorHeartbeat,
        claimDailyFirstCallBonus,
        coinPackages,
        virtualGifts,
        saveVirtualGift,
        deleteVirtualGift,
        resetVirtualGifts,
        payoutRequests,
        activeCall,
        chatMessages,
        unreadMessagesCount,
        pendingFriendRequestsCount,
        readMessageIds,
        markChatAsRead,
        markAllChatsAsRead,
        feedPosts,
        callLogs,
        friendRequests,
        favorites,
        friends,
        blockedUserIds,
        creatorGoals,
        dailyBonusClaimed,
        dailyRewardRecord,
        isDailyRewardsModalOpen,
        openDailyRewardsModal,
        closeDailyRewardsModal,
        claimDailyStreak,
        claimDailyMission,
        claimDailyMasterChest,
        hasUnclaimedDailyRewards,
        recordChatFriendInteraction,
        recordQuickMatchInteraction,
        recordVideoCallDuration,
        recordMomentInteraction,
        recordGiftSentInteraction,
        toast,
        fastTestMode,
        theme,
        setTheme,
        toggleTheme,
        homeBanners,
        policyDocuments,
        homeQuickLinks,
        activePolicyDoc,
        openPolicyModal,
        closePolicyModal,
        saveHomeBanner,
        deleteHomeBanner,
        toggleBannerActive,
        savePolicyDocument,
        deletePolicyDocument,
        saveHomeQuickLink,
        deleteHomeQuickLink,
        showToast,
        hideToast,
        switchUser,
        switchRolePersona,
        loginUser,
        logoutUser,
        registerUser,
        updateUserProfile,
        changeUserPassword,
        buyCoinPackage,
        purchaseVip,
        claimDailyBonus,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        sendGiftInCall,
        toggleFastTestMode,
        getEffectiveCallRate,
        sendMessage,
        clearChatHistory,
        toggleFavorite,
        toggleFriend,
        addFriend,
        removeFriend,
        isFriend,
        sendFriendRequest,
        acceptFriendRequest,
        declineFriendRequest,
        blockUser,
        unblockUser,
        reportUser,
        contributeToGoal,
        submitPayoutRequest,
        liveHostIds,
        activeQuickMatchCallerIds,
        connectedCallersByHost,
        connectCallerToHost,
        disconnectCallerFromHost,
        setCallerQuickMatchBrowsing,
        toggleGoLiveQuickMatch,
        isHostLive,
        quickMatches,
        recordQuickMatch,
        sendQuickMatchGift,
        updateSystemSettings,
        updateLiveKitConfig,
        saveCoinPackage,
        deleteCoinPackage,
        adminApprovePayout,
        adminRejectPayout,
        adminUpdateUser,
        adminDeleteUser,
        toggleVerifyUser,
        toggleUserStatus,
        manualGrantCoins,
        syncAllProfilesToSupabase,
        syncUsersFromSupabase,
        purgeAllMockData,
        resetMockDataGranular,
        likePost,
        likeUserMoment,
        tipMomentCreator,
        addFeedPost,
        createTeamLeader,
        createCreatorByTeamLeader,
        updateCreatorCoinEarnOverride,
        banCreatorByTeamLeader,
        unbanCreatorByTeamLeader,
        deleteCreatorByTeamLeader,
        creatorReviews,
        submitCreatorReview,
        sendRatingRequest,
        pendingRatingCall,
        setPendingRatingCall,
        adminActiveCalls,
        incidentEvidenceLogs,
        refreshAdminActiveCalls,
        adminTerminateCall,
        adminIssueCallWarning,
        adminCaptureEvidence,
        adminSpawnDemoCall,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
