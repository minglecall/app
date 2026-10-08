import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Search,
  Video,
  PhoneCall,
  ShieldCheck,
  Globe,
  Languages,
  Sparkles,
  SlidersHorizontal,
  Crown,
  LayoutGrid,
  Target,
  Flame,
  TrendingUp,
  RefreshCw,
  Users,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { rankCreatorsForDiscovery, isCurrentlyPeakHour } from '../../utils/discoveryAlgorithm';
import { ProfileDetailModal } from './ProfileDetailModal';
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
import { Badge, MediaCard } from '../ui';

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
    syncUsersFromSupabase,
    creatorMetricsMap,
    blockedUserIds,
    blockedByUserIds,
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
      (showSelf ? true : u.id !== currentUser.id) &&
      !blockedUserIds.includes(u.id) &&
      !blockedByUserIds.includes(u.id)
  );
  const onlineCount = allOtherUsers.filter((u) => u.onlineStatus === 'online').length;

  // Selected User for detail modal
  const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfile | null>(null);

  // User interest matching
  const userInterestedIn = useMemo(() => {
    if (currentUser.interestedIn && currentUser.interestedIn.length > 0) {
      return currentUser.interestedIn;
    }
    return currentUser.gender === 'female' ? ['male'] : ['female'];
  }, [currentUser.interestedIn, currentUser.gender]);

  // Filter logic (memoized so ranking/cards do not thrash on unrelated parent renders)
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Exclude Team Leaders, Agency Managers, and Admins from callable live stream discovery
      if (u.role === 'team_leader' || u.role === 'agency_manager' || u.role === 'admin') return false;

      // Exclude banned accounts
      if (u.isBanned) return false;

      // Exclude current logged in user unless showSelf is checked
      if (!showSelf && u.id === currentUser.id) return false;

      // Exclude blocked relationships (both directions)
      if (blockedUserIds.includes(u.id) || blockedByUserIds.includes(u.id)) return false;

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
  }, [
    users,
    currentUser.id,
    showSelf,
    blockedUserIds,
    blockedByUserIds,
    userInterestedIn,
    verifiedOnly,
    searchQuery,
    minAge,
    maxAge,
    selectedCountry,
    selectedLanguage,
    selectedZodiac,
    selectedInterest,
    selectedStatus,
  ]);

  // Apply Algorithmic Weighted Discovery Matrix & Rotational Ranking (memoized — stable order)
  const rankedItems = useMemo(() => {
    return rankCreatorsForDiscovery(filteredUsers, creatorMetricsMap, {
      peakHoursStart: systemSettings.peakHoursStart,
      peakHoursEnd: systemSettings.peakHoursEnd,
      peakHoursEnabled: systemSettings.peakHoursEnabled,
      readyNowOnly: discoveryTab === 'ready_now',
      trendingOnly: discoveryTab === 'trending',
      targetThresholds: systemSettings,
    }).filter((item) => {
      if (discoveryTab === 'gold_silver') {
        return item.tier === 'gold' || item.tier === 'silver';
      }
      return true;
    });
  }, [
    filteredUsers,
    creatorMetricsMap,
    systemSettings,
    discoveryTab,
  ]);

  const populatedDiscoveryUsers = useMemo(
    () => rankedItems.map((r) => r.user),
    [rankedItems]
  );

  // Realtime selected profile reference
  const currentSelectedUser = selectedUserProfile
    ? users.find((u) => u.id === selectedUserProfile.id) || selectedUserProfile
    : null;

  const hasActiveFilters =
    discoveryTab !== 'all' ||
    selectedStatus !== 'all' ||
    selectedCountry !== 'all' ||
    selectedLanguage !== 'all' ||
    selectedZodiac !== 'all' ||
    selectedInterest !== 'all' ||
    verifiedOnly ||
    nearbyOnly ||
    showSelf ||
    minAge > 18 ||
    maxAge < 75;

  return (
    <div id="discovery-grid-module" className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 pt-1.5 sm:pt-2 pb-6 space-y-3.5">
      {/* Filter Toolbar — chips & advanced filters stay hidden until user opens Filters */}
      <div className="bg-app-card border border-hairline rounded-app-lg p-3 sm:p-3.5 space-y-3 shadow-app-sm">
            <div className="flex items-center gap-2.5 w-full">
              {/* Search Box */}
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-app-muted" />
                <input
                  id="discovery-search-input"
                  type="text"
                  placeholder="Search by name, country, interests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-app-input border border-app rounded-[var(--radius-sm)] text-xs text-app-heading placeholder:text-app-muted focus:outline-none focus:border-brand transition-colors"
                />
              </div>

              <button
                id="discovery-supabase-sync-btn"
                onClick={handleManualSync}
                disabled={isSyncing}
                title="Refresh discovery profiles"
                className="shrink-0 px-3 py-2 rounded-[var(--radius-sm)] border text-xs font-semibold flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer bg-app-card-subtle text-app-muted border-hairline hover:text-app-heading disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              {/* Filter Button */}
              <button
                id="discovery-toggle-filters-btn"
                onClick={() => setShowFilters(!showFilters)}
                className={`shrink-0 px-3.5 py-2 rounded-[var(--radius-sm)] border text-xs font-semibold flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  showFilters || hasActiveFilters
                    ? 'bg-brand-soft text-brand border-brand/40'
                    : 'bg-app-input text-app-muted border-app hover:text-app-heading'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">More Filters</span>
                <span className="sm:hidden">Filters</span>
              </button>
            </div>

            {/* Expanded Filters Drawer: strategy chips + advanced taxonomies */}
            {showFilters && (
              <div id="discovery-advanced-filters-panel" className="pt-3 border-t border-slate-800 space-y-3">
                {/* Algorithmic Discovery Strategy Tabs */}
                <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none text-xs font-semibold">
                  <button
                    onClick={() => setDiscoveryTab('all')}
                    className={`px-3 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer flex items-center space-x-1.5 ${
                      discoveryTab === 'all'
                        ? 'bg-brand text-white shadow-brand'
                        : 'bg-app-input text-app-muted hover:text-app-heading border border-app'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>All Hosts</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-app-input text-app-muted">
                      {allOtherUsers.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setDiscoveryTab('ready_now')}
                    className={`px-3 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer flex items-center space-x-1.5 ${
                      discoveryTab === 'ready_now'
                        ? 'bg-brand text-white shadow-brand'
                        : 'bg-app-input text-brand hover:text-app-heading border border-brand/30'
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
                        : 'bg-app-input text-amber-400 hover:text-white border border-amber-900/50'
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
                        : 'bg-app-input text-yellow-400 hover:text-white border border-yellow-900/50'
                    }`}
                  >
                    <Crown className="w-3.5 h-3.5 text-yellow-400" />
                    <span>Gold & Silver</span>
                  </button>

                  <div className="h-4 w-px bg-[var(--app-hairline)] shrink-0 mx-1" />

                  <button
                    onClick={() => setSelectedStatus(selectedStatus === 'online' ? 'all' : 'online')}
                    className={`px-3 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer flex items-center space-x-1.5 ${
                      selectedStatus === 'online'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-app-input text-emerald-400 hover:text-white border border-emerald-900/50'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Online ({onlineCount})</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 text-xs font-mono">
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
              </div>
            )}
          </div>

          {/* Profile Cards Grid - 2 Cards per row on mobile */}
          <div id="discovery-user-cards-grid" className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-6">
            {populatedDiscoveryUsers.map((user) => {
              const isUserOnline = user.onlineStatus === 'online';
              const isUserBusy = user.onlineStatus === 'busy' || user.onlineStatus === 'in_call';

              const metrics = creatorMetricsMap[user.id];
              const isReadyNow = Boolean(metrics?.isReadyNowActive) && isUserOnline && isCurrentlyPeakHour(systemSettings.peakHoursStart, systemSettings.peakHoursEnd);
              const countryName = getUserEffectiveLocation(user).country || user.nationality || '';

              const fallbackAvatar = getFallbackAvatar(user.name, user.gender, user.role);
              const primaryAvatar =
                normalizeMediaUrl(user.avatarUrl) ||
                normalizeMediaUrl(user.gallery?.[0]) ||
                fallbackAvatar;

              const statusBadgeClass =
                'backdrop-blur-md shadow-md shadow-black/50 font-bold text-white border';

              return (
                <MediaCard
                  key={user.id}
                  src={primaryAvatar}
                  fallbackSrc={fallbackAvatar}
                  alt={user.name}
                  aspect="3/4"
                  onClick={() => setSelectedUserProfile(user)}
                  statusSlot={
                    <>
                      {isReadyNow ? (
                        <Badge tone="brand" className={`${statusBadgeClass} !bg-orange-500 !text-white !border-orange-200/70`}>
                          <Flame className="w-2.5 h-2.5" /> Ready
                        </Badge>
                      ) : isUserOnline ? (
                        <Badge tone="neutral" className={`${statusBadgeClass} !bg-emerald-500 !text-white !border-emerald-200/70`}>
                          <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-white shadow-sm" />
                          </span>
                          Online
                        </Badge>
                      ) : isUserBusy ? (
                        <Badge tone="warning" className={`${statusBadgeClass} !bg-amber-500 !text-white !border-amber-200/70`}>
                          Busy
                        </Badge>
                      ) : (
                        <Badge tone="neutral" className={`${statusBadgeClass} !bg-slate-900/85 !text-white !border-white/40`}>
                          Offline
                        </Badge>
                      )}
                      {user.isVerified && (
                        <span title="Verified" aria-label="Verified" className="ml-auto drop-shadow-md">
                          <ShieldCheck className="w-4 h-4 text-emerald-400" strokeWidth={2.5} />
                        </span>
                      )}
                    </>
                  }
                  metadata={
                    <div className="space-y-0.5 text-on-media">
                      <h3 className="font-display font-bold text-sm sm:text-base drop-shadow-md truncate leading-tight">
                        {user.name}
                      </h3>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <SvgFlag
                          countryCode={user.countryCode}
                          nationality={countryName}
                          size="sm"
                          rounded={true}
                        />
                        <span className="text-[11px] sm:text-xs text-white/90 font-medium truncate drop-shadow-sm">
                          {countryName}
                        </span>
                      </div>
                    </div>
                  }
                  footer={
                    <div className="flex justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartCall(user.id);
                        }}
                        title={isUserBusy ? 'Busy' : 'Call'}
                        aria-label={isUserBusy ? 'Busy' : 'Call'}
                        className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                          isUserOnline
                            ? 'bg-flirt text-white shadow-brand active:scale-95'
                            : isUserBusy
                            ? 'bg-amber-500 text-white shadow-md'
                            : 'bg-black/55 text-white/80 border border-white/25 backdrop-blur-md'
                        }`}
                      >
                        {isUserBusy ? (
                          <PhoneCall className="w-5 h-5" />
                        ) : (
                          <Video className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  }
                />
              );
            })}
          </div>

          {populatedDiscoveryUsers.length === 0 && (
            <div className="text-center py-16 bg-app-card border border-hairline rounded-app-xl p-8 space-y-4">
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
                    setDiscoveryTab('all');
                    setSearchQuery('');
                    setSelectedCountry('all');
                    setSelectedLanguage('all');
                    setSelectedZodiac('all');
                    setSelectedInterest('all');
                    setSelectedStatus('all');
                    setShowSelf(true);
                    setMinAge(18);
                    setMaxAge(75);
                    setVerifiedOnly(false);
                    setNearbyOnly(false);
                  }}
                  className="px-4 py-2 bg-brand hover:brightness-110 text-white rounded-app text-xs font-semibold transition-colors cursor-pointer shadow-brand"
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

