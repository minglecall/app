import { SystemSettings, CoinPackage, VirtualGift, VIPPlan, HomeBanner, PolicyDocument, HomeQuickLink, UserProfile, CreatorReview } from '../types';

export const INITIAL_CREATOR_REVIEWS: CreatorReview[] = [];

export const DEFAULT_ADMIN_USER: UserProfile = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'System Admin',
  email: 'admin@livecall.app',
  gender: 'male',
  genderLocked: true,
  role: 'admin',
  age: 30,
  dob: '1994-01-01',
  bio: 'Platform Root Administrator & Moderator',
  avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=400',
  gallery: ['https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=400'],
  nationality: 'United States',
  countryCode: 'US',
  spokenLanguages: ['English'],
  tags: ['Admin', 'Security', 'Compliance'],
  interests: ['System Architecture', 'Live Stream Quality', 'Security'],
  coinBalance: 999999,
  hourlyCoinRate: 10,
  earningsCoins: 0,
  totalLifetimeEarnedUSD: 0,
  vipTier: 'diamond',
  onlineStatus: 'online',
  isVerified: true,
  createdAt: new Date().toISOString(),
};

export const DEFAULT_TEAM_LEADER_USER: UserProfile = {
  id: '00000000-0000-0000-0000-000000000002',
  name: 'Elena Rostova',
  email: 'teamleader@livecall.app',
  gender: 'female',
  genderLocked: true,
  role: 'team_leader',
  age: 29,
  dob: '1997-04-15',
  bio: 'Director at Aurora Talent Guild & Creator Management Agency',
  avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400',
  gallery: ['https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400'],
  nationality: 'United States',
  countryCode: 'US',
  spokenLanguages: ['English', 'Spanish'],
  tags: ['Team Leader', 'Talent Manager', 'VIP Agency'],
  interests: ['Talent Growth', 'Creator Mentorship', 'Live Video Economy'],
  coinBalance: 5000,
  hourlyCoinRate: 12,
  earningsCoins: 12450,
  totalLifetimeEarnedUSD: 3420,
  vipTier: 'diamond',
  onlineStatus: 'online',
  isVerified: true,
  agencyName: 'Aurora Talent Management',
  commissionPercent: 15,
  createdAt: new Date().toISOString(),
};

export const INITIAL_SYSTEM_SETTINGS: SystemSettings = {
  coinBurnRatePerMin: 120, // Standard Coin Burn Rate - Non-Friends (Coins / Minute)
  coinBurnRateFriendPerMin: 80, // Friend Discounted Burn Rate - Friends (Coins / Minute)
  femaleHostSharePercent: 40, // Female Host Share (%) (40% of coin burn goes to host)
  teamLeaderSharePercent: 10, // Team Leader Share (%) (10% override commission to TL)
  giftFemaleHostSharePercent: 70, // Female Host Share for Virtual Gifts (%) (70% of gift coin value to host)
  giftTeamLeaderSharePercent: 10, // Team Leader Share for Virtual Gifts (%) (10% override commission to TL)
  enableVirtualGifts: true, // Master switch for Virtual Gifts
  femalePayoutRatioUSD: 0.008, // Female Coin-to-USD Payout Ratio ($ USD per Coin Earned)
  minPayoutThresholdUSD: 50, // Minimum Withdrawal Threshold ($ USD)
  femaleEarningRatePerMin: 48, // 40% of 120 = 48 coins/min
  coinToUSDRatio: 0.01, // 1 coin = $0.01 USD
  enableRegularFemaleCoinEarning: false, // Coin earning disabled for regular female users by default; reserved for Team Leader created female hosts
  aiNudityShieldEnabled: true,
  screenRecordingProtection: true,
  freeDailyLoginCoins: 20,
  showDevPersonaBar: false,
  defaultTheme: 'dark',
  videoQualityProfile: 'high_720p',
  livekitCaptureResolution: '720p',
  livekitMaxBitrateKbps: 3500,
  livekitMaxFramerate: 60,
  livekitSimulcastEnabled: true,
  livekitAdaptiveStream: true,
  livekitDynacast: true,
  livekitVideoCodec: 'h264',
  // Quick Match Defaults
  quickMatchFreeEnabled: true,
  quickMatchTimerSeconds: 5,
  quickMatchGiftPrices: {
    rose: 10,
    heart: 25,
    cheers: 50,
    tiara: 100,
    diamond: 200,
    rocket: 500,
  },
  quickMatchGiftSplitFemaleCreator: 60,
  quickMatchGiftSplitTL: 10,
  quickMatchGiftSplitPlatform: 30,
  quickMatchAutoFallbackOnlineCreators: true,
  flagSizes: {
    xs: 14,
    sm: 18,
    card: 18,
    md: 22,
    lg: 27,
    admin: 27,
    xl: 36,
    '2xl': 48,
  },
  dailyStreakRewards: [10, 15, 20, 25, 35, 50, 100],
  dailyMissionsConfig: {
    chatFriends: { target: 3, reward: 25, enabled: true },
    quickMatches: { target: 10, reward: 30, enabled: true },
    videoCall: { target: 60, reward: 35, enabled: true },
    momentInteract: { target: 3, reward: 15, enabled: true },
    sendGift: { target: 1, reward: 20, enabled: true },
    masterChest: { target: 4, reward: 50, enabled: true },
  },
  creatorTargetCycle: 'weekly',
  creatorTargetBronzeHours: 20,
  creatorTargetBronzeCoins: 5000,
  creatorTargetBronzeBonusUSD: 15,
  creatorTargetSilverHours: 40,
  creatorTargetSilverCoins: 20000,
  creatorTargetSilverBonusUSD: 50,
  creatorTargetGoldHours: 60,
  creatorTargetGoldCoins: 60000,
  creatorTargetGoldBonusUSD: 150,
  peakHoursStart: '18:00',
  peakHoursEnd: '00:00',
  peakHoursEnabled: true,
  callRingTimeoutSeconds: 30,
  dailyFirstCallBonusCoins: 100,
  dailyFirstCallBonusUSD: 1.00,
  dailyFirstCallMinDurationSec: 30,
  streakTargetDays: 7,
  streakBoostDurationDays: 3,
  minDailyActiveHoursForStreak: 2,
};

export const DEFAULT_FLAG_SIZES = {
  xs: 14,     // 21px x 14px
  sm: 18,     // 27px x 18px (Discovery Grid, Swipe Deck, Country Selector)
  card: 18,   // 27px x 18px
  md: 22,     // 33px x 22px
  lg: 27,     // 40px x 27px (Admin Taxonomy Manager)
  admin: 27,  // 40px x 27px
  xl: 36,     // 54px x 36px
  '2xl': 48,  // 72px x 48px
};

export const INITIAL_COIN_PACKAGES: CoinPackage[] = [
  { id: 'pkg_starter', title: 'Starter Pack', coins: 100, bonusCoins: 0, priceUSD: 4.99 },
  { id: 'pkg_popular', title: 'Popular Bundle', coins: 500, bonusCoins: 100, priceUSD: 19.99, badgeTag: 'MOST POPULAR', popular: true },
  { id: 'pkg_super', title: 'VIP Super Chest', coins: 1500, bonusCoins: 450, priceUSD: 49.99, badgeTag: 'BEST VALUE' },
  { id: 'pkg_whale', title: 'Whale Vault', coins: 5000, bonusCoins: 2000, priceUSD: 149.99, badgeTag: '70% BONUS' },
];

export const VIRTUAL_GIFTS: VirtualGift[] = [
  { id: 'g_rose', name: 'Red Rose', coinCost: 10, icon: '🌹', animationType: 'rose', color: 'from-pink-500 to-rose-600', isActive: true, category: 'Romantic' },
  { id: 'g_heart', name: 'Love Box', coinCost: 50, icon: '💖', animationType: 'heart', color: 'from-red-500 to-pink-500', isActive: true, category: 'Romantic' },
  { id: 'g_ring', name: 'Diamond Ring', coinCost: 200, icon: '💍', animationType: 'ring', color: 'from-blue-400 to-cyan-500', isActive: true, category: 'Luxury' },
  { id: 'g_crown', name: 'Royal Crown', coinCost: 500, icon: '👑', animationType: 'crown', color: 'from-amber-400 to-yellow-500', isActive: true, category: 'Luxury' },
  { id: 'g_car', name: 'Sports Car', coinCost: 1000, icon: '🏎️', animationType: 'car', color: 'from-amber-400 to-orange-500', isActive: true, category: 'VIP' },
  { id: 'g_yacht', name: 'Luxury Yacht', coinCost: 2500, icon: '🛥️', animationType: 'yacht', color: 'from-indigo-500 to-purple-600', isActive: true, category: 'VIP' },
  { id: 'g_rocket', name: 'Cosmic Rocket', coinCost: 5000, icon: '🚀', animationType: 'rocket', color: 'from-purple-600 to-pink-600', isActive: true, category: 'Legendary' },
];

export const VIP_PLANS: VIPPlan[] = [
  {
    id: 'bronze',
    name: 'Bronze VIP',
    priceMonthlyUSD: 9.99,
    dailyFreeCoins: 15,
    callDiscountPercent: 5,
    badge: '🥉 Bronze',
    features: ['15 Free Daily Coins', '5% Off Call Coin Rates', 'VIP Profile Badge', 'Priority Match Queue']
  },
  {
    id: 'silver',
    name: 'Silver VIP',
    priceMonthlyUSD: 24.99,
    dailyFreeCoins: 40,
    callDiscountPercent: 10,
    badge: '🥈 Silver',
    features: ['40 Free Daily Coins', '10% Off Call Coin Rates', 'Silver Glow Avatar Frame', 'Direct Instant Messaging Unlocked']
  },
  {
    id: 'gold',
    name: 'Gold VIP',
    priceMonthlyUSD: 49.99,
    dailyFreeCoins: 100,
    callDiscountPercent: 20,
    badge: '🥇 Gold',
    features: ['100 Free Daily Coins', '20% Off Call Rates', 'Gold Crown Badge', 'Exclusive VIP Gift Animations', 'Free Auto-Translate in Chat']
  },
  {
    id: 'diamond',
    name: 'Diamond VIP',
    priceMonthlyUSD: 99.99,
    dailyFreeCoins: 250,
    callDiscountPercent: 30,
    badge: '💎 Diamond',
    features: ['250 Free Daily Coins', '30% Off Call Rates', 'Diamond Animated Aura', 'Priority Match Queue', 'Dedicated 24/7 VIP Concierge']
  }
];

export const INITIAL_HOME_BANNERS: HomeBanner[] = [
  {
    id: 'banner_live_dating',
    title: 'Experience Genuine 1-on-1 Video Moments',
    subtitle: 'Connect with verified creators and matches around the globe in ultra-low latency HD video.',
    tagText: '🔥 TRENDING NOW',
    tagColor: 'bg-rose-500 text-white',
    imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=1200',
    ctaText: 'Explore Matches',
    actionType: 'tab',
    actionTarget: 'discovery',
    active: true,
    order: 1,
    bgGradient: 'from-purple-900/90 via-pink-900/60 to-slate-900/90',
  },
  {
    id: 'banner_quick_roulette',
    title: 'Instant Video Roulette Matching',
    subtitle: 'Skip the endless texting. Spin the live wheel to meet interesting people instantly with real-time translation.',
    tagText: '⚡ QUICK RADAR',
    tagColor: 'bg-amber-400 text-slate-950',
    imageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=1200',
    ctaText: 'Start Match',
    actionType: 'modal',
    actionTarget: 'match',
    active: true,
    order: 2,
    bgGradient: 'from-amber-950/90 via-rose-950/60 to-slate-900/90',
  },
  {
    id: 'banner_vip_club',
    title: 'Unlock VIP Elite Privileges',
    subtitle: 'Enjoy up to 30% discount on video calls, exclusive profile badges, and daily bonus coin chests.',
    tagText: '💎 VIP EXCLUSIVE',
    tagColor: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950',
    imageUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=1200',
    ctaText: 'Upgrade to VIP',
    actionType: 'modal',
    actionTarget: 'vip',
    active: true,
    order: 3,
    bgGradient: 'from-amber-900/90 via-purple-950/70 to-slate-900/90',
  },
  {
    id: 'banner_creator_earnings',
    title: 'Earn Real Cash As a Verified Host',
    subtitle: 'Get paid per minute for your video calls with automatic instant withdrawals to Bank or Crypto.',
    tagText: '💰 CREATOR REWARDS',
    tagColor: 'bg-emerald-500 text-slate-950',
    imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=1200',
    ctaText: 'Creator Dashboard',
    actionType: 'tab',
    actionTarget: 'earnings',
    active: true,
    order: 4,
    bgGradient: 'from-emerald-950/90 via-teal-950/60 to-slate-900/90',
  },
  {
    id: 'banner_safety_first',
    title: 'Your Privacy & Safety Is Protected',
    subtitle: 'Zero tolerance for harassment, automatic real-time AI nudity shield, and anti-screenshot technology.',
    tagText: '🛡️ 100% SAFE PLATFORM',
    tagColor: 'bg-indigo-500 text-white',
    imageUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=1200',
    ctaText: 'Read Safety Policy',
    actionType: 'policy',
    actionTarget: 'policy_safety',
    active: true,
    order: 5,
    bgGradient: 'from-indigo-950/90 via-slate-900/80 to-slate-950/90',
  },
];

export const INITIAL_POLICY_DOCUMENTS: PolicyDocument[] = [
  {
    id: 'policy_safety',
    slug: 'community-safety',
    title: 'Community Safety & Anti-Harassment Policy',
    category: 'safety',
    icon: 'ShieldCheck',
    summary: 'Our strict community rules against hate speech, harassment, non-consensual behavior, and inappropriate content.',
    lastUpdated: 'August 2026',
    order: 1,
    isFeaturedOnHome: true,
    content: `
### 1. Zero Tolerance for Harassment & Bullying
LIVECALL VIP is dedicated to maintaining a respectful, welcoming, and safe space for all users. We enforce a zero-tolerance policy regarding:
* Bullying, verbal intimidation, blackmail, or stalking.
* Discrimination based on race, ethnicity, religion, disability, gender, or sexual orientation.
* Requesting unauthorized off-platform payments, personal financial data, or home addresses.

### 2. AI Real-Time Content Moderation
* All video calls are guarded by active server-side ML analysis that detects non-consensual explicit conduct and immediately blurs video feeds.
* Violators receive instant temporary suspensions, and severe infractions result in permanent device and hardware ID bans.

### 3. Immediate Reporting & Blocking
* Every profile, chat, and active call features a one-tap **Block & Report** button.
* Our 24/7 human moderation review team investigates reports within 5 minutes.
    `.trim(),
  },
  {
    id: 'policy_privacy',
    slug: 'privacy-data-protection',
    title: 'Privacy Policy & End-to-End Encryption',
    category: 'privacy',
    icon: 'Lock',
    summary: 'How your personal data, video feeds, and account credentials are encrypted and shielded from third parties.',
    lastUpdated: 'August 2026',
    order: 2,
    isFeaturedOnHome: true,
    content: `
### 1. Data Collection & Minimization
We collect only the minimum necessary data required to operate real-time signaling, matchmaking, and financial payouts. We never sell your personal data or phone number to marketing advertisers.

### 2. Video Stream Security
* All 1-on-1 video call streams run over secure WebRTC / TLS / DTLS peer-to-peer or encrypted SFU pipelines.
* Live video streams are never recorded or stored on our platform servers unless flagged for severe safety reviews.

### 3. Anti-Screenshot & Screen Recording Shield
* The mobile and web application utilizes hardware-level DRM protection and overlay shields to prevent screenshot capture of creators' private feeds.
    `.trim(),
  },
  {
    id: 'policy_terms',
    slug: 'terms-of-service',
    title: 'Terms of Service & 18+ Age Verification',
    category: 'terms',
    icon: 'FileText',
    summary: 'The contractual terms governing user accounts, eligibility requirements, and platform guidelines.',
    lastUpdated: 'August 2026',
    order: 3,
    isFeaturedOnHome: true,
    content: `
### 1. 18+ Age Requirement
You must be at least eighteen (18) years of age or the age of legal majority in your jurisdiction to create an account, purchase coins, or participate in video calls. Minors are strictly prohibited.

### 2. User Accounts & Verification
* Users agree to provide truthful information. Impersonation of another person or celebrity is grounds for immediate termination.
* Female creator verification requires government-issued photo ID authentication prior to coin monetization and cash withdrawals.

### 3. Account Termination
LIVECALL VIP reserves the right to suspend or terminate any account that violates our safety policies or engages in fraudulent activity.
    `.trim(),
  },
  {
    id: 'policy_coins',
    slug: 'coins-gifts-refunds',
    title: 'Coin Economy, Virtual Gifts & Refund Policy',
    category: 'coins',
    icon: 'Coins',
    summary: 'Guidelines for purchasing coins, gifting virtual items, burn rate mechanics, and refund terms.',
    lastUpdated: 'August 2026',
    order: 4,
    isFeaturedOnHome: true,
    content: `
### 1. Coin Purchasing & Virtual Assets
* Coins are virtual utility tokens used exclusively within the LIVECALL VIP platform to initiate video calls and send animated virtual gifts.
* Coins have no cash value outside the platform for standard male users and cannot be transferred to secondary exchanges.

### 2. Standard vs. Friend Burn Rates
* Standard 1-on-1 video calls burn **10 coins / minute**.
* Once a mutual friend connection is established, the call discount activates at **5 coins / minute** (50% savings).
* VIP subscribers receive additional tiered coin discounts up to 30%.

### 3. Refund Policy
* Consumed coins used during completed video calls or delivered virtual gifts are non-refundable.
* If a technical disruption causes an abnormal disconnection within the first 10 seconds of a call, unspent coins are instantly restored to your balance.
    `.trim(),
  },
  {
    id: 'policy_creators',
    slug: 'creator-earnings-payouts',
    title: 'Creator Earnings & Payout Guidelines',
    category: 'creators',
    icon: 'Sparkles',
    summary: 'Everything verified female hosts need to know about earning coins, conversion ratios, and weekly cashouts.',
    lastUpdated: 'August 2026',
    order: 5,
    isFeaturedOnHome: true,
    content: `
### 1. Revenue Share & Split
* Verified female creators earn **6 coins per minute** of completed 1-on-1 video calls, plus **70% of all received virtual gifts**.
* Earning ratios are transparently tracked in the live **Earnings Dashboard**.

### 2. Payout Methods & Thresholds
* Payout exchange rate: **1 coin earned = $0.008 USD**.
* Minimum payout withdrawal threshold is **$50.00 USD**.
* Supported payout options: Direct Bank Wire (ACH/SWIFT), PayPal, Stripe, and Crypto (USDT TRC20/ERC20).
* Payout requests are verified and disbursed by the financial administration within 24–48 business hours.
    `.trim(),
  },
  {
    id: 'policy_moderation',
    slug: 'ai-moderation-guidelines',
    title: 'Real-Time AI Moderation & Dispute Resolution',
    category: 'moderation',
    icon: 'UserCheck',
    summary: 'Transparent overview of automated AI safety guards, dispute filing, and human moderation appeals.',
    lastUpdated: 'August 2026',
    order: 6,
    isFeaturedOnHome: false,
    content: `
### 1. Automated Detection Mechanics
We utilize low-latency computer vision and acoustic models to detect harmful behavior, aggressive conduct, and non-consensual visual exposure in real time.

### 2. Appeals Process
If your account or payout was temporarily paused due to an automated flag and you believe it was in error, you may file an appeal by contacting support or through the Admin Support portal.
    `.trim(),
  },
];

export const INITIAL_HOME_QUICK_LINKS: HomeQuickLink[] = [
  {
    id: 'link_quick_match',
    title: 'Quick Match',
    subtitle: 'Instant Video Radar',
    icon: 'Zap',
    badge: 'HOT',
    actionType: 'modal',
    actionTarget: 'match',
    colorGradient: 'from-amber-500 to-rose-500',
    order: 1,
    active: true,
  },
  {
    id: 'link_swipe_deck',
    title: 'Swipe Deck',
    subtitle: 'Browse Cards',
    icon: 'Layers',
    badge: 'NEW',
    actionType: 'tab',
    actionTarget: 'swipe',
    colorGradient: 'from-pink-500 to-purple-600',
    order: 2,
    active: true,
  },
  {
    id: 'link_vip_club',
    title: 'VIP Pass',
    subtitle: 'Exclusive Perks',
    icon: 'Crown',
    badge: '30% OFF',
    actionType: 'modal',
    actionTarget: 'vip',
    colorGradient: 'from-yellow-400 to-amber-600',
    order: 3,
    active: true,
  },
  {
    id: 'link_coin_store',
    title: 'Get Coins',
    subtitle: 'Refill Balance',
    icon: 'Coins',
    badge: '+20% BONUS',
    actionType: 'modal',
    actionTarget: 'store',
    colorGradient: 'from-emerald-400 to-teal-600',
    order: 4,
    active: true,
  },
  {
    id: 'link_moments_feed',
    title: 'Moments Feed',
    subtitle: 'Creator Stories',
    icon: 'Sparkles',
    badge: 'LIVE',
    actionType: 'tab',
    actionTarget: 'moments',
    colorGradient: 'from-blue-500 to-indigo-600',
    order: 5,
    active: true,
  },
  {
    id: 'link_safety_policy',
    title: 'Safety Center',
    subtitle: 'Verified & Shielded',
    icon: 'ShieldCheck',
    badge: 'SECURE',
    actionType: 'policy',
    actionTarget: 'policy_safety',
    colorGradient: 'from-indigo-500 to-cyan-600',
    order: 6,
    active: true,
  },
];
