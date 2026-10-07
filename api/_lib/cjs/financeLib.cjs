var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server/r2Storage.ts
var import_client_s3, import_s3_request_presigner, CATEGORY_MAX_BYTES;
var init_r2Storage = __esm({
  "server/r2Storage.ts"() {
    import_client_s3 = require("@aws-sdk/client-s3");
    import_s3_request_presigner = require("@aws-sdk/s3-request-presigner");
    try {
      require("dotenv").config();
    } catch {
    }
    CATEGORY_MAX_BYTES = {
      avatar: 5 * 1024 * 1024,
      gallery: 10 * 1024 * 1024,
      moment: 10 * 1024 * 1024,
      chat_media: 10 * 1024 * 1024,
      verification: 15 * 1024 * 1024,
      intro_video: 50 * 1024 * 1024
    };
  }
});

// src/constants/appDefaults.ts
var DEFAULT_ADMIN_USER, DEFAULT_TEAM_LEADER_USER, INITIAL_POLICY_DOCUMENTS;
var init_appDefaults = __esm({
  "src/constants/appDefaults.ts"() {
    DEFAULT_ADMIN_USER = {
      id: "00000000-0000-0000-0000-000000000001",
      name: "System Admin",
      email: "admin@livecall.app",
      gender: "male",
      genderLocked: true,
      role: "admin",
      age: 30,
      dob: "1994-01-01",
      bio: "Platform Root Administrator & Moderator",
      avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=400",
      gallery: ["https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=400"],
      nationality: "United States",
      countryCode: "US",
      spokenLanguages: ["English"],
      tags: ["Admin", "Security", "Compliance"],
      interests: ["System Architecture", "Live Stream Quality", "Security"],
      coinBalance: 0,
      hourlyCoinRate: 10,
      earningsCoins: 0,
      totalLifetimeEarnedUSD: 0,
      onlineStatus: "online",
      isVerified: true,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    DEFAULT_TEAM_LEADER_USER = {
      id: "00000000-0000-0000-0000-000000000002",
      name: "Elena Rostova",
      email: "teamleader@livecall.app",
      gender: "female",
      genderLocked: true,
      role: "team_leader",
      age: 29,
      dob: "1997-04-15",
      bio: "Director at Aurora Talent Guild & Creator Management Agency",
      avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400",
      gallery: ["https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400"],
      nationality: "United States",
      countryCode: "US",
      spokenLanguages: ["English", "Spanish"],
      tags: ["Team Leader", "Talent Manager", "VIP Agency"],
      interests: ["Talent Growth", "Creator Mentorship", "Live Video Economy"],
      coinBalance: 5e3,
      hourlyCoinRate: 12,
      earningsCoins: 12450,
      totalLifetimeEarnedUSD: 3420,
      onlineStatus: "online",
      isVerified: true,
      agencyName: "Aurora Talent Management",
      commissionPercent: 15,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    INITIAL_POLICY_DOCUMENTS = [
      {
        id: "policy_safety",
        slug: "community-safety",
        title: "Community Safety & Anti-Harassment Policy",
        category: "safety",
        icon: "ShieldCheck",
        summary: "Community rules against hate speech, harassment, non-consensual behavior, and inappropriate content.",
        lastUpdated: "September 2026",
        order: 1,
        isFeaturedOnHome: true,
        content: `
### 1. Zero Tolerance for Harassment & Bullying
Minglecall is dedicated to maintaining a respectful, welcoming, and safe space for all users. We enforce a zero-tolerance policy regarding:
* Bullying, verbal intimidation, blackmail, or stalking.
* Discrimination based on race, ethnicity, religion, disability, gender, or sexual orientation.
* Requesting unauthorized off-platform payments, personal financial data, or home addresses.

### 2. Content Moderation
* We review reports and may suspend or permanently ban accounts that violate these rules.
* Severe violations may result in permanent account termination.

### 3. Reporting & Blocking
* Every profile, chat, and active call features a **Block & Report** option.
* Our moderation team reviews reports as quickly as capacity allows.
    `.trim()
      },
      {
        id: "policy_privacy",
        slug: "privacy-data-protection",
        title: "Privacy Policy & Data Protection",
        category: "privacy",
        icon: "Lock",
        summary: "How personal data, video sessions, and account credentials are handled on the platform.",
        lastUpdated: "September 2026",
        order: 2,
        isFeaturedOnHome: true,
        content: `
### 1. Data Collection & Minimization
We collect only the minimum necessary data required to operate matchmaking, messaging, calls, and payouts. We do not sell your personal data to marketing advertisers.

### 2. Video Stream Security
* 1-on-1 video call streams use encrypted WebRTC transport (DTLS/SRTP).
* Live video is not recorded or stored on our servers unless required for a specific safety investigation.

### 3. Screenshots & Screen Recording
* We cannot guarantee that other participants will never capture their screen. Treat every call as potentially visible to the other person and report misuse.
    `.trim()
      },
      {
        id: "policy_terms",
        slug: "terms-of-service",
        title: "Terms of Service & 18+ Age Verification",
        category: "terms",
        icon: "FileText",
        summary: "Contractual terms governing user accounts, eligibility requirements, and platform guidelines.",
        lastUpdated: "September 2026",
        order: 3,
        isFeaturedOnHome: true,
        content: `
### 1. 18+ Age Requirement
You must be at least eighteen (18) years of age or the age of legal majority in your jurisdiction to create an account, purchase coins, or participate in video calls. Minors are strictly prohibited.

### 2. User Accounts & Verification
* Users agree to provide truthful information. Impersonation is grounds for termination.
* Hosts requesting payouts may be asked to complete identity verification before funds are released.

### 3. Account Termination
We reserve the right to suspend or terminate any account that violates safety policies or engages in fraudulent activity.
    `.trim()
      },
      {
        id: "policy_coins",
        slug: "coins-gifts-refunds",
        title: "Coin Economy, Virtual Gifts & Refund Policy",
        category: "coins",
        icon: "Coins",
        summary: "Guidelines for purchasing coins, gifting virtual items, burn rates, and refund terms.",
        lastUpdated: "September 2026",
        order: 4,
        isFeaturedOnHome: true,
        content: `
### 1. Coin Purchasing & Virtual Assets
* Coins are virtual utility tokens used within the platform to initiate video calls and send virtual gifts.
* Coins have no cash value outside the platform for standard consumer users and cannot be transferred to secondary exchanges.

### 2. Call Burn Rates
* Call rates are shown in-app before and during a call and may vary by host, friendship status, or promotions.

### 3. Refund Policy
* Consumed coins used during completed video calls or delivered virtual gifts are generally non-refundable.
* If a technical disruption causes an abnormal disconnection near the start of a call, unused coins may be restored at our discretion.
    `.trim()
      },
      {
        id: "policy_creators",
        slug: "creator-earnings-payouts",
        title: "Creator Earnings & Payout Guidelines",
        category: "creators",
        icon: "Sparkles",
        summary: "How verified hosts earn coins, track balances, and request payouts.",
        lastUpdated: "September 2026",
        order: 5,
        isFeaturedOnHome: true,
        content: `
### 1. Revenue Share
* Verified hosts earn coins from completed eligible calls and shared gift revenue as configured in admin settings.
* Earnings are tracked in the **Earnings Dashboard**.

### 2. Payout Methods & Thresholds
* Conversion rates and minimum payout thresholds are shown in the payout request flow.
* Supported payout methods depend on your region and verification status.
* Payout requests are reviewed by administration; processing times vary and are not guaranteed as same-day.
    `.trim()
      },
      {
        id: "policy_moderation",
        slug: "moderation-guidelines",
        title: "Moderation & Dispute Resolution",
        category: "moderation",
        icon: "UserCheck",
        summary: "How safety reports, account holds, and appeals are handled.",
        lastUpdated: "September 2026",
        order: 6,
        isFeaturedOnHome: false,
        content: `
### 1. Moderation Process
We review user reports and may take action including warnings, temporary holds, or permanent bans.

### 2. Appeals Process
If your account or payout was paused and you believe it was in error, contact support through the in-app support options or admin channels available to your role.
    `.trim()
      }
    ];
  }
});

// server/supabaseAdmin.ts
function decodeJwtRole(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    return typeof payload?.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}
function isSupabaseAdminConfigured() {
  return Boolean(
    supabaseUrl && supabaseServiceKey && !supabaseUrl.includes("placeholder-project") && !supabaseUrl.includes("your-project-ref")
  );
}
function isSupabaseServiceRoleConfigured() {
  return isSupabaseAdminConfigured() && decodeJwtRole(supabaseServiceKey) === "service_role";
}
function getSupabaseAdmin() {
  if (!isSupabaseAdminConfigured()) return null;
  if (!isSupabaseServiceRoleConfigured()) {
    console.error(
      "[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY is missing or not a service_role JWT. Admin mutations will fail under RLS."
    );
  }
  if (!supabaseAdmin) {
    try {
      supabaseAdmin = (0, import_supabase_js.createClient)(supabaseUrl, supabaseServiceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
      console.log("[Supabase Admin] Initialized server-side Supabase client connected to:", supabaseUrl);
    } catch (err) {
      console.error("[Supabase Admin] Failed to initialize Supabase client:", err);
    }
  }
  return supabaseAdmin;
}
var import_supabase_js, import_dotenv, import_bcryptjs, supabaseUrl, supabaseServiceKey, supabaseAdmin;
var init_supabaseAdmin = __esm({
  "server/supabaseAdmin.ts"() {
    import_supabase_js = require("@supabase/supabase-js");
    import_dotenv = __toESM(require("dotenv"), 1);
    import_bcryptjs = __toESM(require("bcryptjs"), 1);
    init_r2Storage();
    init_appDefaults();
    import_dotenv.default.config();
    supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
    supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    supabaseAdmin = null;
  }
});

// api/_lib/financeBundleEntry.ts
var financeBundleEntry_exports = {};
__export(financeBundleEntry_exports, {
  DEFAULT_COIN_TO_USD_RATIO: () => DEFAULT_COIN_TO_USD_RATIO,
  DEFAULT_COIN_USD_PEG: () => DEFAULT_COIN_USD_PEG,
  DEFAULT_FEMALE_PAYOUT_RATIO_USD: () => DEFAULT_FEMALE_PAYOUT_RATIO_USD,
  DEFAULT_TARGET_THRESHOLDS: () => DEFAULT_TARGET_THRESHOLDS,
  EMPTY_HOST_EARNINGS_BREAKDOWN: () => EMPTY_HOST_EARNINGS_BREAKDOWN,
  PAYABLE_MODEL_NOTES: () => PAYABLE_MODEL_NOTES,
  PAYABLE_SOURCE_OF_TRUTH: () => PAYABLE_SOURCE_OF_TRUTH,
  PAYOUT_PERIOD_END_ONLY: () => PAYOUT_PERIOD_END_ONLY,
  PayoutPolicyError: () => PayoutPolicyError,
  SETTLEMENT_STATUS_TRANSITIONS: () => SETTLEMENT_STATUS_TRANSITIONS,
  aggregateHostCallBurnForTrueUp: () => aggregateHostCallBurnForTrueUp,
  aggregateWalletLedgerEarnings: () => aggregateWalletLedgerEarnings,
  appendFinancialLedgerEntries: () => appendFinancialLedgerEntries,
  appendFinancialLedgerEntry: () => appendFinancialLedgerEntry,
  appendGiftEarnLedger: () => appendGiftEarnLedger,
  appendReversalEntry: () => appendReversalEntry,
  appendSettlementNote: () => appendSettlementNote,
  applyCreatorEarnCoins: () => applyCreatorEarnCoins,
  assertManualPayoutAllowed: () => assertManualPayoutAllowed,
  assertManualPayoutAllowedSync: () => assertManualPayoutAllowedSync,
  buildSettlementBatches: () => buildSettlementBatches,
  canTransitionSettlementStatus: () => canTransitionSettlementStatus,
  cancelSettlementBatch: () => cancelSettlementBatch,
  checkManualPayoutAllowed: () => checkManualPayoutAllowed,
  closeDuePeriods: () => closeDuePeriods,
  closePeriod: () => closePeriod,
  coinsToUsd: () => coinsToUsd,
  coinsToUsdWithCachedRatio: () => coinsToUsdWithCachedRatio,
  coinsToUsdWithLiveRatio: () => coinsToUsdWithLiveRatio,
  coinsToUsdWithSnapshot: () => coinsToUsdWithSnapshot,
  completeCoinPurchase: () => completeCoinPurchase,
  computeCloseScheduledAt: () => computeCloseScheduledAt,
  computePerformanceTier: () => computePerformanceTier,
  computePerformanceTierFromCache: () => computePerformanceTierFromCache,
  computePerformanceTierFromConfig: () => computePerformanceTierFromConfig,
  createCheckoutIntent: () => createCheckoutIntent,
  createSettlementBatchesForPeriod: () => createSettlementBatchesForPeriod,
  defaultFinanceSystemConfig: () => defaultFinanceSystemConfig,
  ensureOpenPeriod: () => ensureOpenPeriod,
  evaluateManualPayoutPolicy: () => evaluateManualPayoutPolicy,
  failCheckoutIntent: () => failCheckoutIntent,
  findDueOpenPeriods: () => findDueOpenPeriods,
  findRetryableFailedPeriods: () => findRetryableFailedPeriods,
  formatPegExample: () => formatPegExample,
  freezeFinanceConfigSnapshot: () => freezeFinanceConfigSnapshot,
  getCachedCoinUsdPeg: () => getCachedCoinUsdPeg,
  getCachedFinanceConfig: () => getCachedFinanceConfig,
  getCoinUsdPeg: () => getCoinUsdPeg,
  getCurrentPeriodBounds: () => getCurrentPeriodBounds,
  getNextCloseAt: () => getNextCloseAt2,
  getTargetThresholds: () => getTargetThresholds,
  getUserPeriodAccrual: () => getUserPeriodAccrual,
  invalidateFinanceConfigCache: () => invalidateFinanceConfigCache,
  labelSettlementComponent: () => labelSettlementComponent,
  loadFinanceSystemConfig: () => loadFinanceSystemConfig,
  loadGiftSharePercents: () => loadGiftSharePercents,
  markBatchAdminPaid: () => markBatchAdminPaid,
  markBatchTlConfirmed: () => markBatchTlConfirmed,
  normalizeCycleType: () => normalizeCycleType,
  normalizeFxRatio: () => normalizeFxRatio,
  planHostShareTrueUps: () => planHostShareTrueUps,
  postHostShareTrueUpWallet: () => postHostShareTrueUpWallet,
  recordBatchCreatedEvent: () => recordBatchCreatedEvent,
  refreshFinanceConfigInBackground: () => refreshFinanceConfigInBackground,
  resolveCatalogGiftById: () => resolveCatalogGiftById,
  resolveTargetThresholds: () => resolveTargetThresholds,
  summarizeHostSettlementLines: () => summarizeHostSettlementLines,
  targetBonusUsdForTier: () => targetBonusUsdForTier,
  updateFinanceSystemConfig: () => updateFinanceSystemConfig,
  usdToCoins: () => usdToCoins
});
module.exports = __toCommonJS(financeBundleEntry_exports);

// server/finance/config.ts
init_supabaseAdmin();

// shared/finance/periodBounds.ts
var HH_MM_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
function normalizeCycleType(raw) {
  const v = String(raw || "weekly").trim().toLowerCase();
  return v === "monthly" ? "monthly" : "weekly";
}
function parseUtcCloseTime(raw) {
  const s = String(raw ?? "00:00").trim();
  if (!HH_MM_RE.test(s)) {
    return { hours: 0, minutes: 0, hhmm: "00:00" };
  }
  const [h, m] = s.split(":").map((x) => Number(x));
  return { hours: h, minutes: m, hhmm: s };
}
function startOfUtcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}
function startOfUtcWeekMonday(at) {
  const day = at.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const start = startOfUtcDay(at);
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start;
}
function startOfUtcMonth(at) {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1, 0, 0, 0, 0));
}
function addUtcMonths(at, months) {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + months, at.getUTCDate(), at.getUTCHours(), at.getUTCMinutes(), at.getUTCSeconds(), at.getUTCMilliseconds()));
}
function getCurrentPeriodBounds(cycleType, at = /* @__PURE__ */ new Date()) {
  const cycle = normalizeCycleType(cycleType);
  if (cycle === "monthly") {
    const periodStart2 = startOfUtcMonth(at);
    const periodEnd2 = addUtcMonths(periodStart2, 1);
    return { cycleType: "monthly", periodStart: periodStart2, periodEnd: periodEnd2 };
  }
  const periodStart = startOfUtcWeekMonday(at);
  const periodEnd = new Date(periodStart);
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 7);
  return { cycleType: "weekly", periodStart, periodEnd };
}
function computeCloseScheduledAt(periodEnd, periodCloseUtcTime) {
  const { hours, minutes } = parseUtcCloseTime(periodCloseUtcTime);
  return new Date(
    Date.UTC(
      periodEnd.getUTCFullYear(),
      periodEnd.getUTCMonth(),
      periodEnd.getUTCDate(),
      hours,
      minutes,
      0,
      0
    )
  );
}
function getNextCloseAt(cycleType, periodCloseUtcTime, at = /* @__PURE__ */ new Date()) {
  const { periodEnd } = getCurrentPeriodBounds(cycleType, at);
  const closeAt = computeCloseScheduledAt(periodEnd, periodCloseUtcTime);
  return closeAt;
}
function toIso(d) {
  return d.toISOString();
}

// shared/finance/targetBonus.ts
var DEFAULT_TARGET_THRESHOLDS = {
  bronzeHours: 20,
  bronzeCoins: 5e3,
  bronzeBonusUsd: 15,
  silverHours: 40,
  silverCoins: 2e4,
  silverBonusUsd: 50,
  goldHours: 60,
  goldCoins: 6e4,
  goldBonusUsd: 150
};
function num(raw, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
function resolveTargetThresholds(raw) {
  const r = raw || {};
  return {
    bronzeHours: num(r.creator_target_bronze_hours ?? r.creatorTargetBronzeHours, DEFAULT_TARGET_THRESHOLDS.bronzeHours),
    bronzeCoins: num(r.creator_target_bronze_coins ?? r.creatorTargetBronzeCoins, DEFAULT_TARGET_THRESHOLDS.bronzeCoins),
    bronzeBonusUsd: num(r.creator_target_bronze_bonus_usd ?? r.creatorTargetBronzeBonusUSD, DEFAULT_TARGET_THRESHOLDS.bronzeBonusUsd),
    silverHours: num(r.creator_target_silver_hours ?? r.creatorTargetSilverHours, DEFAULT_TARGET_THRESHOLDS.silverHours),
    silverCoins: num(r.creator_target_silver_coins ?? r.creatorTargetSilverCoins, DEFAULT_TARGET_THRESHOLDS.silverCoins),
    silverBonusUsd: num(r.creator_target_silver_bonus_usd ?? r.creatorTargetSilverBonusUSD, DEFAULT_TARGET_THRESHOLDS.silverBonusUsd),
    goldHours: num(r.creator_target_gold_hours ?? r.creatorTargetGoldHours, DEFAULT_TARGET_THRESHOLDS.goldHours),
    goldCoins: num(r.creator_target_gold_coins ?? r.creatorTargetGoldCoins, DEFAULT_TARGET_THRESHOLDS.goldCoins),
    goldBonusUsd: num(r.creator_target_gold_bonus_usd ?? r.creatorTargetGoldBonusUSD, DEFAULT_TARGET_THRESHOLDS.goldBonusUsd)
  };
}
function computePerformanceTier(hours, totalCoins, thresholds = DEFAULT_TARGET_THRESHOLDS) {
  const h = Number(hours) || 0;
  const c = Number(totalCoins) || 0;
  if (h >= thresholds.goldHours && c >= thresholds.goldCoins) return "gold";
  if (h >= thresholds.silverHours && c >= thresholds.silverCoins) return "silver";
  return "bronze";
}
function targetBonusUsdForTier(tier, thresholds = DEFAULT_TARGET_THRESHOLDS) {
  if (tier === "gold") return thresholds.goldBonusUsd;
  if (tier === "silver") return thresholds.silverBonusUsd;
  return thresholds.bronzeBonusUsd;
}

// shared/finance/fx.ts
var DEFAULT_COIN_USD_PEG = 3e-3;
var DEFAULT_FEMALE_PAYOUT_RATIO_USD = DEFAULT_COIN_USD_PEG;
var DEFAULT_COIN_TO_USD_RATIO = DEFAULT_COIN_USD_PEG;
function normalizeFxRatio(raw, fallback = DEFAULT_COIN_USD_PEG) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}
function getCoinUsdPeg(source) {
  if (source == null || typeof source !== "object") return DEFAULT_COIN_USD_PEG;
  const s = source;
  const preferred = s.coin_usd_peg ?? s.coinUsdPeg;
  if (preferred !== void 0 && preferred !== null) {
    return normalizeFxRatio(preferred, DEFAULT_COIN_USD_PEG);
  }
  const legacy = s.female_payout_ratio_usd ?? s.femalePayoutRatioUSD ?? s.coin_to_usd_ratio ?? s.coinToUSDRatio;
  return normalizeFxRatio(legacy, DEFAULT_COIN_USD_PEG);
}
function coinsToUsd(coins, peg = DEFAULT_COIN_USD_PEG) {
  const ratio = normalizeFxRatio(peg);
  const c = Number(coins);
  if (!Number.isFinite(c)) return 0;
  return Math.round(c * ratio * 1e4) / 1e4;
}
function usdToCoins(usd, peg = DEFAULT_COIN_USD_PEG) {
  const ratio = normalizeFxRatio(peg);
  const u = Number(usd);
  if (!Number.isFinite(u) || ratio <= 0) return 0;
  return Math.floor(u / ratio);
}
function formatPegExample(peg = DEFAULT_COIN_USD_PEG, coins = 1e3) {
  const usd = coinsToUsd(coins, peg);
  return `${coins.toLocaleString()} coins = $${usd.toFixed(2)}`;
}

// shared/finance/economyBurn.ts
var DEFAULT_COIN_BURN_RATE_PER_MIN = 120;
var DEFAULT_COIN_BURN_RATE_FRIEND_PER_MIN = 80;
var DEFAULT_FEMALE_HOST_SHARE_PERCENT = 30;
var DEFAULT_FEMALE_HOST_TARGET_SHARE_PERCENT = 40;
var DEFAULT_TEAM_LEADER_SHARE_PERCENT = 10;
function normalizePositiveInt(raw, fallback) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.round(n);
}
function normalizeSharePercent(raw, fallback) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(100, Math.round(n));
}
function resolveEconomyBurnRates(source) {
  const s = source && typeof source === "object" ? source : {};
  return {
    coinBurnRatePerMin: normalizePositiveInt(
      s.coin_burn_rate_per_min ?? s.coinBurnRatePerMin,
      DEFAULT_COIN_BURN_RATE_PER_MIN
    ),
    coinBurnRateFriendPerMin: normalizePositiveInt(
      s.coin_burn_rate_friend_per_min ?? s.coinBurnRateFriendPerMin,
      DEFAULT_COIN_BURN_RATE_FRIEND_PER_MIN
    ),
    femaleHostSharePercent: normalizeSharePercent(
      s.female_host_share_percent ?? s.femaleHostSharePercent,
      DEFAULT_FEMALE_HOST_SHARE_PERCENT
    ),
    femaleHostTargetSharePercent: normalizeSharePercent(
      s.female_host_target_share_percent ?? s.femaleHostTargetSharePercent,
      DEFAULT_FEMALE_HOST_TARGET_SHARE_PERCENT
    ),
    teamLeaderSharePercent: normalizeSharePercent(
      s.team_leader_share_percent ?? s.teamLeaderSharePercent,
      DEFAULT_TEAM_LEADER_SHARE_PERCENT
    )
  };
}
function hasMetCreatorPeriodTarget(hours, totalCoins, thresholds = DEFAULT_TARGET_THRESHOLDS) {
  const h = Number(hours) || 0;
  const c = Number(totalCoins) || 0;
  return h >= thresholds.bronzeHours && c >= thresholds.bronzeCoins;
}

// server/finance/config.ts
var CACHE_TTL_MS = 6e4;
var cached = null;
function defaultFinanceSystemConfig() {
  const peg = DEFAULT_COIN_USD_PEG;
  return {
    creatorTargetCycle: "weekly",
    periodCloseUtcTime: "00:00",
    settlementEnabled: true,
    coinUsdPeg: peg,
    femalePayoutRatioUsd: peg,
    coinToUsdRatio: peg,
    burn: {
      coinBurnRatePerMin: DEFAULT_COIN_BURN_RATE_PER_MIN,
      coinBurnRateFriendPerMin: DEFAULT_COIN_BURN_RATE_FRIEND_PER_MIN,
      femaleHostSharePercent: DEFAULT_FEMALE_HOST_SHARE_PERCENT,
      femaleHostTargetSharePercent: DEFAULT_FEMALE_HOST_TARGET_SHARE_PERCENT,
      teamLeaderSharePercent: DEFAULT_TEAM_LEADER_SHARE_PERCENT
    },
    thresholds: { ...DEFAULT_TARGET_THRESHOLDS },
    raw: {}
  };
}
function mapRow(row) {
  const r = row || {};
  const close = parseUtcCloseTime(r.period_close_utc_time ?? r.periodCloseUtcTime);
  const settlementRaw = r.settlement_enabled ?? r.settlementEnabled;
  const settlementEnabled = settlementRaw === void 0 || settlementRaw === null ? true : Boolean(settlementRaw);
  const peg = getCoinUsdPeg(r);
  return {
    creatorTargetCycle: normalizeCycleType(r.creator_target_cycle ?? r.creatorTargetCycle),
    periodCloseUtcTime: close.hhmm,
    settlementEnabled,
    coinUsdPeg: peg,
    femalePayoutRatioUsd: peg,
    coinToUsdRatio: peg,
    burn: resolveEconomyBurnRates(r),
    thresholds: resolveTargetThresholds(r),
    raw: r
  };
}
function getCachedFinanceConfig() {
  return cached?.value ?? defaultFinanceSystemConfig();
}
function invalidateFinanceConfigCache() {
  cached = null;
}
async function loadFinanceSystemConfig(opts) {
  const now = Date.now();
  if (!opts?.force && cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value;
  }
  if (!isSupabaseAdminConfigured()) {
    const fallback = defaultFinanceSystemConfig();
    cached = { value: fallback, fetchedAt: now };
    return fallback;
  }
  try {
    const client = getSupabaseAdmin();
    if (!client) {
      const fallback = defaultFinanceSystemConfig();
      cached = { value: fallback, fetchedAt: now };
      return fallback;
    }
    const { data, error } = await client.from("system_configs").select(
      [
        "creator_target_cycle",
        "period_close_utc_time",
        "settlement_enabled",
        "coin_usd_peg",
        "female_payout_ratio_usd",
        "coin_to_usd_ratio",
        "coin_burn_rate_per_min",
        "coin_burn_rate_friend_per_min",
        "female_host_share_percent",
        "female_host_target_share_percent",
        "team_leader_share_percent",
        "gift_female_host_share_percent",
        "gift_team_leader_share_percent",
        "creator_target_bronze_hours",
        "creator_target_bronze_coins",
        "creator_target_bronze_bonus_usd",
        "creator_target_silver_hours",
        "creator_target_silver_coins",
        "creator_target_silver_bonus_usd",
        "creator_target_gold_hours",
        "creator_target_gold_coins",
        "creator_target_gold_bonus_usd"
      ].join(", ")
    ).eq("id", "default").maybeSingle();
    if (error) {
      console.warn("[finance/config] load failed:", error.message);
      const fallback = cached?.value ?? defaultFinanceSystemConfig();
      cached = { value: fallback, fetchedAt: now };
      return fallback;
    }
    const value = mapRow(data || {});
    cached = { value, fetchedAt: now };
    return value;
  } catch (err) {
    console.warn("[finance/config] load exception:", err?.message || err);
    const fallback = cached?.value ?? defaultFinanceSystemConfig();
    cached = { value: fallback, fetchedAt: now };
    return fallback;
  }
}
function refreshFinanceConfigInBackground() {
  void loadFinanceSystemConfig({ force: true });
}
async function updateFinanceSystemConfig(patch) {
  if (!isSupabaseAdminConfigured()) {
    return { success: false, error: "Supabase admin not configured" };
  }
  const client = getSupabaseAdmin();
  if (!client) return { success: false, error: "Supabase admin client unavailable" };
  const payload = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
  if (patch.creatorTargetCycle !== void 0) {
    payload.creator_target_cycle = normalizeCycleType(patch.creatorTargetCycle);
  }
  if (patch.periodCloseUtcTime !== void 0) {
    const raw = String(patch.periodCloseUtcTime).trim();
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(raw)) {
      return { success: false, error: "period_close_utc_time must be HH:mm UTC (00:00\u201323:59)" };
    }
    payload.period_close_utc_time = parseUtcCloseTime(raw).hhmm;
  }
  if (patch.settlementEnabled !== void 0) {
    payload.settlement_enabled = Boolean(patch.settlementEnabled);
  }
  if (Object.keys(payload).length <= 1) {
    return { success: false, error: "No finance config fields to update" };
  }
  const { error } = await client.from("system_configs").update(payload).eq("id", "default");
  if (error) return { success: false, error: error.message };
  invalidateFinanceConfigCache();
  const config = await loadFinanceSystemConfig({ force: true });
  return { success: true, config };
}

// shared/finance/economyGift.ts
var DEFAULT_GIFT_FEMALE_HOST_SHARE_PERCENT = 70;
var DEFAULT_GIFT_TEAM_LEADER_SHARE_PERCENT = 10;
function resolveEconomyGiftShares(source) {
  const s = source && typeof source === "object" ? source : {};
  return {
    giftFemaleHostSharePercent: normalizeSharePercent(
      s.gift_female_host_share_percent ?? s.giftFemaleHostSharePercent,
      DEFAULT_GIFT_FEMALE_HOST_SHARE_PERCENT
    ),
    giftTeamLeaderSharePercent: normalizeSharePercent(
      s.gift_team_leader_share_percent ?? s.giftTeamLeaderSharePercent,
      DEFAULT_GIFT_TEAM_LEADER_SHARE_PERCENT
    )
  };
}

// server/finance/payableModel.ts
var PAYABLE_SOURCE_OF_TRUTH = "settlement_line_items";
var PAYABLE_MODEL_NOTES = [
  "Cash obligations exist only as settlement_batches / settlement_line_items after period close.",
  "financial_ledger is the immutable journal of those obligations and related accruals.",
  "profiles.earnings_coins is informational/operational \u2014 not the payout queue.",
  "Host-facing salary status is settlement_line_items.host_salary_status (pending|paid)."
].join(" ");

// server/finance/configSnapshot.ts
function freezeFinanceConfigSnapshot(config, opts) {
  const burn = config.burn;
  const raw = config.raw || {};
  const num2 = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const snap = {
    period_close_utc_time: config.periodCloseUtcTime,
    creator_target_cycle: config.creatorTargetCycle,
    coin_usd_peg: config.coinUsdPeg,
    // Legacy mirrors — same peg
    female_payout_ratio_usd: config.coinUsdPeg,
    coin_to_usd_ratio: config.coinUsdPeg,
    // Call burn rates (Phase 2 / 5)
    coin_burn_rate_per_min: num2(
      burn?.coinBurnRatePerMin ?? raw.coin_burn_rate_per_min ?? raw.coinBurnRatePerMin,
      DEFAULT_COIN_BURN_RATE_PER_MIN
    ),
    coin_burn_rate_friend_per_min: num2(
      burn?.coinBurnRateFriendPerMin ?? raw.coin_burn_rate_friend_per_min ?? raw.coinBurnRateFriendPerMin,
      DEFAULT_COIN_BURN_RATE_FRIEND_PER_MIN
    ),
    // Call shares — base + target (NOT gift defaults)
    female_host_share_percent: num2(
      burn?.femaleHostSharePercent ?? raw.female_host_share_percent ?? raw.femaleHostSharePercent,
      DEFAULT_FEMALE_HOST_SHARE_PERCENT
    ),
    female_host_target_share_percent: num2(
      burn?.femaleHostTargetSharePercent ?? raw.female_host_target_share_percent ?? raw.femaleHostTargetSharePercent,
      DEFAULT_FEMALE_HOST_TARGET_SHARE_PERCENT
    ),
    team_leader_share_percent: num2(
      burn?.teamLeaderSharePercent ?? raw.team_leader_share_percent ?? raw.teamLeaderSharePercent,
      DEFAULT_TEAM_LEADER_SHARE_PERCENT
    ),
    // Gift shares (Phase 3) — separate from call
    gift_female_host_share_percent: num2(
      raw.gift_female_host_share_percent ?? raw.giftFemaleHostSharePercent,
      DEFAULT_GIFT_FEMALE_HOST_SHARE_PERCENT
    ),
    gift_team_leader_share_percent: num2(
      raw.gift_team_leader_share_percent ?? raw.giftTeamLeaderSharePercent,
      DEFAULT_GIFT_TEAM_LEADER_SHARE_PERCENT
    ),
    creator_target_bronze_hours: config.thresholds.bronzeHours,
    creator_target_bronze_coins: config.thresholds.bronzeCoins,
    creator_target_bronze_bonus_usd: config.thresholds.bronzeBonusUsd,
    creator_target_silver_hours: config.thresholds.silverHours,
    creator_target_silver_coins: config.thresholds.silverCoins,
    creator_target_silver_bonus_usd: config.thresholds.silverBonusUsd,
    creator_target_gold_hours: config.thresholds.goldHours,
    creator_target_gold_coins: config.thresholds.goldCoins,
    creator_target_gold_bonus_usd: config.thresholds.goldBonusUsd,
    payable_source_of_truth: PAYABLE_SOURCE_OF_TRUTH
  };
  if (opts?.includeFrozenAt !== false) {
    snap.frozen_at = (/* @__PURE__ */ new Date()).toISOString();
  }
  return snap;
}

// server/finance/period.ts
init_supabaseAdmin();
function rowToPeriod(row) {
  return {
    id: row.id,
    cycleType: normalizeCycleType(row.cycle_type),
    periodStart: row.period_start,
    periodEnd: row.period_end,
    closeScheduledAt: row.close_scheduled_at,
    closedAt: row.closed_at ?? null,
    status: row.status,
    configSnapshot: row.config_snapshot || {},
    closeError: row.close_error ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
async function getNextCloseAt2(opts) {
  const config = opts?.config ?? await loadFinanceSystemConfig();
  const at = opts?.at ?? /* @__PURE__ */ new Date();
  return getNextCloseAt(config.creatorTargetCycle, config.periodCloseUtcTime, at);
}
async function ensureOpenPeriod(opts) {
  const at = opts?.at ?? /* @__PURE__ */ new Date();
  const config = opts?.config ?? await loadFinanceSystemConfig();
  const cycleType = normalizeCycleType(opts?.cycleType ?? config.creatorTargetCycle);
  const bounds = getCurrentPeriodBounds(cycleType, at);
  const closeScheduledAt = computeCloseScheduledAt(bounds.periodEnd, config.periodCloseUtcTime);
  if (!isSupabaseAdminConfigured()) {
    return {
      success: false,
      period: null,
      bounds,
      created: false,
      error: "Supabase admin not configured"
    };
  }
  const client = getSupabaseAdmin();
  if (!client) {
    return {
      success: false,
      period: null,
      bounds,
      created: false,
      error: "Supabase admin client unavailable"
    };
  }
  const periodStartIso = toIso(bounds.periodStart);
  const periodEndIso = toIso(bounds.periodEnd);
  const closeIso = toIso(closeScheduledAt);
  const { data: existing, error: selectError } = await client.from("settlement_periods").select("*").eq("cycle_type", cycleType).eq("period_start", periodStartIso).maybeSingle();
  if (selectError) {
    return {
      success: false,
      period: null,
      bounds,
      created: false,
      error: selectError.message
    };
  }
  if (existing) {
    if (existing.status === "open" && existing.close_scheduled_at !== closeIso) {
      const { data: updated, error: updateError } = await client.from("settlement_periods").update({
        close_scheduled_at: closeIso,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", existing.id).eq("status", "open").select("*").maybeSingle();
      if (!updateError && updated) {
        return { success: true, period: rowToPeriod(updated), bounds, created: false };
      }
    }
    return { success: true, period: rowToPeriod(existing), bounds, created: false };
  }
  const insertPayload = {
    cycle_type: cycleType,
    period_start: periodStartIso,
    period_end: periodEndIso,
    close_scheduled_at: closeIso,
    status: "open",
    // Seed with full economy snapshot (peg, burns, call/gift shares, targets).
    // Close re-freezes with frozen_at.
    config_snapshot: freezeFinanceConfigSnapshot(config, { includeFrozenAt: false })
  };
  const { data: inserted, error: insertError } = await client.from("settlement_periods").insert(insertPayload).select("*").maybeSingle();
  if (insertError) {
    if (String(insertError.code) === "23505" || /duplicate/i.test(insertError.message)) {
      const { data: raced } = await client.from("settlement_periods").select("*").eq("cycle_type", cycleType).eq("period_start", periodStartIso).maybeSingle();
      if (raced) {
        return { success: true, period: rowToPeriod(raced), bounds, created: false };
      }
    }
    return {
      success: false,
      period: null,
      bounds,
      created: false,
      error: insertError.message
    };
  }
  return {
    success: true,
    period: inserted ? rowToPeriod(inserted) : null,
    bounds,
    created: true
  };
}

// server/finance/fx.ts
async function coinsToUsdWithLiveRatio(coins) {
  const config = await loadFinanceSystemConfig();
  return coinsToUsd(coins, config.coinUsdPeg);
}
function coinsToUsdWithCachedRatio(coins) {
  return coinsToUsd(coins, getCachedFinanceConfig().coinUsdPeg);
}
function coinsToUsdWithSnapshot(coins, peg) {
  return coinsToUsd(coins, peg);
}
function getCachedCoinUsdPeg() {
  return getCoinUsdPeg(getCachedFinanceConfig());
}

// server/finance/targetBonus.ts
function computePerformanceTierFromCache(hours, totalCoins) {
  refreshFinanceConfigInBackground();
  const thresholds = getCachedFinanceConfig().thresholds;
  return computePerformanceTier(hours, totalCoins, thresholds);
}
async function computePerformanceTierFromConfig(hours, totalCoins, thresholds) {
  const t = thresholds ?? (await loadFinanceSystemConfig()).thresholds;
  return computePerformanceTier(hours, totalCoins, t);
}
async function getTargetThresholds() {
  return (await loadFinanceSystemConfig()).thresholds;
}

// server/finance/accrualQuery.ts
init_supabaseAdmin();
function emptyUser(userId) {
  return {
    userId,
    hostEarnCoins: 0,
    tlEarnCoins: 0,
    giftHostEarnCoins: 0,
    giftTlEarnCoins: 0,
    callHostEarnCoins: 0,
    callTlEarnCoins: 0,
    targetShareTrueUpCoins: 0
  };
}
function isGiftMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return false;
  const m = metadata;
  const kind = String(m.kind || m.source || m.category || "").toLowerCase();
  return kind === "gift" || kind === "virtual_gift" || m.is_gift === true;
}
async function aggregateWalletLedgerEarnings(opts) {
  const byUser = /* @__PURE__ */ new Map();
  const totals = {
    callDebitCoins: 0,
    giftDebitCoins: 0,
    hostEarnCoins: 0,
    tlEarnCoins: 0,
    giftHostEarnCoins: 0,
    giftTlEarnCoins: 0,
    targetShareTrueUpCoins: 0,
    platformRetainedCoins: 0
  };
  if (!opts.client && !isSupabaseAdminConfigured()) {
    return { success: false, byUser, totals, error: "Supabase admin not configured" };
  }
  const client = opts.client ?? getSupabaseAdmin();
  if (!client) {
    return { success: false, byUser, totals, error: "Supabase admin client unavailable" };
  }
  const startIso = typeof opts.periodStart === "string" ? opts.periodStart : toIso(opts.periodStart);
  const endIso = typeof opts.periodEnd === "string" ? opts.periodEnd : toIso(opts.periodEnd);
  const pageSize = Math.min(Math.max(opts.pageSize ?? 1e3, 100), 5e3);
  const includeDebits = opts.userIds == null || opts.userIds.length === 0;
  let offset = 0;
  for (; ; ) {
    let q = client.from("wallet_ledger").select("user_id, transaction_type, amount, metadata, created_at").in(
      "transaction_type",
      includeDebits ? [
        "CALL_DEBIT",
        "GIFT_DEBIT",
        "HOST_EARN",
        "TL_EARN",
        "TARGET_SHARE_TRUEUP"
      ] : ["HOST_EARN", "TL_EARN", "TARGET_SHARE_TRUEUP"]
    ).gte("created_at", startIso).lt("created_at", endIso).order("created_at", { ascending: true }).range(offset, offset + pageSize - 1);
    if (opts.userIds && opts.userIds.length > 0) {
      q = q.in("user_id", opts.userIds);
    }
    const { data, error } = await q;
    if (error) {
      return { success: false, byUser, totals, error: error.message };
    }
    const rows = data || [];
    for (const row of rows) {
      const userId = String(row.user_id || "");
      if (!userId) continue;
      const amount = Number(row.amount) || 0;
      if (amount === 0) continue;
      const entry = byUser.get(userId) || emptyUser(userId);
      const gift = isGiftMetadata(row.metadata);
      if (row.transaction_type === "CALL_DEBIT" || row.transaction_type === "GIFT_DEBIT") {
        const abs = Math.abs(amount);
        totals.callDebitCoins += abs;
        if (row.transaction_type === "GIFT_DEBIT") {
          totals.giftDebitCoins += abs;
        }
      } else if (row.transaction_type === "HOST_EARN") {
        entry.hostEarnCoins += amount;
        totals.hostEarnCoins += amount;
        if (gift) {
          entry.giftHostEarnCoins += amount;
          totals.giftHostEarnCoins += amount;
        }
        entry.callHostEarnCoins = Math.max(0, entry.hostEarnCoins - entry.giftHostEarnCoins);
        entry.callTlEarnCoins = Math.max(0, entry.tlEarnCoins - entry.giftTlEarnCoins);
        byUser.set(userId, entry);
      } else if (row.transaction_type === "TARGET_SHARE_TRUEUP") {
        entry.targetShareTrueUpCoins += Math.max(0, amount);
        totals.targetShareTrueUpCoins += Math.max(0, amount);
        byUser.set(userId, entry);
      } else if (row.transaction_type === "TL_EARN") {
        entry.tlEarnCoins += amount;
        totals.tlEarnCoins += amount;
        if (gift) {
          entry.giftTlEarnCoins += amount;
          totals.giftTlEarnCoins += amount;
        }
        entry.callHostEarnCoins = Math.max(0, entry.hostEarnCoins - entry.giftHostEarnCoins);
        entry.callTlEarnCoins = Math.max(0, entry.tlEarnCoins - entry.giftTlEarnCoins);
        byUser.set(userId, entry);
      }
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  totals.platformRetainedCoins = Math.max(
    0,
    totals.callDebitCoins - totals.hostEarnCoins - totals.targetShareTrueUpCoins - totals.tlEarnCoins
  );
  return { success: true, byUser, totals };
}
async function getUserPeriodAccrual(userId, periodStart, periodEnd) {
  const res = await aggregateWalletLedgerEarnings({
    periodStart,
    periodEnd,
    userIds: [userId]
  });
  if (!res.success) return null;
  return res.byUser.get(userId) || emptyUser(userId);
}

// server/finance/payoutPolicy.ts
var PAYOUT_PERIOD_END_ONLY = "PAYOUT_PERIOD_END_ONLY";
var PayoutPolicyError = class extends Error {
  constructor(message = "Payouts are only available at period end via settlement batches.") {
    super(message);
    this.code = PAYOUT_PERIOD_END_ONLY;
    this.httpStatus = 400;
    this.name = "PayoutPolicyError";
  }
};
function evaluateManualPayoutPolicy(settlementEnabled) {
  return {
    allowed: false,
    code: PAYOUT_PERIOD_END_ONLY,
    message: "Manual mid-period payouts are disabled. Salaries settle at period end via settlement batches only.",
    settlementEnabled
  };
}
function assertManualPayoutAllowedSync() {
  const decision = evaluateManualPayoutPolicy(getCachedFinanceConfig().settlementEnabled);
  if (!decision.allowed) {
    throw new PayoutPolicyError(decision.message);
  }
}
async function assertManualPayoutAllowed() {
  const config = await loadFinanceSystemConfig();
  const decision = evaluateManualPayoutPolicy(config.settlementEnabled);
  if (!decision.allowed) {
    throw new PayoutPolicyError(decision.message);
  }
}
async function checkManualPayoutAllowed() {
  const config = await loadFinanceSystemConfig();
  return evaluateManualPayoutPolicy(config.settlementEnabled);
}

// server/finance/ledger.ts
init_supabaseAdmin();
function rowToEntry(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    periodId: row.period_id ?? null,
    entryType: row.entry_type,
    userId: row.user_id ?? null,
    teamLeaderId: row.team_leader_id ?? null,
    counterpartyRole: row.counterparty_role ?? null,
    amountCoins: Number(row.amount_coins) || 0,
    amountUsd: Number(row.amount_usd) || 0,
    fxRatio: Number(row.fx_ratio) || 0,
    sourceRefType: row.source_ref_type ?? null,
    sourceRefId: row.source_ref_id ?? null,
    metadata: row.metadata || {}
  };
}
async function appendFinancialLedgerEntry(input) {
  if (!isSupabaseAdminConfigured()) {
    return { success: false, entry: null, error: "Supabase admin not configured" };
  }
  const client = getSupabaseAdmin();
  if (!client) {
    return { success: false, entry: null, error: "Supabase admin client unavailable" };
  }
  const fxRatio = normalizeFxRatio(input.fxRatio);
  const amountCoins = Number(input.amountCoins) || 0;
  const amountUsd = input.amountUsd !== void 0 && Number.isFinite(Number(input.amountUsd)) ? Number(input.amountUsd) : coinsToUsd(amountCoins, fxRatio);
  const payload = {
    period_id: input.periodId ?? null,
    entry_type: input.entryType,
    user_id: input.userId ?? null,
    team_leader_id: input.teamLeaderId ?? null,
    counterparty_role: input.counterpartyRole ?? null,
    amount_coins: amountCoins,
    amount_usd: amountUsd,
    fx_ratio: fxRatio,
    source_ref_type: input.sourceRefType ?? null,
    source_ref_id: input.sourceRefId ?? null,
    metadata: input.metadata ?? {}
  };
  const { data, error } = await client.from("financial_ledger").insert(payload).select("*").maybeSingle();
  if (error) {
    return { success: false, entry: null, error: error.message };
  }
  return { success: true, entry: data ? rowToEntry(data) : null };
}
async function appendFinancialLedgerEntries(inputs) {
  if (!inputs.length) return { success: true, entries: [] };
  if (!isSupabaseAdminConfigured()) {
    return { success: false, entries: [], error: "Supabase admin not configured" };
  }
  const client = getSupabaseAdmin();
  if (!client) {
    return { success: false, entries: [], error: "Supabase admin client unavailable" };
  }
  const rows = inputs.map((input) => {
    const fxRatio = normalizeFxRatio(input.fxRatio);
    const amountCoins = Number(input.amountCoins) || 0;
    const amountUsd = input.amountUsd !== void 0 && Number.isFinite(Number(input.amountUsd)) ? Number(input.amountUsd) : coinsToUsd(amountCoins, fxRatio);
    return {
      period_id: input.periodId ?? null,
      entry_type: input.entryType,
      user_id: input.userId ?? null,
      team_leader_id: input.teamLeaderId ?? null,
      counterparty_role: input.counterpartyRole ?? null,
      amount_coins: amountCoins,
      amount_usd: amountUsd,
      fx_ratio: fxRatio,
      source_ref_type: input.sourceRefType ?? null,
      source_ref_id: input.sourceRefId ?? null,
      metadata: input.metadata ?? {}
    };
  });
  const { data, error } = await client.from("financial_ledger").insert(rows).select("*");
  if (error) {
    return { success: false, entries: [], error: error.message };
  }
  return { success: true, entries: (data || []).map(rowToEntry) };
}
async function appendReversalEntry(opts) {
  return appendFinancialLedgerEntry({
    periodId: opts.periodId ?? null,
    entryType: "REVERSAL",
    userId: opts.userId ?? null,
    teamLeaderId: opts.teamLeaderId ?? null,
    counterpartyRole: opts.counterpartyRole ?? null,
    amountCoins: opts.amountCoins,
    amountUsd: opts.amountUsd,
    fxRatio: opts.fxRatio,
    sourceRefType: opts.reversesEntryId ? "financial_ledger" : "manual_reversal",
    sourceRefId: opts.reversesEntryId ?? null,
    metadata: {
      reason: opts.reason || "admin_reversal",
      ...opts.metadata || {}
    }
  });
}

// server/finance/settlement.ts
init_supabaseAdmin();
function pushComponent(lines, payeeUserId, payeeRole, component, coins, usd, breakdown = {}) {
  if (coins <= 0 && usd <= 0) return;
  lines.push({
    payeeUserId,
    payeeRole,
    amountCoins: Math.max(0, Math.round(coins)),
    amountUsd: Math.max(0, usd),
    component,
    breakdown
  });
}
function buildSettlementBatches(opts) {
  const fxRatio = opts.fxRatio;
  const currency = opts.currency || "USD";
  const hostsByTl = /* @__PURE__ */ new Map();
  const directHosts = [];
  const tlRows = /* @__PURE__ */ new Map();
  for (const a of opts.accruals) {
    if (a.role === "team_leader") {
      tlRows.set(a.userId, a);
      continue;
    }
    const tlId = a.teamLeaderId ? String(a.teamLeaderId) : "";
    if (tlId) {
      const list = hostsByTl.get(tlId) || [];
      list.push(a);
      hostsByTl.set(tlId, list);
    } else {
      directHosts.push(a);
    }
  }
  for (const tlId of tlRows.keys()) {
    if (!hostsByTl.has(tlId)) hostsByTl.set(tlId, []);
  }
  const batches = [];
  for (const [tlId, hosts] of hostsByTl.entries()) {
    const lines = [];
    let totalHostSalaryCoins = 0;
    let totalHostSalaryUsd = 0;
    for (const host of hosts) {
      const callCoins = Number(host.callEarningsCoins) || 0;
      const giftCoins = Number(host.giftEarningsCoins) || 0;
      const bonusCoins = Number(host.targetBonusCoins) || 0;
      const trueUpCoins = Number(host.targetShareTrueUpCoins) || 0;
      const bonusUsd = host.targetBonusUsd !== void 0 && Number.isFinite(Number(host.targetBonusUsd)) ? Number(host.targetBonusUsd) : coinsToUsd(bonusCoins, fxRatio);
      pushComponent(lines, host.userId, "host", "call_earnings", callCoins, coinsToUsd(callCoins, fxRatio), {
        ...host.breakdown || {}
      });
      pushComponent(lines, host.userId, "host", "gift_earnings", giftCoins, coinsToUsd(giftCoins, fxRatio));
      pushComponent(
        lines,
        host.userId,
        "host",
        "target_share_trueup",
        trueUpCoins,
        coinsToUsd(trueUpCoins, fxRatio),
        { kind: "target_share_trueup" }
      );
      pushComponent(lines, host.userId, "host", "target_bonus", bonusCoins, bonusUsd, {
        targetBonusUsd: bonusUsd
      });
      totalHostSalaryCoins += callCoins + giftCoins + trueUpCoins + bonusCoins;
      totalHostSalaryUsd += coinsToUsd(callCoins, fxRatio) + coinsToUsd(giftCoins, fxRatio) + coinsToUsd(trueUpCoins, fxRatio) + bonusUsd;
    }
    const tlAccrual = tlRows.get(tlId);
    const tlCommissionCoins = Number(tlAccrual?.tlCommissionCoins) || 0;
    const tlCommissionUsd = coinsToUsd(tlCommissionCoins, fxRatio);
    pushComponent(lines, tlId, "team_leader", "tl_commission", tlCommissionCoins, tlCommissionUsd, {
      ...tlAccrual?.breakdown || {}
    });
    batches.push({
      batchKind: "team_leader_bundle",
      teamLeaderId: tlId,
      payeeUserId: tlId,
      totalHostSalaryUsd: round4(totalHostSalaryUsd),
      totalTlCommissionUsd: round4(tlCommissionUsd),
      totalDueUsd: round4(totalHostSalaryUsd + tlCommissionUsd),
      totalHostSalaryCoins,
      totalTlCommissionCoins: tlCommissionCoins,
      currency,
      lineItems: lines
    });
  }
  for (const host of directHosts) {
    const lines = [];
    const callCoins = Number(host.callEarningsCoins) || 0;
    const giftCoins = Number(host.giftEarningsCoins) || 0;
    const bonusCoins = Number(host.targetBonusCoins) || 0;
    const trueUpCoins = Number(host.targetShareTrueUpCoins) || 0;
    const bonusUsd = host.targetBonusUsd !== void 0 && Number.isFinite(Number(host.targetBonusUsd)) ? Number(host.targetBonusUsd) : coinsToUsd(bonusCoins, fxRatio);
    pushComponent(lines, host.userId, "host", "call_earnings", callCoins, coinsToUsd(callCoins, fxRatio));
    pushComponent(lines, host.userId, "host", "gift_earnings", giftCoins, coinsToUsd(giftCoins, fxRatio));
    pushComponent(
      lines,
      host.userId,
      "host",
      "target_share_trueup",
      trueUpCoins,
      coinsToUsd(trueUpCoins, fxRatio),
      { kind: "target_share_trueup" }
    );
    pushComponent(lines, host.userId, "host", "target_bonus", bonusCoins, bonusUsd);
    const totalCoins = callCoins + giftCoins + trueUpCoins + bonusCoins;
    const totalUsd = coinsToUsd(callCoins, fxRatio) + coinsToUsd(giftCoins, fxRatio) + coinsToUsd(trueUpCoins, fxRatio) + bonusUsd;
    batches.push({
      batchKind: "direct_host",
      teamLeaderId: null,
      payeeUserId: host.userId,
      totalHostSalaryUsd: round4(totalUsd),
      totalTlCommissionUsd: 0,
      totalDueUsd: round4(totalUsd),
      totalHostSalaryCoins: totalCoins,
      totalTlCommissionCoins: 0,
      currency,
      lineItems: lines
    });
  }
  return batches;
}
function round4(n) {
  return Math.round(n * 1e4) / 1e4;
}
async function createSettlementBatchesForPeriod(opts) {
  if (!opts.batches.length) return { success: true, batchIds: [] };
  if (!isSupabaseAdminConfigured()) {
    return { success: false, batchIds: [], error: "Supabase admin not configured" };
  }
  const client = getSupabaseAdmin();
  if (!client) {
    return { success: false, batchIds: [], error: "Supabase admin client unavailable" };
  }
  const batchIds = [];
  for (const batch of opts.batches) {
    const { data: inserted, error } = await client.from("settlement_batches").insert({
      period_id: opts.periodId,
      batch_kind: batch.batchKind,
      team_leader_id: batch.teamLeaderId,
      payee_user_id: batch.payeeUserId,
      status: "pending_admin_pay",
      total_host_salary_usd: batch.totalHostSalaryUsd,
      total_tl_commission_usd: batch.totalTlCommissionUsd,
      total_due_usd: batch.totalDueUsd,
      total_host_salary_coins: batch.totalHostSalaryCoins,
      total_tl_commission_coins: batch.totalTlCommissionCoins,
      currency: batch.currency
    }).select("id").maybeSingle();
    if (error || !inserted?.id) {
      const isUnique = String(error?.code) === "23505" || /duplicate|unique/i.test(error?.message || "");
      if (isUnique) {
        let existingId = null;
        if (batch.batchKind === "team_leader_bundle" && batch.teamLeaderId) {
          const { data: existing } = await client.from("settlement_batches").select("id").eq("period_id", opts.periodId).eq("batch_kind", "team_leader_bundle").eq("team_leader_id", batch.teamLeaderId).maybeSingle();
          existingId = existing?.id || null;
        } else {
          const { data: existing } = await client.from("settlement_batches").select("id").eq("period_id", opts.periodId).eq("batch_kind", "direct_host").eq("payee_user_id", batch.payeeUserId).maybeSingle();
          existingId = existing?.id || null;
        }
        if (existingId) {
          batchIds.push(existingId);
          continue;
        }
      }
      return {
        success: false,
        batchIds,
        error: error?.message || "Failed to insert settlement_batches row"
      };
    }
    batchIds.push(inserted.id);
    if (batch.lineItems.length) {
      const lines = batch.lineItems.map((li) => ({
        batch_id: inserted.id,
        payee_user_id: li.payeeUserId,
        payee_role: li.payeeRole,
        amount_coins: li.amountCoins,
        amount_usd: li.amountUsd,
        component: li.component,
        breakdown: li.breakdown,
        host_salary_status: "pending"
      }));
      const { error: lineError } = await client.from("settlement_line_items").insert(lines);
      if (lineError) {
        return { success: false, batchIds, error: lineError.message };
      }
    }
  }
  return { success: true, batchIds };
}

// server/finance/hostShareTrueUp.ts
init_supabaseAdmin();

// shared/finance/hostShareTrueUp.ts
function computeHostShareTrueUpCoins(opts) {
  const burn = Math.max(0, Math.round(Number(opts.periodEligibleCallBurn) || 0));
  const already = Math.max(0, Math.round(Number(opts.periodHostCallEarnCoinsAlready) || 0));
  const pct = normalizeSharePercent(
    opts.targetSharePercent,
    DEFAULT_FEMALE_HOST_TARGET_SHARE_PERCENT
  );
  return Math.max(0, Math.round(burn * pct / 100) - already);
}
function shouldSkipHostShareTrueUp(coinEarnOverrideRate) {
  const n = Number(coinEarnOverrideRate);
  return Number.isFinite(n) && n > 0;
}
function targetShareTrueUpCallId(periodId) {
  return `target_share_trueup:${periodId}`;
}

// server/finance/hostShareTrueUp.ts
function isGiftMetadata2(metadata) {
  if (!metadata || typeof metadata !== "object") return false;
  const m = metadata;
  const kind = String(m.kind || m.source || m.category || "").toLowerCase();
  return kind === "gift" || kind === "virtual_gift" || m.is_gift === true;
}
function callMinuteKey(callId, billingMinute) {
  return `${String(callId || "")}:${Number(billingMinute) || 0}`;
}
async function paginateWallet(client, types, startIso, endIso, pageSize, onRow) {
  let offset = 0;
  for (; ; ) {
    const { data, error } = await client.from("wallet_ledger").select("user_id, call_id, transaction_type, amount, billing_minute, metadata").in("transaction_type", types).gte("created_at", startIso).lt("created_at", endIso).order("created_at", { ascending: true }).range(offset, offset + pageSize - 1);
    if (error) return error.message;
    const rows = data || [];
    for (const row of rows) onRow(row);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return null;
}
async function aggregateHostCallBurnForTrueUp(opts) {
  const byHost = /* @__PURE__ */ new Map();
  if (!opts.client && !isSupabaseAdminConfigured()) {
    return { success: false, byHost, error: "Supabase admin not configured" };
  }
  const client = opts.client ?? getSupabaseAdmin();
  if (!client) {
    return { success: false, byHost, error: "Supabase admin client unavailable" };
  }
  const startIso = typeof opts.periodStart === "string" ? opts.periodStart : toIso(opts.periodStart);
  const endIso = typeof opts.periodEnd === "string" ? opts.periodEnd : toIso(opts.periodEnd);
  const pageSize = Math.min(Math.max(opts.pageSize ?? 1e3, 100), 5e3);
  const trueUpCallId = targetShareTrueUpCallId(opts.periodId);
  const debitBurnByKey = /* @__PURE__ */ new Map();
  const err1 = await paginateWallet(
    client,
    ["CALL_DEBIT"],
    startIso,
    endIso,
    pageSize,
    (row) => {
      const key = callMinuteKey(row.call_id, row.billing_minute);
      const abs = Math.abs(Number(row.amount) || 0);
      if (abs > 0) debitBurnByKey.set(key, (debitBurnByKey.get(key) || 0) + abs);
    }
  );
  if (err1) return { success: false, byHost, error: err1 };
  const ensure = (hostId) => {
    let e = byHost.get(hostId);
    if (!e) {
      e = {
        hostId,
        periodEligibleCallBurn: 0,
        periodHostCallEarn: 0,
        alreadyTrueUpCoins: 0
      };
      byHost.set(hostId, e);
    }
    return e;
  };
  const err2 = await paginateWallet(
    client,
    ["HOST_EARN", "TARGET_SHARE_TRUEUP"],
    startIso,
    endIso,
    pageSize,
    (row) => {
      const userId = String(row.user_id || "");
      if (!userId) return;
      const t = String(row.transaction_type || "");
      const amount = Number(row.amount) || 0;
      const meta = row.metadata || {};
      if (t === "TARGET_SHARE_TRUEUP") {
        const periodMatch = String(row.call_id || "") === trueUpCallId || String(meta.period_id || "") === opts.periodId;
        if (!periodMatch) return;
        ensure(userId).alreadyTrueUpCoins += Math.max(0, amount);
        return;
      }
      if (t !== "HOST_EARN") return;
      if (isGiftMetadata2(meta)) return;
      const kind = String(meta.kind || "").toLowerCase();
      if (kind === "target_share_trueup" || kind === "share_trueup") return;
      const entry = ensure(userId);
      entry.periodHostCallEarn += Math.max(0, amount);
      const key = callMinuteKey(row.call_id, row.billing_minute);
      let burn = debitBurnByKey.get(key) || 0;
      if (burn <= 0) {
        const fromMeta = Number(meta.ratePerMin ?? meta.coinsBurned ?? meta.coins_burned);
        if (Number.isFinite(fromMeta) && fromMeta > 0) burn = Math.round(fromMeta);
      }
      entry.periodEligibleCallBurn += Math.max(0, burn);
    }
  );
  if (err2) return { success: false, byHost, error: err2 };
  return { success: true, byHost };
}
function planHostShareTrueUps(opts) {
  const rates = resolveEconomyBurnRates(opts.burnConfig || {});
  const targetShare = opts.targetSharePercent > 0 ? opts.targetSharePercent : rates.femaleHostTargetSharePercent;
  const ids = /* @__PURE__ */ new Set([
    ...opts.hostIds,
    ...opts.aggByHost.keys(),
    ...opts.metricsByCreator.keys()
  ]);
  const plans = [];
  for (const hostId of ids) {
    const metrics = opts.metricsByCreator.get(hostId) || { hours: 0, coins: 0 };
    const agg = opts.aggByHost.get(hostId) || {
      hostId,
      periodEligibleCallBurn: 0,
      periodHostCallEarn: 0,
      alreadyTrueUpCoins: 0
    };
    const targetMet = hasMetCreatorPeriodTarget(
      metrics.hours,
      metrics.coins,
      opts.thresholds
    );
    const skippedOverride = shouldSkipHostShareTrueUp(opts.overrideByHost.get(hostId));
    const skippedAlreadyPosted = agg.alreadyTrueUpCoins > 0;
    let trueUpCoins = 0;
    if (targetMet && !skippedOverride && !skippedAlreadyPosted) {
      trueUpCoins = computeHostShareTrueUpCoins({
        periodEligibleCallBurn: agg.periodEligibleCallBurn,
        periodHostCallEarnCoinsAlready: agg.periodHostCallEarn,
        targetSharePercent: targetShare
      });
    }
    plans.push({
      hostId,
      targetMet,
      skippedOverride,
      skippedAlreadyPosted,
      periodEligibleCallBurn: agg.periodEligibleCallBurn,
      periodHostCallEarn: agg.periodHostCallEarn,
      trueUpCoins,
      targetSharePercent: targetShare,
      hours: metrics.hours,
      coins: metrics.coins
    });
  }
  return plans;
}
async function postHostShareTrueUpWallet(opts) {
  const coins = Math.max(0, Math.round(opts.trueUpCoins));
  if (coins <= 0) return { success: true, posted: false };
  const client = opts.client ?? getSupabaseAdmin();
  if (!client) return { success: false, posted: false, error: "No supabase client" };
  const callId = targetShareTrueUpCallId(opts.periodId);
  const { data: existing } = await client.from("wallet_ledger").select("id").eq("user_id", opts.hostId).eq("transaction_type", "TARGET_SHARE_TRUEUP").eq("call_id", callId).eq("billing_minute", 0).maybeSingle();
  if (existing?.id) return { success: true, posted: false };
  const { data: profile, error: pErr } = await client.from("profiles").select("earnings_coins").eq("id", opts.hostId).maybeSingle();
  if (pErr) return { success: false, posted: false, error: pErr.message };
  const current = Number(profile?.earnings_coins) || 0;
  const next = current + coins;
  const { error: upErr } = await client.from("profiles").update({ earnings_coins: next, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", opts.hostId);
  if (upErr) return { success: false, posted: false, error: upErr.message };
  const { error: wErr } = await client.from("wallet_ledger").insert({
    user_id: opts.hostId,
    call_id: callId,
    transaction_type: "TARGET_SHARE_TRUEUP",
    amount: coins,
    balance_after: next,
    billing_minute: 0,
    metadata: {
      kind: "target_share_trueup",
      period_id: opts.periodId,
      ...opts.metadata || {}
    }
  });
  if (wErr) {
    if (String(wErr.code || "") === "23505" || /duplicate/i.test(String(wErr.message || ""))) {
      return { success: true, posted: false };
    }
    await client.from("profiles").update({ earnings_coins: current, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", opts.hostId);
    return { success: false, posted: false, error: wErr.message };
  }
  return { success: true, posted: true };
}

// server/finance/statusTransition.ts
init_supabaseAdmin();
var SETTLEMENT_STATUS_TRANSITIONS = {
  pending_admin_pay: ["admin_paid", "cancelled"],
  admin_paid: ["tl_confirmed", "cancelled"],
  tl_confirmed: [],
  cancelled: []
};
function canTransitionSettlementStatus(from, to) {
  return (SETTLEMENT_STATUS_TRANSITIONS[from] || []).includes(to);
}
async function appendEvent(opts) {
  const client = getSupabaseAdmin();
  if (!client) return { success: false, error: "Supabase admin client unavailable" };
  const { error } = await client.from("settlement_events").insert({
    batch_id: opts.batchId,
    period_id: opts.periodId ?? null,
    event_type: opts.eventType,
    actor_user_id: opts.actorUserId,
    note: opts.note ?? null,
    payload: opts.payload ?? {}
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}
async function markHostLinesPaid(batchId) {
  const client = getSupabaseAdmin();
  if (!client) return { success: false, error: "Supabase admin client unavailable" };
  const { error } = await client.from("settlement_line_items").update({ host_salary_status: "paid" }).eq("batch_id", batchId).eq("payee_role", "host");
  if (error) return { success: false, error: error.message };
  return { success: true };
}
async function markBatchAdminPaid(opts) {
  if (!isSupabaseAdminConfigured()) {
    return { success: false, code: "NOT_CONFIGURED", error: "Supabase admin not configured" };
  }
  const client = getSupabaseAdmin();
  if (!client) {
    return { success: false, code: "NOT_CONFIGURED", error: "Supabase admin client unavailable" };
  }
  const { data: batch, error } = await client.from("settlement_batches").select("id, status, batch_kind, period_id").eq("id", opts.batchId).maybeSingle();
  if (error) return { success: false, code: "DB_ERROR", error: error.message };
  if (!batch) return { success: false, code: "NOT_FOUND", error: "Batch not found" };
  const from = batch.status;
  if (!canTransitionSettlementStatus(from, "admin_paid")) {
    return {
      success: false,
      code: "INVALID_TRANSITION",
      error: `Cannot transition ${from} \u2192 admin_paid`
    };
  }
  const { error: updateError } = await client.from("settlement_batches").update({
    status: "admin_paid",
    payment_reference: opts.paymentReference ?? null,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", opts.batchId).eq("status", from);
  if (updateError) return { success: false, code: "DB_ERROR", error: updateError.message };
  const ev = await appendEvent({
    batchId: opts.batchId,
    periodId: batch.period_id,
    eventType: "admin_marked_paid",
    actorUserId: opts.actorUserId,
    note: opts.note ?? null,
    payload: { paymentReference: opts.paymentReference ?? null }
  });
  if (!ev.success) {
    await client.from("settlement_batches").update({
      status: from,
      payment_reference: null,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", opts.batchId).eq("status", "admin_paid");
    return { success: false, code: "DB_ERROR", error: ev.error };
  }
  const payHostsNow = opts.markHostsPaidNow === true || batch.batch_kind === "direct_host";
  if (payHostsNow) {
    const paid = await markHostLinesPaid(opts.batchId);
    if (!paid.success) return { success: false, code: "DB_ERROR", error: paid.error };
  }
  return { success: true };
}
async function markBatchTlConfirmed(opts) {
  if (!isSupabaseAdminConfigured()) {
    return { success: false, code: "NOT_CONFIGURED", error: "Supabase admin not configured" };
  }
  const client = getSupabaseAdmin();
  if (!client) {
    return { success: false, code: "NOT_CONFIGURED", error: "Supabase admin client unavailable" };
  }
  const { data: batch, error } = await client.from("settlement_batches").select("id, status, batch_kind, team_leader_id, payee_user_id, period_id").eq("id", opts.batchId).maybeSingle();
  if (error) return { success: false, code: "DB_ERROR", error: error.message };
  if (!batch) return { success: false, code: "NOT_FOUND", error: "Batch not found" };
  if (batch.batch_kind !== "team_leader_bundle") {
    return {
      success: false,
      code: "INVALID_TRANSITION",
      error: "tl_confirmed only applies to team_leader_bundle batches"
    };
  }
  const allowedActor = opts.actorUserId === batch.team_leader_id || opts.actorUserId === batch.payee_user_id;
  if (!allowedActor) {
    return {
      success: false,
      code: "INVALID_TRANSITION",
      error: "Only the batch team leader may confirm receipt"
    };
  }
  const from = batch.status;
  if (!canTransitionSettlementStatus(from, "tl_confirmed")) {
    return {
      success: false,
      code: "INVALID_TRANSITION",
      error: `Cannot transition ${from} \u2192 tl_confirmed`
    };
  }
  const { error: updateError } = await client.from("settlement_batches").update({
    status: "tl_confirmed",
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", opts.batchId).eq("status", from);
  if (updateError) return { success: false, code: "DB_ERROR", error: updateError.message };
  const ev = await appendEvent({
    batchId: opts.batchId,
    periodId: batch.period_id,
    eventType: "tl_confirmed",
    actorUserId: opts.actorUserId,
    note: opts.note ?? null
  });
  if (!ev.success) {
    await client.from("settlement_batches").update({ status: from, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", opts.batchId).eq("status", "tl_confirmed");
    return { success: false, code: "DB_ERROR", error: ev.error };
  }
  const paid = await markHostLinesPaid(opts.batchId);
  if (!paid.success) return { success: false, code: "DB_ERROR", error: paid.error };
  return { success: true };
}
async function cancelSettlementBatch(opts) {
  if (!isSupabaseAdminConfigured()) {
    return { success: false, code: "NOT_CONFIGURED", error: "Supabase admin not configured" };
  }
  const client = getSupabaseAdmin();
  if (!client) {
    return { success: false, code: "NOT_CONFIGURED", error: "Supabase admin client unavailable" };
  }
  const { data: batch, error } = await client.from("settlement_batches").select("id, status, period_id").eq("id", opts.batchId).maybeSingle();
  if (error) return { success: false, code: "DB_ERROR", error: error.message };
  if (!batch) return { success: false, code: "NOT_FOUND", error: "Batch not found" };
  const from = batch.status;
  if (!canTransitionSettlementStatus(from, "cancelled")) {
    return {
      success: false,
      code: "INVALID_TRANSITION",
      error: `Cannot transition ${from} \u2192 cancelled`
    };
  }
  const { error: updateError } = await client.from("settlement_batches").update({
    status: "cancelled",
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", opts.batchId).eq("status", from);
  if (updateError) return { success: false, code: "DB_ERROR", error: updateError.message };
  const ev = await appendEvent({
    batchId: opts.batchId,
    periodId: batch.period_id,
    eventType: "cancelled",
    actorUserId: opts.actorUserId,
    note: opts.note ?? "Cancelled by admin"
  });
  if (!ev.success) {
    await client.from("settlement_batches").update({ status: from, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", opts.batchId).eq("status", "cancelled");
    return { success: false, code: "DB_ERROR", error: ev.error };
  }
  return { success: true };
}
async function appendSettlementNote(opts) {
  if (!isSupabaseAdminConfigured()) {
    return { success: false, code: "NOT_CONFIGURED", error: "Supabase admin not configured" };
  }
  const ev = await appendEvent({
    batchId: opts.batchId,
    periodId: opts.periodId ?? null,
    eventType: "note",
    actorUserId: opts.actorUserId,
    note: opts.note
  });
  if (!ev.success) return { success: false, code: "DB_ERROR", error: ev.error };
  return { success: true };
}
async function recordBatchCreatedEvent(opts) {
  if (!isSupabaseAdminConfigured()) {
    return { success: false, code: "NOT_CONFIGURED", error: "Supabase admin not configured" };
  }
  const ev = await appendEvent({
    batchId: opts.batchId,
    periodId: opts.periodId,
    eventType: "created",
    actorUserId: opts.actorUserId,
    payload: opts.payload ?? {}
  });
  if (!ev.success) return { success: false, code: "DB_ERROR", error: ev.error };
  return { success: true };
}

// server/finance/walletLedgerWrite.ts
init_supabaseAdmin();
function sanitizeSourceKey(key) {
  return String(key || "").trim().slice(0, 180).replace(/\s+/g, "_");
}
async function appendGiftEarnLedger(input) {
  if (!input.client && !isSupabaseAdminConfigured()) {
    return { success: false, error: "Supabase admin not configured" };
  }
  const client = input.client ?? getSupabaseAdmin();
  if (!client) return { success: false, error: "Supabase admin client unavailable" };
  const sourceKey = sanitizeSourceKey(input.sourceKey);
  if (!sourceKey) return { success: false, error: "sourceKey required" };
  const baseMeta = {
    kind: "gift",
    source: input.kind,
    ...input.metadata || {}
  };
  const rows = [];
  const giftCost = Math.max(0, Math.round(Number(input.giftCost) || 0));
  const hostCoins = Math.max(0, Math.round(Number(input.hostCoins) || 0));
  const tlCoins = Math.max(0, Math.round(Number(input.tlCoins) || 0));
  if (input.senderUserId && giftCost > 0) {
    rows.push({
      user_id: input.senderUserId,
      call_id: sourceKey,
      transaction_type: "GIFT_DEBIT",
      amount: -giftCost,
      balance_after: Math.max(0, Number(input.senderBalanceAfter) || 0),
      billing_minute: 0,
      metadata: { ...baseMeta, side: "sender" }
    });
  }
  if (input.hostUserId && hostCoins > 0) {
    rows.push({
      user_id: input.hostUserId,
      call_id: sourceKey,
      transaction_type: "HOST_EARN",
      amount: hostCoins,
      balance_after: Math.max(0, Number(input.hostBalanceAfter) || 0),
      billing_minute: 0,
      metadata: { ...baseMeta, side: "host" }
    });
  }
  if (input.tlUserId && tlCoins > 0) {
    rows.push({
      user_id: input.tlUserId,
      call_id: sourceKey,
      transaction_type: "TL_EARN",
      amount: tlCoins,
      balance_after: Math.max(0, Number(input.tlBalanceAfter) || 0),
      billing_minute: 0,
      metadata: { ...baseMeta, side: "team_leader" }
    });
  }
  if (!rows.length) return { success: true };
  const { error } = await client.from("wallet_ledger").insert(rows);
  if (error) {
    const msg = String(error.message || "");
    if (error.code === "23505" || /duplicate|unique/i.test(msg)) {
      return { success: true, duplicate: true };
    }
    return { success: false, error: msg };
  }
  return { success: true };
}
async function loadGiftSharePercents(client) {
  try {
    const c = client ?? getSupabaseAdmin();
    if (!c) {
      return {
        host: DEFAULT_GIFT_FEMALE_HOST_SHARE_PERCENT,
        tl: DEFAULT_GIFT_TEAM_LEADER_SHARE_PERCENT
      };
    }
    const { data } = await c.from("system_configs").select("gift_female_host_share_percent, gift_team_leader_share_percent").eq("id", "default").maybeSingle();
    const shares = resolveEconomyGiftShares(data || {});
    return {
      host: shares.giftFemaleHostSharePercent,
      tl: shares.giftTeamLeaderSharePercent
    };
  } catch {
    return {
      host: DEFAULT_GIFT_FEMALE_HOST_SHARE_PERCENT,
      tl: DEFAULT_GIFT_TEAM_LEADER_SHARE_PERCENT
    };
  }
}
async function resolveCatalogGiftById(giftId, fallbackCatalog, client) {
  const id = String(giftId || "").trim();
  if (!id) return null;
  const pick = (list) => {
    const g = list.find((x) => x.id === id && x.isActive !== false);
    if (!g) return null;
    const cost = Number(g.coinCost);
    if (!Number.isFinite(cost) || cost <= 0) return null;
    return { id: g.id, coinCost: Math.round(cost), name: g.name };
  };
  try {
    const c = client ?? getSupabaseAdmin();
    if (c) {
      const { data } = await c.from("system_configs").select("virtual_gifts_json").eq("id", "default").maybeSingle();
      const raw = data?.virtual_gifts_json;
      if (raw) {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) {
          const fromDb = pick(parsed);
          if (fromDb) return fromDb;
        }
      }
    }
  } catch (err) {
    console.warn("[resolveCatalogGiftById]", err?.message || err);
  }
  return pick(fallbackCatalog);
}

// server/finance/completeCoinPurchase.ts
init_supabaseAdmin();
function purchasePegFields(amountCoins, amountUsd, peg) {
  const coinUsdPegAtPurchase = peg > 0 ? peg : DEFAULT_COIN_USD_PEG;
  const pegValueUsd = coinsToUsd(amountCoins, coinUsdPegAtPurchase);
  const paid = amountUsd == null ? null : Number(amountUsd);
  const loadMarginUsd = paid != null && Number.isFinite(paid) ? Math.round((paid - pegValueUsd) * 1e6) / 1e6 : null;
  return { coinUsdPegAtPurchase, pegValueUsd, loadMarginUsd };
}
async function loadLiveCoinUsdPeg(client) {
  try {
    const { data } = await client.from("system_configs").select("coin_usd_peg, female_payout_ratio_usd, coin_to_usd_ratio").eq("id", "default").maybeSingle();
    return getCoinUsdPeg(data || {});
  } catch {
    return DEFAULT_COIN_USD_PEG;
  }
}
function buildLedgerMetadata(input, pegFields) {
  return {
    channel: input.channel,
    ...input.actorAdminId ? { actor_admin_id: input.actorAdminId } : {},
    ...input.reason ? { reason: input.reason } : {},
    ...input.provider ? { payment_provider: input.provider } : {},
    ...input.externalRef ? { external_ref: input.externalRef } : {},
    ...input.packageId ? { package_id: input.packageId } : {},
    ...input.amountUsd != null && Number.isFinite(Number(input.amountUsd)) ? { amount_usd: Number(input.amountUsd) } : {},
    coin_usd_peg: pegFields.coinUsdPegAtPurchase,
    peg_value_usd: pegFields.pegValueUsd,
    ...pegFields.loadMarginUsd != null ? { load_margin_usd: pegFields.loadMarginUsd } : {}
  };
}
function resolveAdminClient(client) {
  if (client) return client;
  if (!isSupabaseAdminConfigured()) return null;
  return getSupabaseAdmin();
}
async function createCheckoutIntent(input) {
  const userId = String(input.userId || "").trim();
  const packageId = String(input.packageId || "").trim();
  if (!userId) return { success: false, error: "userId required", code: "INVALID_USER" };
  if (!packageId) return { success: false, error: "packageId required", code: "INVALID_PACKAGE" };
  const client = resolveAdminClient(input.client);
  if (!client) return { success: false, error: "Supabase admin not configured", code: "NO_ADMIN" };
  const { data: profile, error: profileErr } = await client.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (profileErr) return { success: false, error: profileErr.message, code: "PROFILE_LOAD_FAILED" };
  if (!profile) return { success: false, error: "User not found", code: "NOT_FOUND" };
  const { data: pkg, error: pkgErr } = await client.from("coin_packages").select("id, title, coins, bonus_coins, price_usd, discount_price_usd").eq("id", packageId).maybeSingle();
  if (pkgErr) return { success: false, error: pkgErr.message, code: "PACKAGE_LOAD_FAILED" };
  if (!pkg) return { success: false, error: "Coin package not found", code: "PACKAGE_NOT_FOUND" };
  const baseCoins = Math.max(0, Math.round(Number(pkg.coins) || 0));
  const bonusCoins = Math.max(0, Math.round(Number(pkg.bonus_coins) || 0));
  const totalCoins = baseCoins + bonusCoins;
  if (totalCoins <= 0) {
    return { success: false, error: "Package has no coins", code: "INVALID_PACKAGE" };
  }
  const listUsd = Number(pkg.price_usd);
  const discountRaw = pkg.discount_price_usd;
  const discountUsd = discountRaw == null ? NaN : Number(discountRaw);
  const payUsd = Number.isFinite(discountUsd) ? discountUsd : listUsd;
  const amountUsd = Number.isFinite(payUsd) ? payUsd : null;
  const provider = (input.provider ? String(input.provider).trim() : "stub") || "stub";
  const peg = await loadLiveCoinUsdPeg(client);
  const pegFields = purchasePegFields(totalCoins, amountUsd, peg);
  const { data: purchaseRow, error: purchaseErr } = await client.from("coin_purchases").insert({
    user_id: userId,
    channel: "GATEWAY",
    status: "pending",
    amount_coins: totalCoins,
    amount_usd: amountUsd,
    coin_usd_peg_at_purchase: pegFields.coinUsdPegAtPurchase,
    peg_value_usd: pegFields.pegValueUsd,
    load_margin_usd: pegFields.loadMarginUsd,
    package_id: packageId,
    payment_provider: provider,
    external_ref: null,
    reason: `Checkout intent \xB7 ${pkg.title || packageId}`
  }).select("*").single();
  if (purchaseErr) {
    return { success: false, error: purchaseErr.message, code: "INTENT_INSERT_FAILED" };
  }
  const purchaseId = String(purchaseRow.id);
  return {
    success: true,
    purchase: {
      id: purchaseId,
      userId,
      channel: "GATEWAY",
      status: "pending",
      amountCoins: totalCoins,
      amountUsd,
      pegValueUsd: pegFields.pegValueUsd,
      loadMarginUsd: pegFields.loadMarginUsd,
      coinUsdPegAtPurchase: pegFields.coinUsdPegAtPurchase,
      packageId,
      paymentProvider: provider,
      externalRef: null,
      createdAt: purchaseRow.created_at
    },
    package: {
      id: String(pkg.id),
      title: String(pkg.title || packageId),
      coins: baseCoins,
      bonusCoins,
      totalCoins,
      priceUsd: amountUsd ?? 0
    },
    // Extension point: real PSP would return session URL; token identifies the pending intent.
    checkoutToken: `minglecall_checkout_${purchaseId}`
  };
}
async function completeCoinPurchase(input) {
  const channel = input.channel;
  const existingPurchaseId = input.purchaseId ? String(input.purchaseId).trim() : "";
  if (channel !== "ADMIN_MANUAL" && channel !== "GATEWAY") {
    return { success: false, error: "Invalid channel", code: "INVALID_CHANNEL" };
  }
  const client = resolveAdminClient(input.client);
  if (!client) return { success: false, error: "Supabase admin client unavailable", code: "NO_ADMIN" };
  const provider = input.provider ? String(input.provider).trim() : null;
  const externalRef = input.externalRef ? String(input.externalRef).trim() : null;
  if (channel === "GATEWAY" && provider && externalRef) {
    const { data: existing } = await client.from("coin_purchases").select("id, wallet_ledger_id, user_id, amount_coins").eq("channel", "GATEWAY").eq("payment_provider", provider).eq("external_ref", externalRef).eq("status", "completed").maybeSingle();
    if (existing?.id) {
      const { data: profile2 } = await client.from("profiles").select("coin_balance").eq("id", existing.user_id).maybeSingle();
      return {
        success: true,
        duplicate: true,
        purchaseId: existing.id,
        walletLedgerId: existing.wallet_ledger_id ?? void 0,
        coinBalance: Number(profile2?.coin_balance) || 0
      };
    }
  }
  let userId = String(input.userId || "").trim();
  let amountCoins = Math.round(Number(input.amountCoins) || 0);
  let amountUsd = input.amountUsd;
  let packageId = input.packageId ?? null;
  let reason = input.reason ?? null;
  let purchaseId = existingPurchaseId;
  let pendingMode = false;
  if (existingPurchaseId) {
    const { data: pending, error: pendingErr } = await client.from("coin_purchases").select("*").eq("id", existingPurchaseId).maybeSingle();
    if (pendingErr) return { success: false, error: pendingErr.message, code: "PURCHASE_LOAD_FAILED" };
    if (!pending) return { success: false, error: "Purchase intent not found", code: "NOT_FOUND" };
    if (pending.status === "completed" && pending.wallet_ledger_id) {
      const { data: profile2 } = await client.from("profiles").select("coin_balance").eq("id", pending.user_id).maybeSingle();
      return {
        success: true,
        duplicate: true,
        purchaseId: pending.id,
        walletLedgerId: pending.wallet_ledger_id,
        coinBalance: Number(profile2?.coin_balance) || 0
      };
    }
    if (pending.status !== "pending") {
      return {
        success: false,
        error: `Purchase status is ${pending.status}, expected pending`,
        code: "INVALID_STATUS"
      };
    }
    if (String(pending.channel) !== "GATEWAY") {
      return {
        success: false,
        error: "Only GATEWAY pending intents can be completed this way",
        code: "INVALID_CHANNEL"
      };
    }
    pendingMode = true;
    userId = String(pending.user_id);
    amountCoins = Math.round(Number(pending.amount_coins) || 0);
    amountUsd = pending.amount_usd != null ? Number(pending.amount_usd) : amountUsd;
    packageId = pending.package_id ?? packageId;
    reason = reason || pending.reason || "Gateway purchase completed";
  }
  if (!userId) return { success: false, error: "userId required", code: "INVALID_USER" };
  if (!Number.isFinite(amountCoins) || amountCoins <= 0) {
    return { success: false, error: "amountCoins must be a positive integer", code: "INVALID_AMOUNT" };
  }
  const { data: profile, error: profileErr } = await client.from("profiles").select("id, coin_balance").eq("id", userId).maybeSingle();
  if (profileErr) return { success: false, error: profileErr.message, code: "PROFILE_LOAD_FAILED" };
  if (!profile) return { success: false, error: "User not found", code: "NOT_FOUND" };
  const peg = await loadLiveCoinUsdPeg(client);
  const pegFields = purchasePegFields(amountCoins, amountUsd, peg);
  const previousBalance = Number(profile.coin_balance) || 0;
  const newBalance = previousBalance + amountCoins;
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const ledgerMeta = buildLedgerMetadata(
    {
      ...input,
      userId,
      amountCoins,
      amountUsd,
      packageId,
      reason,
      provider: provider || input.provider,
      externalRef: externalRef || input.externalRef
    },
    pegFields
  );
  const pegColumnPayload = {
    coin_usd_peg_at_purchase: pegFields.coinUsdPegAtPurchase,
    peg_value_usd: pegFields.pegValueUsd,
    load_margin_usd: pegFields.loadMarginUsd
  };
  if (!pendingMode) {
    const { data: purchaseRow, error: purchaseErr } = await client.from("coin_purchases").insert({
      user_id: userId,
      channel,
      status: "completed",
      amount_coins: amountCoins,
      amount_usd: amountUsd != null ? Number(amountUsd) : null,
      ...pegColumnPayload,
      package_id: packageId,
      payment_provider: provider,
      external_ref: externalRef,
      actor_admin_id: input.actorAdminId ?? null,
      reason,
      completed_at: nowIso
    }).select("id").single();
    if (purchaseErr) {
      if (purchaseErr.code === "23505") {
        return { success: false, error: "Duplicate gateway purchase reference", code: "DUPLICATE" };
      }
      return { success: false, error: purchaseErr.message, code: "PURCHASE_INSERT_FAILED" };
    }
    purchaseId = String(purchaseRow.id);
  }
  const { error: balErr } = await client.from("profiles").update({ coin_balance: newBalance }).eq("id", userId);
  if (balErr) {
    if (!pendingMode && purchaseId) {
      await client.from("coin_purchases").delete().eq("id", purchaseId);
    }
    return { success: false, error: balErr.message, code: "BALANCE_UPDATE_FAILED" };
  }
  const { data: ledgerRow, error: ledgerErr } = await client.from("wallet_ledger").insert({
    user_id: userId,
    call_id: purchaseId,
    transaction_type: "PURCHASE",
    amount: amountCoins,
    balance_after: newBalance,
    billing_minute: 0,
    metadata: ledgerMeta
  }).select("id").single();
  if (ledgerErr) {
    await client.from("profiles").update({ coin_balance: previousBalance }).eq("id", userId);
    if (!pendingMode && purchaseId) {
      await client.from("coin_purchases").delete().eq("id", purchaseId);
    }
    const msg = String(ledgerErr.message || "");
    if (ledgerErr.code === "23505" || /duplicate|unique/i.test(msg)) {
      return { success: false, error: "Purchase ledger already posted", code: "LEDGER_DUPLICATE" };
    }
    return { success: false, error: msg, code: "LEDGER_INSERT_FAILED" };
  }
  const walletLedgerId = String(ledgerRow.id);
  const { error: finalizeErr } = await client.from("coin_purchases").update({
    status: "completed",
    wallet_ledger_id: walletLedgerId,
    completed_at: nowIso,
    payment_provider: provider || void 0,
    external_ref: externalRef || void 0,
    reason: reason || void 0,
    amount_usd: amountUsd != null ? Number(amountUsd) : void 0,
    ...pegColumnPayload
  }).eq("id", purchaseId);
  if (finalizeErr) {
    console.warn("[completeCoinPurchase] finalize purchase row failed:", finalizeErr.message);
  }
  return {
    success: true,
    purchaseId,
    walletLedgerId,
    coinBalance: newBalance
  };
}
async function failCheckoutIntent(opts) {
  const client = resolveAdminClient(opts.client);
  if (!client) return { success: false, error: "Supabase admin unavailable", code: "NO_ADMIN" };
  const id = String(opts.purchaseId || "").trim();
  if (!id) return { success: false, error: "purchaseId required", code: "INVALID_ID" };
  const { data: row, error } = await client.from("coin_purchases").select("*").eq("id", id).maybeSingle();
  if (error) return { success: false, error: error.message, code: "PURCHASE_LOAD_FAILED" };
  if (!row) return { success: false, error: "Purchase not found", code: "NOT_FOUND" };
  if (row.status === "completed") {
    return { success: false, error: "Cannot fail a completed purchase", code: "ALREADY_COMPLETED" };
  }
  if (row.status === "failed") return { success: true };
  const { error: updErr } = await client.from("coin_purchases").update({
    status: "failed",
    reason: opts.reason || row.reason || "Payment failed",
    payment_provider: opts.provider || row.payment_provider,
    external_ref: opts.externalRef || row.external_ref
  }).eq("id", id).eq("status", "pending");
  if (updErr) return { success: false, error: updErr.message, code: "UPDATE_FAILED" };
  return { success: true };
}

// server/finance/creatorEarnMetrics.ts
function applyCreatorEarnCoins(existing, opts) {
  const callAdd = Math.max(0, Math.round(Number(opts.callCoins) || 0));
  const giftAdd = Math.max(0, Math.round(Number(opts.giftCoins) || 0));
  const base = existing ? { ...existing, creatorId: opts.creatorId } : {
    creatorId: opts.creatorId,
    agencyLeaderId: opts.agencyLeaderId || null,
    activeOnlineSeconds: 0,
    activeOnlineHours: 0,
    coinsEarnedFromCalls: 0,
    coinsEarnedFromGifts: 0,
    totalTargetCoins: 0,
    performanceTier: "bronze"
  };
  const coinsEarnedFromCalls = Number(base.coinsEarnedFromCalls || 0) + callAdd;
  const coinsEarnedFromGifts = Number(base.coinsEarnedFromGifts || 0) + giftAdd;
  const totalTargetCoins = coinsEarnedFromCalls + coinsEarnedFromGifts;
  const hours = Number(base.activeOnlineHours || 0);
  const performanceTier = opts.computeTier(hours, totalTargetCoins);
  return {
    ...base,
    creatorId: opts.creatorId,
    agencyLeaderId: base.agencyLeaderId || opts.agencyLeaderId || null,
    coinsEarnedFromCalls,
    coinsEarnedFromGifts,
    totalTargetCoins,
    performanceTier,
    lastActiveDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}

// server/finance/closePeriod.ts
init_supabaseAdmin();
function freezeConfigSnapshot(config) {
  return freezeFinanceConfigSnapshot(config, { includeFrozenAt: true });
}
async function sumPeriodPackageLoadMarginUsd(client, periodStart, periodEnd) {
  const startIso = typeof periodStart === "string" ? periodStart : toIso(periodStart);
  const endIso = typeof periodEnd === "string" ? periodEnd : toIso(periodEnd);
  try {
    const { data, error } = await client.from("coin_purchases").select("load_margin_usd").eq("status", "completed").gte("completed_at", startIso).lt("completed_at", endIso);
    if (error) {
      console.warn("[finance/closePeriod] load_margin sum skipped:", error.message);
      return 0;
    }
    let sum = 0;
    for (const row of data || []) {
      const n = Number(row.load_margin_usd);
      if (Number.isFinite(n)) sum += n;
    }
    return Math.round(sum * 1e6) / 1e6;
  } catch (err) {
    console.warn("[finance/closePeriod] load_margin sum exception:", err?.message || err);
    return 0;
  }
}
function thresholdsFromSnapshot(snapshot, fallback) {
  if (!snapshot || typeof snapshot !== "object") return fallback;
  return resolveTargetThresholds(snapshot);
}
function computeHostTargetBonus(opts) {
  const tier = computePerformanceTier(opts.hours, opts.totalCoins, opts.thresholds);
  const metBronze = opts.hours >= opts.thresholds.bronzeHours && opts.totalCoins >= opts.thresholds.bronzeCoins;
  let bonusUsd = 0;
  if (tier === "gold" || tier === "silver") {
    bonusUsd = targetBonusUsdForTier(tier, opts.thresholds);
  } else if (metBronze) {
    bonusUsd = targetBonusUsdForTier("bronze", opts.thresholds);
  }
  return {
    tier,
    bonusUsd,
    bonusCoins: bonusUsd > 0 ? usdToCoins(bonusUsd, opts.fxRatio) : 0
  };
}
async function markPeriodFailed(periodId, closeError) {
  const client = getSupabaseAdmin();
  if (!client) return;
  await client.from("settlement_periods").update({
    status: "failed",
    close_error: closeError.slice(0, 2e3),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", periodId);
}
async function resolveSystemActorUserId(preferred) {
  if (preferred && String(preferred).trim()) return String(preferred).trim();
  const envActor = (process.env.FINANCE_JOB_ACTOR_USER_ID || "").trim();
  if (envActor) return envActor;
  const client = getSupabaseAdmin();
  if (!client) return null;
  const { data } = await client.from("profiles").select("id").eq("role", "admin").limit(1).maybeSingle();
  return data?.id ? String(data.id) : null;
}
async function findDueOpenPeriods(at = /* @__PURE__ */ new Date()) {
  const client = getSupabaseAdmin();
  if (!client) return [];
  const { data, error } = await client.from("settlement_periods").select("*").eq("status", "open").lte("close_scheduled_at", toIso(at)).order("period_start", { ascending: true });
  if (error) {
    console.warn("[finance/closePeriod] findDueOpenPeriods:", error.message);
    return [];
  }
  return data || [];
}
async function findRetryableFailedPeriods(at = /* @__PURE__ */ new Date()) {
  const client = getSupabaseAdmin();
  if (!client) return [];
  const { data, error } = await client.from("settlement_periods").select("*").eq("status", "failed").lte("close_scheduled_at", toIso(at)).order("period_start", { ascending: true });
  if (error) {
    console.warn("[finance/closePeriod] findRetryableFailedPeriods:", error.message);
    return [];
  }
  return data || [];
}
async function closePeriod(periodId, opts) {
  if (!isSupabaseAdminConfigured()) {
    return {
      success: false,
      periodId,
      status: "failed",
      error: "Supabase admin not configured"
    };
  }
  const client = getSupabaseAdmin();
  if (!client) {
    return {
      success: false,
      periodId,
      status: "failed",
      error: "Supabase admin client unavailable"
    };
  }
  const actorUserId = await resolveSystemActorUserId(opts.actorUserId);
  if (!actorUserId) {
    return {
      success: false,
      periodId,
      status: "failed",
      error: "No actor user id (pass actorUserId or set FINANCE_JOB_ACTOR_USER_ID / admin profile)"
    };
  }
  const { data: existing, error: loadError } = await client.from("settlement_periods").select("*").eq("id", periodId).maybeSingle();
  if (loadError || !existing) {
    return {
      success: false,
      periodId,
      status: "failed",
      error: loadError?.message || "Period not found"
    };
  }
  if (existing.status === "closed") {
    return {
      success: true,
      periodId,
      status: "noop",
      idempotent: true,
      message: "Period already closed"
    };
  }
  const claimable = existing.status === "open" || existing.status === "failed" || existing.status === "closing";
  if (!claimable) {
    return {
      success: false,
      periodId,
      status: "skipped",
      error: `Cannot close period in status=${existing.status}`
    };
  }
  const { data: claimed, error: claimError } = await client.from("settlement_periods").update({
    status: "closing",
    close_error: null,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", periodId).in("status", ["open", "failed", "closing"]).select("*").maybeSingle();
  if (claimError || !claimed) {
    const { data: again } = await client.from("settlement_periods").select("status").eq("id", periodId).maybeSingle();
    if (again?.status === "closed") {
      return {
        success: true,
        periodId,
        status: "noop",
        idempotent: true,
        message: "Period closed by concurrent worker"
      };
    }
    return {
      success: false,
      periodId,
      status: "failed",
      error: claimError?.message || "Failed to claim period for closing"
    };
  }
  try {
    const { data: existingBatches, error: batchListError } = await client.from("settlement_batches").select("id").eq("period_id", periodId);
    if (batchListError) throw new Error(batchListError.message);
    let batchIds = (existingBatches || []).map((b) => String(b.id));
    const batchesAlreadyExist = batchIds.length > 0;
    const liveConfig = await loadFinanceSystemConfig({ force: true });
    const priorSnapshot = claimed.config_snapshot && typeof claimed.config_snapshot === "object" ? claimed.config_snapshot : null;
    const priorFrozen = Boolean(priorSnapshot && priorSnapshot.frozen_at);
    let config = liveConfig;
    let snapshot = freezeConfigSnapshot(liveConfig);
    if (batchesAlreadyExist && priorFrozen) {
      snapshot = { ...priorSnapshot };
      const frozenPeg = getCoinUsdPeg(priorSnapshot);
      config = {
        ...liveConfig,
        coinUsdPeg: frozenPeg,
        femalePayoutRatioUsd: frozenPeg,
        coinToUsdRatio: frozenPeg,
        thresholds: thresholdsFromSnapshot(priorSnapshot, liveConfig.thresholds)
      };
    } else {
      await client.from("settlement_periods").update({
        config_snapshot: snapshot,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", periodId);
    }
    const fxRatio = config.coinUsdPeg;
    const periodStart = claimed.period_start;
    const periodEnd = claimed.period_end;
    const { count: accrualLedgerCount, error: ledgerCountError } = await client.from("financial_ledger").select("id", { count: "exact", head: true }).eq("period_id", periodId).eq("entry_type", "SETTLEMENT_ACCRUAL");
    if (ledgerCountError) throw new Error(ledgerCountError.message);
    const { count: platformLedgerCount, error: platformCountError } = await client.from("financial_ledger").select("id", { count: "exact", head: true }).eq("period_id", periodId).eq("entry_type", "PLATFORM_EARN");
    if (platformCountError) throw new Error(platformCountError.message);
    const ledgerAlreadyExists = (accrualLedgerCount || 0) > 0 || (platformLedgerCount || 0) > 0;
    let ledgerEntriesWritten = 0;
    let builtAccruals = [];
    let hostBonusByUser = /* @__PURE__ */ new Map();
    const hostTrueUpByUser = /* @__PURE__ */ new Map();
    let periodBurnTotals = {
      callDebitCoins: 0,
      hostEarnCoins: 0,
      targetShareTrueUpCoins: 0,
      tlEarnCoins: 0,
      platformRetainedCoins: 0
    };
    const { data: metricsRows, error: metricsError } = await client.from("creator_metrics").select("*");
    if (metricsError) throw new Error(metricsError.message);
    const metricsList = metricsRows || [];
    if (!batchesAlreadyExist) {
      const accrual = await aggregateWalletLedgerEarnings({
        periodStart,
        periodEnd,
        client
      });
      if (!accrual.success) throw new Error(accrual.error || "Accrual query failed");
      periodBurnTotals = {
        callDebitCoins: accrual.totals.callDebitCoins,
        hostEarnCoins: accrual.totals.hostEarnCoins,
        targetShareTrueUpCoins: accrual.totals.targetShareTrueUpCoins,
        tlEarnCoins: accrual.totals.tlEarnCoins,
        platformRetainedCoins: accrual.totals.platformRetainedCoins
      };
      const userIds = Array.from(accrual.byUser.keys());
      for (const m of metricsList) {
        if (m.creator_id && !accrual.byUser.has(m.creator_id)) {
          userIds.push(m.creator_id);
        }
      }
      const profileById = /* @__PURE__ */ new Map();
      if (userIds.length) {
        const chunkSize = 200;
        for (let i = 0; i < userIds.length; i += chunkSize) {
          const chunk = userIds.slice(i, i + chunkSize);
          const { data: profiles, error: profileError } = await client.from("profiles").select("id, team_leader_id, created_by_id, role, coin_earn_override_rate").in("id", chunk);
          if (profileError) throw new Error(profileError.message);
          for (const p of profiles || []) {
            profileById.set(String(p.id), {
              teamLeaderId: p.team_leader_id || p.created_by_id || null,
              role: String(p.role || ""),
              coinEarnOverrideRate: p.coin_earn_override_rate != null ? Number(p.coin_earn_override_rate) : null
            });
          }
        }
      }
      const metricsByCreator = /* @__PURE__ */ new Map();
      const metricsHoursCoins = /* @__PURE__ */ new Map();
      for (const m of metricsList) {
        const cid = String(m.creator_id);
        metricsByCreator.set(cid, m);
        metricsHoursCoins.set(cid, {
          hours: Number(m.active_online_hours || 0),
          coins: Number(m.total_target_coins) || Number(m.coins_earned_from_calls || 0) + Number(m.coins_earned_from_gifts || 0)
        });
      }
      const burnRates = resolveEconomyBurnRates(snapshot);
      const trueUpAgg = await aggregateHostCallBurnForTrueUp({
        periodStart,
        periodEnd,
        periodId,
        client
      });
      if (!trueUpAgg.success) throw new Error(trueUpAgg.error || "True-up accrual failed");
      const creatorHostIds = Array.from(
        /* @__PURE__ */ new Set([
          ...Array.from(trueUpAgg.byHost.keys()),
          ...Array.from(metricsByCreator.keys()).filter((id) => {
            const role = profileById.get(id)?.role || "";
            return role === "female_creator" || role === "female_host";
          })
        ])
      ).filter((id) => {
        const role = profileById.get(id)?.role || "";
        if (!role) return true;
        return role === "female_creator" || role === "female_host";
      });
      const overrideByHost = /* @__PURE__ */ new Map();
      for (const id of creatorHostIds) {
        overrideByHost.set(id, profileById.get(id)?.coinEarnOverrideRate);
      }
      const trueUpPlans = planHostShareTrueUps({
        hostIds: creatorHostIds,
        aggByHost: trueUpAgg.byHost,
        metricsByCreator: metricsHoursCoins,
        overrideByHost,
        thresholds: config.thresholds,
        targetSharePercent: burnRates.femaleHostTargetSharePercent,
        burnConfig: snapshot
      });
      let postedTrueUpTotal = 0;
      for (const plan of trueUpPlans) {
        if (plan.skippedAlreadyPosted) {
          const already = trueUpAgg.byHost.get(plan.hostId)?.alreadyTrueUpCoins || 0;
          if (already > 0) hostTrueUpByUser.set(plan.hostId, already);
          continue;
        }
        if (plan.trueUpCoins <= 0) continue;
        const posted = await postHostShareTrueUpWallet({
          hostId: plan.hostId,
          periodId,
          trueUpCoins: plan.trueUpCoins,
          client,
          metadata: {
            period_eligible_call_burn: plan.periodEligibleCallBurn,
            period_host_call_earn: plan.periodHostCallEarn,
            target_share_percent: plan.targetSharePercent,
            hours: plan.hours,
            coins: plan.coins
          }
        });
        if (!posted.success) {
          throw new Error(posted.error || `True-up wallet post failed for ${plan.hostId}`);
        }
        hostTrueUpByUser.set(plan.hostId, plan.trueUpCoins);
        if (posted.posted) postedTrueUpTotal += plan.trueUpCoins;
      }
      if (postedTrueUpTotal > 0) {
        periodBurnTotals.targetShareTrueUpCoins += postedTrueUpTotal;
        periodBurnTotals.platformRetainedCoins = Math.max(
          0,
          periodBurnTotals.callDebitCoins - periodBurnTotals.hostEarnCoins - periodBurnTotals.targetShareTrueUpCoins - periodBurnTotals.tlEarnCoins
        );
      }
      const hostIds = /* @__PURE__ */ new Set();
      const tlCommission = /* @__PURE__ */ new Map();
      for (const [userId, totals] of accrual.byUser.entries()) {
        if (totals.hostEarnCoins > 0 || totals.giftHostEarnCoins > 0) {
          hostIds.add(userId);
        }
        if (totals.tlEarnCoins > 0) {
          tlCommission.set(userId, (tlCommission.get(userId) || 0) + totals.tlEarnCoins);
        }
      }
      for (const id of hostTrueUpByUser.keys()) hostIds.add(id);
      for (const m of metricsList) {
        const cid = String(m.creator_id);
        const hours = Number(m.active_online_hours || 0);
        const coins = Number(m.total_target_coins) || Number(m.coins_earned_from_calls || 0) + Number(m.coins_earned_from_gifts || 0);
        const bonus = computeHostTargetBonus({
          hours,
          totalCoins: coins,
          thresholds: config.thresholds,
          fxRatio
        });
        if (bonus.bonusUsd > 0) {
          hostIds.add(cid);
          hostBonusByUser.set(cid, {
            ...bonus,
            hours,
            coins
          });
        } else if (hours > 0 || coins > 0) {
          hostBonusByUser.set(cid, { ...bonus, hours, coins });
        }
      }
      for (const hostId of hostIds) {
        const totals = accrual.byUser.get(hostId);
        const profile = profileById.get(hostId);
        const metrics = metricsByCreator.get(hostId);
        const teamLeaderId = metrics?.agency_leader_id || profile?.teamLeaderId || null;
        let bonus = hostBonusByUser.get(hostId);
        if (!bonus && metrics) {
          const hours = Number(metrics.active_online_hours || 0);
          const coins = Number(metrics.total_target_coins) || Number(metrics.coins_earned_from_calls || 0) + Number(metrics.coins_earned_from_gifts || 0);
          bonus = {
            ...computeHostTargetBonus({
              hours,
              totalCoins: coins,
              thresholds: config.thresholds,
              fxRatio
            }),
            hours,
            coins
          };
          hostBonusByUser.set(hostId, bonus);
        }
        builtAccruals.push({
          userId: hostId,
          teamLeaderId,
          role: "host",
          callEarningsCoins: totals?.callHostEarnCoins || 0,
          giftEarningsCoins: totals?.giftHostEarnCoins || 0,
          targetShareTrueUpCoins: hostTrueUpByUser.get(hostId) || 0,
          targetBonusCoins: bonus?.bonusCoins || 0,
          targetBonusUsd: bonus?.bonusUsd || 0,
          breakdown: {
            performanceTier: bonus?.tier || "bronze",
            activeOnlineHours: bonus?.hours ?? Number(metrics?.active_online_hours || 0),
            totalTargetCoins: bonus?.coins ?? 0
          }
        });
      }
      for (const [tlId, coins] of tlCommission.entries()) {
        builtAccruals.push({
          userId: tlId,
          role: "team_leader",
          tlCommissionCoins: coins,
          breakdown: { source: "wallet_ledger.TL_EARN" }
        });
      }
      for (const a of builtAccruals) {
        if (a.role === "host" && a.teamLeaderId && !tlCommission.has(a.teamLeaderId)) {
          if (!builtAccruals.some((x) => x.role === "team_leader" && x.userId === a.teamLeaderId)) {
            builtAccruals.push({
              userId: a.teamLeaderId,
              role: "team_leader",
              tlCommissionCoins: 0
            });
          }
        }
      }
      const built = buildSettlementBatches({
        accruals: builtAccruals,
        fxRatio
      }).filter((b) => b.totalDueUsd > 0 || b.lineItems.length > 0);
      const created = await createSettlementBatchesForPeriod({
        periodId,
        batches: built
      });
      if (!created.success) throw new Error(created.error || "Batch create failed");
      batchIds = created.batchIds;
    }
    if (!ledgerAlreadyExists) {
      const ledgerInputs = [];
      if (batchesAlreadyExist && periodBurnTotals.callDebitCoins === 0 && periodBurnTotals.hostEarnCoins === 0) {
        const burnAccrual = await aggregateWalletLedgerEarnings({
          periodStart,
          periodEnd,
          client
        });
        if (!burnAccrual.success) throw new Error(burnAccrual.error || "Burn accrual query failed");
        periodBurnTotals = {
          callDebitCoins: burnAccrual.totals.callDebitCoins,
          hostEarnCoins: burnAccrual.totals.hostEarnCoins,
          targetShareTrueUpCoins: burnAccrual.totals.targetShareTrueUpCoins,
          tlEarnCoins: burnAccrual.totals.tlEarnCoins,
          platformRetainedCoins: burnAccrual.totals.platformRetainedCoins
        };
      }
      {
        const platformCoins = periodBurnTotals.platformRetainedCoins;
        const retainedUsd = coinsToUsd(platformCoins, fxRatio);
        const loadMarginUsd = await sumPeriodPackageLoadMarginUsd(client, periodStart, periodEnd);
        const platformUsd = Math.round((retainedUsd + loadMarginUsd) * 1e4) / 1e4;
        ledgerInputs.push({
          periodId,
          entryType: "PLATFORM_EARN",
          userId: null,
          teamLeaderId: null,
          counterpartyRole: "platform",
          amountCoins: platformCoins,
          amountUsd: platformUsd,
          fxRatio,
          sourceRefType: "settlement_period",
          sourceRefId: periodId,
          metadata: {
            invariant: "CALL_DEBIT+GIFT_DEBIT - HOST_EARN - TARGET_SHARE_TRUEUP - TL_EARN",
            callDebitCoins: periodBurnTotals.callDebitCoins,
            hostEarnCoins: periodBurnTotals.hostEarnCoins,
            targetShareTrueUpCoins: periodBurnTotals.targetShareTrueUpCoins,
            tlEarnCoins: periodBurnTotals.tlEarnCoins,
            platformRetainedCoins: platformCoins,
            platformRetainedUsd: retainedUsd,
            package_load_margin_usd: loadMarginUsd,
            coin_usd_peg: fxRatio,
            // Legacy mirrors in metadata
            coin_to_usd_ratio: fxRatio,
            female_payout_ratio_usd: fxRatio
          }
        });
      }
      if (!batchesAlreadyExist && builtAccruals.length) {
        for (const a of builtAccruals) {
          if (a.role === "host") {
            const call = Number(a.callEarningsCoins) || 0;
            const gift = Number(a.giftEarningsCoins) || 0;
            const trueUp = Number(a.targetShareTrueUpCoins) || 0;
            const hostCoins = call + gift;
            if (hostCoins > 0) {
              ledgerInputs.push({
                periodId,
                entryType: "HOST_EARN",
                userId: a.userId,
                teamLeaderId: a.teamLeaderId || null,
                counterpartyRole: "host",
                amountCoins: hostCoins,
                amountUsd: coinsToUsd(hostCoins, fxRatio),
                fxRatio,
                sourceRefType: "settlement_period",
                sourceRefId: periodId,
                metadata: { call, gift, coin_usd_peg: fxRatio }
              });
            }
            if (trueUp > 0) {
              ledgerInputs.push({
                periodId,
                entryType: "TARGET_SHARE_TRUEUP",
                userId: a.userId,
                teamLeaderId: a.teamLeaderId || null,
                counterpartyRole: "host",
                amountCoins: trueUp,
                amountUsd: coinsToUsd(trueUp, fxRatio),
                fxRatio,
                sourceRefType: "settlement_period",
                sourceRefId: periodId,
                metadata: {
                  kind: "target_share_trueup",
                  coin_usd_peg: fxRatio,
                  ...a.breakdown || {}
                }
              });
            }
            if ((a.targetBonusUsd || 0) > 0) {
              ledgerInputs.push({
                periodId,
                entryType: "TARGET_BONUS",
                userId: a.userId,
                teamLeaderId: a.teamLeaderId || null,
                counterpartyRole: "host",
                amountCoins: a.targetBonusCoins || 0,
                amountUsd: a.targetBonusUsd || 0,
                fxRatio,
                sourceRefType: "settlement_period",
                sourceRefId: periodId,
                metadata: a.breakdown || {}
              });
            }
          } else if (a.role === "team_leader" && (a.tlCommissionCoins || 0) > 0) {
            const tlCoins = Number(a.tlCommissionCoins) || 0;
            ledgerInputs.push({
              periodId,
              entryType: "TL_EARN",
              userId: a.userId,
              teamLeaderId: a.userId,
              counterpartyRole: "team_leader",
              amountCoins: tlCoins,
              amountUsd: coinsToUsd(tlCoins, fxRatio),
              fxRatio,
              sourceRefType: "settlement_period",
              sourceRefId: periodId,
              metadata: { coin_usd_peg: fxRatio }
            });
          }
        }
      } else if (batchesAlreadyExist && batchIds.length) {
        const { data: resumeLines, error: resumeLinesError } = await client.from("settlement_line_items").select(
          "payee_user_id, payee_role, component, amount_coins, amount_usd, batch_id, metadata"
        ).in("batch_id", batchIds);
        if (resumeLinesError) throw new Error(resumeLinesError.message);
        const { data: resumeBatches } = await client.from("settlement_batches").select("id, team_leader_id").in("id", batchIds);
        const tlByBatch = new Map(
          (resumeBatches || []).map((b) => [String(b.id), b.team_leader_id || null])
        );
        const byPayee = /* @__PURE__ */ new Map();
        for (const li of resumeLines || []) {
          const uid = String(li.payee_user_id || "");
          if (!uid) continue;
          const cur = byPayee.get(uid) || {
            call: 0,
            gift: 0,
            trueUp: 0,
            bonusCoins: 0,
            bonusUsd: 0,
            tl: 0,
            teamLeaderId: tlByBatch.get(String(li.batch_id)) || null,
            meta: {}
          };
          const coins = Number(li.amount_coins) || 0;
          const usd = Number(li.amount_usd) || 0;
          const c = String(li.component || "");
          if (c === "call_earnings") cur.call += coins;
          else if (c === "gift_earnings") cur.gift += coins;
          else if (c === "target_share_trueup") cur.trueUp += coins;
          else if (c === "target_bonus") {
            cur.bonusCoins += coins;
            cur.bonusUsd += usd;
          } else if (c === "tl_commission") cur.tl += coins;
          if (li.metadata && typeof li.metadata === "object") {
            cur.meta = { ...cur.meta, ...li.metadata };
          }
          byPayee.set(uid, cur);
        }
        for (const [uid, a] of byPayee.entries()) {
          const hostCoins = a.call + a.gift;
          if (hostCoins > 0) {
            ledgerInputs.push({
              periodId,
              entryType: "HOST_EARN",
              userId: uid,
              teamLeaderId: a.teamLeaderId,
              counterpartyRole: "host",
              amountCoins: hostCoins,
              amountUsd: coinsToUsd(hostCoins, fxRatio),
              fxRatio,
              sourceRefType: "settlement_period",
              sourceRefId: periodId,
              metadata: { call: a.call, gift: a.gift, coin_usd_peg: fxRatio, resumed: true }
            });
          }
          if (a.trueUp > 0) {
            ledgerInputs.push({
              periodId,
              entryType: "TARGET_SHARE_TRUEUP",
              userId: uid,
              teamLeaderId: a.teamLeaderId,
              counterpartyRole: "host",
              amountCoins: a.trueUp,
              amountUsd: coinsToUsd(a.trueUp, fxRatio),
              fxRatio,
              sourceRefType: "settlement_period",
              sourceRefId: periodId,
              metadata: {
                kind: "target_share_trueup",
                coin_usd_peg: fxRatio,
                resumed: true,
                ...a.meta
              }
            });
          }
          if (a.bonusUsd > 0 || a.bonusCoins > 0) {
            ledgerInputs.push({
              periodId,
              entryType: "TARGET_BONUS",
              userId: uid,
              teamLeaderId: a.teamLeaderId,
              counterpartyRole: "host",
              amountCoins: a.bonusCoins,
              amountUsd: a.bonusUsd,
              fxRatio,
              sourceRefType: "settlement_period",
              sourceRefId: periodId,
              metadata: { resumed: true, ...a.meta }
            });
          }
          if (a.tl > 0) {
            ledgerInputs.push({
              periodId,
              entryType: "TL_EARN",
              userId: uid,
              teamLeaderId: uid,
              counterpartyRole: "team_leader",
              amountCoins: a.tl,
              amountUsd: coinsToUsd(a.tl, fxRatio),
              fxRatio,
              sourceRefType: "settlement_period",
              sourceRefId: periodId,
              metadata: { coin_usd_peg: fxRatio, resumed: true }
            });
          }
        }
      }
      const { data: batchRows, error: batchFetchError } = await client.from("settlement_batches").select("id, total_due_usd, total_host_salary_coins, total_tl_commission_coins, payee_user_id, team_leader_id, batch_kind").eq("period_id", periodId);
      if (batchFetchError) throw new Error(batchFetchError.message);
      for (const b of batchRows || []) {
        const coins = Number(b.total_host_salary_coins || 0) + Number(b.total_tl_commission_coins || 0);
        ledgerInputs.push({
          periodId,
          entryType: "SETTLEMENT_ACCRUAL",
          userId: b.payee_user_id,
          teamLeaderId: b.team_leader_id,
          counterpartyRole: b.batch_kind === "team_leader_bundle" ? "team_leader" : "host",
          amountCoins: coins,
          amountUsd: Number(b.total_due_usd) || 0,
          fxRatio,
          sourceRefType: "settlement_batch",
          sourceRefId: b.id,
          metadata: { batchKind: b.batch_kind }
        });
      }
      if (ledgerInputs.length) {
        const written = await appendFinancialLedgerEntries(ledgerInputs);
        if (!written.success) throw new Error(written.error || "Ledger write failed");
        ledgerEntriesWritten = written.entries.length;
      }
    }
    for (const batchId of batchIds) {
      const { count, error: evCountError } = await client.from("settlement_events").select("id", { count: "exact", head: true }).eq("batch_id", batchId).eq("event_type", "created");
      if (evCountError) throw new Error(evCountError.message);
      if ((count || 0) > 0) continue;
      const ev = await recordBatchCreatedEvent({
        batchId,
        periodId,
        actorUserId,
        payload: { payableSourceOfTruth: PAYABLE_SOURCE_OF_TRUTH }
      });
      if (!ev.success) throw new Error(ev.error || "Failed to record created event");
    }
    const { count: snapCount, error: snapCountError } = await client.from("creator_period_snapshots").select("id", { count: "exact", head: true }).eq("period_id", periodId);
    if (snapCountError) throw new Error(snapCountError.message);
    let snapshotsWritten = snapCount || 0;
    if ((snapCount || 0) === 0 && metricsList.length > 0) {
      const snapRows = metricsList.map((m) => {
        const hours = Number(m.active_online_hours || 0);
        const coins = Number(m.total_target_coins) || Number(m.coins_earned_from_calls || 0) + Number(m.coins_earned_from_gifts || 0);
        const cached2 = hostBonusByUser.get(String(m.creator_id));
        const bonus = cached2 || computeHostTargetBonus({
          hours,
          totalCoins: coins,
          thresholds: config.thresholds,
          fxRatio
        });
        return {
          period_id: periodId,
          creator_id: m.creator_id,
          agency_leader_id: m.agency_leader_id || null,
          active_online_seconds: Number(m.active_online_seconds || 0),
          active_online_hours: hours,
          coins_earned_from_calls: Number(m.coins_earned_from_calls || 0),
          coins_earned_from_gifts: Number(m.coins_earned_from_gifts || 0),
          total_target_coins: Number(m.total_target_coins || coins),
          performance_tier: bonus.tier,
          bonus_earned_coins: bonus.bonusCoins,
          bonus_earned_usd: bonus.bonusUsd,
          current_streak_days: Number(m.current_streak_days || 0),
          response_health_score: Number(m.response_health_score ?? 100),
          metrics_snapshot: m
        };
      });
      const chunkSize = 100;
      for (let i = 0; i < snapRows.length; i += chunkSize) {
        const chunk = snapRows.slice(i, i + chunkSize);
        const { error: snapError } = await client.from("creator_period_snapshots").insert(chunk);
        if (snapError) {
          if (String(snapError.code) !== "23505" && !/duplicate|unique/i.test(snapError.message)) {
            throw new Error(snapError.message);
          }
        } else {
          snapshotsWritten += chunk.length;
        }
      }
    }
    if (metricsList.length > 0) {
      const nextBounds = await ensureOpenPeriod({
        at: new Date(new Date(periodEnd).getTime()),
        config,
        cycleType: claimed.cycle_type
      });
      const nextStart = nextBounds.bounds.periodStart.toISOString().slice(0, 10);
      const nextEndExclusive = nextBounds.bounds.periodEnd;
      const nextEndDate = new Date(nextEndExclusive.getTime() - 1).toISOString().slice(0, 10);
      const resetPayload = {
        active_online_seconds: 0,
        active_online_hours: 0,
        coins_earned_from_calls: 0,
        coins_earned_from_gifts: 0,
        total_target_coins: 0,
        performance_tier: "bronze",
        bonus_earned_coins: 0,
        bonus_earned_usd: 0,
        target_period_start: nextStart,
        target_period_end: nextEndDate,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      const creatorsNeedingReset = metricsList.filter((m) => {
        const start = m.target_period_start != null ? String(m.target_period_start).slice(0, 10) : "";
        return start !== nextStart;
      }).map((m) => String(m.creator_id)).filter(Boolean);
      const chunkSize = 100;
      for (let i = 0; i < creatorsNeedingReset.length; i += chunkSize) {
        const chunk = creatorsNeedingReset.slice(i, i + chunkSize);
        const { error: resetError } = await client.from("creator_metrics").update(resetPayload).in("creator_id", chunk);
        if (resetError) throw new Error(resetError.message);
      }
      if (opts.creatorMetricsMap && creatorsNeedingReset.length) {
        for (const creatorId of creatorsNeedingReset) {
          const prev = opts.creatorMetricsMap.get(creatorId);
          if (!prev) continue;
          opts.creatorMetricsMap.set(creatorId, {
            ...prev,
            activeOnlineSeconds: 0,
            activeOnlineHours: 0,
            coinsEarnedFromCalls: 0,
            coinsEarnedFromGifts: 0,
            totalTargetCoins: 0,
            performanceTier: "bronze",
            bonusEarnedCoins: 0,
            bonusEarnedUSD: 0,
            targetPeriodStart: nextStart,
            targetPeriodEnd: nextEndDate,
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
        opts.onMetricsReset?.();
      }
    }
    const { error: closeError } = await client.from("settlement_periods").update({
      status: "closed",
      closed_at: (/* @__PURE__ */ new Date()).toISOString(),
      close_error: null,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", periodId).eq("status", "closing");
    if (closeError) throw new Error(closeError.message);
    await ensureOpenPeriod({
      at: /* @__PURE__ */ new Date(),
      config,
      cycleType: claimed.cycle_type
    });
    return {
      success: true,
      periodId,
      status: "closed",
      idempotent: batchesAlreadyExist || ledgerAlreadyExists,
      batchIds,
      ledgerEntriesWritten,
      snapshotsWritten,
      message: batchesAlreadyExist ? "Resumed/finalized existing settlement artifacts" : "Period closed and settlement batches created"
    };
  } catch (err) {
    const message = err?.message || String(err);
    console.error("[finance/closePeriod] failed:", periodId, message);
    await markPeriodFailed(periodId, message);
    return {
      success: false,
      periodId,
      status: "failed",
      error: message
    };
  }
}
async function closeDuePeriods(opts) {
  if (!isSupabaseAdminConfigured()) {
    return { success: false, results: [], error: "Supabase admin not configured" };
  }
  const at = opts.at ?? /* @__PURE__ */ new Date();
  const actorUserId = await resolveSystemActorUserId(opts.actorUserId);
  if (!actorUserId) {
    return {
      success: false,
      results: [],
      error: "No actor user id for settlement_events (FINANCE_JOB_ACTOR_USER_ID or admin profile)"
    };
  }
  const ensured = await ensureOpenPeriod({ at });
  const due = await findDueOpenPeriods(at);
  const failed = opts.includeFailedRetries === false ? [] : await findRetryableFailedPeriods(at);
  const byId = /* @__PURE__ */ new Map();
  for (const p of [...due, ...failed]) byId.set(p.id, p);
  const results = [];
  for (const period of byId.values()) {
    const result = await closePeriod(period.id, {
      actorUserId,
      at,
      creatorMetricsMap: opts.creatorMetricsMap,
      onMetricsReset: opts.onMetricsReset
    });
    results.push(result);
  }
  const ensuredAfter = await ensureOpenPeriod({ at: /* @__PURE__ */ new Date() });
  const anyHardFail = results.some((r) => r.status === "failed");
  return {
    success: !anyHardFail,
    ensuredOpenPeriodId: ensuredAfter.period?.id || ensured.period?.id || null,
    results
  };
}

// shared/finance/hostEarningsBreakdown.ts
var EMPTY_HOST_EARNINGS_BREAKDOWN = {
  callEarningsCoins: 0,
  callEarningsUsd: 0,
  giftEarningsCoins: 0,
  giftEarningsUsd: 0,
  targetShareTrueUpCoins: 0,
  targetShareTrueUpUsd: 0,
  targetBonusCoins: 0,
  targetBonusUsd: 0,
  totalCoins: 0,
  totalUsd: 0
};
function labelSettlementComponent(component) {
  switch (component) {
    case "call_earnings":
      return "Call earnings (base)";
    case "gift_earnings":
      return "Gift earnings";
    case "target_share_trueup":
      return "Target share true-up";
    case "target_bonus":
      return "Target cash bonus";
    case "tl_commission":
      return "TL commission";
    default:
      return component.replace(/_/g, " ");
  }
}
function add(a, patch) {
  const next = { ...a };
  for (const [k, v] of Object.entries(patch)) {
    const key = k;
    next[key] = (Number(next[key]) || 0) + (Number(v) || 0);
  }
  next.totalCoins = next.callEarningsCoins + next.giftEarningsCoins + next.targetShareTrueUpCoins + next.targetBonusCoins;
  next.totalUsd = next.callEarningsUsd + next.giftEarningsUsd + next.targetShareTrueUpUsd + next.targetBonusUsd;
  return next;
}
function summarizeHostSettlementLines(lines) {
  let out = { ...EMPTY_HOST_EARNINGS_BREAKDOWN };
  for (const li of lines) {
    const coins = Number(li.amountCoins ?? li.amount_coins) || 0;
    const usd = Number(li.amountUsd ?? li.amount_usd) || 0;
    const c = String(li.component || "");
    if (c === "call_earnings") {
      out = add(out, { callEarningsCoins: coins, callEarningsUsd: usd });
    } else if (c === "gift_earnings") {
      out = add(out, { giftEarningsCoins: coins, giftEarningsUsd: usd });
    } else if (c === "target_share_trueup") {
      out = add(out, { targetShareTrueUpCoins: coins, targetShareTrueUpUsd: usd });
    } else if (c === "target_bonus") {
      out = add(out, { targetBonusCoins: coins, targetBonusUsd: usd });
    } else if (c !== "tl_commission") {
      out = add(out, { callEarningsCoins: coins, callEarningsUsd: usd });
    }
  }
  return out;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_COIN_TO_USD_RATIO,
  DEFAULT_COIN_USD_PEG,
  DEFAULT_FEMALE_PAYOUT_RATIO_USD,
  DEFAULT_TARGET_THRESHOLDS,
  EMPTY_HOST_EARNINGS_BREAKDOWN,
  PAYABLE_MODEL_NOTES,
  PAYABLE_SOURCE_OF_TRUTH,
  PAYOUT_PERIOD_END_ONLY,
  PayoutPolicyError,
  SETTLEMENT_STATUS_TRANSITIONS,
  aggregateHostCallBurnForTrueUp,
  aggregateWalletLedgerEarnings,
  appendFinancialLedgerEntries,
  appendFinancialLedgerEntry,
  appendGiftEarnLedger,
  appendReversalEntry,
  appendSettlementNote,
  applyCreatorEarnCoins,
  assertManualPayoutAllowed,
  assertManualPayoutAllowedSync,
  buildSettlementBatches,
  canTransitionSettlementStatus,
  cancelSettlementBatch,
  checkManualPayoutAllowed,
  closeDuePeriods,
  closePeriod,
  coinsToUsd,
  coinsToUsdWithCachedRatio,
  coinsToUsdWithLiveRatio,
  coinsToUsdWithSnapshot,
  completeCoinPurchase,
  computeCloseScheduledAt,
  computePerformanceTier,
  computePerformanceTierFromCache,
  computePerformanceTierFromConfig,
  createCheckoutIntent,
  createSettlementBatchesForPeriod,
  defaultFinanceSystemConfig,
  ensureOpenPeriod,
  evaluateManualPayoutPolicy,
  failCheckoutIntent,
  findDueOpenPeriods,
  findRetryableFailedPeriods,
  formatPegExample,
  freezeFinanceConfigSnapshot,
  getCachedCoinUsdPeg,
  getCachedFinanceConfig,
  getCoinUsdPeg,
  getCurrentPeriodBounds,
  getNextCloseAt,
  getTargetThresholds,
  getUserPeriodAccrual,
  invalidateFinanceConfigCache,
  labelSettlementComponent,
  loadFinanceSystemConfig,
  loadGiftSharePercents,
  markBatchAdminPaid,
  markBatchTlConfirmed,
  normalizeCycleType,
  normalizeFxRatio,
  planHostShareTrueUps,
  postHostShareTrueUpWallet,
  recordBatchCreatedEvent,
  refreshFinanceConfigInBackground,
  resolveCatalogGiftById,
  resolveTargetThresholds,
  summarizeHostSettlementLines,
  targetBonusUsdForTier,
  updateFinanceSystemConfig,
  usdToCoins
});
