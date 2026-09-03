-- ============================================================================
-- LIVECALL DATING & MONETIZATION ECOSYSTEM - SUPABASE POSTGRESQL SCHEMA
-- Version: 3.2 (Production Master Schema - 100% Idempotent)
-- CANONICAL SOURCE OF TRUTH — do not maintain parallel schema copies.
-- Served by GET /api/admin/schema via server/schemaLoader.ts
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
    role TEXT NOT NULL DEFAULT 'male_user' CHECK (role IN ('male_user', 'female_user', 'female_creator', 'female_host', 'other_user', 'admin', 'team_leader', 'agency_manager')),
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

-- Allow female_user alongside female_creator (idempotent for existing DBs)
DO $$
BEGIN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_role_check
        CHECK (role IN ('male_user', 'female_user', 'female_creator', 'female_host', 'other_user', 'admin', 'team_leader', 'agency_manager'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

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
CREATE INDEX IF NOT EXISTS idx_messages_unread ON public.messages(receiver_id, is_read) WHERE is_read = false;

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
CREATE INDEX IF NOT EXISTS idx_call_logs_participants ON public.call_logs(caller_id, receiver_id, created_at DESC);

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
    creator_target_cycle TEXT DEFAULT 'weekly',
    creator_target_bronze_hours NUMERIC DEFAULT 20,
    creator_target_bronze_coins BIGINT DEFAULT 5000,
    creator_target_bronze_bonus_usd NUMERIC DEFAULT 15,
    creator_target_silver_hours NUMERIC DEFAULT 40,
    creator_target_silver_coins BIGINT DEFAULT 20000,
    creator_target_silver_bonus_usd NUMERIC DEFAULT 50,
    creator_target_gold_hours NUMERIC DEFAULT 60,
    creator_target_gold_coins BIGINT DEFAULT 60000,
    creator_target_gold_bonus_usd NUMERIC DEFAULT 150,
    peak_hours_start TEXT DEFAULT '18:00',
    peak_hours_end TEXT DEFAULT '00:00',
    peak_hours_enabled BOOLEAN DEFAULT true,
    call_ring_timeout_seconds INT DEFAULT 30,
    daily_first_call_bonus_coins INT DEFAULT 100,
    daily_first_call_bonus_usd NUMERIC DEFAULT 1.00,
    daily_first_call_min_duration_sec INT DEFAULT 30,
    streak_target_days INT DEFAULT 7,
    streak_boost_duration_days INT DEFAULT 3,
    min_daily_active_hours_for_streak NUMERIC DEFAULT 2.0,
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

-- Replace permissive "Public full access" policies with command-specific policies.
-- Goal: prevent destructive DELETE operations from being executed by non-admin clients.
-- SELECT remains public for discovery. INSERT/UPDATE remain authenticated-only to reduce anonymous abuse.
-- DELETE is restricted:
--   - admin-only for most tables
--   - owner-or-admin for favorites & blocked_users

-- Shared admin predicate used in multiple DELETE policies
-- (admin@livecall.app is also checked for environments where profiles.role may drift)
--
-- NOTE: RLS policies cannot define variables; we inline the predicate.

DROP POLICY IF EXISTS "Public full access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public full access to matches" ON public.matches;
DROP POLICY IF EXISTS "Public full access to messages" ON public.messages;
DROP POLICY IF EXISTS "Public full access to call_logs" ON public.call_logs;
DROP POLICY IF EXISTS "Public full access to friend_requests" ON public.friend_requests;
DROP POLICY IF EXISTS "Public full access to payout_requests" ON public.payout_requests;
DROP POLICY IF EXISTS "Public full access to country_configs" ON public.country_configs;
DROP POLICY IF EXISTS "Public full access to language_configs" ON public.language_configs;
DROP POLICY IF EXISTS "Public full access to zodiac_configs" ON public.zodiac_configs;
DROP POLICY IF EXISTS "Public full access to interest_configs" ON public.interest_configs;
DROP POLICY IF EXISTS "Public full access to system_configs" ON public.system_configs;
DROP POLICY IF EXISTS "Public full access to moderation_reports" ON public.moderation_reports;
DROP POLICY IF EXISTS "Public full access to cms_policies" ON public.cms_policies;
DROP POLICY IF EXISTS "Public full access to home_banners" ON public.home_banners;
DROP POLICY IF EXISTS "Public full access to home_quick_links" ON public.home_quick_links;
DROP POLICY IF EXISTS "Public full access to feed_posts" ON public.feed_posts;
DROP POLICY IF EXISTS "Public full access to coin_packages" ON public.coin_packages;
DROP POLICY IF EXISTS "Public full access to favorites" ON public.favorites;
DROP POLICY IF EXISTS "Public full access to blocked_users" ON public.blocked_users;
DROP POLICY IF EXISTS "Public full access to creator_goals" ON public.creator_goals;
DROP POLICY IF EXISTS "Public full access to user_daily_rewards" ON public.user_daily_rewards;

-- PROFILES
CREATE POLICY "public select profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "authenticated insert profiles" ON public.profiles FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update profiles" ON public.profiles FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin delete profiles" ON public.profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.role = 'admin'
        AND (
          p.auth_id = auth.uid()
          OR p.id = auth.uid()::text
          OR (p.email IS NOT NULL AND lower(p.email) = 'admin@livecall.app')
        )
    )
  );

-- MATCHES
CREATE POLICY "public select matches" ON public.matches FOR SELECT USING (true);
CREATE POLICY "authenticated insert matches" ON public.matches FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update matches" ON public.matches FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin delete matches" ON public.matches
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.role = 'admin'
        AND (
          p.auth_id = auth.uid()
          OR p.id = auth.uid()::text
          OR (p.email IS NOT NULL AND lower(p.email) = 'admin@livecall.app')
        )
    )
  );

-- MESSAGES
CREATE POLICY "public select messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "authenticated insert messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update messages" ON public.messages FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin delete messages" ON public.messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.role = 'admin'
        AND (
          p.auth_id = auth.uid()
          OR p.id = auth.uid()::text
          OR (p.email IS NOT NULL AND lower(p.email) = 'admin@livecall.app')
        )
    )
  );

-- CALL LOGS
CREATE POLICY "public select call_logs" ON public.call_logs FOR SELECT USING (true);
CREATE POLICY "authenticated insert call_logs" ON public.call_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update call_logs" ON public.call_logs FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin delete call_logs" ON public.call_logs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.role = 'admin'
        AND (
          p.auth_id = auth.uid()
          OR p.id = auth.uid()::text
          OR (p.email IS NOT NULL AND lower(p.email) = 'admin@livecall.app')
        )
    )
  );

-- FRIEND REQUESTS
CREATE POLICY "public select friend_requests" ON public.friend_requests FOR SELECT USING (true);
CREATE POLICY "authenticated insert friend_requests" ON public.friend_requests FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update friend_requests" ON public.friend_requests FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin delete friend_requests" ON public.friend_requests
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.role = 'admin'
        AND (
          p.auth_id = auth.uid()
          OR p.id = auth.uid()::text
          OR (p.email IS NOT NULL AND lower(p.email) = 'admin@livecall.app')
        )
    )
  );

-- PAYOUT REQUESTS
CREATE POLICY "public select payout_requests" ON public.payout_requests FOR SELECT USING (true);
CREATE POLICY "authenticated insert payout_requests" ON public.payout_requests FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update payout_requests" ON public.payout_requests FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin delete payout_requests" ON public.payout_requests
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.role = 'admin'
        AND (
          p.auth_id = auth.uid()
          OR p.id = auth.uid()::text
          OR (p.email IS NOT NULL AND lower(p.email) = 'admin@livecall.app')
        )
    )
  );

-- CONFIG / TAXONOMY TABLES
CREATE POLICY "public select country_configs" ON public.country_configs FOR SELECT USING (true);
CREATE POLICY "authenticated insert country_configs" ON public.country_configs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update country_configs" ON public.country_configs FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin delete country_configs" ON public.country_configs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.role = 'admin'
        AND (
          p.auth_id = auth.uid()
          OR p.id = auth.uid()::text
          OR (p.email IS NOT NULL AND lower(p.email) = 'admin@livecall.app')
        )
    )
  );

CREATE POLICY "public select language_configs" ON public.language_configs FOR SELECT USING (true);
CREATE POLICY "authenticated insert language_configs" ON public.language_configs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update language_configs" ON public.language_configs FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin delete language_configs" ON public.language_configs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.role = 'admin'
        AND (
          p.auth_id = auth.uid()
          OR p.id = auth.uid()::text
          OR (p.email IS NOT NULL AND lower(p.email) = 'admin@livecall.app')
        )
    )
  );

CREATE POLICY "public select zodiac_configs" ON public.zodiac_configs FOR SELECT USING (true);
CREATE POLICY "authenticated insert zodiac_configs" ON public.zodiac_configs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update zodiac_configs" ON public.zodiac_configs FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin delete zodiac_configs" ON public.zodiac_configs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.role = 'admin'
        AND (
          p.auth_id = auth.uid()
          OR p.id = auth.uid()::text
          OR (p.email IS NOT NULL AND lower(p.email) = 'admin@livecall.app')
        )
    )
  );

CREATE POLICY "public select interest_configs" ON public.interest_configs FOR SELECT USING (true);
CREATE POLICY "authenticated insert interest_configs" ON public.interest_configs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update interest_configs" ON public.interest_configs FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin delete interest_configs" ON public.interest_configs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.role = 'admin'
        AND (
          p.auth_id = auth.uid()
          OR p.id = auth.uid()::text
          OR (p.email IS NOT NULL AND lower(p.email) = 'admin@livecall.app')
        )
    )
  );

CREATE POLICY "public select system_configs" ON public.system_configs FOR SELECT USING (true);
CREATE POLICY "authenticated insert system_configs" ON public.system_configs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update system_configs" ON public.system_configs FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin delete system_configs" ON public.system_configs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.role = 'admin'
        AND (
          p.auth_id = auth.uid()
          OR p.id = auth.uid()::text
          OR (p.email IS NOT NULL AND lower(p.email) = 'admin@livecall.app')
        )
    )
  );

CREATE POLICY "public select moderation_reports" ON public.moderation_reports FOR SELECT USING (true);
CREATE POLICY "authenticated insert moderation_reports" ON public.moderation_reports FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update moderation_reports" ON public.moderation_reports FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin delete moderation_reports" ON public.moderation_reports
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.role = 'admin'
        AND (
          p.auth_id = auth.uid()
          OR p.id = auth.uid()::text
          OR (p.email IS NOT NULL AND lower(p.email) = 'admin@livecall.app')
        )
    )
  );

CREATE POLICY "public select cms_policies" ON public.cms_policies FOR SELECT USING (true);
CREATE POLICY "authenticated insert cms_policies" ON public.cms_policies FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update cms_policies" ON public.cms_policies FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin delete cms_policies" ON public.cms_policies
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.role = 'admin'
        AND (
          p.auth_id = auth.uid()
          OR p.id = auth.uid()::text
          OR (p.email IS NOT NULL AND lower(p.email) = 'admin@livecall.app')
        )
    )
  );

CREATE POLICY "public select home_banners" ON public.home_banners FOR SELECT USING (true);
CREATE POLICY "authenticated insert home_banners" ON public.home_banners FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update home_banners" ON public.home_banners FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin delete home_banners" ON public.home_banners
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.role = 'admin'
        AND (
          p.auth_id = auth.uid()
          OR p.id = auth.uid()::text
          OR (p.email IS NOT NULL AND lower(p.email) = 'admin@livecall.app')
        )
    )
  );

CREATE POLICY "public select home_quick_links" ON public.home_quick_links FOR SELECT USING (true);
CREATE POLICY "authenticated insert home_quick_links" ON public.home_quick_links FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update home_quick_links" ON public.home_quick_links FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin delete home_quick_links" ON public.home_quick_links
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.role = 'admin'
        AND (
          p.auth_id = auth.uid()
          OR p.id = auth.uid()::text
          OR (p.email IS NOT NULL AND lower(p.email) = 'admin@livecall.app')
        )
    )
  );

CREATE POLICY "public select feed_posts" ON public.feed_posts FOR SELECT USING (true);
CREATE POLICY "authenticated insert feed_posts" ON public.feed_posts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update feed_posts" ON public.feed_posts FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin delete feed_posts" ON public.feed_posts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.role = 'admin'
        AND (
          p.auth_id = auth.uid()
          OR p.id = auth.uid()::text
          OR (p.email IS NOT NULL AND lower(p.email) = 'admin@livecall.app')
        )
    )
  );

CREATE POLICY "public select coin_packages" ON public.coin_packages FOR SELECT USING (true);
CREATE POLICY "authenticated insert coin_packages" ON public.coin_packages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update coin_packages" ON public.coin_packages FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin delete coin_packages" ON public.coin_packages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.role = 'admin'
        AND (
          p.auth_id = auth.uid()
          OR p.id = auth.uid()::text
          OR (p.email IS NOT NULL AND lower(p.email) = 'admin@livecall.app')
        )
    )
  );

-- USER RELATIONIAL PRIVACY TABLES
CREATE POLICY "public select favorites" ON public.favorites FOR SELECT USING (true);
CREATE POLICY "authenticated insert favorites" ON public.favorites FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update favorites" ON public.favorites FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "owner/admin delete favorites" ON public.favorites
  FOR DELETE USING (
    user_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.role = 'admin'
        AND (
          p.auth_id = auth.uid()
          OR p.id = auth.uid()::text
          OR (p.email IS NOT NULL AND lower(p.email) = 'admin@livecall.app')
        )
    )
  );

CREATE POLICY "public select blocked_users" ON public.blocked_users FOR SELECT USING (true);
CREATE POLICY "authenticated insert blocked_users" ON public.blocked_users FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update blocked_users" ON public.blocked_users FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "owner/admin delete blocked_users" ON public.blocked_users
  FOR DELETE USING (
    user_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.role = 'admin'
        AND (
          p.auth_id = auth.uid()
          OR p.id = auth.uid()::text
          OR (p.email IS NOT NULL AND lower(p.email) = 'admin@livecall.app')
        )
    )
  );

-- CREATOR GOALS
CREATE POLICY "public select creator_goals" ON public.creator_goals FOR SELECT USING (true);
CREATE POLICY "authenticated insert creator_goals" ON public.creator_goals FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update creator_goals" ON public.creator_goals FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin delete creator_goals" ON public.creator_goals
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.role = 'admin'
        AND (
          p.auth_id = auth.uid()
          OR p.id = auth.uid()::text
          OR (p.email IS NOT NULL AND lower(p.email) = 'admin@livecall.app')
        )
    )
  );

-- DAILY REWARDS
CREATE POLICY "public select user_daily_rewards" ON public.user_daily_rewards FOR SELECT USING (true);
CREATE POLICY "authenticated insert user_daily_rewards" ON public.user_daily_rewards FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update user_daily_rewards" ON public.user_daily_rewards FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin delete user_daily_rewards" ON public.user_daily_rewards
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.role = 'admin'
        AND (
          p.auth_id = auth.uid()
          OR p.id = auth.uid()::text
          OR (p.email IS NOT NULL AND lower(p.email) = 'admin@livecall.app')
        )
    )
  );

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
-- 16.5 IMMUTABLE WALLET LEDGER (append-only call billing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.wallet_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    call_id TEXT,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('CALL_DEBIT', 'HOST_EARN', 'TL_EARN')),
    amount NUMERIC NOT NULL,
    balance_after NUMERIC NOT NULL,
    billing_minute INT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS wallet_ledger_unique_billing_idx
    ON public.wallet_ledger (call_id, billing_minute, transaction_type, user_id);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user_created
    ON public.wallet_ledger (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_call
    ON public.wallet_ledger (call_id, billing_minute);

ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public select wallet_ledger" ON public.wallet_ledger;
DROP POLICY IF EXISTS "service role manage wallet_ledger" ON public.wallet_ledger;
CREATE POLICY "public select wallet_ledger" ON public.wallet_ledger FOR SELECT USING (true);
CREATE POLICY "authenticated insert wallet_ledger" ON public.wallet_ledger FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- 16.6 ATOMIC CALL COIN BURNING STORED PROCEDURE
-- Server-authoritative debit/credit with row locks + append-only ledger.
-- Unique (call_id, billing_minute, transaction_type, user_id) prevents duplicate burns.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.burn_call_coins_atomic(
    p_caller_id TEXT,
    p_receiver_id TEXT,
    p_tl_id TEXT,
    p_call_id TEXT,
    p_billing_minute INT,
    p_coins_burned INT,
    p_host_coins_earned INT,
    p_tl_coins_earned INT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_caller_balance BIGINT;
    v_host_earnings BIGINT := 0;
    v_tl_earnings BIGINT := 0;
    v_host_earned INT;
    v_tl_earned INT;
    v_receiver_role TEXT;
BEGIN
    IF p_call_id IS NULL OR p_billing_minute IS NULL OR p_billing_minute < 1 THEN
        RETURN jsonb_build_object(
            'success', false,
            'new_caller_balance', 0,
            'new_host_earnings', 0,
            'error_message', 'Invalid call_id or billing_minute'
        );
    END IF;

    IF p_coins_burned IS NULL OR p_coins_burned <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'new_caller_balance', 0,
            'new_host_earnings', 0,
            'error_message', 'Invalid coins_burned'
        );
    END IF;

    -- Enforce invariant: hostEarned + tlEarned <= coinsBurned
    v_host_earned := GREATEST(0, COALESCE(p_host_coins_earned, 0));
    v_tl_earned := GREATEST(0, COALESCE(p_tl_coins_earned, 0));
    IF (v_host_earned + v_tl_earned) > p_coins_burned THEN
        IF v_tl_earned > p_coins_burned THEN
            v_tl_earned := p_coins_burned;
            v_host_earned := 0;
        ELSE
            v_host_earned := p_coins_burned - v_tl_earned;
        END IF;
    END IF;

    -- Idempotent re-hit: already billed this minute for this caller
    IF EXISTS (
        SELECT 1 FROM public.wallet_ledger
        WHERE call_id = p_call_id
          AND billing_minute = p_billing_minute
          AND transaction_type = 'CALL_DEBIT'
          AND user_id = p_caller_id
    ) THEN
        SELECT coin_balance INTO v_caller_balance FROM public.profiles WHERE id = p_caller_id;
        IF p_receiver_id IS NOT NULL AND p_receiver_id <> '' THEN
            SELECT earnings_coins INTO v_host_earnings FROM public.profiles WHERE id = p_receiver_id;
        END IF;
        IF p_tl_id IS NOT NULL AND p_tl_id <> '' THEN
            SELECT earnings_coins INTO v_tl_earnings FROM public.profiles WHERE id = p_tl_id;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'new_caller_balance', COALESCE(v_caller_balance, 0),
            'new_host_earnings', COALESCE(v_host_earnings, 0),
            'new_tl_earnings', COALESCE(v_tl_earnings, 0),
            'error_message', NULL,
            'duplicate', true,
            'coins_burned', p_coins_burned,
            'host_coins_earned', v_host_earned,
            'tl_coins_earned', v_tl_earned
        );
    END IF;

    -- Lock caller row and fail hard on insufficient balance
    SELECT coin_balance INTO v_caller_balance
    FROM public.profiles
    WHERE id = p_caller_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'new_caller_balance', 0,
            'new_host_earnings', 0,
            'error_message', 'Caller profile not found'
        );
    END IF;

    IF v_caller_balance < p_coins_burned THEN
        RETURN jsonb_build_object(
            'success', false,
            'new_caller_balance', v_caller_balance,
            'new_host_earnings', 0,
            'error_message', 'INSUFFICIENT_BALANCE',
            'code', 'INSUFFICIENT_BALANCE'
        );
    END IF;

    -- Atomically debit caller (never allow negative)
    UPDATE public.profiles
    SET coin_balance = coin_balance - p_coins_burned,
        updated_at = now()
    WHERE id = p_caller_id
    RETURNING coin_balance INTO v_caller_balance;

    INSERT INTO public.wallet_ledger (
        user_id, call_id, transaction_type, amount, balance_after, billing_minute, metadata
    ) VALUES (
        p_caller_id, p_call_id, 'CALL_DEBIT', -p_coins_burned, v_caller_balance, p_billing_minute,
        COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('side', 'caller')
    );

    -- Credit female_creator host only (server passes 0 for non-creators)
    IF v_host_earned > 0 AND p_receiver_id IS NOT NULL AND p_receiver_id <> '' THEN
        SELECT role INTO v_receiver_role FROM public.profiles WHERE id = p_receiver_id FOR UPDATE;

        IF v_receiver_role IN ('female_creator', 'female_host') THEN
            UPDATE public.profiles
            SET earnings_coins = earnings_coins + v_host_earned,
                total_call_minutes = COALESCE(total_call_minutes, 0) + 1,
                updated_at = now()
            WHERE id = p_receiver_id
            RETURNING earnings_coins INTO v_host_earnings;

            INSERT INTO public.wallet_ledger (
                user_id, call_id, transaction_type, amount, balance_after, billing_minute, metadata
            ) VALUES (
                p_receiver_id, p_call_id, 'HOST_EARN', v_host_earned, v_host_earnings, p_billing_minute,
                COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('side', 'host')
            );
        ELSE
            v_host_earned := 0;
        END IF;
    END IF;

    -- Credit team leader only when TL id present and share > 0 (server gates female_creator)
    IF v_tl_earned > 0 AND p_tl_id IS NOT NULL AND p_tl_id <> '' THEN
        UPDATE public.profiles
        SET earnings_coins = earnings_coins + v_tl_earned,
            updated_at = now()
        WHERE id = p_tl_id
        RETURNING earnings_coins INTO v_tl_earnings;

        IF FOUND THEN
            INSERT INTO public.wallet_ledger (
                user_id, call_id, transaction_type, amount, balance_after, billing_minute, metadata
            ) VALUES (
                p_tl_id, p_call_id, 'TL_EARN', v_tl_earned, v_tl_earnings, p_billing_minute,
                COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('side', 'team_leader')
            );
        ELSE
            v_tl_earned := 0;
            v_tl_earnings := 0;
        END IF;
    ELSE
        v_tl_earned := 0;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'new_caller_balance', v_caller_balance,
        'new_host_earnings', COALESCE(v_host_earnings, 0),
        'new_tl_earnings', COALESCE(v_tl_earnings, 0),
        'error_message', NULL,
        'duplicate', false,
        'coins_burned', p_coins_burned,
        'host_coins_earned', v_host_earned,
        'tl_coins_earned', v_tl_earned
    );
EXCEPTION WHEN unique_violation THEN
    -- Concurrent duplicate burn — treat as idempotent success
    SELECT coin_balance INTO v_caller_balance FROM public.profiles WHERE id = p_caller_id;
    IF p_receiver_id IS NOT NULL AND p_receiver_id <> '' THEN
        SELECT earnings_coins INTO v_host_earnings FROM public.profiles WHERE id = p_receiver_id;
    END IF;
    RETURN jsonb_build_object(
        'success', true,
        'new_caller_balance', COALESCE(v_caller_balance, 0),
        'new_host_earnings', COALESCE(v_host_earnings, 0),
        'new_tl_earnings', COALESCE(v_tl_earnings, 0),
        'error_message', NULL,
        'duplicate', true,
        'coins_burned', p_coins_burned,
        'host_coins_earned', GREATEST(0, COALESCE(p_host_coins_earned, 0)),
        'tl_coins_earned', GREATEST(0, COALESCE(p_tl_coins_earned, 0))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'wallet_ledger') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_ledger;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'feed_posts') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_posts;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_daily_rewards') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_daily_rewards;
    END IF;
END $$;

-- ============================================================================
-- 17. TAXONOMY SEED DATA & SYSTEM DEFAULTS
-- ============================================================================

-- 1. Seed All Worldwide Countries
INSERT INTO public.country_configs (code, name, flag, region, is_tier1, enabled) VALUES
('US', 'United States', '🇺🇸', 'North America', true, true),
('CA', 'Canada', '🇨🇦', 'North America', true, true),
('GB', 'United Kingdom', '🇬🇧', 'Europe', true, true),
('AU', 'Australia', '🇦🇺', 'Oceania', true, true),
('DE', 'Germany', '🇩🇪', 'Europe', true, true),
('FR', 'France', '🇫🇷', 'Europe', true, true),
('JP', 'Japan', '🇯🇵', 'Asia', true, true),
('KR', 'South Korea', '🇰🇷', 'Asia', true, true),
('ES', 'Spain', '🇪🇸', 'Europe', true, true),
('IT', 'Italy', '🇮🇹', 'Europe', true, true),
('NL', 'Netherlands', '🇳🇱', 'Europe', true, true),
('CH', 'Switzerland', '🇨🇭', 'Europe', true, true),
('SE', 'Sweden', '🇸🇪', 'Europe', true, true),
('NO', 'Norway', '🇳🇴', 'Europe', true, true),
('DK', 'Denmark', '🇩🇰', 'Europe', true, true),
('FI', 'Finland', '🇫🇮', 'Europe', true, true),
('IE', 'Ireland', '🇮🇪', 'Europe', true, true),
('NZ', 'New Zealand', '🇳🇿', 'Oceania', true, true),
('SG', 'Singapore', '🇸🇬', 'Asia', true, true),
('AE', 'United Arab Emirates', '🇦🇪', 'Middle East', true, true),
('SA', 'Saudi Arabia', '🇸🇦', 'Middle East', true, true),
('QA', 'Qatar', '🇶🇦', 'Middle East', true, true),
('KW', 'Kuwait', '🇰🇼', 'Middle East', true, true),
('AT', 'Austria', '🇦🇹', 'Europe', true, true),
('BE', 'Belgium', '🇧🇪', 'Europe', true, true),
('BR', 'Brazil', '🇧🇷', 'South America', false, true),
('MX', 'Mexico', '🇲🇽', 'North America', false, true),
('CO', 'Colombia', '🇨🇴', 'South America', false, true),
('AR', 'Argentina', '🇦🇷', 'South America', false, true),
('CL', 'Chile', '🇨🇱', 'South America', false, true),
('PE', 'Peru', '🇵🇪', 'South America', false, true),
('EC', 'Ecuador', '🇪🇨', 'South America', false, true),
('VE', 'Venezuela', '🇻🇪', 'South America', false, true),
('UY', 'Uruguay', '🇺🇾', 'South America', false, true),
('PY', 'Paraguay', '🇵🇾', 'South America', false, true),
('BO', 'Bolivia', '🇧🇴', 'South America', false, true),
('CR', 'Costa Rica', '🇨🇷', 'North America', false, true),
('PA', 'Panama', '🇵🇦', 'North America', false, true),
('DO', 'Dominican Republic', '🇩🇴', 'Caribbean', false, true),
('GT', 'Guatemala', '🇬🇹', 'North America', false, true),
('HN', 'Honduras', '🇭🇳', 'North America', false, true),
('SV', 'El Salvador', '🇸🇻', 'North America', false, true),
('NI', 'Nicaragua', '🇳🇮', 'North America', false, true),
('PR', 'Puerto Rico', '🇵🇷', 'Caribbean', false, true),
('JM', 'Jamaica', '🇯🇲', 'Caribbean', false, true),
('TT', 'Trinidad and Tobago', '🇹🇹', 'Caribbean', false, true),
('PL', 'Poland', '🇵🇱', 'Europe', false, true),
('PT', 'Portugal', '🇵🇹', 'Europe', false, true),
('GR', 'Greece', '🇬🇷', 'Europe', false, true),
('CZ', 'Czech Republic', '🇨🇿', 'Europe', false, true),
('RO', 'Romania', '🇷🇴', 'Europe', false, true),
('HU', 'Hungary', '🇭🇺', 'Europe', false, true),
('BG', 'Bulgaria', '🇧🇬', 'Europe', false, true),
('HR', 'Croatia', '🇭🇷', 'Europe', false, true),
('RS', 'Serbia', '🇷🇸', 'Europe', false, true),
('SK', 'Slovakia', '🇸🇰', 'Europe', false, true),
('SI', 'Slovenia', '🇸🇮', 'Europe', false, true),
('LT', 'Lithuania', '🇱🇹', 'Europe', false, true),
('LV', 'Latvia', '🇱🇻', 'Europe', false, true),
('EE', 'Estonia', '🇪🇪', 'Europe', false, true),
('UA', 'Ukraine', '🇺🇦', 'Europe', false, true),
('TR', 'Turkey', '🇹🇷', 'Europe', false, true),
('CY', 'Cyprus', '🇨🇾', 'Europe', false, true),
('MT', 'Malta', '🇲🇹', 'Europe', false, true),
('IS', 'Iceland', '🇮🇸', 'Europe', false, true),
('LU', 'Luxembourg', '🇱🇺', 'Europe', false, true),
('AL', 'Albania', '🇦🇱', 'Europe', false, true),
('BA', 'Bosnia and Herzegovina', '🇧🇦', 'Europe', false, true),
('MK', 'North Macedonia', '🇲🇰', 'Europe', false, true),
('ME', 'Montenegro', '🇲🇪', 'Europe', false, true),
('MD', 'Moldova', '🇲🇩', 'Europe', false, true),
('GE', 'Georgia', '🇬🇪', 'Europe', false, true),
('AM', 'Armenia', '🇦🇲', 'Europe', false, true),
('AZ', 'Azerbaijan', '🇦🇿', 'Europe', false, true),
('IN', 'India', '🇮🇳', 'Asia', false, true),
('CN', 'China', '🇨🇳', 'Asia', false, true),
('PH', 'Philippines', '🇵🇭', 'Asia', false, true),
('TH', 'Thailand', '🇹🇭', 'Asia', false, true),
('ID', 'Indonesia', '🇮🇩', 'Asia', false, true),
('VN', 'Vietnam', '🇻🇳', 'Asia', false, true),
('MY', 'Malaysia', '🇲🇾', 'Asia', false, true),
('TW', 'Taiwan', '🇹🇼', 'Asia', false, true),
('HK', 'Hong Kong', '🇭🇰', 'Asia', false, true),
('PK', 'Pakistan', '🇵🇰', 'Asia', false, true),
('BD', 'Bangladesh', '🇧🇩', 'Asia', false, true),
('LK', 'Sri Lanka', '🇱🇰', 'Asia', false, true),
('NP', 'Nepal', '🇳🇵', 'Asia', false, true),
('KZ', 'Kazakhstan', '🇰🇿', 'Asia', false, true),
('UZ', 'Uzbekistan', '🇺🇿', 'Asia', false, true),
('KH', 'Cambodia', '🇰🇭', 'Asia', false, true),
('MN', 'Mongolia', '🇲🇳', 'Asia', false, true),
('IL', 'Israel', '🇮🇱', 'Middle East', false, true),
('EG', 'Egypt', '🇪🇬', 'Middle East', false, true),
('MA', 'Morocco', '🇲🇦', 'Middle East', false, true),
('JO', 'Jordan', '🇯🇴', 'Middle East', false, true),
('LB', 'Lebanon', '🇱🇧', 'Middle East', false, true),
('OM', 'Oman', '🇴🇲', 'Middle East', false, true),
('BH', 'Bahrain', '🇧🇭', 'Middle East', false, true),
('TN', 'Tunisia', '🇹🇳', 'Middle East', false, true),
('DZ', 'Algeria', '🇩🇿', 'Middle East', false, true),
('IQ', 'Iraq', '🇮🇶', 'Middle East', false, true),
('ZA', 'South Africa', '🇿🇦', 'Africa', false, true),
('NG', 'Nigeria', '🇳🇬', 'Africa', false, true),
('KE', 'Kenya', '🇰🇪', 'Africa', false, true),
('GH', 'Ghana', '🇬🇭', 'Africa', false, true),
('ET', 'Ethiopia', '🇪🇹', 'Africa', false, true),
('TZ', 'Tanzania', '🇹🇿', 'Africa', false, true),
('UG', 'Uganda', '🇺🇬', 'Africa', false, true),
('CI', 'Ivory Coast', '🇨🇮', 'Africa', false, true),
('SN', 'Senegal', '🇸🇳', 'Africa', false, true),
('CM', 'Cameroon', '🇨🇲', 'Africa', false, true),
('ZW', 'Zimbabwe', '🇿🇼', 'Africa', false, true),
('MU', 'Mauritius', '🇲🇺', 'Africa', false, true),
('FJ', 'Fiji', '🇫🇯', 'Oceania', false, true),
('PG', 'Papua New Guinea', '🇵🇬', 'Oceania', false, true)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    flag = EXCLUDED.flag,
    region = EXCLUDED.region,
    is_tier1 = EXCLUDED.is_tier1;

-- 2. Seed All Spoken Languages
INSERT INTO public.language_configs (code, name, native_name, popular, region, enabled) VALUES
('en', 'English', 'English', true, 'Global', true),
('es', 'Spanish', 'Español', true, 'Europe & Americas', true),
('fr', 'French', 'Français', true, 'Europe & Africa', true),
('de', 'German', 'Deutsch', true, 'Europe', true),
('it', 'Italian', 'Italiano', true, 'Europe', true),
('pt', 'Portuguese', 'Português', true, 'Europe & Americas', true),
('ru', 'Russian', 'Русский', true, 'Eurasia', true),
('zh', 'Chinese (Mandarin)', '中文 (普通话)', true, 'East Asia', true),
('zh-yue', 'Chinese (Cantonese)', '粵語', true, 'East Asia', true),
('ja', 'Japanese', '日本語', true, 'East Asia', true),
('ko', 'Korean', '한국어', true, 'East Asia', true),
('ar', 'Arabic', 'العربية', true, 'Middle East & North Africa', true),
('hi', 'Hindi', 'हिन्दी', true, 'South Asia', true),
('ur', 'Urdu', 'اردو', true, 'South Asia', true),
('tr', 'Turkish', 'Türkçe', true, 'Middle East & Europe', true),
('vi', 'Vietnamese', 'Tiếng Việt', true, 'Southeast Asia', true),
('th', 'Thai', 'ไทย', true, 'Southeast Asia', true),
('tl', 'Tagalog (Filipino)', 'Tagalog', true, 'Southeast Asia', true),
('id', 'Indonesian', 'Bahasa Indonesia', true, 'Southeast Asia', true),
('ms', 'Malay', 'Bahasa Melayu', true, 'Southeast Asia', true),
('nl', 'Dutch', 'Nederlands', false, 'Europe', true),
('pl', 'Polish', 'Polski', false, 'Europe', true),
('uk', 'Ukrainian', 'Українська', false, 'Europe', true),
('sv', 'Swedish', 'Svenska', false, 'Europe', true),
('no', 'Norwegian', 'Norsk', false, 'Europe', true),
('da', 'Danish', 'Dansk', false, 'Europe', true),
('fi', 'Finnish', 'Suomi', false, 'Europe', true),
('el', 'Greek', 'Ελληνικά', false, 'Europe', true),
('cs', 'Czech', 'Čeština', false, 'Europe', true),
('ro', 'Romanian', 'Română', false, 'Europe', true),
('hu', 'Hungarian', 'Magyar', false, 'Europe', true),
('bg', 'Bulgarian', 'Български', false, 'Europe', true),
('hr', 'Croatian', 'Hrvatski', false, 'Europe', true),
('sr', 'Serbian', 'Српски', false, 'Europe', true),
('sk', 'Slovak', 'Slovenčina', false, 'Europe', true),
('sl', 'Slovenian', 'Slovenščina', false, 'Europe', true),
('lt', 'Lithuanian', 'Lietuvių', false, 'Europe', true),
('lv', 'Latvian', 'Latviešu', false, 'Europe', true),
('et', 'Estonian', 'Eesti', false, 'Europe', true),
('bn', 'Bengali', 'বাংলা', false, 'South Asia', true),
('pa', 'Punjabi', 'ਪੰਜਾਬੀ', false, 'South Asia', true),
('ta', 'Tamil', 'தமிழ்', false, 'South Asia', true),
('te', 'Telugu', 'తెలుగు', false, 'South Asia', true),
('mr', 'Marathi', 'मराठी', false, 'South Asia', true),
('gu', 'Gujarati', 'ગુજરાતી', false, 'South Asia', true),
('kn', 'Kannada', 'ಕನ್ನಡ', false, 'South Asia', true),
('ml', 'Malayalam', 'മലയാളം', false, 'South Asia', true),
('ne', 'Nepali', 'नेपाली', false, 'South Asia', true),
('si', 'Sinhala', 'සිංහල', false, 'South Asia', true),
('fa', 'Persian (Farsi)', 'فارسی', false, 'Middle East', true),
('he', 'Hebrew', 'עברית', false, 'Middle East', true),
('az', 'Azerbaijani', 'Azərbaycan', false, 'Central Asia', true),
('ka', 'Georgian', 'ქართული', false, 'Caucasus', true),
('hy', 'Armenian', 'Հայերեն', false, 'Caucasus', true),
('kk', 'Kazakh', 'Қазақша', false, 'Central Asia', true),
('uz', 'Uzbek', 'Oʻzbek', false, 'Central Asia', true),
('sw', 'Swahili', 'Kiswahili', false, 'Africa', true),
('am', 'Amharic', 'አማርኛ', false, 'Africa', true),
('yo', 'Yoruba', 'Èdè Yorùbá', false, 'Africa', true),
('ig', 'Igbo', 'Asụsụ Igbo', false, 'Africa', true),
('ha', 'Hausa', 'Harshen Hausa', false, 'Africa', true),
('zu', 'Zulu', 'isiZulu', false, 'Africa', true),
('af', 'Afrikaans', 'Afrikaans', false, 'Africa', true)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    native_name = EXCLUDED.native_name,
    popular = EXCLUDED.popular,
    region = EXCLUDED.region;

-- 3. Seed All 12 Astrological Zodiac Signs
INSERT INTO public.zodiac_configs (key, name, symbol, date_range, element, enabled) VALUES
('aries', 'Aries', '♈', 'Mar 21 - Apr 19', 'fire', true),
('taurus', 'Taurus', '♉', 'Apr 20 - May 20', 'earth', true),
('gemini', 'Gemini', '♊', 'May 21 - Jun 20', 'air', true),
('cancer', 'Cancer', '♋', 'Jun 21 - Jul 22', 'water', true),
('leo', 'Leo', '♌', 'Jul 23 - Aug 22', 'fire', true),
('virgo', 'Virgo', '♍', 'Aug 23 - Sep 22', 'earth', true),
('libra', 'Libra', '♎', 'Sep 23 - Oct 22', 'air', true),
('scorpio', 'Scorpio', '♏', 'Oct 23 - Nov 21', 'water', true),
('sagittarius', 'Sagittarius', '♐', 'Nov 22 - Dec 21', 'fire', true),
('capricorn', 'Capricorn', '♑', 'Dec 22 - Jan 19', 'earth', true),
('aquarius', 'Aquarius', '♒', 'Jan 20 - Feb 18', 'air', true),
('pisces', 'Pisces', '♓', 'Feb 19 - Mar 20', 'water', true)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    symbol = EXCLUDED.symbol,
    date_range = EXCLUDED.date_range,
    element = EXCLUDED.element;

-- 4. Seed All Categorized Interests & Passions
INSERT INTO public.interest_configs (id, name, category, icon_name, color, popular, enabled) VALUES
('travel', 'Travel & Adventure', 'lifestyle', 'Compass', '#38bdf8', true, true),
('photography', 'Photography & Stories', 'lifestyle', 'Camera', '#f472b6', true, true),
('fashion', 'Fashion & Style', 'lifestyle', 'Shirt', '#ec4899', true, true),
('pets', 'Dogs & Cat Lovers', 'lifestyle', 'PawPrint', '#fb923c', false, true),
('nature', 'Nature & Camping', 'lifestyle', 'Trees', '#4ade80', false, true),
('roadtrips', 'Road Trips', 'lifestyle', 'Car', '#60a5fa', false, true),
('fitness', 'Fitness & Gym', 'sports', 'Dumbbell', '#f97316', true, true),
('running', 'Running & Marathons', 'sports', 'Activity', '#ef4444', false, true),
('swimming', 'Swimming & Beach', 'sports', 'Waves', '#06b6d4', false, true),
('cycling', 'Cycling & Biking', 'sports', 'Bike', '#84cc16', false, true),
('football', 'Soccer & Football', 'sports', 'Trophy', '#22c55e', false, true),
('basketball', 'Basketball', 'sports', 'Target', '#f59e0b', false, true),
('martial_arts', 'Martial Arts & Boxing', 'sports', 'Shield', '#dc2626', false, true),
('music_concerts', 'Music & Concerts', 'music', 'Music', '#a855f7', true, true),
('karaoke', 'Singing & Karaoke', 'music', 'Mic', '#d946ef', true, true),
('dj_edm', 'DJing & EDM Festivals', 'music', 'Radio', '#8b5cf6', false, true),
('rock_metal', 'Rock & Indie Bands', 'music', 'Guitar', '#6366f1', false, true),
('hiphop_rnb', 'Hip-Hop & R&B', 'music', 'Disc', '#ec4899', false, true),
('classical', 'Classical & Jazz', 'music', 'Piano', '#3b82f6', false, true),
('art_design', 'Art & Design', 'art', 'Palette', '#14b8a6', true, true),
('movies_cinema', 'Movies & Cinema', 'art', 'Film', '#0ea5e9', true, true),
('anime_manga', 'Anime & Manga', 'art', 'Sparkles', '#f43f5e', true, true),
('dancing', 'Dancing & Choreography', 'art', 'Footprints', '#e11d48', false, true),
('writing_poetry', 'Writing & Books', 'art', 'BookOpen', '#10b981', false, true),
('cosplay', 'Cosplay & Conventions', 'art', 'Mask', '#a21caf', false, true),
('gaming', 'Gaming & Esports', 'tech', 'Gamepad2', '#3b82f6', true, true),
('streaming', 'Live Streaming & Twitch', 'tech', 'Tv', '#9333ea', true, true),
('tech_coding', 'Tech & Programming', 'tech', 'Code', '#0284c7', false, true),
('crypto_web3', 'Crypto & Investing', 'tech', 'Coins', '#eab308', false, true),
('ai_future', 'AI & Gadgets', 'tech', 'Cpu', '#6366f1', false, true),
('board_games', 'Board Games & Trivia', 'tech', 'Dice', '#f59e0b', false, true),
('cooking', 'Cooking & Foodie', 'food', 'Utensils', '#f97316', true, true),
('coffee_cafes', 'Coffee & Cozy Cafes', 'food', 'Coffee', '#b45309', true, true),
('baking', 'Baking & Desserts', 'food', 'Cake', '#f472b6', false, true),
('wine_cocktails', 'Wine Tasting & Cocktails', 'food', 'Wine', '#be123c', false, true),
('street_food', 'Street Food Exploring', 'food', 'Pizza', '#ea580c', false, true),
('yoga_meditation', 'Yoga & Meditation', 'wellness', 'Smile', '#10b981', true, true),
('mental_health', 'Mindfulness & Growth', 'wellness', 'Heart', '#ec4899', false, true),
('spa_skincare', 'Skincare & Self-Care', 'wellness', 'Flower', '#f43f5e', false, true),
('astrology', 'Astrology & Crystals', 'wellness', 'Moon', '#8b5cf6', false, true),
('late_night_chats', 'Late Night Talks', 'social', 'MessageCircle', '#6366f1', true, true),
('nightlife_dining', 'Nightlife & Lounges', 'social', 'PartyPopper', '#d946ef', true, true),
('language_exchange', 'Language Exchange', 'social', 'Globe', '#06b6d4', true, true),
('volunteering', 'Volunteering & Causes', 'social', 'HeartHandshake', '#10b981', false, true)
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
    ARRAY['US','CA','GB','AU','DE','FR','JP','KR','ES','IT','NL','CH','SE','NO','DK','FI','IE','NZ','SG','AE','SA','QA','KW','AT','BE','BR','MX','CO','AR','CL'],
    ARRAY['English','Spanish','French','German','Italian','Portuguese','Russian','Chinese (Mandarin)','Chinese (Cantonese)','Japanese','Korean','Arabic','Hindi','Urdu','Turkish','Vietnamese','Thai','Tagalog (Filipino)','Indonesian','Malay'],
    ARRAY['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'],
    ARRAY['Travel & Adventure','Photography & Stories','Fashion & Style','Dogs & Cat Lovers','Nature & Camping','Road Trips','Fitness & Gym','Running & Marathons','Swimming & Beach','Cycling & Biking','Soccer & Football','Basketball','Martial Arts & Boxing','Music & Concerts','Singing & Karaoke','DJing & EDM Festivals','Rock & Indie Bands','Hip-Hop & R&B','Classical & Jazz','Art & Design','Movies & Cinema','Anime & Manga','Dancing & Choreography','Writing & Books','Cosplay & Conventions','Gaming & Esports','Live Streaming & Twitch','Tech & Programming','Crypto & Investing','AI & Gadgets','Board Games & Trivia','Cooking & Foodie','Coffee & Cozy Cafes','Baking & Desserts','Wine Tasting & Cocktails','Street Food Exploring','Yoga & Meditation','Mindfulness & Growth','Skincare & Self-Care','Astrology & Crystals','Late Night Talks','Nightlife & Lounges','Language Exchange','Volunteering & Causes'],
    '{"xs":14,"sm":18,"card":18,"md":22,"lg":27,"admin":27,"xl":36,"2xl":48}'
)
ON CONFLICT (id) DO UPDATE SET
    allowed_country_codes = EXCLUDED.allowed_country_codes,
    allowed_languages = EXCLUDED.allowed_languages,
    allowed_zodiac_signs = EXCLUDED.allowed_zodiac_signs,
    allowed_interests = EXCLUDED.allowed_interests,
    flag_sizes_json = EXCLUDED.flag_sizes_json,
    updated_at = now();

