import { ALL_WORLDWIDE_COUNTRIES, ALL_LANGUAGES, ALL_ZODIAC_SIGNS, ALL_INTERESTS } from './taxonomies';

/**
 * Escapes SQL string literals safely
 */
function sqlEscape(val: string): string {
  if (!val) return '';
  return val.replace(/'/g, "''");
}

/**
 * Generates comprehensive SQL INSERT statements for all master taxonomies
 */
export function generateTaxonomySeedSql(): string {
  // Countries
  const countryValues = ALL_WORLDWIDE_COUNTRIES.map(
    (c) =>
      `('${sqlEscape(c.code)}', '${sqlEscape(c.name)}', '${sqlEscape(c.flag)}', '${sqlEscape(c.region)}', ${
        c.isTier1 ? 'true' : 'false'
      }, true)`
  ).join(',\n');

  // Languages
  const langValues = ALL_LANGUAGES.map(
    (l) =>
      `('${sqlEscape(l.code)}', '${sqlEscape(l.name)}', '${sqlEscape(l.nativeName)}', ${
        l.popular ? 'true' : 'false'
      }, '${sqlEscape(l.region || 'Global')}', true)`
  ).join(',\n');

  // Zodiac Signs
  const zodiacValues = ALL_ZODIAC_SIGNS.map(
    (z) =>
      `('${sqlEscape(z.key)}', '${sqlEscape(z.name)}', '${sqlEscape(z.symbol)}', '${sqlEscape(z.dateRange)}', '${sqlEscape(
        z.element
      )}', true)`
  ).join(',\n');

  // Interests
  const interestValues = ALL_INTERESTS.map(
    (i) =>
      `('${sqlEscape(i.id)}', '${sqlEscape(i.name)}', '${sqlEscape(i.category)}', '${sqlEscape(
        i.iconName || 'Sparkles'
      )}', '${sqlEscape(i.color || '#6366f1')}', ${i.popular ? 'true' : 'false'}, true)`
  ).join(',\n');

  // Allowed country codes array
  const defaultCountryCodes = ALL_WORLDWIDE_COUNTRIES.slice(0, 30).map((c) => `'${sqlEscape(c.code)}'`).join(',');
  const defaultLanguageNames = ALL_LANGUAGES.filter((l) => l.popular).map((l) => `'${sqlEscape(l.name)}'`).join(',');
  const defaultZodiacKeys = ALL_ZODIAC_SIGNS.map((z) => `'${sqlEscape(z.key)}'`).join(',');
  const defaultInterestNames = ALL_INTERESTS.map((i) => `'${sqlEscape(i.name)}'`).join(',');

  return `-- ============================================================================
-- 17. TAXONOMY SEED DATA & SYSTEM DEFAULTS
-- ============================================================================

-- 1. Seed All Worldwide Countries
INSERT INTO public.country_configs (code, name, flag, region, is_tier1, enabled) VALUES
${countryValues}
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    flag = EXCLUDED.flag,
    region = EXCLUDED.region,
    is_tier1 = EXCLUDED.is_tier1;

-- 2. Seed All Spoken Languages
INSERT INTO public.language_configs (code, name, native_name, popular, region, enabled) VALUES
${langValues}
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    native_name = EXCLUDED.native_name,
    popular = EXCLUDED.popular,
    region = EXCLUDED.region;

-- 3. Seed All 12 Astrological Zodiac Signs
INSERT INTO public.zodiac_configs (key, name, symbol, date_range, element, enabled) VALUES
${zodiacValues}
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    symbol = EXCLUDED.symbol,
    date_range = EXCLUDED.date_range,
    element = EXCLUDED.element;

-- 4. Seed All Categorized Interests & Passions
INSERT INTO public.interest_configs (id, name, category, icon_name, color, popular, enabled) VALUES
${interestValues}
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    icon_name = EXCLUDED.icon_name,
    color = EXCLUDED.color,
    popular = EXCLUDED.popular;

-- 5. Seed / Update Master System Configs
INSERT INTO public.system_configs (
    id,
    coin_burn_rate_per_min,
    coin_burn_rate_friend_per_min,
    female_earning_rate_per_min,
    female_host_share_percent,
    team_leader_share_percent,
    gift_female_host_share_percent,
    gift_team_leader_share_percent,
    enable_virtual_gifts,
    coin_to_usd_ratio,
    female_payout_ratio_usd,
    min_payout_threshold_usd,
    allowed_country_codes,
    allowed_languages,
    allowed_zodiac_signs,
    allowed_interests,
    flag_sizes_json
)
VALUES (
    'default',
    120,
    80,
    48,
    40,
    10,
    70,
    10,
    true,
    0.01,
    0.008,
    50,
    ARRAY[${defaultCountryCodes}],
    ARRAY[${defaultLanguageNames}],
    ARRAY[${defaultZodiacKeys}],
    ARRAY[${defaultInterestNames}],
    '{"xs":14,"sm":18,"card":18,"md":22,"lg":27,"admin":27,"xl":36,"2xl":48}'
)
ON CONFLICT (id) DO UPDATE SET
    allowed_country_codes = EXCLUDED.allowed_country_codes,
    allowed_languages = EXCLUDED.allowed_languages,
    allowed_zodiac_signs = EXCLUDED.allowed_zodiac_signs,
    allowed_interests = EXCLUDED.allowed_interests,
    flag_sizes_json = EXCLUDED.flag_sizes_json,
    updated_at = now();
`;
}

/**
 * Builds the complete Master PostgreSQL Schema DDL + RLS + Triggers + Seed Data
 */
export function getMasterSchemaSql(): string {
  const seedSql = generateTaxonomySeedSql();

  return `-- ============================================================================
-- LIVECALL DATING & MONETIZATION ECOSYSTEM - SUPABASE POSTGRESQL SCHEMA
-- Version: 3.2 (Production Master Schema - 100% Idempotent)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PROFILES TABLE (Core user accounts, creators, hosts, callers & admins)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    gender TEXT NOT NULL DEFAULT 'male' CHECK (gender IN ('male', 'female', 'other')),
    gender_locked BOOLEAN NOT NULL DEFAULT true,
    age INT DEFAULT 21 CHECK (age >= 18),
    dob DATE DEFAULT '2000-01-01',
    nationality TEXT DEFAULT 'United States',
    country_code VARCHAR(8) DEFAULT 'US',
    bio TEXT DEFAULT '',
    extended_bio TEXT,
    location_city TEXT,
    zodiac TEXT,
    interests TEXT[] DEFAULT '{}',
    interested_in TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    spoken_languages TEXT[] DEFAULT '{"English"}',
    avatar_url TEXT DEFAULT 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=400',
    gallery TEXT[] DEFAULT '{}',
    intro_video_url TEXT,
    verification_video_url TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    is_onboarded BOOLEAN NOT NULL DEFAULT true,
    agreed_to_terms BOOLEAN NOT NULL DEFAULT true,
    agreed_to_adult_terms BOOLEAN NOT NULL DEFAULT false,
    agreed_to_host_terms BOOLEAN NOT NULL DEFAULT false,
    kyc_status TEXT NOT NULL DEFAULT 'unsubmitted' CHECK (kyc_status IN ('unsubmitted', 'pending', 'verified', 'rejected')),
    kyc_documents JSONB,
    online_status TEXT NOT NULL DEFAULT 'online' CHECK (online_status IN ('online', 'busy', 'offline', 'in_call')),
    role TEXT NOT NULL DEFAULT 'male_user' CHECK (role IN ('male_user', 'female_creator', 'female_host', 'other_user', 'admin', 'team_leader', 'agency_manager')),
    coin_balance BIGINT NOT NULL DEFAULT 50,
    vip_tier TEXT NOT NULL DEFAULT 'none' CHECK (vip_tier IN ('none', 'bronze', 'silver', 'gold', 'diamond')),
    hourly_coin_rate INT NOT NULL DEFAULT 10,
    earnings_coins BIGINT NOT NULL DEFAULT 0,
    total_lifetime_earned_usd NUMERIC NOT NULL DEFAULT 0,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    allow_mock_location BOOLEAN DEFAULT false,
    is_using_mock_location BOOLEAN DEFAULT false,
    mock_location_city TEXT,
    mock_location_country TEXT,
    total_calls_hosted INT DEFAULT 0,
    total_call_minutes INT DEFAULT 0,
    total_gifts_received_count INT DEFAULT 0,
    rating_score NUMERIC DEFAULT 5.0,
    total_reviews_count INT DEFAULT 0,
    acceptance_rate_percent NUMERIC DEFAULT 100,
    is_banned BOOLEAN NOT NULL DEFAULT false,
    ban_reason TEXT,
    banned_until TIMESTAMPTZ,
    banned_by_id TEXT,
    banned_by_role TEXT,
    team_leader_id TEXT,
    created_by_id TEXT,
    agency_name TEXT,
    coin_earn_override_rate INT DEFAULT 8,
    commission_percent NUMERIC DEFAULT 15,
    team_leader_note TEXT,
    password_hash TEXT,
    has_password_set BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure all updated columns exist if table was previously created
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS interested_in TEXT[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS intro_video_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_onboarded BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agreed_to_terms BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agreed_to_adult_terms BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agreed_to_host_terms BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'unsubmitted';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_documents JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_by_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_by_role TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team_leader_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_by_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agency_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coin_earn_override_rate INT DEFAULT 8;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS commission_percent NUMERIC DEFAULT 15;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team_leader_note TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_password_set BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON public.profiles(role, online_status);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_geo ON public.profiles(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_profiles_team_leader ON public.profiles(team_leader_id);
CREATE INDEX IF NOT EXISTS idx_profiles_agency ON public.profiles(agency_name);

-- ============================================================================
-- 2. MATCHES TABLE (Real-time Video & Discovery pairings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_b_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'matched', 'rejected', 'unmatched')) DEFAULT 'pending',
    initiated_by TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    matched_at TIMESTAMPTZ,
    last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_match_pair UNIQUE (user_a_id, user_b_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_users ON public.matches(user_a_id, user_b_id);

-- ============================================================================
-- 3. MESSAGES TABLE (Real-time chats, auto-translations, media & virtual gifts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
    sender_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    text TEXT,
    original_language TEXT DEFAULT 'en',
    translated_text TEXT,
    target_language TEXT,
    media_url TEXT,
    media_type TEXT,
    media_storage_key TEXT,
    type TEXT NOT NULL CHECK (type IN ('text', 'image', 'video', 'voice', 'gift', 'friend_request')) DEFAULT 'text',
    gift_info JSONB,
    friend_request_info JSONB,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(sender_id, receiver_id, created_at DESC);

-- ============================================================================
-- 4. CALL LOGS TABLE (1-on-1 WebRTC & LiveKit billed sessions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.call_logs (
    id TEXT PRIMARY KEY,
    caller_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    host_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    caller_name TEXT,
    host_name TEXT,
    duration_seconds INT NOT NULL DEFAULT 0,
    coins_spent INT NOT NULL DEFAULT 0,
    coins_earned INT NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT now(),
    start_time TIMESTAMPTZ DEFAULT now(),
    ended_at TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    end_reason TEXT DEFAULT 'completed',
    status TEXT DEFAULT 'completed',
    was_friend_call BOOLEAN DEFAULT false,
    burn_rate_per_min INT DEFAULT 120,
    earning_rate_per_min INT DEFAULT 48,
    team_leader_id TEXT,
    team_leader_earned_coins INT DEFAULT 0,
    team_leader_commission_percent NUMERIC DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure all updated columns exist if table was previously created
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS caller_id TEXT;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS host_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS receiver_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS caller_name TEXT;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS host_name TEXT;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS duration_seconds INT DEFAULT 0;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS coins_spent INT DEFAULT 0;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS coins_earned INT DEFAULT 0;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS end_reason TEXT DEFAULT 'completed';
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS was_friend_call BOOLEAN DEFAULT false;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS burn_rate_per_min INT DEFAULT 120;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS earning_rate_per_min INT DEFAULT 48;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS team_leader_id TEXT;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS team_leader_earned_coins INT DEFAULT 0;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS team_leader_commission_percent NUMERIC DEFAULT 10;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_call_logs_caller ON public.call_logs(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_host ON public.call_logs(host_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_team_leader ON public.call_logs(team_leader_id);

-- ============================================================================
-- 5. FRIEND REQUESTS TABLE (Followers, friendships & mutual discounts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.friend_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')) DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at TIMESTAMPTZ,
    CONSTRAINT unique_friend_request UNIQUE (sender_id, receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_users ON public.friend_requests(sender_id, receiver_id, status);

-- ============================================================================
-- 6. PAYOUT REQUESTS TABLE (Creator & Agency earnings withdrawals)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount_coins BIGINT NOT NULL,
    amount_usd NUMERIC NOT NULL,
    payout_method TEXT NOT NULL CHECK (payout_method IN ('paypal', 'bank_wire', 'crypto_usdt', 'stripe')),
    payout_details JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'processing', 'completed')) DEFAULT 'pending',
    admin_notes TEXT,
    kyc_verified BOOLEAN NOT NULL DEFAULT false,
    team_leader_id TEXT,
    team_leader_name TEXT,
    request_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payout_requests ADD COLUMN IF NOT EXISTS team_leader_id TEXT;
ALTER TABLE public.payout_requests ADD COLUMN IF NOT EXISTS team_leader_name TEXT;

CREATE INDEX IF NOT EXISTS idx_payout_requests_user ON public.payout_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_team_leader ON public.payout_requests(team_leader_id);

-- ============================================================================
-- 7. TAXONOMY CONFIGURATIONS TABLES (Countries, Languages, Zodiac Signs, Interests)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.country_configs (
    code VARCHAR(8) PRIMARY KEY,
    name TEXT NOT NULL,
    flag TEXT NOT NULL DEFAULT '🌍',
    region TEXT NOT NULL DEFAULT 'Worldwide',
    is_tier1 BOOLEAN NOT NULL DEFAULT false,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.country_configs ADD COLUMN IF NOT EXISTS is_tier1 BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS public.language_configs (
    code VARCHAR(16) PRIMARY KEY,
    name TEXT NOT NULL,
    native_name TEXT NOT NULL,
    popular BOOLEAN NOT NULL DEFAULT false,
    region TEXT DEFAULT 'Global',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.zodiac_configs (
    key VARCHAR(32) PRIMARY KEY,
    name TEXT NOT NULL,
    symbol VARCHAR(8) NOT NULL,
    date_range TEXT NOT NULL,
    element TEXT NOT NULL DEFAULT 'fire',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.interest_configs (
    id VARCHAR(64) PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'lifestyle',
    icon_name TEXT,
    color TEXT,
    popular BOOLEAN DEFAULT false,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 8. SYSTEM CONFIGS TABLE (Global economy rates, R2, SMTP, AI moderation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.system_configs (
    id TEXT PRIMARY KEY DEFAULT 'default',
    coin_burn_rate_per_min INT DEFAULT 120,
    coin_burn_rate_friend_per_min INT DEFAULT 80,
    female_earning_rate_per_min INT DEFAULT 48,
    female_host_share_percent NUMERIC DEFAULT 40,
    team_leader_share_percent NUMERIC DEFAULT 10,
    gift_female_host_share_percent NUMERIC DEFAULT 70,
    gift_team_leader_share_percent NUMERIC DEFAULT 10,
    enable_virtual_gifts BOOLEAN DEFAULT true,
    virtual_gifts_json TEXT DEFAULT '',
    allowed_country_codes TEXT[] DEFAULT '{}',
    allowed_languages TEXT[] DEFAULT '{}',
    allowed_zodiac_signs TEXT[] DEFAULT '{}',
    allowed_interests TEXT[] DEFAULT '{}',
    flag_sizes_json TEXT DEFAULT '',
    show_dev_persona_bar BOOLEAN DEFAULT true,
    enable_regular_female_coin_earning BOOLEAN DEFAULT false,
    coin_to_usd_ratio NUMERIC DEFAULT 0.01,
    female_payout_ratio_usd NUMERIC DEFAULT 0.008,
    min_payout_threshold_usd INT DEFAULT 50,
    r2_bucket_name TEXT DEFAULT 'datingappbucket',
    r2_max_image_size_mb INT DEFAULT 15,
    r2_max_video_size_mb INT DEFAULT 100,
    r2_allowed_mime_types TEXT[] DEFAULT '{"image/jpeg","image/png","image/webp","video/mp4"}',
    r2_cdn_cache_ttl_seconds INT DEFAULT 86400,
    smtp_host TEXT DEFAULT '',
    smtp_port INT DEFAULT 587,
    smtp_user TEXT DEFAULT '',
    smtp_pass TEXT DEFAULT '',
    smtp_from TEXT DEFAULT '',
    smtp_show_otp BOOLEAN DEFAULT true,
    resend_api_key TEXT DEFAULT '',
    auto_moderation_sensitivity TEXT DEFAULT 'medium',
    nsfw_filter_enabled BOOLEAN DEFAULT true,
    ai_nudity_shield_enabled BOOLEAN DEFAULT true,
    screen_recording_protection BOOLEAN DEFAULT true,
    banned_keywords TEXT[] DEFAULT '{"scam","wire transfer","bank password","abuse"}',
    abuse_report_auto_suspend_threshold INT DEFAULT 5,
    db_max_pool_size INT DEFAULT 50,
    db_idle_timeout_seconds INT DEFAULT 30,
    db_statement_timeout_ms INT DEFAULT 5000,
    db_query_caching_enabled BOOLEAN DEFAULT true,
    feature_realtime_chat_enabled BOOLEAN DEFAULT true,
    feature_r2_direct_upload_enabled BOOLEAN DEFAULT true,
    feature_video_calling_enabled BOOLEAN DEFAULT true,
    feature_geo_discovery_enabled BOOLEAN DEFAULT true,
    feature_maintenance_mode BOOLEAN DEFAULT false,
    daily_streak_rewards_json TEXT DEFAULT '[10,15,20,25,35,50,100]',
    daily_missions_config_json TEXT DEFAULT '{"chat_friends":{"target":3,"reward":25},"quick_matches":{"target":10,"reward":30},"video_call_min":{"target":60,"reward":35},"moment_interactions":{"target":3,"reward":15},"send_gift":{"target":1,"reward":20},"master_chest":{"target":4,"reward":50}}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS allowed_languages TEXT[] DEFAULT '{}';
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS allowed_zodiac_signs TEXT[] DEFAULT '{}';
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS allowed_interests TEXT[] DEFAULT '{}';
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS flag_sizes_json TEXT DEFAULT '';
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS daily_streak_rewards_json TEXT DEFAULT '[10,15,20,25,35,50,100]';
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS daily_missions_config_json TEXT DEFAULT '{"chat_friends":{"target":3,"reward":25},"quick_matches":{"target":10,"reward":30},"video_call_min":{"target":60,"reward":35},"moment_interactions":{"target":3,"reward":15},"send_gift":{"target":1,"reward":20},"master_chest":{"target":4,"reward":50}}';
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS creator_target_cycle TEXT DEFAULT 'weekly';
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS creator_target_bronze_hours NUMERIC DEFAULT 20;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS creator_target_bronze_coins BIGINT DEFAULT 5000;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS creator_target_bronze_bonus_usd NUMERIC DEFAULT 15;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS creator_target_silver_hours NUMERIC DEFAULT 40;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS creator_target_silver_coins BIGINT DEFAULT 20000;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS creator_target_silver_bonus_usd NUMERIC DEFAULT 50;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS creator_target_gold_hours NUMERIC DEFAULT 60;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS creator_target_gold_coins BIGINT DEFAULT 60000;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS creator_target_gold_bonus_usd NUMERIC DEFAULT 150;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS peak_hours_start TEXT DEFAULT '18:00';
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS peak_hours_end TEXT DEFAULT '00:00';
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS peak_hours_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS call_ring_timeout_seconds INT DEFAULT 30;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS daily_first_call_bonus_coins INT DEFAULT 100;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS daily_first_call_bonus_usd NUMERIC DEFAULT 1.00;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS daily_first_call_min_duration_sec INT DEFAULT 30;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS streak_target_days INT DEFAULT 7;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS streak_boost_duration_days INT DEFAULT 3;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS min_daily_active_hours_for_streak NUMERIC DEFAULT 2.0;

-- ============================================================================
-- 9. MODERATION REPORTS TABLE (User incident telemetry & live QA evidence)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.moderation_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reported_user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    details TEXT,
    evidence_snapshot_url TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'investigating', 'action_taken', 'dismissed')) DEFAULT 'pending',
    action_taken TEXT,
    admin_notes TEXT,
    resolved_by TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 10. CMS POLICIES & HOME CMS TABLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cms_policies (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'safety',
    icon TEXT DEFAULT 'ShieldCheck',
    summary TEXT,
    content TEXT NOT NULL,
    order_num INT DEFAULT 0,
    is_featured BOOLEAN DEFAULT true,
    external_url TEXT,
    effective_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.home_banners (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    badge TEXT,
    image_url TEXT,
    action_type TEXT DEFAULT 'tab',
    action_target TEXT DEFAULT 'coins',
    bg_gradient TEXT DEFAULT 'from-indigo-950/90 via-purple-950/70 to-slate-900/90',
    order_num INT DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.home_quick_links (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    icon TEXT DEFAULT 'Zap',
    badge TEXT,
    action_type TEXT DEFAULT 'tab',
    action_target TEXT DEFAULT 'discovery',
    color_gradient TEXT DEFAULT 'from-indigo-500 to-purple-600',
    order_num INT DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 11. FEED POSTS & CREATOR MOMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.feed_posts (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    creator_name TEXT NOT NULL,
    creator_avatar TEXT,
    media_url TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')) DEFAULT 'image',
    caption TEXT DEFAULT '',
    likes INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feed_posts_creator ON public.feed_posts(creator_id, created_at DESC);

-- ============================================================================
-- 12. COIN PACKAGES & STORE SKUS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.coin_packages (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    coins INT NOT NULL,
    bonus_coins INT DEFAULT 0,
    price_usd NUMERIC NOT NULL,
    badge_tag TEXT,
    popular BOOLEAN DEFAULT false,
    order_num INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 13. FAVORITES, BLOCKED USERS & CREATOR GOALS TABLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.favorites (
    user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    favorite_user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, favorite_user_id)
);

CREATE TABLE IF NOT EXISTS public.blocked_users (
    user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, blocked_user_id)
);

CREATE TABLE IF NOT EXISTS public.creator_goals (
    creator_id TEXT PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    current_coins INT DEFAULT 0,
    target_coins INT NOT NULL DEFAULT 10000,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 14. USER DAILY REWARDS & ACTIVITY QUESTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_daily_rewards (
    user_id TEXT PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_login_date DATE NOT NULL DEFAULT CURRENT_DATE,
    streak_count INT NOT NULL DEFAULT 1,
    streak_claimed_date DATE,
    tasks_date DATE NOT NULL DEFAULT CURRENT_DATE,
    task_chat_friends TEXT[] NOT NULL DEFAULT '{}',
    task_chat_claimed BOOLEAN NOT NULL DEFAULT false,
    task_quick_matches INT NOT NULL DEFAULT 0,
    task_quick_match_claimed BOOLEAN NOT NULL DEFAULT false,
    task_video_call_seconds INT NOT NULL DEFAULT 0,
    task_video_call_claimed BOOLEAN NOT NULL DEFAULT false,
    task_moment_interactions INT NOT NULL DEFAULT 0,
    task_moment_claimed BOOLEAN NOT NULL DEFAULT false,
    task_gift_count INT NOT NULL DEFAULT 0,
    task_gift_claimed BOOLEAN NOT NULL DEFAULT false,
    master_chest_claimed BOOLEAN NOT NULL DEFAULT false,
    total_coins_earned BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS last_login_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS streak_count INT DEFAULT 1;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS streak_claimed_date DATE;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS tasks_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS task_chat_friends TEXT[] DEFAULT '{}';
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS task_chat_claimed BOOLEAN DEFAULT false;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS task_quick_matches INT DEFAULT 0;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS task_quick_match_claimed BOOLEAN DEFAULT false;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS task_video_call_seconds INT DEFAULT 0;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS task_video_call_claimed BOOLEAN DEFAULT false;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS task_moment_interactions INT DEFAULT 0;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS task_moment_claimed BOOLEAN DEFAULT false;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS task_gift_count INT DEFAULT 0;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS task_gift_claimed BOOLEAN DEFAULT false;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS master_chest_claimed BOOLEAN DEFAULT false;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS total_coins_earned BIGINT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_user_daily_rewards_user ON public.user_daily_rewards(user_id);

-- ============================================================================
-- 15. ROW LEVEL SECURITY (RLS) POLICIES (Full Public & Authenticated Access)
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.language_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zodiac_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interest_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_quick_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_daily_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access to profiles" ON public.profiles;
CREATE POLICY "Public full access to profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to matches" ON public.matches;
CREATE POLICY "Public full access to matches" ON public.matches FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to messages" ON public.messages;
CREATE POLICY "Public full access to messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to call_logs" ON public.call_logs;
CREATE POLICY "Public full access to call_logs" ON public.call_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to friend_requests" ON public.friend_requests;
CREATE POLICY "Public full access to friend_requests" ON public.friend_requests FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to payout_requests" ON public.payout_requests;
CREATE POLICY "Public full access to payout_requests" ON public.payout_requests FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to country_configs" ON public.country_configs;
CREATE POLICY "Public full access to country_configs" ON public.country_configs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to language_configs" ON public.language_configs;
CREATE POLICY "Public full access to language_configs" ON public.language_configs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to zodiac_configs" ON public.zodiac_configs;
CREATE POLICY "Public full access to zodiac_configs" ON public.zodiac_configs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to interest_configs" ON public.interest_configs;
CREATE POLICY "Public full access to interest_configs" ON public.interest_configs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to system_configs" ON public.system_configs;
CREATE POLICY "Public full access to system_configs" ON public.system_configs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to moderation_reports" ON public.moderation_reports;
CREATE POLICY "Public full access to moderation_reports" ON public.moderation_reports FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to cms_policies" ON public.cms_policies;
CREATE POLICY "Public full access to cms_policies" ON public.cms_policies FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to home_banners" ON public.home_banners;
CREATE POLICY "Public full access to home_banners" ON public.home_banners FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to home_quick_links" ON public.home_quick_links;
CREATE POLICY "Public full access to home_quick_links" ON public.home_quick_links FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to feed_posts" ON public.feed_posts;
CREATE POLICY "Public full access to feed_posts" ON public.feed_posts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to coin_packages" ON public.coin_packages;
CREATE POLICY "Public full access to coin_packages" ON public.coin_packages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to favorites" ON public.favorites;
CREATE POLICY "Public full access to favorites" ON public.favorites FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to blocked_users" ON public.blocked_users;
CREATE POLICY "Public full access to blocked_users" ON public.blocked_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to creator_goals" ON public.creator_goals;
CREATE POLICY "Public full access to creator_goals" ON public.creator_goals FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to user_daily_rewards" ON public.user_daily_rewards;
CREATE POLICY "Public full access to user_daily_rewards" ON public.user_daily_rewards FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 16. AUTOMATED AUTH TRIGGER (Sync auth.users with public.profiles)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        auth_id,
        name,
        email,
        gender,
        gender_locked,
        role,
        coin_balance,
        hourly_coin_rate,
        is_onboarded,
        is_verified,
        online_status
    )
    VALUES (
        NEW.id::TEXT,
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'New Member'),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'gender', 'male'),
        true,
        COALESCE(NEW.raw_user_meta_data->>'role', 'male_user'),
        CASE WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'male_user') = 'male_user' THEN 50 ELSE 0 END,
        CASE WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'male_user') = 'female_creator' THEN 10 ELSE 0 END,
        false,
        false,
        'online'
    )
    ON CONFLICT (id) DO UPDATE SET
        auth_id = EXCLUDED.auth_id,
        email = EXCLUDED.email,
        updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================================
-- 16. REALTIME PUBLICATION SETUP (Idempotent - checks pg_publication_tables)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'profiles') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'matches') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'call_logs') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.call_logs;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'friend_requests') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'feed_posts') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_posts;
    END IF;
END $$;

${seedSql}
`;
}

/**
 * Builds the incremental non-destructive migration SQL for existing production DBs
 */
export function getMigrationSchemaSql(): string {
  const seedSql = generateTaxonomySeedSql();

  return `-- ============================================================================
-- LIVECALL DATING ECOSYSTEM - INCREMENTAL PRODUCTION MIGRATION
-- Safe & Non-Destructive Update for Existing Supabase Databases
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. UPDATE PROFILES TABLE
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS interested_in TEXT[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS intro_video_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_onboarded BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agreed_to_terms BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agreed_to_adult_terms BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agreed_to_host_terms BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'unsubmitted';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_documents JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_by_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_by_role TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team_leader_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_by_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agency_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coin_earn_override_rate INT DEFAULT 8;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS commission_percent NUMERIC DEFAULT 15;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team_leader_note TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_password_set BOOLEAN DEFAULT false;

-- 3. UPDATE CALL LOGS TABLE
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS caller_id TEXT;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS host_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS receiver_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS caller_name TEXT;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS host_name TEXT;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS duration_seconds INT DEFAULT 0;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS coins_spent INT DEFAULT 0;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS coins_earned INT DEFAULT 0;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS end_reason TEXT DEFAULT 'completed';
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS was_friend_call BOOLEAN DEFAULT false;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS burn_rate_per_min INT DEFAULT 120;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS earning_rate_per_min INT DEFAULT 48;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS team_leader_id TEXT;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS team_leader_earned_coins INT DEFAULT 0;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS team_leader_commission_percent NUMERIC DEFAULT 10;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_call_logs_caller ON public.call_logs(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_host ON public.call_logs(host_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_team_leader ON public.call_logs(team_leader_id);

-- 4. UPDATE PAYOUT REQUESTS TABLE
ALTER TABLE public.payout_requests ADD COLUMN IF NOT EXISTS team_leader_id TEXT;
ALTER TABLE public.payout_requests ADD COLUMN IF NOT EXISTS team_leader_name TEXT;
CREATE INDEX IF NOT EXISTS idx_payout_requests_team_leader ON public.payout_requests(team_leader_id);

-- 5. UPDATE SYSTEM CONFIGS TABLE
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS smtp_show_otp BOOLEAN DEFAULT true;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS resend_api_key TEXT DEFAULT '';
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS ai_nudity_shield_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS screen_recording_protection BOOLEAN DEFAULT true;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS coin_burn_rate_friend_per_min INT DEFAULT 80;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS enable_regular_female_coin_earning BOOLEAN DEFAULT false;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS feature_maintenance_mode BOOLEAN DEFAULT false;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS female_host_share_percent NUMERIC DEFAULT 40;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS team_leader_share_percent NUMERIC DEFAULT 10;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS gift_female_host_share_percent NUMERIC DEFAULT 70;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS gift_team_leader_share_percent NUMERIC DEFAULT 10;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS enable_virtual_gifts BOOLEAN DEFAULT true;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS virtual_gifts_json TEXT DEFAULT '';
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS allowed_country_codes TEXT[] DEFAULT '{}';
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS allowed_languages TEXT[] DEFAULT '{}';
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS allowed_zodiac_signs TEXT[] DEFAULT '{}';
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS allowed_interests TEXT[] DEFAULT '{}';
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS flag_sizes_json TEXT DEFAULT '';
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS show_dev_persona_bar BOOLEAN DEFAULT true;
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS daily_streak_rewards_json TEXT DEFAULT '[10,15,20,25,35,50,100]';
ALTER TABLE public.system_configs ADD COLUMN IF NOT EXISTS daily_missions_config_json TEXT DEFAULT '{"chat_friends":{"target":3,"reward":25},"quick_matches":{"target":10,"reward":30},"video_call_min":{"target":60,"reward":35},"moment_interactions":{"target":3,"reward":15},"send_gift":{"target":1,"reward":20},"master_chest":{"target":4,"reward":50}}';

-- 6. ENSURE ALL TAXONOMY & CMS TABLES EXIST
CREATE TABLE IF NOT EXISTS public.country_configs (
    code VARCHAR(8) PRIMARY KEY,
    name TEXT NOT NULL,
    flag TEXT NOT NULL DEFAULT '🌍',
    region TEXT NOT NULL DEFAULT 'Worldwide',
    is_tier1 BOOLEAN NOT NULL DEFAULT false,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.country_configs ADD COLUMN IF NOT EXISTS is_tier1 BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS public.language_configs (
    code VARCHAR(16) PRIMARY KEY,
    name TEXT NOT NULL,
    native_name TEXT NOT NULL,
    popular BOOLEAN NOT NULL DEFAULT false,
    region TEXT DEFAULT 'Global',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.zodiac_configs (
    key VARCHAR(32) PRIMARY KEY,
    name TEXT NOT NULL,
    symbol VARCHAR(8) NOT NULL,
    date_range TEXT NOT NULL,
    element TEXT NOT NULL DEFAULT 'fire',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.interest_configs (
    id VARCHAR(64) PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'lifestyle',
    icon_name TEXT,
    color TEXT,
    popular BOOLEAN DEFAULT false,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cms_policies (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'safety',
    icon TEXT DEFAULT 'ShieldCheck',
    summary TEXT,
    content TEXT NOT NULL,
    order_num INT DEFAULT 0,
    is_featured BOOLEAN DEFAULT true,
    external_url TEXT,
    effective_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.home_banners (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    badge TEXT,
    image_url TEXT,
    action_type TEXT DEFAULT 'tab',
    action_target TEXT DEFAULT 'coins',
    bg_gradient TEXT DEFAULT 'from-indigo-950/90 via-purple-950/70 to-slate-900/90',
    order_num INT DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.home_quick_links (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    icon TEXT DEFAULT 'Zap',
    badge TEXT,
    action_type TEXT DEFAULT 'tab',
    action_target TEXT DEFAULT 'discovery',
    color_gradient TEXT DEFAULT 'from-indigo-500 to-purple-600',
    order_num INT DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_daily_rewards (
    user_id TEXT PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_login_date DATE NOT NULL DEFAULT CURRENT_DATE,
    streak_count INT NOT NULL DEFAULT 1,
    streak_claimed_date DATE,
    tasks_date DATE NOT NULL DEFAULT CURRENT_DATE,
    task_chat_friends TEXT[] NOT NULL DEFAULT '{}',
    task_chat_claimed BOOLEAN NOT NULL DEFAULT false,
    task_quick_matches INT NOT NULL DEFAULT 0,
    task_quick_match_claimed BOOLEAN NOT NULL DEFAULT false,
    task_video_call_seconds INT NOT NULL DEFAULT 0,
    task_video_call_claimed BOOLEAN NOT NULL DEFAULT false,
    task_moment_interactions INT NOT NULL DEFAULT 0,
    task_moment_claimed BOOLEAN NOT NULL DEFAULT false,
    task_gift_count INT NOT NULL DEFAULT 0,
    task_gift_claimed BOOLEAN NOT NULL DEFAULT false,
    master_chest_claimed BOOLEAN NOT NULL DEFAULT false,
    total_coins_earned BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS last_login_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS streak_count INT DEFAULT 1;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS streak_claimed_date DATE;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS tasks_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS task_chat_friends TEXT[] DEFAULT '{}';
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS task_chat_claimed BOOLEAN DEFAULT false;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS task_quick_matches INT DEFAULT 0;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS task_quick_match_claimed BOOLEAN DEFAULT false;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS task_video_call_seconds INT DEFAULT 0;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS task_video_call_claimed BOOLEAN DEFAULT false;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS task_moment_interactions INT DEFAULT 0;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS task_moment_claimed BOOLEAN DEFAULT false;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS task_gift_count INT DEFAULT 0;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS task_gift_claimed BOOLEAN DEFAULT false;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS master_chest_claimed BOOLEAN DEFAULT false;
ALTER TABLE public.user_daily_rewards ADD COLUMN IF NOT EXISTS total_coins_earned BIGINT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_user_daily_rewards_user ON public.user_daily_rewards(user_id);

-- 7. RE-APPLY RLS POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.language_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zodiac_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interest_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_quick_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_daily_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access to profiles" ON public.profiles;
CREATE POLICY "Public full access to profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to payout_requests" ON public.payout_requests;
CREATE POLICY "Public full access to payout_requests" ON public.payout_requests FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to country_configs" ON public.country_configs;
CREATE POLICY "Public full access to country_configs" ON public.country_configs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to language_configs" ON public.language_configs;
CREATE POLICY "Public full access to language_configs" ON public.language_configs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to zodiac_configs" ON public.zodiac_configs;
CREATE POLICY "Public full access to zodiac_configs" ON public.zodiac_configs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to interest_configs" ON public.interest_configs;
CREATE POLICY "Public full access to interest_configs" ON public.interest_configs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to system_configs" ON public.system_configs;
CREATE POLICY "Public full access to system_configs" ON public.system_configs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to user_daily_rewards" ON public.user_daily_rewards;
CREATE POLICY "Public full access to user_daily_rewards" ON public.user_daily_rewards FOR ALL USING (true) WITH CHECK (true);

-- 8. REALTIME REPLICATION RE-CHECK
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'profiles') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'payout_requests') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.payout_requests;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_daily_rewards') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_daily_rewards;
    END IF;
END $$;

${seedSql}
`;
}
