import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Search,
  Filter,
  Video,
  PhoneCall,
  MessageSquare,
  ShieldCheck,
  Globe,
  Languages,
  Sparkles,
  SlidersHorizontal,
  Crown,
  LayoutGrid,
  Zap,
  Target,
  Gift,
  CheckCircle2,
  MapPin,
  Flame,
  Award,
  TrendingUp,
  Star,
  RefreshCw,
  Users,
} from 'lucide-react';
import { UserProfile, CreatorMetrics } from '../../types';
import { rankCreatorsForDiscovery, isCurrentlyPeakHour } from '../../utils/discoveryAlgorithm';
import { ProfileDetailModal } from './ProfileDetailModal';
import { getCountryFlag } from '../../utils/flags';
import { getUserEffectiveLocation } from '../../utils/location';
import { normalizeMediaUrl } from '../../utils/r2Storage';
import { getFallbackAvatar } from '../../utils/avatars';
import { QuickMatchRoulette } from './QuickMatchRoulette';
import {
  getAllowedCountries,
  getAllowedLanguages,
  getAllowedZodiacs,
  getAllowedInterests,
} from '../../utils/taxonomies';
import { SvgFlag } from '../common/SvgFlag';
import { ZodiacIcon } from '../common/ZodiacIcon';
import { SearchableFilterDropdown } from '../common/SearchableFilterDropdown';

interface DiscoveryGridProps {
  onStartCall: (userId: string) => void;
  onOpenChat: (userId: string) => void;
  onOpenMatch?: () => void;
  onNavigateToSwipe?: () => void;
}

export const DiscoveryGrid: React.FC<DiscoveryGridProps> = ({ onStartCall, onOpenChat, onOpenMatch, onNavigateToSwipe }) => {
  const {
    users,
    currentUser,
    systemSettings,
    creatorGoals,
    contributeToGoal,
    favorites,
    toggleFavorite,
    isFriend,
    syncUsersFromSupabase,
    creatorMetricsMap,
  } = useApp();
  const [isRouletteOpen, setIsRouletteOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [discoveryTab, setDiscoveryTab] = useState<'all' | 'ready_now' | 'trending' | 'gold_silver'>('all');

  // Sync latest user details from Supabase when Discovery Grid opens
  useEffect(() => {
    syncUsersFromSupabase(false);
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await syncUsersFromSupabase(true);
    setTimeout(() => setIsSyncing(false), 600);
  };

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(75);
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [selectedZodiac, setSelectedZodiac] = useState('all');
  const [selectedInterest, setSelectedInterest] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'online' | 'busy' | 'offline'>('all');
  const [showSelf, setShowSelf] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Dynamic taxonomy lists derived from global admin governance
  const allowedCountries = getAllowedCountries(systemSettings.allowedCountryCodes);
  const allowedLanguages = getAllowedLanguages(systemSettings.allowedLanguages || (systemSettings as any).allowedLanguageCodes);
  const allowedZodiacs = getAllowedZodiacs(systemSettings.allowedZodiacSigns || (systemSettings as any).allowedZodiacCodes);
  const allowedInterests = getAllowedInterests(systemSettings.allowedInterests || (systemSettings as any).allowedInterestIds);

  // Status counts (excluding Team Leaders and Admins from callable hosts)
  const allOtherUsers = users.filter(
    (u) =>
      u.role !== 'team_leader' &&
      u.role !== 'agency_manager' &&
      u.role !== 'admin' &&
      (showSelf ? true : u.id !== currentUser.id)
  );
  const onlineCount = allOtherUsers.filter((u) => u.onlineStatus === 'online').length;
  const busyCount = allOtherUsers.filter((u) => u.onlineStatus === 'busy' || u.onlineStatus === 'in_call').length;
  const offlineCount = allOtherUsers.filter((u) => u.onlineStatus === 'offline').length;

  // Selected User for detail modal
  const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfile | null>(null);

  // User interest matching
  const userInterestedIn = currentUser.interestedIn && currentUser.interestedIn.length > 0
    ? currentUser.interestedIn
    : (currentUser.gender === 'female' ? ['male'] : ['female']);

  // Filter logic
  const filteredUsers = users.filter((u) => {
    // Exclude Team Leaders, Agency Managers, and Admins from callable live stream discovery
    if (u.role === 'team_leader' || u.role === 'agency_manager' || u.role === 'admin') return false;

    // Exclude current logged in user unless showSelf is checked
    if (!showSelf && u.id === currentUser.id) return false;

    // Automatically filter on basis of user's profile interestedIn
    const isFemaleTarget = u.gender === 'female' || u.role === 'female_creator' || u.role === 'female_host';
    const isMaleTarget = u.gender === 'male' || u.role === 'male_user';
    const isOtherTarget = u.gender === 'other' || u.role === 'other_user';

    if (!userInterestedIn.includes('everyone') && !userInterestedIn.includes('all')) {
      let isInterestMatch = false;
      if (isFemaleTarget && userInterestedIn.includes('female')) isInterestMatch = true;
      if (isMaleTarget && userInterestedIn.includes('male')) isInterestMatch = true;
      if (isOtherTarget && (userInterestedIn.includes('other') || userInterestedIn.includes('others'))) isInterestMatch = true;
      if (!isInterestMatch) return false;
    }

    // AI Verified filter
    if (verifiedOnly && !u.isVerified) return false;

    // Search query
    if (
      searchQuery &&
      !u.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !u.bio.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !u.nationality.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    // Age
    if (u.age < minAge || u.age > maxAge) return false;

    // Dynamic Country Filter
    if (selectedCountry !== 'all') {
      const matchCode = u.countryCode && u.countryCode.toLowerCase() === selectedCountry.toLowerCase();
      const matchName = u.nationality && u.nationality.toLowerCase() === selectedCountry.toLowerCase();
      if (!matchCode && !matchName) return false;
    }

    // Dynamic Spoken Language Filter (Matches strictly against FIRST/Primary Language)
    if (selectedLanguage !== 'all') {
      const primaryLang = (u.spokenLanguages && u.spokenLanguages.length > 0) ? u.spokenLanguages[0] : 'English';
      if (primaryLang.trim().toLowerCase() !== selectedLanguage.trim().toLowerCase()) {
        return false;
      }
    }

    // Dynamic Zodiac Sign Filter
    if (selectedZodiac !== 'all') {
      const matchZodiac = u.zodiac && u.zodiac.toLowerCase().includes(selectedZodiac.toLowerCase());
      if (!matchZodiac) return false;
    }

    // Dynamic Interests Filter
    if (selectedInterest !== 'all') {
      const matchInterest = u.interests && u.interests.some(i => i.toLowerCase() === selectedInterest.toLowerCase());
      if (!matchInterest) return false;
    }

    // Status
    if (selectedStatus === 'online' && u.onlineStatus !== 'online') return false;
    if (selectedStatus === 'busy' && u.onlineStatus !== 'busy' && u.onlineStatus !== 'in_call') return false;
    if (selectedStatus === 'offline' && u.onlineStatus !== 'offline') return false;

    return true;
  });

  // Apply Algorithmic Weighted Discovery Matrix & Rotational Ranking
  const rankedItems = rankCreatorsForDiscovery(filteredUsers, creatorMetricsMap, {
    peakHoursStart: systemSettings.peakHoursStart,
    peakHoursEnd: systemSettings.peakHoursEnd,
    peakHoursEnabled: systemSettings.peakHoursEnabled,
    readyNowOnly: discoveryTab === 'ready_now',
    trendingOnly: discoveryTab === 'trending',
  }).filter((item) => {
    if (discoveryTab === 'gold_silver') {
      return item.tier === 'gold' || item.tier === 'silver';
    }
    return true;
  });

  const populatedDiscoveryUsers = rankedItems.map((r) => r.user);

  // Realtime selected profile reference
  const currentSelectedUser = selectedUserProfile
    ? users.find((u) => u.id === selectedUserProfile.id) || selectedUserProfile
    : null;

  return (
    <div id="discovery-grid-module" className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 pt-1.5 sm:pt-2 pb-6 space-y-3.5">
      {/* Filter Toolbar */}
      <div className="bg-[#161920] border border-slate-800 rounded-xl p-3 sm:p-3.5 space-y-3 shadow-xl">
            <div className="flex items-center gap-2.5 w-full">
              {/* Search Box */}
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  id="discovery-search-input"
                  type="text"
                  placeholder="Search hosts by name, country, interests or languages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#0F1115] border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                />
              </div>

              {/* Supabase Live Sync Button */}
              <button
                id="discovery-supabase-sync-btn"
                onClick={handleManualSync}
                disabled={isSyncing}
                title="Synchronize all host details from Supabase database"
                className="shrink-0 px-3 py-2 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 transition-all font-mono whitespace-nowrap cursor-pointer bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/50 hover:border-emerald-600 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sync Supabase</span>
                <span className="sm:hidden">Sync</span>
              </button>

              {/* Filter Button */}
              <button
                id="discovery-toggle-filters-btn"
                onClick={() => setShowFilters(!showFilters)}
                className={`shrink-0 px-3.5 py-2 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 transition-all font-mono whitespace-nowrap cursor-pointer ${
                  showFilters
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50'
                    : 'bg-[#0F1115] text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">More Filters</span>
                <span className="sm:hidden">Filters</span>
              </button>
            </div>

            {/* Algorithmic Discovery Strategy Tabs */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none text-xs font-semibold">
              <button
                onClick={() => setDiscoveryTab('all')}
                className={`px-3 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer flex items-center space-x-1.5 ${
                  discoveryTab === 'all'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-[#0F1115] text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>All Hosts</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
                  {allOtherUsers.length}
                </span>
              </button>

              <button
                onClick={() => setDiscoveryTab('ready_now')}
                className={`px-3 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer flex items-center space-x-1.5 ${
                  discoveryTab === 'ready_now'
                    ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-lg shadow-orange-950/50'
                    : 'bg-[#0F1115] text-orange-400 hover:text-white border border-orange-900/50'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-orange-400 animate-bounce" />
                <span>Ready Now</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-orange-950/80 text-orange-300 border border-orange-700/50 font-mono">
                  🔥 Boosted
                </span>
              </button>

              <button
                onClick={() => setDiscoveryTab('trending')}
                className={`px-3 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer flex items-center space-x-1.5 ${
                  discoveryTab === 'trending'
                    ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-md'
                    : 'bg-[#0F1115] text-amber-400 hover:text-white border border-amber-900/50'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Trending</span>
              </button>

              <button
                onClick={() => setDiscoveryTab('gold_silver')}
                className={`px-3 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer flex items-center space-x-1.5 ${
                  discoveryTab === 'gold_silver'
                    ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-slate-950 font-bold shadow-md'
                    : 'bg-[#0F1115] text-yellow-400 hover:text-white border border-yellow-900/50'
                }`}
              >
                <Crown className="w-3.5 h-3.5 text-yellow-400" />
                <span>VIP Gold & Silver</span>
              </button>

              <div className="h-4 w-px bg-slate-800 shrink-0 mx-1" />

              <button
                onClick={() => setSelectedStatus(selectedStatus === 'online' ? 'all' : 'online')}
                className={`px-3 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer flex items-center space-x-1.5 ${
                  selectedStatus === 'online'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-[#0F1115] text-emerald-400 hover:text-white border border-emerald-900/50'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Online ({onlineCount})</span>
              </button>
            </div>

            {/* Expanded Filters Drawer with Dynamic Admin Taxonomies */}
            {showFilters && (
              <div id="discovery-advanced-filters-panel" className="pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 text-xs font-mono">
                {/* Age Range */}
                <div className="xl:col-span-2">
                  <label className="block font-semibold text-slate-300 mb-1">
                    Age Range: {minAge} - {maxAge} yrs
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="18"
                      max="60"
                      value={minAge}
                      onChange={(e) => setMinAge(Number(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                    <input
                      type="range"
                      min="18"
                      max="60"
                      value={maxAge}
                      onChange={(e) => setMaxAge(Number(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                  </div>
                </div>

                {/* Dynamic Searchable Country Filter */}
                <SearchableFilterDropdown
                  label="Country / Flag"
                  icon={<Globe className="w-3.5 h-3.5 text-indigo-400" />}
                  value={selectedCountry}
                  onChange={(val) => setSelectedCountry(val)}
                  allOptionLabel={`🌍 All Countries (${allowedCountries.length})`}
                  allOptionValue="all"
                  placeholder="Search country or code..."
                  autoSort={true}
                  options={allowedCountries.map((c) => ({
                    value: c.name,
                    label: c.name,
                    subLabel: c.code,
                    icon: <SvgFlag countryCode={c.code} size="xs" className="rounded shadow-xs shrink-0" />,
                  }))}
                />

                {/* Dynamic Searchable Language Filter */}
                <SearchableFilterDropdown
                  label="Language"
                  icon={<Languages className="w-3.5 h-3.5 text-indigo-400" />}
                  value={selectedLanguage}
                  onChange={(val) => setSelectedLanguage(val)}
                  allOptionLabel={`🗣️ All Languages (${allowedLanguages.length})`}
                  allOptionValue="all"
                  placeholder="Search language..."
                  autoSort={true}
                  options={allowedLanguages.map((l) => ({
                    value: l.name,
                    label: l.name,
                    subLabel: l.nativeName,
                    badge: l.popular ? 'TOP' : undefined,
                  }))}
                />

                {/* Dynamic Searchable Zodiac Sign Filter */}
                <SearchableFilterDropdown
                  label="Zodiac Sign"
                  icon={<Sparkles className="w-3.5 h-3.5 text-amber-400" />}
                  value={selectedZodiac}
                  onChange={(val) => setSelectedZodiac(val)}
                  allOptionLabel={`✨ All Zodiacs (${allowedZodiacs.length})`}
                  allOptionValue="all"
                  placeholder="Search zodiac..."
                  autoSort={true}
                  options={allowedZodiacs.map((z) => ({
                    value: z.name,
                    label: z.name,
                    subLabel: z.element,
                    icon: <ZodiacIcon sign={z.key} size="sm" className="shrink-0" />,
                  }))}
                />

                {/* Dynamic Searchable Interests Filter */}
                <SearchableFilterDropdown
                  label="Interest / Passion"
                  icon={<Target className="w-3.5 h-3.5 text-pink-400" />}
                  value={selectedInterest}
                  onChange={(val) => setSelectedInterest(val)}
                  allOptionLabel={`🎯 All Interests (${allowedInterests.length})`}
                  allOptionValue="all"
                  placeholder="Search interest..."
                  autoSort={true}
                  options={allowedInterests.map((i) => ({
                    value: i.name,
                    label: i.name,
                    subLabel: i.category,
                    badge: i.popular ? 'POPULAR' : undefined,
                  }))}
                />

                {/* Show My Account in Grid Toggle */}
                <div className="flex items-center justify-between sm:col-span-2 lg:col-span-3 xl:col-span-6 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="discovery-show-self-toggle"
                      checked={showSelf}
                      onChange={(e) => setShowSelf(e.target.checked)}
                      className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                    />
                    <label htmlFor="discovery-show-self-toggle" className="text-slate-300 text-xs font-semibold cursor-pointer">
                      Show My Own Account ({currentUser.name}) in Host Directory
                    </label>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Showing {populatedDiscoveryUsers.length} of {users.length} profiles
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Profile Cards Grid - 2 Cards per row on mobile */}
          <div id="discovery-user-cards-grid" className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-6">
            {populatedDiscoveryUsers.map((user) => {
              const isFemale = user.gender === 'female';
              const userIsFriend = isFriend(user.id);
              const friendRate = systemSettings.coinBurnRateFriendPerMin ?? 80;
              const standardRate = systemSettings.coinBurnRatePerMin || 120;
              const rate = userIsFriend ? friendRate : standardRate;
              const isFav = favorites.includes(user.id);
              const isUserOnline = user.onlineStatus === 'online';
              const isUserBusy = user.onlineStatus === 'busy' || user.onlineStatus === 'in_call';

              const metrics = creatorMetricsMap[user.id];
              const isReadyNow = Boolean(metrics?.isReadyNowActive) && isUserOnline && isCurrentlyPeakHour(systemSettings.peakHoursStart, systemSettings.peakHoursEnd);
              const tier = metrics?.performanceTier || 'bronze';
              const healthScore = metrics?.responseHealthScore ?? 100;
              const hasStreak = Boolean(metrics?.currentStreakDays && metrics.currentStreakDays >= 3);

              return (
                <div
                  key={user.id}
                  onClick={() => setSelectedUserProfile(user)}
                  className={`group relative bg-[#161920] border rounded-xl sm:rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col cursor-pointer ${
                    isReadyNow
                      ? 'border-orange-500/60 ring-1 ring-orange-500/30 shadow-orange-950/40 hover:border-orange-400'
                      : isUserOnline
                      ? 'border-emerald-500/30 hover:border-emerald-500/70 hover:shadow-emerald-950/40'
                      : isUserBusy
                      ? 'border-amber-500/30 hover:border-amber-500/70 hover:shadow-amber-950/40'
                      : 'border-slate-800 hover:border-indigo-500/50 hover:shadow-indigo-950/30'
                  }`}
                >
                  {/* Top Media / Avatar Box */}
                  <div className="relative h-[206px] sm:h-64 bg-[#0F1115] overflow-hidden">
                    <img
                      src={normalizeMediaUrl(user.avatarUrl)}
                      alt={user.name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getFallbackAvatar(user.name, user.gender, user.role);
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />

                    {/* Dark Vignette Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#161920] via-transparent to-black/30" />

                    {/* Top Status & Favorite Badges */}
                    <div className="absolute top-2 left-2 right-2 sm:top-3 sm:left-3 sm:right-3 flex items-center justify-between z-10">
                      {/* Top-left status pill indicator */}
                      <div className="flex items-center space-x-1.5">
                        <div
                          className={`px-2 py-1 rounded-full backdrop-blur-md border shadow-md flex items-center space-x-1.5 transition-all ${
                            isUserOnline
                              ? 'bg-emerald-950/85 border-emerald-500/70 text-emerald-300 ring-1 ring-emerald-500/30 shadow-emerald-950/50'
                              : isUserBusy
                              ? 'bg-amber-950/85 border-amber-500/70 text-amber-300 ring-1 ring-amber-500/30 shadow-amber-950/50'
                              : 'bg-slate-950/85 border-slate-700/60 text-slate-400'
                          }`}
                          title={
                            isUserOnline
                              ? 'Available for Video Call'
                              : isUserBusy
                              ? 'Busy on Video Call'
                              : 'Offline'
                          }
                        >
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isUserOnline
                                ? 'bg-emerald-400 animate-pulse ring-2 ring-emerald-400/50'
                                : isUserBusy
                                ? 'bg-amber-400 animate-pulse ring-2 ring-amber-400/50'
                                : 'bg-rose-500'
                            }`}
                          />
                          <span className="text-[10px] font-bold tracking-tight uppercase font-mono">
                            {isUserOnline
                              ? 'Online'
                              : isUserBusy
                              ? 'Busy'
                              : 'Offline'}
                          </span>
                        </div>

                        {/* Ready Now Peak Hour Surge Badge */}
                        {isReadyNow && (
                          <div
                            className="px-2 py-1 rounded-full bg-gradient-to-r from-orange-600 to-amber-500 text-white font-black text-[9px] uppercase tracking-wider flex items-center space-x-1 shadow-lg shadow-orange-950/80 animate-pulse border border-orange-400/60"
                            title="Ready Now Active — Instant High-Priority Match"
                          >
                            <Flame className="w-2.5 h-2.5 fill-current text-yellow-200" />
                            <span className="hidden sm:inline">Ready Now</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-1 sm:space-x-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(user.id);
                          }}
                          className={`p-1 sm:p-1.5 rounded-full backdrop-blur-md transition-colors ${
                            isFav ? 'bg-amber-500 text-slate-950' : 'bg-slate-900/80 text-slate-300 hover:text-white'
                          }`}
                        >
                          <Star className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isFav ? 'fill-current' : ''}`} />
                        </button>

                        {user.isVerified && (
                          <span className="p-0.5 sm:p-1 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-400 backdrop-blur-md" title="AI Verified Profile">
                            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Performance Tier & Floating Badges */}
                    {isFemale && (
                      <div className="absolute top-10 left-2 sm:top-12 sm:left-3 z-10 flex items-center space-x-1 flex-wrap gap-y-1">
                        {tier === 'gold' && (
                          <span className="px-1.5 py-0.5 rounded bg-yellow-500/90 text-slate-950 font-black text-[9px] shadow-sm flex items-center space-x-1 border border-yellow-300">
                            <Crown className="w-2.5 h-2.5" />
                            <span>GOLD</span>
                          </span>
                        )}
                        {tier === 'silver' && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-300/90 text-slate-950 font-bold text-[9px] shadow-sm flex items-center space-x-1 border border-white">
                            <Award className="w-2.5 h-2.5" />
                            <span>SILVER</span>
                          </span>
                        )}
                        {hasStreak && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-950/80 backdrop-blur-md text-rose-300 border border-rose-500/40 text-[9px] font-mono font-bold" title="Active Daily Streak">
                            🔥 {metrics?.currentStreakDays}d
                          </span>
                        )}
                      </div>
                    )}

                    {/* Bottom Overlay Info on Photo */}
                    <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3 z-10">
                      <div className="flex items-center space-x-1.5 text-white flex-wrap">
                        <h3 className="font-black text-sm sm:text-lg drop-shadow-md truncate max-w-[120px] sm:max-w-[160px]">{user.name}</h3>
                        <span className="text-xs sm:text-sm text-slate-200 font-semibold shrink-0">{user.age}</span>
                        <SvgFlag
                          countryCode={user.countryCode}
                          nationality={getUserEffectiveLocation(user).country || user.nationality}
                          size="sm"
                          rounded={true}
                        />
                      </div>
                      <div className="flex items-center space-x-1 text-[10px] text-slate-300 font-medium truncate mt-0.5">
                        <MapPin className={`w-2.5 h-2.5 ${getUserEffectiveLocation(user).isMock ? 'text-pink-400' : 'text-emerald-400'} shrink-0`} />
                        <span className="truncate">{getUserEffectiveLocation(user).displayCity}</span>
                        {getUserEffectiveLocation(user).isMock && (
                          <span className="px-1 rounded bg-pink-600/90 text-[8px] font-mono text-white font-bold shrink-0">
                            MOCK
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="p-2.5 sm:p-3 bg-[#161920] flex-1 flex flex-col justify-end">
                    {/* Quick Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 font-sans">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenChat(user.id);
                        }}
                        className="h-8.5 py-2 w-full bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg font-medium text-xs flex items-center justify-center space-x-1.5 transition-colors border border-slate-700 cursor-pointer"
                        title={`Chat with ${user.name}`}
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                        <span>Chat</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartCall(user.id);
                        }}
                        className={`h-8.5 py-2 w-full rounded-lg font-medium text-xs flex items-center justify-center space-x-1.5 transition-all shadow-sm cursor-pointer ${
                          isUserOnline
                            ? 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold shadow-rose-600/30 active:scale-95'
                            : isUserBusy
                            ? 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 font-bold'
                            : 'bg-slate-800/80 hover:bg-slate-750 text-slate-400 hover:text-slate-200 border border-slate-700/80'
                        }`}
                        title={
                          isUserOnline
                            ? `Start 1-on-1 Video Call with ${user.name}`
                            : isUserBusy
                            ? `${user.name} is currently busy on a video call`
                            : `Call ${user.name}`
                        }
                      >
                        {isUserBusy ? (
                          <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <Video className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {isUserOnline
                            ? 'Call'
                            : isUserBusy
                            ? 'Busy'
                            : 'Call'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {populatedDiscoveryUsers.length === 0 && (
            <div className="text-center py-16 bg-[#161920] border border-slate-800 rounded-2xl p-8 space-y-4 font-mono">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto text-xl">
                <Users className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-200">No profile cards found matching current filters</p>
                <p className="text-xs text-slate-400">
                  {users.length > 0
                    ? `You are logged in as "${currentUser.name}". Total users in system: ${users.length}.`
                    : 'Your Supabase database table is empty or still synchronizing.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCountry('all');
                    setSelectedLanguage('all');
                    setSelectedStatus('all');
                    setShowSelf(true);
                    setMinAge(18);
                    setMaxAge(75);
                    setVerifiedOnly(false);
                    setNearbyOnly(false);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Reset All Filters (Show All)
                </button>
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Sync from Supabase</span>
                </button>
              </div>
            </div>
          )}

      {/* Quick Match Roulette Modal */}
      <QuickMatchRoulette
        isOpen={isRouletteOpen}
        onClose={() => setIsRouletteOpen(false)}
        onOpenChat={onOpenChat}
      />

      {/* Profile Detail Modal */}
      <ProfileDetailModal
        user={currentSelectedUser}
        onClose={() => setSelectedUserProfile(null)}
        onStartCall={onStartCall}
        onOpenChat={onOpenChat}
      />
    </div>
  );
};

