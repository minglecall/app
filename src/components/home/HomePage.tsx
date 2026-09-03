import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Zap,
  Sparkles,
  Crown,
  Coins,
  ShieldCheck,
  Lock,
  FileText,
  Layers,
  Flame,
  ChevronRight,
  ChevronLeft,
  Gift,
  CheckCircle2,
  Globe,
  Settings,
  ArrowRight,
  UserPlus,
  LogIn,
  Users,
} from 'lucide-react';
import { HomeBanner, PolicyDocument, HomeQuickLink } from '../../types';

interface HomePageProps {
  onStartCall?: (userId: string) => void;
  onOpenChat: (userId?: string) => void;
  onOpenMatch: () => void;
  onOpenStore: () => void;
  onOpenVip: () => void;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
  onNavigateToTab: (tab: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onStartCall,
  onOpenChat,
  onOpenMatch,
  onOpenStore,
  onOpenVip,
  onOpenAuth,
  onNavigateToTab,
}) => {
  const {
    currentUser,
    isLoggedIn,
    users,
    homeBanners,
    policyDocuments,
    homeQuickLinks,
    openPolicyModal,
    claimDailyBonus,
    dailyBonusClaimed,
    openDailyRewardsModal,
    dailyRewardRecord,
    hasUnclaimedDailyRewards,
    systemSettings,
    favorites,
    toggleFavorite,
  } = useApp();

  // Active Banners
  const activeBanners = useMemo(() => {
    return homeBanners.filter((b) => b.active).sort((a, b) => a.order - b.order);
  }, [homeBanners]);
  
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [isBannerHovered, setIsBannerHovered] = useState(false);
  const autoSlideTimerRef = useRef<any>(null);

  // Auto cycle banners every 5.5s
  useEffect(() => {
    if (activeBanners.length <= 1 || isBannerHovered) return;

    autoSlideTimerRef.current = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % activeBanners.length);
    }, 5500);

    return () => {
      if (autoSlideTimerRef.current) clearInterval(autoSlideTimerRef.current);
    };
  }, [activeBanners.length, isBannerHovered]);

  const handleNextBanner = () => {
    setCurrentBannerIndex((prev) => (prev + 1) % activeBanners.length);
  };

  const handlePrevBanner = () => {
    setCurrentBannerIndex((prev) => (prev - 1 + activeBanners.length) % activeBanners.length);
  };

  const handleBannerAction = (banner: HomeBanner) => {
    if (banner.actionType === 'tab') {
      onNavigateToTab(banner.actionTarget);
    } else if (banner.actionType === 'modal') {
      if (banner.actionTarget === 'match') onOpenMatch();
      else if (banner.actionTarget === 'vip') onOpenVip();
      else if (banner.actionTarget === 'store') onOpenStore();
      else if (banner.actionTarget === 'chat') onOpenChat();
    } else if (banner.actionType === 'policy') {
      openPolicyModal(banner.actionTarget);
    } else if (banner.actionType === 'external' && banner.actionTarget) {
      window.open(banner.actionTarget, '_blank');
    }
  };

  const handleQuickLinkAction = (link: HomeQuickLink) => {
    if (link.actionType === 'tab') {
      onNavigateToTab(link.actionTarget);
    } else if (link.actionType === 'modal') {
      if (link.actionTarget === 'match') onOpenMatch();
      else if (link.actionTarget === 'vip') onOpenVip();
      else if (link.actionTarget === 'store') onOpenStore();
      else if (link.actionTarget === 'chat') onOpenChat();
    } else if (link.actionType === 'policy') {
      openPolicyModal(link.actionTarget);
    } else if (link.actionType === 'external' && link.actionTarget) {
      window.open(link.actionTarget, '_blank');
    }
  };

  const getQuickIcon = (iconName: string) => {
    switch (iconName) {
      case 'Zap':
        return <Zap className="w-5 h-5" />;
      case 'Layers':
        return <Layers className="w-5 h-5" />;
      case 'Crown':
        return <Crown className="w-5 h-5" />;
      case 'Coins':
        return <Coins className="w-5 h-5" />;
      case 'Sparkles':
        return <Sparkles className="w-5 h-5" />;
      case 'ShieldCheck':
      default:
        return <ShieldCheck className="w-5 h-5" />;
    }
  };

  const currentBanner = activeBanners[currentBannerIndex] || activeBanners[0];

  return (
    <div id="home-page-root" className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 space-y-8 animate-in fade-in duration-300">
      

      {/* Admin Quick Notification Pill */}
      {isLoggedIn && currentUser.role === 'admin' && (
        <div className="bg-purple-950/50 border border-purple-500/40 rounded-2xl p-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-2.5 text-xs text-purple-200">
            <Settings className="w-4 h-4 text-purple-400 shrink-0" />
            <span>
              <strong className="text-white">Admin CMS Active:</strong> All banners, quick links, and policy documents can be added/edited in real time in the{' '}
              <button
                onClick={() => onNavigateToTab('admin')}
                className="underline text-purple-300 font-bold hover:text-white"
              >
                Admin Dashboard
              </button>.
            </span>
          </div>
          <button
            onClick={() => onNavigateToTab('admin')}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shrink-0 transition-colors shadow"
          >
            Open CMS
          </button>
        </div>
      )}

      {/* 1. HERO DATING & LIVE SOCIAL BANNER CAROUSEL */}
      {activeBanners.length > 0 && currentBanner && (
        <section
          className="relative rounded-3xl overflow-hidden shadow-2xl border border-slate-800 bg-[#0B0D13] group"
          onMouseEnter={() => setIsBannerHovered(true)}
          onMouseLeave={() => setIsBannerHovered(false)}
        >
          <div className="relative min-h-[260px] sm:min-h-[340px] md:min-h-[380px] flex items-center">
            {/* Background High-res Image */}
            <div className="absolute inset-0 z-0">
              <img
                src={currentBanner.imageUrl}
                alt={currentBanner.title}
                className="w-full h-full object-cover object-center transform scale-105 transition-transform duration-1000 ease-out group-hover:scale-100"
              />
              {/* Gradient Overlays */}
              <div className={`absolute inset-0 bg-gradient-to-r ${currentBanner.bgGradient || 'from-slate-950/95 via-slate-950/80 to-transparent'}`} />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D13] via-transparent to-black/30" />
            </div>

            {/* Banner Text Content */}
            <div className="relative z-10 p-5 sm:p-8 md:p-12 max-w-2xl space-y-3 sm:space-y-4">
              {currentBanner.tagText && (
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-black tracking-wider uppercase shadow-md bg-rose-500 text-white">
                  <Flame className="w-3.5 h-3.5" />
                  <span>{currentBanner.tagText}</span>
                </div>
              )}

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-tight drop-shadow-md">
                {currentBanner.title}
              </h1>

              <p className="text-xs sm:text-sm md:text-base text-slate-200 line-clamp-3 sm:line-clamp-none font-medium leading-relaxed drop-shadow">
                {currentBanner.subtitle}
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => handleBannerAction(currentBanner)}
                  className="px-5 sm:px-6 py-2.5 sm:py-3 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-pink-600/30 flex items-center space-x-2 transition-all transform active:scale-95 cursor-pointer"
                >
                  <span>{currentBanner.ctaText || 'Explore Now'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={onOpenMatch}
                  className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-xs sm:text-sm border border-slate-700/80 backdrop-blur-md flex items-center space-x-2 transition-all"
                >
                  <Zap className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                  <span>Instant Match</span>
                </button>
              </div>
            </div>

            {/* Slider Navigation Arrows */}
            {activeBanners.length > 1 && (
              <>
                <button
                  onClick={handlePrevBanner}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md border border-white/10 opacity-70 group-hover:opacity-100 transition-opacity"
                  title="Previous banner"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <button
                  onClick={handleNextBanner}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md border border-white/10 opacity-70 group-hover:opacity-100 transition-opacity"
                  title="Next banner"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Indicator Dots */}
            {activeBanners.length > 1 && (
              <div className="absolute bottom-3 right-4 sm:right-8 z-20 flex items-center space-x-1.5 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
                {activeBanners.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentBannerIndex(idx)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      idx === currentBannerIndex ? 'w-6 bg-pink-500' : 'w-2 bg-white/40 hover:bg-white/70'
                    }`}
                    title={`Slide ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 2. QUICK ACTION SHORTCUTS (Dating App Style) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-pink-400" />
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight">Hot Activities & Shortcuts</h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">1-TAP SHORTCUTS</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {homeQuickLinks
            .filter((l) => l.active)
            .sort((a, b) => a.order - b.order)
            .map((link) => (
              <button
                key={link.id}
                onClick={() => handleQuickLinkAction(link)}
                className="group relative p-4 rounded-2xl bg-[#141721] hover:bg-[#1A1E2B] border border-slate-800/90 hover:border-pink-500/50 shadow-md hover:shadow-pink-500/10 flex flex-col items-center text-center transition-all transform hover:-translate-y-0.5 active:scale-95 cursor-pointer overflow-hidden"
              >
                {link.badge && (
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-pink-600 to-rose-600 text-white font-black text-[8px] uppercase tracking-wider shadow">
                    {link.badge}
                  </span>
                )}

                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${link.colorGradient} flex items-center justify-center text-white shadow-lg mb-2.5 group-hover:scale-110 transition-transform`}>
                  {getQuickIcon(link.icon)}
                </div>

                <span className="text-xs font-bold text-white tracking-tight leading-tight group-hover:text-pink-300 transition-colors">
                  {link.title}
                </span>
                {link.subtitle && (
                  <span className="text-[10px] text-slate-400 mt-0.5">{link.subtitle}</span>
                )}
              </button>
            ))}
        </div>
      </section>

      {/* 3. DUAL BANNERS: DAILY REWARD CHEST & QUICK MATCH RADAR */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Daily Bonus Reward Card */}
        <div className="bg-gradient-to-br from-amber-950/40 via-[#181520] to-[#12141C] border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-400 text-[10px] font-mono uppercase font-bold">
                <Gift className="w-3 h-3" />
                <span>DAILY REWARDS & QUESTS</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-300 text-[10px] font-mono font-bold">
                🔥 Day {dailyRewardRecord?.streakCount || 1} Streak
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
              7-Day Streak & Daily Quests
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Earn free coins daily by logging in, chatting with friends, quick matching, and video calling.
            </p>
          </div>

          <div className="pt-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-2xl bg-amber-400/20 text-amber-400 flex items-center justify-center font-black text-sm">
                🪙
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold">Your Balance</span>
                <span className="text-sm font-extrabold text-amber-400 font-mono">
                  {(currentUser?.coinBalance ?? 0).toLocaleString()} Coins
                </span>
              </div>
            </div>

            <button
              onClick={openDailyRewardsModal}
              className={`px-4 py-2 rounded-2xl font-black text-xs transition-all shadow-lg flex items-center space-x-1.5 cursor-pointer ${
                hasUnclaimedDailyRewards
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 shadow-amber-500/25 active:scale-95 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <Gift className="w-3.5 h-3.5" />
              <span>{hasUnclaimedDailyRewards ? 'Claim Free Coins 🎁' : 'View Quests & Streak'}</span>
            </button>
          </div>
        </div>

        {/* Quick Match Roulette Promo Card */}
        <div className="bg-gradient-to-br from-indigo-950/40 via-[#131628] to-[#12141C] border border-indigo-500/30 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-indigo-400/10 border border-indigo-400/30 text-indigo-400 text-[10px] font-mono uppercase font-bold">
              <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span>RADAR MATCHER</span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
              Instant 1-on-1 Video Match
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Skip profile browsing. Spin the roulette wheel to connect directly with a random live match in 5 seconds.
            </p>
          </div>

          <div className="pt-4 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs text-slate-400">
              <Globe className="w-4 h-4 text-indigo-400" />
              <span>Real-Time Translation Active</span>
            </div>

            <button
              onClick={onOpenMatch}
              className="px-5 py-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-pink-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 text-white font-black text-xs shadow-lg shadow-pink-600/30 transition-all flex items-center space-x-1.5 active:scale-95 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Spin & Match</span>
            </button>
          </div>
        </div>
      </section>

      {/* 5. COMMUNITY SAFETY, TRUST & POLICY LINKS GRID */}
      <section className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">Platform Trust & Policies</h2>
            </div>
            <p className="text-xs text-slate-400">
              Our safety standards, data privacy encryption, terms of service, and creator monetization guidelines.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>100% REGULATORY COMPLIANT</span>
            </span>
          </div>
        </div>

        {/* Policy Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {policyDocuments
            .filter((p) => p.isFeaturedOnHome)
            .sort((a, b) => a.order - b.order)
            .map((policy) => (
              <div
                key={policy.id}
                onClick={() => openPolicyModal(policy.id)}
                className="bg-[#141721] hover:bg-[#1A1F2E] border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-4 flex flex-col justify-between transition-all shadow-md hover:shadow-indigo-500/10 cursor-pointer group"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                      {policy.category === 'safety' ? (
                        <ShieldCheck className="w-4 h-4 text-rose-400" />
                      ) : policy.category === 'privacy' ? (
                        <Lock className="w-4 h-4 text-indigo-400" />
                      ) : policy.category === 'terms' ? (
                        <FileText className="w-4 h-4 text-emerald-400" />
                      ) : policy.category === 'coins' ? (
                        <Coins className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-pink-400" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono uppercase">{policy.lastUpdated}</span>
                  </div>

                  <h4 className="font-extrabold text-sm text-white group-hover:text-indigo-300 transition-colors leading-snug">
                    {policy.title}
                  </h4>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {policy.summary}
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-indigo-400 group-hover:text-indigo-300">
                  <span>Read Official Policy</span>
                  <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* 6. PLATFORM CAPABILITY HIGHLIGHTS STRIP */}
      <section className="bg-[#12151E] border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-3 bg-[#0C0E14] rounded-2xl border border-slate-800/80">
            <div className="text-xl sm:text-2xl font-black text-white font-mono">1,280+</div>
            <div className="text-[11px] text-slate-400 uppercase tracking-wider mt-0.5">Verified Hosts</div>
          </div>
          <div className="p-3 bg-[#0C0E14] rounded-2xl border border-slate-800/80">
            <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">18ms</div>
            <div className="text-[11px] text-slate-400 uppercase tracking-wider mt-0.5">HD WebRTC Latency</div>
          </div>
          <div className="p-3 bg-[#0C0E14] rounded-2xl border border-slate-800/80">
            <div className="text-xl sm:text-2xl font-black text-pink-400 font-mono">50% Off</div>
            <div className="text-[11px] text-slate-400 uppercase tracking-wider mt-0.5">Friend Calls (5 🪙/m)</div>
          </div>
          <div className="p-3 bg-[#0C0E14] rounded-2xl border border-slate-800/80">
            <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">24/7</div>
            <div className="text-[11px] text-slate-400 uppercase tracking-wider mt-0.5">AI Safety Shield</div>
          </div>
        </div>
      </section>

      {/* 6.5 BOTTOM REGISTRATION & DISCOVERY CTA */}
      {onOpenAuth && (
        <section className="rounded-3xl bg-gradient-to-br from-indigo-950/80 via-slate-900 to-pink-950/80 border border-indigo-500/30 p-6 sm:p-8 text-center space-y-4 shadow-2xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/40 text-xs font-bold font-mono uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ready To Start Video Calling?</span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Register Today & Receive Instant Bonus Coins
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto">
            Connect directly with verified female creator hosts in HD 1-on-1 private video calls. No subscriptions required.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => onOpenAuth('register')}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-pink-600/30 flex items-center space-x-2 transition-all transform active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-pink-200" />
              <span>Register Free Account</span>
            </button>
            <button
              onClick={() => onOpenAuth('login')}
              className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs sm:text-sm border border-slate-700 transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-slate-400" />
              <span>Sign In with Password</span>
            </button>
          </div>
        </section>
      )}

      {/* 7. LEGAL POLICY FOOTER COMPLIANCE BAR */}
      <section className="border-t border-slate-800/80 pt-6 pb-2 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-2">
          {policyDocuments.map((doc) => (
            <button
              key={doc.id}
              onClick={() => openPolicyModal(doc.id)}
              className="text-slate-400 hover:text-white transition-colors underline-offset-2 hover:underline cursor-pointer"
            >
              {doc.title.split('&')[0].trim()}
            </button>
          ))}
        </div>

        <div className="text-[11px] text-slate-500 font-mono">
          © 2026 LIVECALL VIP. All rights reserved. 18+ Only.
        </div>
      </section>

    </div>
  );
};
