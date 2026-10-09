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
  onOpenSocialCircle?: () => void;
  onOpenChat?: (userId?: string) => void;
  onOpenMatch?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenStore,
  onOpenAuth,
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
    claimDailyBonus,
    dailyBonusClaimed,
    openDailyRewardsModal,
    hasUnclaimedDailyRewards,
    dailyRewardRecord,
    unreadMessagesCount,
    pendingFriendRequestsCount,
    missedCallsCount,
    markCallLogsSeen,
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
    if (tab === 'call_logs') markCallLogsSeen();
    setActiveTab(tab);
    setShowPersonaMenu(false);
  };

  const isMale = currentUser.gender === 'male';
  const isFemale = currentUser.gender === 'female';
  const isAdmin = isLoggedIn && currentUser.role === 'admin';

  return (
    <header id="main-app-header" className="sticky top-0 z-50 shrink-0 bg-chrome backdrop-blur-xl border-b border-hairline text-app w-full">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-12 sm:h-14 min-w-0">
          {/* Left Side: Brand Logo + Home & Admin Navigation */}
          <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
            {/* Brand Logo & Name */}
            <div className="flex items-center space-x-2 cursor-pointer shrink-0" onClick={() => handleNav('home')}>
              <div className="w-8 h-8 rounded-xl bg-flirt text-white flex items-center justify-center font-display font-bold text-sm shadow-brand shrink-0">
                M
              </div>
              <span className="font-display font-bold text-base sm:text-lg tracking-tight text-app-heading whitespace-nowrap">
                Mingle<span className="text-brand">call</span>
              </span>
            </div>

            {/* Left-Aligned Home & Admin Navigation */}
            {isLoggedIn && (
              <nav className="hidden md:flex items-center space-x-1 bg-app-card-subtle p-1 rounded-full border border-hairline shrink-0">
                <button
                  id="nav-home-tab"
                  onClick={() => handleNav('home')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'home'
                      ? 'bg-flirt text-white shadow-brand'
                      : 'text-app-muted hover:text-app-heading hover:bg-brand-soft'
                  }`}
                >
                  <HomeIcon className="w-3.5 h-3.5" />
                  <span>Home</span>
                </button>

                {isAdmin && (
                  <button
                    id="nav-admin-tab"
                    onClick={() => handleNav('admin')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      activeTab === 'admin'
                        ? 'bg-app-card text-app-heading border border-hairline'
                        : 'text-app-muted hover:text-app-heading hover:bg-brand-soft'
                    }`}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Admin</span>
                  </button>
                )}
              </nav>
            )}
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center space-x-1 sm:space-x-2.5 shrink-0">
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
                  className="flex items-center space-x-1.5 px-3.5 sm:px-4 py-1.5 rounded-app bg-app-card hover:bg-app-card-subtle border border-app text-app-heading text-xs sm:text-sm font-semibold transition-all shadow-app-sm shrink-0 cursor-pointer active:scale-95"
                  title="Sign In to your existing account"
                >
                  <LogIn className="w-3.5 h-3.5 text-brand" />
                  <span>Sign In</span>
                </button>

                {/* Register Button */}
                <button
                  id="header-register-btn"
                  onClick={() => onOpenAuth('register')}
                  className="flex items-center space-x-1.5 px-3.5 sm:px-4 py-1.5 rounded-full bg-flirt hover:brightness-110 text-white font-semibold text-xs sm:text-sm shadow-brand transition-all shrink-0 cursor-pointer active:scale-95"
                  title="Create a New Free Account"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Join free</span>
                </button>
              </div>
            ) : (
              /* ========================================================================= */
              /* LOGGED IN STATE: PROFILE DROPDOWN MENU */
              /* ========================================================================= */
              <div id="header-logged-in-actions" className="flex items-center space-x-1 sm:space-x-2 shrink-0">
                {/* Logged-In User Profile Dropdown Trigger */}
                <div className="relative shrink-0" ref={personaMenuRef}>
                  <button
                    id="header-role-switcher-btn"
                    onClick={() => setShowPersonaMenu(!showPersonaMenu)}
                    className="flex items-center space-x-1.5 sm:space-x-2 p-1 sm:pl-2 sm:pr-3 sm:py-1 rounded-full bg-app-card-subtle hover:bg-brand-soft border border-hairline hover:border-brand/40 transition-all shrink-0 cursor-pointer"
                    title="Open Account & Profile Menu"
                  >
                    <div className="relative shrink-0">
                      <img
                        src={normalizeMediaUrl(currentUser.avatarUrl)}
                        alt={currentUser.name}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = getFallbackAvatar(currentUser.name, currentUser.gender, currentUser.role);
                        }}
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover ring-2 ring-pink-500/50 shrink-0 bg-app-input"
                      />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[var(--app-card)] ${
                          currentUser.onlineStatus === 'online'
                            ? 'bg-emerald-400'
                            : currentUser.onlineStatus === 'busy' || currentUser.onlineStatus === 'in_call'
                            ? 'bg-amber-400'
                            : 'bg-rose-500'
                        }`}
                      />
                    </div>
                    <div className="text-left hidden sm:block">
                      <div className="text-xs font-semibold text-app-heading flex items-center space-x-1">
                        <span className="truncate max-w-[90px]">{currentUser.name}</span>
                        {currentUser.isVerified && <span className="text-blue-400 text-[10px]">✓</span>}
                      </div>
                      <div className="text-[10px] text-app-muted capitalize">
                        {currentUser.role.replace('_', ' ')}
                      </div>
                    </div>
                  </button>

                  {/* Logged-In Profile Dropdown Menu */}
                  {showPersonaMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowPersonaMenu(false)} />
                      <div id="persona-dropdown-menu" className="absolute right-0 mt-2 w-76 sm:w-80 bg-app-card border border-hairline rounded-2xl shadow-app-lg p-3.5 z-50 text-app-heading animate-in fade-in zoom-in-95 duration-150">
                        <div id="profile-menu-logged-in-state">
                          {/* Current User Card */}
                          <div
                            onClick={() => {
                              setShowPersonaMenu(false);
                              handleNav('profile');
                            }}
                            className="flex items-center space-x-3 pb-3 mb-3 border-b border-hairline cursor-pointer hover:bg-app-input p-1.5 rounded-xl transition-all"
                            title="Click to open full Profile Page"
                          >
                            <div className="relative shrink-0">
                              <img
                                src={normalizeMediaUrl(currentUser.avatarUrl)}
                                alt={currentUser.name}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = getFallbackAvatar(currentUser.name, currentUser.gender, currentUser.role);
                                }}
                                className="w-11 h-11 rounded-full object-cover ring-2 ring-pink-500/50 bg-app-input"
                              />
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--app-card)] ${
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
                                <span className="font-bold text-sm text-app-heading truncate">{currentUser.name}</span>
                                {currentUser.isVerified && <span className="text-blue-400 text-xs">✓</span>}
                                <span className="text-xs">{currentUser.gender === 'female' ? '👩' : '👨'}</span>
                              </div>
                              <div className="text-[11px] text-app-muted capitalize flex items-center space-x-1.5 mt-0.5 flex-wrap">
                                <span className="px-1.5 py-0.2 rounded bg-app-input text-app-muted font-mono text-[10px] border border-hairline">
                                  {currentUser.role.replace('_', ' ')}
                                </span>
                                <span className="flex items-center space-x-1.5 text-app-muted font-medium text-[10px]">
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
                          <div className="p-2.5 bg-app-input border border-hairline rounded-xl mb-3">
                            {currentUser.role === 'male_user' ? (
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-[10px] text-app-muted uppercase font-semibold">My Balance</div>
                                  <div className="text-sm font-black text-amber-500 font-mono flex items-center space-x-1">
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
                                  <div className="text-[10px] text-app-muted uppercase font-semibold">Creator Earnings</div>
                                  <div className="text-sm font-black text-emerald-500 font-mono flex items-center space-x-1">
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
                                  <div className="text-[10px] text-app-muted uppercase font-semibold">Community Host</div>
                                  <div className="text-xs font-bold text-pink-500 font-mono">
                                    Active Creator
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    handleNav('profile');
                                  }}
                                  className="px-2.5 py-1 bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/40 text-pink-500 font-bold text-[11px] rounded-lg transition-all shadow-sm cursor-pointer"
                                >
                                  Profile ➔
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Real-time Status Control */}
                          <div className="pb-3 mb-3 border-b border-hairline">
                            <p className="text-[10px] font-semibold text-app-muted uppercase tracking-wider mb-1.5">My Live Availability</p>
                            <div className="grid grid-cols-3 gap-1.5">
                              <button
                                onClick={() => toggleUserStatus(currentUser.id, 'online')}
                                className={`py-1.5 px-1.5 rounded-xl text-[10px] font-bold flex items-center justify-center space-x-1 border transition-all cursor-pointer ${
                                  currentUser.onlineStatus === 'online'
                                    ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50 ring-1 ring-emerald-500/30'
                                    : 'bg-app-input text-app-muted border-hairline hover:text-app-heading'
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <span>Available</span>
                              </button>

                              <button
                                onClick={() => toggleUserStatus(currentUser.id, 'busy')}
                                className={`py-1.5 px-1.5 rounded-xl text-[10px] font-bold flex items-center justify-center space-x-1 border transition-all cursor-pointer ${
                                  currentUser.onlineStatus === 'busy' || currentUser.onlineStatus === 'in_call'
                                    ? 'bg-amber-500/20 text-amber-500 border-amber-500/50 ring-1 ring-amber-500/30'
                                    : 'bg-app-input text-app-muted border-hairline hover:text-app-heading'
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                <span>Busy</span>
                              </button>

                              <button
                                onClick={() => toggleUserStatus(currentUser.id, 'offline')}
                                className={`py-1.5 px-1.5 rounded-xl text-[10px] font-bold flex items-center justify-center space-x-1 border transition-all cursor-pointer ${
                                  currentUser.onlineStatus === 'offline'
                                    ? 'bg-rose-500/20 text-rose-500 border-rose-500/50 ring-1 ring-rose-500/30'
                                    : 'bg-app-input text-app-muted border-hairline hover:text-app-heading'
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
                              className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-app-muted hover:text-app-heading bg-app-input hover:bg-brand-soft transition-colors border border-hairline cursor-pointer"
                            >
                              <User className="w-4 h-4 shrink-0" />
                              <span className="font-bold">Profile</span>
                              <span className="ml-auto text-[10px] font-mono opacity-80">View ➔</span>
                            </button>

                            <button
                              id="persona-open-analytics-btn"
                              onClick={() => {
                                setShowPersonaMenu(false);
                                handleNav('earnings');
                              }}
                              className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-app-muted hover:text-app-heading bg-app-input hover:bg-brand-soft transition-colors border border-hairline cursor-pointer"
                            >
                              {isFemale && (currentUser.teamLeaderId || systemSettings.enableRegularFemaleCoinEarning) ? (
                                <DollarSign className="w-4 h-4 shrink-0" />
                              ) : (
                                <TrendingUp className="w-4 h-4 shrink-0" />
                              )}
                              <span className="font-bold">
                                {isFemale
                                  ? (currentUser.teamLeaderId || systemSettings.enableRegularFemaleCoinEarning
                                      ? 'Earnings & Analytics'
                                      : 'Activity & Performance')
                                  : 'Spending & Analytics'}
                              </span>
                              <span className="ml-auto text-[10px] font-mono opacity-80">Hub ➔</span>
                            </button>

                            {onOpenSocialCircle && (
                              <button
                                id="persona-open-social-btn"
                                onClick={() => {
                                  setShowPersonaMenu(false);
                                  onOpenSocialCircle();
                                }}
                                className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-app-muted hover:text-app-heading bg-app-input hover:bg-brand-soft transition-colors border border-hairline cursor-pointer"
                              >
                                <Users className="w-4 h-4 shrink-0" />
                                <span className="font-bold">Friends & Social Circle</span>
                              </button>
                            )}

                            <button
                              id="persona-install-app-btn"
                              onClick={() => {
                                setShowPersonaMenu(false);
                                localStorage.removeItem('livecall_pwa_dismissed');
                                window.location.reload();
                              }}
                              className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-app-muted hover:text-app-heading bg-app-input hover:bg-brand-soft transition-colors border border-hairline cursor-pointer"
                            >
                              <Download className="w-4 h-4 shrink-0" />
                              <span className="font-bold">Install LiveCall PWA App</span>
                            </button>

                            {/* Log Out Button - Redirects to Home */}
                            <button
                              id="persona-logout-btn"
                              onClick={() => {
                                setShowPersonaMenu(false);
                                logoutUser();
                                handleNav('home');
                              }}
                              className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer border-t border-hairline pt-2.5 mt-1"
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
        <div id="desktop-sub-header" className="hidden md:block w-full bg-chrome border-t border-hairline backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-2 flex items-center justify-between">
            
            {/* Group 1: discovery, swipe card, moment, quick match, chat */}
            <div className="flex items-center space-x-1.5 lg:space-x-2">
              <div className="flex items-center space-x-1 bg-app-card-subtle p-1 rounded-app border border-hairline">
                {/* 1. Discovery */}
                <button
                  id="subheader-discovery-tab"
                  onClick={() => handleNav('discovery')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'discovery'
                      ? 'bg-brand text-white shadow-brand'
                      : 'text-app-muted hover:text-app-heading hover:bg-brand-soft'
                  }`}
                  title="Browse & Discover Creators"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Discover</span>
                </button>

                {/* 2. Swipe Card */}
                <button
                  id="subheader-swipe-tab"
                  onClick={() => handleNav('swipe')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'swipe'
                      ? 'bg-brand text-white shadow-brand'
                      : 'text-app-muted hover:text-app-heading hover:bg-brand-soft'
                  }`}
                  title="Swipe Matching Cards"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Swipe</span>
                </button>

                {/* 3. Moment */}
                <button
                  id="subheader-moments-tab"
                  onClick={() => handleNav('moments')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'moments'
                      ? 'bg-brand text-white shadow-brand'
                      : 'text-app-muted hover:text-app-heading hover:bg-brand-soft'
                  }`}
                  title="Explore Social Moments & Video Reels"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Moments</span>
                </button>

                {/* 4. Quick Match */}
                {onOpenMatch && (
                  <button
                    id="subheader-match-btn"
                    onClick={() => {
                      setShowPersonaMenu(false);
                      onOpenMatch();
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-semibold text-app-muted hover:text-brand hover:bg-brand-soft transition-all cursor-pointer"
                    title="Launch 1-on-1 Quick Match Roulette"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Match</span>
                  </button>
                )}

                {/* 5. Chat */}
                {onOpenChat && (
                  <button
                    id="subheader-chat-btn"
                    onClick={() => onOpenChat()}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-semibold transition-all cursor-pointer relative ${
                      unreadMessagesCount > 0
                        ? 'bg-brand-soft text-brand border border-brand/30'
                        : 'text-app-muted hover:text-app-heading hover:bg-brand-soft'
                    }`}
                    title="Open Chat & Direct Messages"
                  >
                    <div className="relative">
                      <MessageCircle className="w-3.5 h-3.5" />
                      {unreadMessagesCount > 0 && (
                        <span className="absolute -top-1.5 -right-2 px-1 min-w-[14px] h-[14px] rounded-full bg-brand text-white text-[8px] font-bold flex items-center justify-center border border-[var(--app-bg)]">
                          {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                        </span>
                      )}
                    </div>
                    <span>Chat</span>
                  </button>
                )}
              </div>
            </div>

            {/* Group 2: Call logs & friend request */}
            <div className="flex items-center space-x-1.5 lg:space-x-2">
              <div className="flex items-center space-x-1 bg-app-card-subtle p-1 rounded-app border border-hairline">
                {/* Call Logs */}
                <button
                  id="subheader-call-logs-tab"
                  onClick={() => handleNav('call_logs')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-semibold transition-all cursor-pointer relative ${
                    activeTab === 'call_logs'
                      ? 'bg-brand text-white shadow-brand'
                      : missedCallsCount > 0
                        ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                        : 'text-app-muted hover:text-app-heading hover:bg-brand-soft'
                  }`}
                  title="View Call Logs & Records"
                >
                  <div className="relative">
                    <PhoneCall className="w-3.5 h-3.5" />
                    {missedCallsCount > 0 && (
                      <span className="absolute -top-1.5 -right-2 px-1 min-w-[14px] h-[14px] rounded-full bg-rose-500 text-white text-[8px] font-bold flex items-center justify-center border border-[var(--app-bg)]">
                        {missedCallsCount > 9 ? '9+' : missedCallsCount}
                      </span>
                    )}
                  </div>
                  <span>Calls</span>
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
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-semibold transition-all cursor-pointer relative ${
                    pendingFriendRequestsCount > 0
                      ? 'bg-brand-soft border border-brand/30 text-brand'
                      : 'text-app-muted hover:text-app-heading hover:bg-brand-soft'
                  }`}
                  title="Manage Friends and Pending Friend Requests"
                >
                  <div className="relative">
                    <UserPlus className="w-3.5 h-3.5" />
                    {pendingFriendRequestsCount > 0 && (
                      <span className="absolute -top-1.5 -right-2 px-1 min-w-[14px] h-[14px] rounded-full bg-amber-500 text-slate-950 text-[8px] font-bold flex items-center justify-center border border-[var(--app-bg)]">
                        {pendingFriendRequestsCount}
                      </span>
                    )}
                  </div>
                  <span>Friends</span>
                </button>

                {/* Open Friends & Favorites Circle */}
                {onOpenSocialCircle && (
                  <button
                    id="subheader-social-circle-btn"
                    onClick={onOpenSocialCircle}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-semibold text-app-muted hover:text-app-heading hover:bg-brand-soft transition-all cursor-pointer"
                    title="Open Friends & Favorites Circle Drawer"
                  >
                    <Users className="w-3.5 h-3.5" />
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

