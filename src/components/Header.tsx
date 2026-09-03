import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Home as HomeIcon,
  Video,
  Coins,
  Crown,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Compass,
  LayoutGrid,
  Layers,
  Image as ImageIcon,
  DollarSign,
  Settings,
  UserPlus,
  LogIn,
  Sparkles,
  Zap,
  PhoneCall,
  Users,
  MessageCircle,
  LogOut,
  User,
  MapPin,
  TrendingUp,
  Sun,
  Moon,
  Download,
} from 'lucide-react';
import { UserRole } from '../types';
import { getCountryFlag } from '../utils/flags';
import { getUserEffectiveLocation } from '../utils/location';
import { normalizeMediaUrl } from '../utils/r2Storage';
import { getFallbackAvatar } from '../utils/avatars';
import { SvgFlag } from './common/SvgFlag';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenStore: () => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onOpenVip: () => void;
  onOpenSocialCircle?: () => void;
  onOpenChat?: (userId?: string) => void;
  onOpenMatch?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenStore,
  onOpenAuth,
  onOpenVip,
  onOpenSocialCircle,
  onOpenChat,
  onOpenMatch,
}) => {
  const {
    currentUser,
    isLoggedIn,
    switchRolePersona,
    users,
    switchUser,
    logoutUser,
    toggleUserStatus,
    fastTestMode,
    toggleFastTestMode,
    claimDailyBonus,
    dailyBonusClaimed,
    openDailyRewardsModal,
    hasUnclaimedDailyRewards,
    dailyRewardRecord,
    unreadMessagesCount,
    pendingFriendRequestsCount,
    theme,
    toggleTheme,
    systemSettings,
  } = useApp();
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const personaMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPersonaMenu) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (personaMenuRef.current && !personaMenuRef.current.contains(e.target as Node)) {
        setShowPersonaMenu(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPersonaMenu(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick, true);
    document.addEventListener('touchstart', handleOutsideClick, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick, true);
      document.removeEventListener('touchstart', handleOutsideClick, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showPersonaMenu]);

  const handleNav = (tab: string) => {
    setActiveTab(tab);
    setShowPersonaMenu(false);
  };

  const isMale = currentUser.gender === 'male';
  const isFemale = currentUser.gender === 'female';
  const isAdmin = isLoggedIn && currentUser.role === 'admin';

  return (
    <header id="main-app-header" className="sticky top-0 z-50 bg-[#161920]/95 backdrop-blur-md border-b border-slate-800 text-slate-200 shadow-xl w-full">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 min-w-0">
          {/* Left Side: Brand Logo + Home & Admin Navigation */}
          <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
            {/* Brand Logo & Name */}
            <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer shrink-0" onClick={() => handleNav('home')}>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-gradient-to-tr from-pink-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs sm:text-sm shadow-md shadow-pink-600/30 shrink-0">
                V
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <span className="font-extrabold text-sm sm:text-base tracking-tight text-white whitespace-nowrap">
                    LIVE<span className="text-pink-400">CALL</span> VIP
                  </span>
                  <span className="hidden sm:inline-block text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold uppercase tracking-widest font-mono">
                    v4.2
                  </span>
                </div>
                <p className="hidden sm:block text-[10px] text-slate-500 font-mono uppercase tracking-wider">Social 1-on-1 Video Hub</p>
              </div>
            </div>

            {/* Left-Aligned Home & Admin Navigation */}
            {isLoggedIn && (
              <nav className="hidden md:flex items-center space-x-1 bg-[#0F1115] p-1 rounded-lg border border-slate-800 shrink-0">
                <button
                  id="nav-home-tab"
                  onClick={() => handleNav('home')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'home'
                      ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white font-bold shadow-md shadow-pink-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <HomeIcon className="w-3.5 h-3.5" />
                  <span>Home</span>
                </button>

                {isAdmin && (
                  <button
                    id="nav-admin-tab"
                    onClick={() => handleNav('admin')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      activeTab === 'admin'
                        ? 'bg-indigo-600 text-white border border-indigo-500 shadow-md shadow-indigo-600/30'
                        : 'text-indigo-400 hover:text-white hover:bg-slate-800/40'
                    }`}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Admin Terminal</span>
                  </button>
                )}
              </nav>
            )}
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center space-x-1 sm:space-x-2.5 shrink-0">
            {/* Fast Test Mode Toggle */}
            <button
              id="header-fast-timer-toggle"
              onClick={toggleFastTestMode}
              title="Toggle fast 3-second coin burn timer for instant test"
              className={`p-1.5 sm:p-2 rounded-lg text-xs font-medium border flex items-center space-x-1 transition-all shrink-0 cursor-pointer ${
                fastTestMode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{fastTestMode ? 'Fast Test (3s)' : 'Timer'}</span>
            </button>

            {/* Logged In Only: Daily Rewards & Quests Modal Button */}
            {isLoggedIn && (
              <button
                id="header-daily-rewards-btn"
                onClick={openDailyRewardsModal}
                title="Daily Rewards & Quests"
                className={`relative flex items-center space-x-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border text-xs font-mono font-bold transition-all shrink-0 cursor-pointer ${
                  hasUnclaimedDailyRewards
                    ? 'bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/10 border-amber-500/50 text-amber-300 hover:border-amber-400 shadow-md shadow-amber-500/10 animate-pulse'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <span className="text-sm">🎁</span>
                <span className="hidden sm:inline-block">
                  {dailyRewardRecord?.streakCount ? `Day ${dailyRewardRecord.streakCount}` : 'Rewards'}
                </span>
                {hasUnclaimedDailyRewards && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5" />
                )}
              </button>
            )}

            {/* Logged In Only: Wallet / Coin Balance pill */}
            {isLoggedIn && isMale && (
              <button
                id="header-coin-store-btn"
                onClick={onOpenStore}
                className="flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 text-amber-300 hover:border-amber-400 transition-all shadow-sm group shrink-0"
              >
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-bold text-[10px] sm:text-xs shadow-inner group-hover:scale-110 transition-transform shrink-0">
                  🪙
                </div>
                <span className="font-bold text-xs text-amber-200">{currentUser.coinBalance}</span>
                <span className="hidden sm:inline-block text-[10px] bg-amber-500 text-slate-950 px-1.5 py-0.2 font-extrabold rounded-full uppercase">
                  + Buy
                </span>
              </button>
            )}

            {/* Logged In Only: Female Earnings pill (Only if eligible to earn coins) */}
            {isLoggedIn && isFemale && (currentUser.teamLeaderId || systemSettings.enableRegularFemaleCoinEarning) && (
              <button
                id="header-earnings-pill"
                onClick={() => setActiveTab('earnings')}
                className="flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:border-emerald-400 transition-all shrink-0"
              >
                <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
                <span className="font-bold text-xs text-emerald-200">
                  ${(currentUser.totalLifetimeEarnedUSD || 0).toFixed(2)}
                </span>
                <span className="hidden sm:inline-block text-[10px] bg-emerald-500 text-slate-950 px-1.5 py-0.2 font-extrabold rounded-full uppercase">
                  Payout
                </span>
              </button>
            )}

            {/* Logged In Only: Team Leader Guild pill */}
            {isLoggedIn && currentUser.role === 'team_leader' && (
              <button
                id="header-leader-guild-pill"
                onClick={() => setActiveTab('team_leader')}
                className="flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:border-amber-400 transition-all shrink-0 cursor-pointer"
              >
                <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-bold text-xs text-amber-200">
                  {currentUser.agencyName || 'Agency Guild'}
                </span>
                <span className="hidden sm:inline-block text-[10px] bg-amber-500 text-slate-950 px-1.5 py-0.2 font-extrabold rounded-full uppercase">
                  Leader
                </span>
              </button>
            )}

            {/* ========================================================================= */}
            {/* LOGGED OUT STATE: ONLY SIGN IN & REGISTER (NO GUEST PROFILE MENU) */}
            {/* ========================================================================= */}
            {!isLoggedIn ? (
              <div id="header-logged-out-actions" className="flex items-center space-x-2 shrink-0">
                {/* Sign In Button */}
                <button
                  id="header-signin-btn"
                  onClick={() => onOpenAuth('login')}
                  className="flex items-center space-x-1.5 px-3.5 sm:px-4 py-1.5 rounded-full bg-slate-800/90 hover:bg-slate-750 border border-slate-700 text-slate-200 hover:text-white text-xs sm:text-sm font-semibold transition-all shadow-sm shrink-0 cursor-pointer active:scale-95"
                  title="Sign In to your existing account"
                >
                  <LogIn className="w-3.5 h-3.5 text-pink-400" />
                  <span>Sign In</span>
                </button>

                {/* Register Button */}
                <button
                  id="header-register-btn"
                  onClick={() => onOpenAuth('register')}
                  className="flex items-center space-x-1.5 px-3.5 sm:px-4 py-1.5 rounded-full bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-pink-600/25 transition-all shrink-0 cursor-pointer active:scale-95"
                  title="Create a New Free Account"
                >
                  <UserPlus className="w-3.5 h-3.5 text-pink-200" />
                  <span>Register</span>
                </button>

                {/* Theme Switcher Toggle (Dark / Light) */}
                <button
                  id="header-theme-toggle-btn"
                  onClick={toggleTheme}
                  className="p-1.5 sm:p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer flex items-center justify-center shadow-sm"
                  title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  aria-label="Toggle Theme"
                >
                  {theme === 'dark' ? (
                    <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 animate-in fade-in transition-transform hover:rotate-45 duration-300" />
                  ) : (
                    <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400 animate-in fade-in transition-transform hover:-rotate-12 duration-300" />
                  )}
                </button>
              </div>
            ) : (
              /* ========================================================================= */
              /* LOGGED IN STATE: VIP + THEME + PROFILE DROPDOWN MENU */
              /* ========================================================================= */
              <div id="header-logged-in-actions" className="flex items-center space-x-1 sm:space-x-2 shrink-0">
                {/* VIP Status Button */}
                <button
                  id="header-vip-btn"
                  onClick={() => {
                    setShowPersonaMenu(false);
                    onOpenVip();
                  }}
                  className="p-1.5 sm:p-2 rounded-xl bg-gradient-to-r from-amber-500/10 to-purple-500/10 border border-amber-500/30 text-amber-300 hover:border-amber-400 transition-all shrink-0 cursor-pointer"
                  title="VIP Subscription Tiers"
                >
                  <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                </button>

                {/* Theme Switcher Toggle (Dark / Light) */}
                <button
                  id="header-theme-toggle-btn"
                  onClick={toggleTheme}
                  className="p-1.5 sm:p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer flex items-center justify-center shadow-sm"
                  title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  aria-label="Toggle Theme"
                >
                  {theme === 'dark' ? (
                    <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 animate-in fade-in transition-transform hover:rotate-45 duration-300" />
                  ) : (
                    <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400 animate-in fade-in transition-transform hover:-rotate-12 duration-300" />
                  )}
                </button>

                {/* Logged-In User Profile Dropdown Trigger */}
                <div className="relative shrink-0" ref={personaMenuRef}>
                  <button
                    id="header-role-switcher-btn"
                    onClick={() => setShowPersonaMenu(!showPersonaMenu)}
                    className="flex items-center space-x-1.5 sm:space-x-2 p-1 sm:pl-2 sm:pr-3 sm:py-1 rounded-full bg-slate-800/90 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 transition-all shrink-0 cursor-pointer"
                    title="Open Account & Profile Menu"
                  >
                    <div className="relative shrink-0">
                      <img
                        src={normalizeMediaUrl(currentUser.avatarUrl)}
                        alt={currentUser.name}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = getFallbackAvatar(currentUser.name, currentUser.gender, currentUser.role);
                        }}
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover ring-2 ring-pink-500/50 shrink-0 bg-slate-900"
                      />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-slate-900 ${
                          currentUser.onlineStatus === 'online'
                            ? 'bg-emerald-400'
                            : currentUser.onlineStatus === 'busy' || currentUser.onlineStatus === 'in_call'
                            ? 'bg-amber-400'
                            : 'bg-rose-500'
                        }`}
                      />
                    </div>
                    <div className="text-left hidden sm:block">
                      <div className="text-xs font-semibold text-slate-200 flex items-center space-x-1">
                        <span className="truncate max-w-[90px]">{currentUser.name}</span>
                        {currentUser.isVerified && <span className="text-blue-400 text-[10px]">✓</span>}
                      </div>
                      <div className="text-[10px] text-slate-400 capitalize">
                        {currentUser.role.replace('_', ' ')}
                      </div>
                    </div>
                  </button>

                  {/* Logged-In Profile Dropdown Menu */}
                  {showPersonaMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowPersonaMenu(false)} />
                      <div id="persona-dropdown-menu" className="absolute right-0 mt-2 w-76 sm:w-80 bg-[#12141c] border border-slate-800 rounded-2xl shadow-2xl p-3.5 z-50 text-slate-200 animate-in fade-in zoom-in-95 duration-150">
                        <div id="profile-menu-logged-in-state">
                          {/* Current User Card */}
                          <div
                            onClick={() => {
                              setShowPersonaMenu(false);
                              handleNav('profile');
                            }}
                            className="flex items-center space-x-3 pb-3 mb-3 border-b border-slate-800 cursor-pointer hover:bg-slate-800/40 p-1.5 rounded-xl transition-all"
                            title="Click to open full Profile Page"
                          >
                            <div className="relative shrink-0">
                              <img
                                src={normalizeMediaUrl(currentUser.avatarUrl)}
                                alt={currentUser.name}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = getFallbackAvatar(currentUser.name, currentUser.gender, currentUser.role);
                                }}
                                className="w-11 h-11 rounded-full object-cover ring-2 ring-pink-500/50 bg-slate-900"
                              />
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                                  currentUser.onlineStatus === 'online'
                                    ? 'bg-emerald-400'
                                    : currentUser.onlineStatus === 'busy' || currentUser.onlineStatus === 'in_call'
                                    ? 'bg-amber-400'
                                    : 'bg-rose-500'
                                }`}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-1">
                                <span className="font-bold text-sm text-white truncate">{currentUser.name}</span>
                                {currentUser.isVerified && <span className="text-blue-400 text-xs">✓</span>}
                                <span className="text-xs">{currentUser.gender === 'female' ? '👩' : '👨'}</span>
                              </div>
                              <div className="text-[11px] text-slate-400 capitalize flex items-center space-x-1.5 mt-0.5 flex-wrap">
                                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                                  {currentUser.role.replace('_', ' ')}
                                </span>
                                <span className="flex items-center space-x-1.5 text-slate-300 font-medium text-[10px]">
                                  <MapPin className={`w-3 h-3 ${currentUser.isUsingMockLocation ? 'text-pink-400' : 'text-emerald-400'}`} />
                                  <span className="truncate max-w-[90px]">{getUserEffectiveLocation(currentUser).displayCity}</span>
                                  <SvgFlag
                                    countryCode={currentUser.countryCode}
                                    nationality={getUserEffectiveLocation(currentUser).country || currentUser.nationality}
                                    size="xs"
                                    rounded={true}
                                  />
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* User Balance / Earnings Quick View */}
                          <div className="p-2.5 bg-slate-950/80 border border-slate-800/80 rounded-xl mb-3">
                            {currentUser.role === 'male_user' ? (
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-[10px] text-slate-400 uppercase font-semibold">My Balance</div>
                                  <div className="text-sm font-black text-amber-400 font-mono flex items-center space-x-1">
                                    <span>🪙</span>
                                    <span>{currentUser.coinBalance} Coins</span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    onOpenStore();
                                    setShowPersonaMenu(false);
                                  }}
                                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[11px] rounded-lg transition-all shadow-sm cursor-pointer"
                                >
                                  Top Up +
                                </button>
                              </div>
                            ) : (currentUser.teamLeaderId || systemSettings.enableRegularFemaleCoinEarning) ? (
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Creator Earnings</div>
                                  <div className="text-sm font-black text-emerald-400 font-mono flex items-center space-x-1">
                                    <span>🪙</span>
                                    <span>{currentUser.earningsCoins}</span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    handleNav('earnings');
                                  }}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg transition-all shadow-sm cursor-pointer"
                                >
                                  Payouts ➔
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Community Host</div>
                                  <div className="text-xs font-bold text-pink-300 font-mono">
                                    Active Creator
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    handleNav('profile');
                                  }}
                                  className="px-2.5 py-1 bg-pink-600/30 hover:bg-pink-600/50 border border-pink-500/40 text-pink-200 font-bold text-[11px] rounded-lg transition-all shadow-sm cursor-pointer"
                                >
                                  Profile ➔
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Real-time Status Control */}
                          <div className="pb-3 mb-3 border-b border-slate-800">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">My Live Availability</p>
                            <div className="grid grid-cols-3 gap-1.5">
                              <button
                                onClick={() => toggleUserStatus(currentUser.id, 'online')}
                                className={`py-1.5 px-1.5 rounded-xl text-[10px] font-bold flex items-center justify-center space-x-1 border transition-all cursor-pointer ${
                                  currentUser.onlineStatus === 'online'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 ring-1 ring-emerald-500/30'
                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <span>Available</span>
                              </button>

                              <button
                                onClick={() => toggleUserStatus(currentUser.id, 'busy')}
                                className={`py-1.5 px-1.5 rounded-xl text-[10px] font-bold flex items-center justify-center space-x-1 border transition-all cursor-pointer ${
                                  currentUser.onlineStatus === 'busy' || currentUser.onlineStatus === 'in_call'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 ring-1 ring-amber-500/30'
                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                <span>Busy</span>
                              </button>

                              <button
                                onClick={() => toggleUserStatus(currentUser.id, 'offline')}
                                className={`py-1.5 px-1.5 rounded-xl text-[10px] font-bold flex items-center justify-center space-x-1 border transition-all cursor-pointer ${
                                  currentUser.onlineStatus === 'offline'
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 ring-1 ring-rose-500/30'
                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                <span>Offline</span>
                              </button>
                            </div>
                          </div>

                          {/* Profile Quick Links */}
                          <div className="space-y-1">
                            <button
                              id="persona-open-profile-btn"
                              onClick={() => {
                                setShowPersonaMenu(false);
                                handleNav('profile');
                              }}
                              className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800/80 hover:bg-slate-800 transition-colors border border-slate-700/80 cursor-pointer"
                            >
                              <User className="w-4 h-4 text-white" />
                              <span className="font-bold text-white">Profile</span>
                              <span className="ml-auto text-[10px] text-white/80 font-mono">View ➔</span>
                            </button>

                            <button
                              id="persona-open-analytics-btn"
                              onClick={() => {
                                setShowPersonaMenu(false);
                                handleNav('earnings');
                              }}
                              className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800/80 hover:bg-slate-800 transition-colors border border-slate-700/80 cursor-pointer"
                            >
                              {isFemale && (currentUser.teamLeaderId || systemSettings.enableRegularFemaleCoinEarning) ? (
                                <DollarSign className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <TrendingUp className="w-4 h-4 text-pink-400" />
                              )}
                              <span className="font-bold text-white">
                                {isFemale
                                  ? (currentUser.teamLeaderId || systemSettings.enableRegularFemaleCoinEarning
                                      ? 'Earnings & Analytics'
                                      : 'Activity & Performance')
                                  : 'Spending & Analytics'}
                              </span>
                              <span className="ml-auto text-[10px] text-white/80 font-mono">Hub ➔</span>
                            </button>

                            {onOpenSocialCircle && (
                              <button
                                id="persona-open-social-btn"
                                onClick={() => {
                                  setShowPersonaMenu(false);
                                  onOpenSocialCircle();
                                }}
                                className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800/80 hover:bg-slate-800 transition-colors border border-slate-700/80 cursor-pointer"
                              >
                                <Users className="w-4 h-4 text-pink-400" />
                                <span className="font-bold text-white">Friends & Social Circle</span>
                              </button>
                            )}

                            <button
                              id="persona-open-vip-btn"
                              onClick={() => {
                                setShowPersonaMenu(false);
                                onOpenVip();
                              }}
                              className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 transition-colors border border-amber-500/30 cursor-pointer"
                            >
                              <Crown className="w-4 h-4 text-amber-400" />
                              <span className="font-bold">VIP Membership Tiers</span>
                            </button>

                            {currentUser.role === 'team_leader' && (
                              <button
                                id="persona-open-team-leader-hub-btn"
                                onClick={() => {
                                  setShowPersonaMenu(false);
                                  handleNav('team_leader');
                                }}
                                className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 transition-colors shadow-md shadow-amber-500/20 cursor-pointer"
                              >
                                <Crown className="w-4 h-4 text-slate-950" />
                                <span className="font-extrabold text-slate-950">Agency Guild Hub</span>
                                <span className="ml-auto text-[10px] bg-slate-950 text-amber-300 px-1.5 py-0.5 rounded font-mono font-bold">
                                  Manage ➔
                                </span>
                              </button>
                            )}

                            {isAdmin && (
                              <button
                                onClick={() => {
                                  handleNav('admin');
                                }}
                                className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-purple-300 hover:bg-purple-950/40 transition-colors border border-purple-500/40 cursor-pointer"
                              >
                                <Settings className="w-4 h-4 text-purple-400" />
                                <span className="font-bold text-purple-300">Open Admin Control Center</span>
                              </button>
                            )}

                            <button
                              id="persona-toggle-theme-btn"
                              onClick={() => {
                                toggleTheme();
                              }}
                              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800/80 hover:bg-slate-800 transition-colors border border-slate-700/80 cursor-pointer"
                            >
                              <div className="flex items-center space-x-2">
                                {theme === 'dark' ? (
                                  <Sun className="w-4 h-4 text-white" />
                                ) : (
                                  <Moon className="w-4 h-4 text-white" />
                                )}
                                <span className="font-bold text-white">Theme</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                theme === 'dark'
                                  ? 'bg-slate-700 text-white'
                                  : 'bg-indigo-500/20 text-white'
                              }`}>
                                {theme === 'dark' ? 'Dark 🌙' : 'Light ☀️'}
                              </span>
                            </button>

                            <button
                              id="persona-install-app-btn"
                              onClick={() => {
                                setShowPersonaMenu(false);
                                localStorage.removeItem('livecall_pwa_dismissed');
                                window.location.reload();
                              }}
                              className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800/80 hover:bg-slate-800 transition-colors border border-slate-700/80 cursor-pointer"
                            >
                              <Download className="w-4 h-4 text-white" />
                              <span className="font-bold text-white">Install LiveCall PWA App</span>
                            </button>

                            {/* Log Out Button - Redirects to Home */}
                            <button
                              id="persona-logout-btn"
                              onClick={() => {
                                setShowPersonaMenu(false);
                                logoutUser();
                                handleNav('home');
                              }}
                              className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors cursor-pointer border-t border-slate-800/80 pt-2.5 mt-1"
                            >
                              <LogOut className="w-4 h-4" />
                              <span>Log Out</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Sub-Header Bar (Signed-in State Only) */}
      {isLoggedIn && (
        <div id="desktop-sub-header" className="hidden md:block w-full bg-[#101319]/95 border-t border-slate-800/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-2 flex items-center justify-between">
            
            {/* Group 1: discovery, swipe card, moment, quick match, chat */}
            <div className="flex items-center space-x-1.5 lg:space-x-2">
              <div className="flex items-center space-x-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 shadow-inner">
                {/* 1. Discovery */}
                <button
                  id="subheader-discovery-tab"
                  onClick={() => handleNav('discovery')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'discovery'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                  title="Browse & Discover Creators"
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Discovery</span>
                </button>

                {/* 2. Swipe Card */}
                <button
                  id="subheader-swipe-tab"
                  onClick={() => handleNav('swipe')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'swipe'
                      ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                  title="Swipe Matching Cards"
                >
                  <Layers className="w-3.5 h-3.5 text-pink-400" />
                  <span>Swipe Card</span>
                </button>

                {/* 3. Moment */}
                <button
                  id="subheader-moments-tab"
                  onClick={() => handleNav('moments')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'moments'
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                  title="Explore Social Moments & Video Reels"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                  <span>Moment</span>
                </button>

                {/* 4. Quick Match */}
                {onOpenMatch && (
                  <button
                    id="subheader-match-btn"
                    onClick={() => {
                      setShowPersonaMenu(false);
                      onOpenMatch();
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-300 hover:text-white hover:bg-amber-500/20 transition-all cursor-pointer"
                    title="Launch 1-on-1 Quick Match Roulette"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
                    <span>Quick Match</span>
                  </button>
                )}

                {/* 5. Chat */}
                {onOpenChat && (
                  <button
                    id="subheader-chat-btn"
                    onClick={() => onOpenChat()}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer relative ${
                      unreadMessagesCount > 0
                        ? 'bg-pink-500/20 text-pink-200 border border-pink-500/40 hover:bg-pink-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                    title="Open Chat & Direct Messages"
                  >
                    <div className="relative">
                      <MessageCircle className="w-3.5 h-3.5 text-pink-400" />
                      {unreadMessagesCount > 0 && (
                        <span className="absolute -top-1.5 -right-2 px-1 min-w-[14px] h-[14px] rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center border border-slate-900 animate-pulse">
                          {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                        </span>
                      )}
                    </div>
                    <span>Chat</span>
                    {unreadMessagesCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-500/30 text-rose-300 text-[10px] font-mono">
                        {unreadMessagesCount}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Group 2: Call logs & friend request */}
            <div className="flex items-center space-x-1.5 lg:space-x-2">
              <div className="flex items-center space-x-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 shadow-inner">
                {/* Call Logs */}
                <button
                  id="subheader-call-logs-tab"
                  onClick={() => handleNav('call_logs')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'call_logs'
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                  title="View Call Logs & Records"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-rose-400" />
                  <span>Call Logs</span>
                </button>

                {/* Friend Request */}
                <button
                  id="subheader-friend-requests-btn"
                  onClick={() => {
                    if (onOpenSocialCircle) {
                      onOpenSocialCircle();
                    } else if (onOpenChat) {
                      onOpenChat();
                    } else {
                      handleNav('call_logs');
                    }
                  }}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer relative ${
                    pendingFriendRequestsCount > 0
                      ? 'bg-gradient-to-r from-amber-500/20 to-pink-500/20 border border-amber-500/50 text-amber-200 hover:border-amber-400'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                  title="Manage Friends and Pending Friend Requests"
                >
                  <div className="relative">
                    <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                    {pendingFriendRequestsCount > 0 && (
                      <span className="absolute -top-1.5 -right-2 px-1 min-w-[14px] h-[14px] rounded-full bg-amber-500 text-slate-950 text-[8px] font-black flex items-center justify-center border border-slate-900 animate-pulse">
                        {pendingFriendRequestsCount}
                      </span>
                    )}
                  </div>
                  <span>Friend Request</span>
                  {pendingFriendRequestsCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-extrabold text-[9px] uppercase tracking-tight ml-1 animate-pulse">
                      {pendingFriendRequestsCount} New
                    </span>
                  )}
                </button>

                {/* Open Friends & Favorites Circle */}
                {onOpenSocialCircle && (
                  <button
                    id="subheader-social-circle-btn"
                    onClick={onOpenSocialCircle}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-300 hover:text-white hover:bg-amber-500/20 transition-all cursor-pointer"
                    title="Open Friends & Favorites Circle Drawer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Circle</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </header>
  );
};

