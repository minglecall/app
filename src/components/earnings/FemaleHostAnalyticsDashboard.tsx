import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  DollarSign,
  TrendingUp,
  Video,
  Gift,
  Clock,
  Send,
  AlertCircle,
  CheckCircle2,
  Building,
  CreditCard,
  Wallet,
  ShieldCheck,
  History,
  PhoneCall,
  Users,
  Eye,
  Star,
  Zap,
  Activity,
  Layers,
  Award,
  Calendar,
  Sparkles,
  ArrowUpRight,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  HelpCircle,
  Lock,
  ChevronRight,
  RefreshCw,
  Globe,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { UserProfile } from '../../types';
import {
  computeHostEarningsData,
  computeHostMetrics,
  EarningsDataPoint,
} from '../../utils/analyticsHelper';
import { normalizeMediaUrl } from '../../utils/r2Storage';
import { getFallbackAvatar } from '../../utils/avatars';
import { CreatorTargetProgressCard } from './CreatorTargetProgressCard';
import { CreatorDailyChecklistWidget } from './CreatorDailyChecklistWidget';

interface FemaleHostAnalyticsDashboardProps {
  user?: UserProfile;
  onOpenCallLogs?: () => void;
  onOpenChat?: (userId: string) => void;
}

export const FemaleHostAnalyticsDashboard: React.FC<FemaleHostAnalyticsDashboardProps> = ({
  user,
  onOpenCallLogs,
  onOpenChat,
}) => {
  const {
    currentUser,
    systemSettings,
    payoutRequests,
    submitPayoutRequest,
    showToast,
    callLogs,
    virtualGifts,
    creatorReviews,
  } = useApp();
  const activeUser = user || currentUser;

  // Real Creator Reviews for this Host
  const hostReviews = useMemo(() => {
    return creatorReviews.filter((r) => r.creatorId === activeUser.id);
  }, [creatorReviews, activeUser.id]);

  // Real Dynamic Ratings Calculations
  const ratingsMetrics = useMemo(() => {
    const count = hostReviews.length;
    if (count === 0) {
      return {
        averageStars: 5.0,
        totalReviews: 0,
        scoreLabel: 'Top 1% Creator Score',
        communication: 5.0,
        friendliness: 5.0,
        clarity: 5.0,
        energy: 5.0,
      };
    }

    const sumStars = hostReviews.reduce((acc, r) => acc + (r.stars || 5), 0);
    const sumComm = hostReviews.reduce((acc, r) => acc + (r.communication || 5), 0);
    const sumFriend = hostReviews.reduce((acc, r) => acc + (r.friendliness || 5), 0);
    const sumClarity = hostReviews.reduce((acc, r) => acc + (r.clarity || 5), 0);
    const sumEnergy = hostReviews.reduce((acc, r) => acc + (r.energy || 5), 0);

    const avgStars = Number((sumStars / count).toFixed(2));
    const scoreLabel =
      avgStars >= 4.9
        ? 'Top 1% Creator Score'
        : avgStars >= 4.7
        ? 'Top 5% Creator Score'
        : avgStars >= 4.5
        ? 'Top Tier Creator Score'
        : 'Verified Creator Score';

    return {
      averageStars: avgStars,
      totalReviews: count,
      scoreLabel,
      communication: Number((sumComm / count).toFixed(1)),
      friendliness: Number((sumFriend / count).toFixed(1)),
      clarity: Number((sumClarity / count).toFixed(1)),
      energy: Number((sumEnergy / count).toFixed(1)),
    };
  }, [hostReviews]);

  // Real Dynamic Compliance & Attendance Metrics (call hours only — no invented standby/%)
  const complianceMetrics = useMemo(() => {
    const hostLogs = callLogs.filter((l) => l.receiverId === activeUser.id);
    const totalCallSeconds = hostLogs.reduce((acc, l) => acc + (l.durationSeconds || 0), 0);
    const totalCallHours = Number((totalCallSeconds / 3600).toFixed(1));

    const storedAcceptance =
      typeof activeUser.acceptanceRatePercent === 'number' &&
      Number.isFinite(activeUser.acceptanceRatePercent)
        ? activeUser.acceptanceRatePercent
        : null;

    const strikes = activeUser.isBanned ? 1 : 0;
    const healthScore = Math.max(0, 100 - strikes * 30);

    return {
      totalCallHours,
      acceptanceRate: storedAcceptance,
      strikes,
      healthScore,
    };
  }, [callLogs, activeUser]);

  // Determine if this female host has coin earning enabled
  const canEarnCoins = Boolean(activeUser.teamLeaderId) || Boolean(systemSettings.enableRegularFemaleCoinEarning);

  // Active Timeframe for Analytics Chart
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');

  // Active Sub-tab in Analytics Dashboard
  const [activeSection, setActiveSection] = useState<
    'targets' | 'financial' | 'engagement' | 'ratings' | 'payouts'
  >('targets');

  // Payout Request Form State
  const [payoutCoins, setPayoutCoins] = useState<number>(activeUser.earningsCoins || 0);
  const [payoutMethod, setPayoutMethod] = useState<'paypal' | 'bank' | 'crypto' | 'local'>('paypal');
  const [accountDetails, setAccountDetails] = useState(
    activeUser.payoutMethod?.details || ''
  );
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);

  // Financial Calculations
  const userCoins = activeUser.earningsCoins ?? 0;
  const availableUSD = userCoins * systemSettings.femalePayoutRatioUSD;
  const requestedUSD = payoutCoins * systemSettings.femalePayoutRatioUSD;
  const isAboveThreshold = requestedUSD >= systemSettings.minPayoutThresholdUSD;

  // Real Host Metrics computed dynamically from Supabase database call logs
  const hostMetrics = useMemo(() => {
    return computeHostMetrics(activeUser, callLogs, systemSettings.femalePayoutRatioUSD);
  }, [activeUser, callLogs, systemSettings.femalePayoutRatioUSD]);

  // Selected Graph Data computed dynamically from Supabase call logs
  const chartData = useMemo(() => {
    return computeHostEarningsData(activeUser.id, callLogs, systemSettings.femalePayoutRatioUSD, timeframe);
  }, [activeUser.id, callLogs, systemSettings.femalePayoutRatioUSD, timeframe]);

  // Real hourly volume breakdown from callLogs
  const peakHoursData = hostMetrics.peakHours;

  // Filter creator's payout requests
  const myRequests = payoutRequests.filter(
    (r) => r.userId === activeUser.id || currentUser.role === 'admin'
  );

  const handleOpenPayoutModal = () => {
    if (availableUSD < systemSettings.minPayoutThresholdUSD) {
      showToast(
        'Minimum Threshold Not Met',
        `You need at least $${systemSettings.minPayoutThresholdUSD.toFixed(2)} USD in accumulated earnings to request a withdrawal.`,
        'warning'
      );
      return;
    }
    setShowPayoutModal(true);
  };

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountDetails.trim()) {
      showToast(
        'Account Details Required',
        'Please enter your bank IBAN, PayPal email, or crypto wallet address.',
        'error'
      );
      return;
    }

    if (requestedUSD < systemSettings.minPayoutThresholdUSD) {
      showToast(
        'Below Minimum Withdrawal',
        `Minimum withdrawal amount is $${systemSettings.minPayoutThresholdUSD.toFixed(2)} USD.`,
        'error'
      );
      return;
    }

    setIsSubmittingPayout(true);
    const safeMethod = (payoutMethod || 'paypal').toUpperCase();
    setTimeout(() => {
      submitPayoutRequest(payoutCoins, safeMethod, accountDetails);
      setIsSubmittingPayout(false);
      setShowPayoutModal(false);
      showToast(
        'Payout Request Submitted! 💸',
        `Requested withdrawal of $${requestedUSD.toFixed(2)} USD via ${safeMethod}. Processing time: 24-48 hours.`,
        'success'
      );
    }, 600);
  };

  return (
    <div id="female-host-analytics-dashboard" className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* 1. Header Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-emerald-950 via-[#0E1B1B] to-[#0A0E17] border border-emerald-500/30 p-6 sm:p-8 shadow-2xl overflow-hidden">
        {/* Glow ambient */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold font-mono">
              <Activity className="w-3.5 h-3.5" />
              <span>{canEarnCoins ? 'Female Creator Earnings & Performance Analytics' : 'Female Host Activity & Performance Analytics'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {canEarnCoins ? 'Host Performance & Financial Ledger' : 'Host Activity & Engagement Hub'}
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              {canEarnCoins
                ? 'Complete real-time transparency into your call minutes, virtual gift revenue, caller retention scores, and secure multi-gateway withdrawals.'
                : 'Detailed real-time metrics on your call volume, hosted sessions, caller ratings, and engagement performance.'}
            </p>
          </div>

          {/* Quick Balance Pill & Payout Action */}
          {canEarnCoins ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-slate-900/90 border border-emerald-500/40 p-4 sm:p-5 rounded-2xl shadow-xl">
              <div>
                <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Withdrawable Net Balance
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                  ${availableUSD.toFixed(2)} USD
                </div>
                <div className="text-[11px] text-emerald-300 font-mono flex items-center space-x-1 mt-0.5">
                  <span>🪙</span>
                  <span>{(activeUser?.earningsCoins ?? 0).toLocaleString()} accumulated coins</span>
                </div>
              </div>

              <button
                id="host-open-payout-btn"
                onClick={handleOpenPayoutModal}
                className="mt-2 sm:mt-0 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs font-mono transition-all shadow-lg shadow-emerald-500/20 hover:scale-105 cursor-pointer flex items-center space-x-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Request Payout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-slate-900/90 border border-pink-500/30 p-4 sm:p-5 rounded-2xl shadow-xl">
              <div>
                <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Host Account Status
                </div>
                <div className="text-lg font-black text-pink-300 font-mono">
                  Community Host
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  {hostMetrics.totalCalls} Total Calls Hosted
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sub-Section Navigation Tabs */}
        <div className="flex items-center space-x-2 mt-6 pt-4 border-t border-slate-800/80 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveSection('targets')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all shrink-0 flex items-center space-x-1.5 ${
              activeSection === 'targets'
                ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-lg shadow-orange-950/40 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span className="px-1.5 py-0.5 rounded bg-slate-950 text-amber-300 font-mono text-[9px] font-bold select-all">
              CR-1
            </span>
            <Zap className="w-3.5 h-3.5 text-yellow-300" />
            <span>Targets & Algorithmic Boosts</span>
          </button>

          {canEarnCoins && (
            <button
              onClick={() => setActiveSection('financial')}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all shrink-0 flex items-center space-x-1.5 ${
                activeSection === 'financial'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span className="px-1.5 py-0.5 rounded bg-slate-950 text-emerald-300 font-mono text-[9px] font-bold select-all">
                CR-2
              </span>
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Financial & Earnings Ledger</span>
            </button>
          )}

          <button
            onClick={() => setActiveSection('engagement')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all shrink-0 flex items-center space-x-1.5 ${
              activeSection === 'engagement'
                ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span className="px-1.5 py-0.5 rounded bg-slate-950 text-pink-300 font-mono text-[9px] font-bold select-all">
              CR-3
            </span>
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Call & Engagement Metrics</span>
          </button>

          <button
            onClick={() => setActiveSection('ratings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all shrink-0 flex items-center space-x-1.5 ${
              activeSection === 'ratings'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span className="px-1.5 py-0.5 rounded bg-slate-950 text-amber-300 font-mono text-[9px] font-bold select-all">
              CR-4
            </span>
            <Star className="w-3.5 h-3.5" />
            <span>Ratings & Quality Standing</span>
          </button>

          {canEarnCoins && (
            <button
              onClick={() => setActiveSection('payouts')}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all shrink-0 flex items-center space-x-1.5 ${
                activeSection === 'payouts'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span className="px-1.5 py-0.5 rounded bg-slate-950 text-indigo-300 font-mono text-[9px] font-bold select-all">
                CR-5
              </span>
              <History className="w-3.5 h-3.5" />
              <span>Withdrawal History ({myRequests.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. TOP KPI CARDS (Financial & Call Overview) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Revenue or Total Calls */}
        {canEarnCoins ? (
          <div className="p-4 sm:p-5 bg-[#13161F] border border-slate-800 rounded-2xl shadow-lg space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold font-mono uppercase flex items-center space-x-1.5">
                <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-emerald-400 font-mono text-[9px] font-bold select-all">
                  CR-0.1
                </span>
                <span>Lifetime Revenue</span>
              </span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-white font-mono">
              ${hostMetrics.lifetimeUSD.toFixed(2)}
            </div>
            <div className="text-[10px] text-emerald-400 font-mono flex items-center space-x-1">
              <ArrowUpRight className="w-3 h-3" />
              <span>{hostMetrics.totalCalls} completed sessions</span>
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-5 bg-[#13161F] border border-slate-800 rounded-2xl shadow-lg space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold font-mono uppercase flex items-center space-x-1.5">
                <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-pink-400 font-mono text-[9px] font-bold select-all">
                  CR-0.1
                </span>
                <span>Total Calls Hosted</span>
              </span>
              <PhoneCall className="w-4 h-4 text-pink-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-white font-mono">
              {hostMetrics.totalCalls}
            </div>
            <div className="text-[10px] text-pink-400 font-mono">
              Completed 1-on-1 calls
            </div>
          </div>
        )}

        {/* Card 2: Call Minutes */}
        <div className="p-4 sm:p-5 bg-[#13161F] border border-slate-800 rounded-2xl shadow-lg space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold font-mono uppercase flex items-center space-x-1.5">
              <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-pink-400 font-mono text-[9px] font-bold select-all">
                CR-0.2
              </span>
              <span>Call Minutes Hosted</span>
            </span>
            <Clock className="w-4 h-4 text-pink-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono">
            {hostMetrics.totalMinutes} <span className="text-xs text-slate-400 font-normal">mins</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            {hostMetrics.totalCalls} Total 1-on-1 Sessions
          </div>
        </div>

        {/* Card 3: Virtual Gift Payouts or Social Engagements */}
        {canEarnCoins ? (
          <div className="p-4 sm:p-5 bg-[#13161F] border border-slate-800 rounded-2xl shadow-lg space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold font-mono uppercase flex items-center space-x-1.5">
                <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-amber-400 font-mono text-[9px] font-bold select-all">
                  CR-0.3
                </span>
                <span>Gifts Received</span>
              </span>
              <Gift className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-white font-mono">
              {activeUser.totalGiftsReceivedCount || 0} <span className="text-xs text-amber-300 font-normal">tips</span>
            </div>
            <div className="text-[10px] text-amber-400 font-mono">
              {systemSettings.giftFemaleHostSharePercent ?? 70}% Host Share credited instantly
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-5 bg-[#13161F] border border-slate-800 rounded-2xl shadow-lg space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold font-mono uppercase flex items-center space-x-1.5">
                <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-indigo-400 font-mono text-[9px] font-bold select-all">
                  CR-0.3
                </span>
                <span>Connected Members</span>
              </span>
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-white font-mono">
              {hostMetrics.totalCallersCount} <span className="text-xs text-indigo-300 font-normal">callers</span>
            </div>
            <div className="text-[10px] text-indigo-300 font-mono">
              Active network & connections
            </div>
          </div>
        )}

        {/* Card 4: Quality & Acceptance Score */}
        <div className="p-4 sm:p-5 bg-[#13161F] border border-slate-800 rounded-2xl shadow-lg space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold font-mono uppercase flex items-center space-x-1.5">
              <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-yellow-400 font-mono text-[9px] font-bold select-all">
                CR-0.4
              </span>
              <span>Host Quality Score</span>
            </span>
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400/20" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono flex items-center space-x-1.5">
            <span>
              {hostMetrics.hostQualityScore != null
                ? hostMetrics.hostQualityScore.toFixed(2)
                : 'N/A'}
            </span>
            {hostMetrics.hostQualityScore != null && (
              <span className="text-xs text-yellow-400 font-normal">★ / 5.0</span>
            )}
          </div>
          <div className="text-[10px] text-emerald-400 font-mono flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>
              {hostMetrics.acceptanceRatePercent != null
                ? `${hostMetrics.acceptanceRatePercent}% Call Acceptance Rate`
                : 'Acceptance rate N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* 2.5 SECTION: CREATOR TARGETS & ALGORITHMIC BOOSTS */}
      {activeSection === 'targets' && (
        <div className="space-y-6">
          <CreatorTargetProgressCard />
          <CreatorDailyChecklistWidget />
        </div>
      )}

      {/* 3. SECTION 1: FINANCIAL & EARNINGS LEDGER */}
      {activeSection === 'financial' && (
        <div className="space-y-6">
          
          {/* Visual Earnings Trends Graph Card */}
          <div className="p-5 sm:p-6 bg-[#13161F] border border-slate-800 rounded-3xl space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-white font-mono uppercase tracking-wider flex items-center space-x-2">
                  <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-emerald-400 font-mono text-[9px] font-bold select-all">
                    CR-2.1
                  </span>
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  <span>Revenue & Earning Streams Breakdown</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Track call earnings from live call logs (coins × payout ratio). Categories only appear when recorded in data.
                </p>
              </div>

              {/* Timeframe Filter Buttons */}
              <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold capitalize transition-all cursor-pointer ${
                      timeframe === tf
                        ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Recharts Area/Bar Graph — single real Call earnings series */}
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVideo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis dataKey="period" stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={11} tickFormatter={(val) => `$${val}`} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: '#F8FAFC',
                    }}
                    formatter={(value: any) => [`$${Number(value).toFixed(2)} USD`, '']}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                    formatter={(val) => (
                      <span className="text-slate-300 font-mono text-xs capitalize">{val}</span>
                    )}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalUSD"
                    name="Call earnings ($)"
                    stroke="#10B981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorVideo)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Commission & Deductions Breakdown Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Transparent Commission Structure */}
            <div className="p-5 sm:p-6 bg-[#13161F] border border-slate-800 rounded-3xl space-y-4 shadow-xl">
              <div className="flex items-center space-x-2">
                <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-emerald-400 font-mono text-[9px] font-bold select-all">
                  CR-2.2
                </span>
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
                  Commission & Deduction Breakdown
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                Transparent revenue split structure ensuring creators keep the maximum value of all earned call minutes and gifts.
              </p>

              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="text-slate-300">Creator Base Revenue Share</span>
                  </div>
                  <span className="text-emerald-400 font-black text-sm">70.0%</span>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span className="text-slate-300">Top Host Tier Performance Bonus</span>
                  </div>
                  <span className="text-amber-400 font-black text-sm">+5.0%</span>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                    <span className="text-slate-400">Platform Streaming & AI Infrastructure</span>
                  </div>
                  <span className="text-slate-400 font-bold">25.0%</span>
                </div>

                <div className="p-3.5 bg-emerald-500/10 rounded-xl border border-emerald-500/30 flex items-center justify-between text-emerald-300">
                  <span className="font-bold">Total Effective Creator Net Payout</span>
                  <span className="font-black text-base">75.0% Net ($0.008/coin)</span>
                </div>
              </div>
            </div>

            {/* Right: Supported Payout Gateways Overview */}
            <div className="p-5 sm:p-6 bg-[#13161F] border border-slate-800 rounded-3xl space-y-4 shadow-xl">
              <div className="flex items-center space-x-2">
                <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-indigo-400 font-mono text-[9px] font-bold select-all">
                  CR-2.3
                </span>
                <Building className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
                  Supported Global Payout Channels
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                Direct withdrawals to international bank accounts, digital e-wallets, and crypto networks.
              </p>

              <div className="grid grid-cols-2 gap-2.5 font-mono text-xs">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center space-x-3">
                  <Wallet className="w-5 h-5 text-blue-400 shrink-0" />
                  <div>
                    <div className="font-bold text-white">PayPal Wallet</div>
                    <div className="text-[10px] text-slate-500">12-24h • Zero fee</div>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center space-x-3">
                  <Building className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-bold text-white">Bank Wire / IBAN</div>
                    <div className="text-[10px] text-slate-500">SEPA & ACH • Direct</div>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center space-x-3">
                  <Zap className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <div className="font-bold text-white">USDT / Crypto</div>
                    <div className="text-[10px] text-slate-500">TRC20 & ERC20 • Instant</div>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center space-x-3">
                  <CreditCard className="w-5 h-5 text-pink-400 shrink-0" />
                  <div>
                    <div className="font-bold text-white">Local E-Wallets</div>
                    <div className="text-[10px] text-slate-500">Revolut, PIX, GCash</div>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>Minimum Withdrawal: <strong className="text-white">${systemSettings.minPayoutThresholdUSD.toFixed(2)} USD</strong></span>
                <span className="text-emerald-400 flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verified 256-Bit SSL</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. SECTION 2: CALL & ENGAGEMENT METRICS */}
      {activeSection === 'engagement' && (
        <div className="space-y-6">
          {/* Call Breakdown & Peak Hours Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Total Minutes Split */}
            <div className="p-5 sm:p-6 bg-[#13161F] border border-slate-800 rounded-3xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-pink-400 font-mono text-[9px] font-bold select-all">
                    CR-3.1
                  </span>
                  <PhoneCall className="w-4 h-4 text-pink-400" />
                  <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
                    Call Minutes by Session Type
                  </h3>
                </div>
                {onOpenCallLogs && (
                  <button
                    onClick={onOpenCallLogs}
                    className="text-xs text-pink-400 hover:text-pink-300 font-mono font-bold flex items-center space-x-1"
                  >
                    <span>Detailed Call Logs</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="space-y-3 font-mono text-xs">
                {/* 1-on-1 Video / Call Minutes */}
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center space-x-2">
                      <Video className="w-3.5 h-3.5 text-pink-400" />
                      <span>
                        {hostMetrics.hasCallTypeBreakdown
                          ? 'Private 1-on-1 Video Calls'
                          : 'Call Minutes'}
                      </span>
                    </span>
                    <span className="text-pink-400 font-black">
                      {hostMetrics.videoMinutes} mins
                      {hostMetrics.hasCallTypeBreakdown
                        ? ` (${hostMetrics.videoPercent}%)`
                        : ''}
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-pink-500 h-full rounded-full"
                      style={{
                        width: `${hostMetrics.hasCallTypeBreakdown ? hostMetrics.videoPercent : 100}%`,
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 flex justify-between">
                    <span>{hostMetrics.videoSessions} sessions</span>
                    <span>Average: {hostMetrics.videoAvgMins} mins/call</span>
                  </div>
                </div>

                {/* Audio / Roulette only when call_logs actually record those flags */}
                {hostMetrics.hasCallTypeBreakdown && (
                  <>
                    <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white flex items-center space-x-2">
                          <PhoneCall className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Private Audio Calls</span>
                        </span>
                        <span className="text-indigo-400 font-black">
                          {hostMetrics.audioMinutes} mins ({hostMetrics.audioPercent}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-500 h-full rounded-full"
                          style={{ width: `${hostMetrics.audioPercent}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 flex justify-between">
                        <span>{hostMetrics.audioSessions} sessions</span>
                        <span>Average: {hostMetrics.audioAvgMins} mins/call</span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white flex items-center space-x-2">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span>Live Roulette Matching</span>
                        </span>
                        <span className="text-amber-400 font-black">
                          {hostMetrics.rouletteMinutes} mins ({hostMetrics.roulettePercent}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-500 h-full rounded-full"
                          style={{ width: `${hostMetrics.roulettePercent}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 flex justify-between">
                        <span>{hostMetrics.rouletteSessions} sessions</span>
                        <span>Average: {hostMetrics.rouletteAvgMins} mins/call</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Peak Calling Hours Heat Bar */}
            <div className="p-5 sm:p-6 bg-[#13161F] border border-slate-800 rounded-3xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-emerald-400 font-mono text-[9px] font-bold select-all">
                    CR-3.2
                  </span>
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
                    Peak Calling Hours (UTC)
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold">
                  PEAK: {hostMetrics.peakWindowLabel}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Call volume distribution over 24 hours. Go online during peak bars to maximize incoming call rates!
              </p>

              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={peakHoursData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                    <XAxis dataKey="hourLabel" stroke="#64748B" fontSize={10} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={10} tickFormatter={(val) => `${val}%`} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#334155',
                        borderRadius: '10px',
                        fontSize: '11px',
                        color: '#F8FAFC',
                      }}
                      formatter={(val: any) => [`${val}% Caller Traffic`, 'Volume']}
                    />
                    <Bar dataKey="callVolumePercent" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center justify-between">
                <span>Repeat Caller Retention:</span>
                <span className="text-emerald-400 font-bold">{hostMetrics.repeatCallerRatePercent}% of callers call again</span>
              </div>
            </div>
          </div>

          {/* Virtual Gifts Received Breakdown */}
          <div className="p-5 sm:p-6 bg-[#13161F] border border-slate-800 rounded-3xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-amber-400 font-mono text-[9px] font-bold select-all">
                  CR-3.3
                </span>
                <Gift className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
                    Virtual Gifts & Tips Received Breakdown
                  </h3>
                  <p className="text-xs text-slate-400">
                    Gifts sent by loyal callers during 1-on-1 video chats and on your Moments feed.
                  </p>
                </div>
              </div>

              <div className="text-right font-mono">
                <div className="text-xs text-slate-400">Total Gift Tips Received</div>
                <div className="text-base font-black text-amber-400">{activeUser.totalGiftsReceivedCount || 0} gifts</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {virtualGifts.filter((g) => g.isActive !== false).map((g) => {
                const hostShareCoins = Math.round(g.coinCost * ((systemSettings.giftFemaleHostSharePercent ?? 70) / 100));
                const hostUSD = hostShareCoins * systemSettings.femalePayoutRatioUSD;
                return (
                  <div
                    key={g.id}
                    className="p-4 bg-slate-950 border border-slate-800/80 rounded-2xl flex items-center space-x-3 hover:border-slate-700 transition-all"
                  >
                    <div className="text-3xl shrink-0 p-2 rounded-xl bg-slate-900 border border-slate-800">
                      {g.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs">{g.name}</span>
                        <span className="text-xs font-mono font-bold text-amber-400">{g.coinCost} coins</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center justify-between">
                        <span>Your Take ({systemSettings.giftFemaleHostSharePercent ?? 70}%)</span>
                        <span className="text-emerald-400 font-bold">🪙 {hostShareCoins} (${hostUSD.toFixed(2)})</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono truncate mt-1">
                        Ready to receive in 1-on-1 calls
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 5. SECTION 3: RATINGS & QUALITY STANDING */}
      {activeSection === 'ratings' && (
        <div className="space-y-6">
          {/* Quality Scorecard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Big Star Card */}
            <div className="p-6 bg-[#13161F] border border-slate-800 rounded-3xl text-center space-y-4 shadow-xl flex flex-col justify-center">
              <div className="flex items-center justify-center space-x-2">
                <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-yellow-400 font-mono text-[9px] font-bold select-all">
                  CR-4.1
                </span>
                <div className="w-12 h-12 rounded-2xl bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 flex items-center justify-center text-2xl">
                  ★
                </div>
              </div>
              <div>
                <div className="text-4xl font-black text-white font-mono">{ratingsMetrics.averageStars.toFixed(2)}</div>
                <div className="text-xs text-yellow-400 font-mono font-bold mt-0.5">{ratingsMetrics.scoreLabel}</div>
                <div className="text-[11px] text-slate-400 font-mono mt-1">
                  Based on {ratingsMetrics.totalReviews} verified caller reviews
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 text-left space-y-2 font-mono text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Communication:</span>
                  <span className="font-bold text-yellow-400">{ratingsMetrics.communication.toFixed(1)} ★</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Friendliness:</span>
                  <span className="font-bold text-yellow-400">{ratingsMetrics.friendliness.toFixed(1)} ★</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Video/Audio Clarity:</span>
                  <span className="font-bold text-yellow-400">{ratingsMetrics.clarity.toFixed(1)} ★</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Engagement & Energy:</span>
                  <span className="font-bold text-yellow-400">{ratingsMetrics.energy.toFixed(1)} ★</span>
                </div>
              </div>
            </div>

            {/* Attendance & Policy Health Card (Span 2) */}
            <div className="lg:col-span-2 p-6 bg-[#13161F] border border-slate-800 rounded-3xl space-y-5 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-emerald-400 font-mono text-[9px] font-bold select-all">
                    CR-4.2
                  </span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
                    Platform Compliance & Attendance Standing
                  </h3>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold">
                  {complianceMetrics.healthScore}% HEALTH SCORE
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase">Call Hours (from logs)</div>
                  <div className="text-lg font-black text-white">{complianceMetrics.totalCallHours} hrs</div>
                  <div className="text-[10px] text-slate-400">Completed session time only</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase">Incoming Call Acceptance</div>
                  <div className="text-lg font-black text-emerald-400">
                    {complianceMetrics.acceptanceRate != null
                      ? `${complianceMetrics.acceptanceRate}%`
                      : 'N/A'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {complianceMetrics.acceptanceRate != null
                      ? 'From profile record'
                      : 'Not recorded yet'}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase">Policy Violations / Strikes</div>
                  <div className="text-lg font-black text-emerald-400">{complianceMetrics.strikes} Strikes</div>
                  <div className="text-[10px] text-emerald-300">
                    {complianceMetrics.strikes === 0 ? 'Clean Record' : 'Under review'}
                  </div>
                </div>
              </div>

              {/* Policy standing summary */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Verified Creator in Good Standing</div>
                  <div className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                    {complianceMetrics.strikes === 0
                      ? 'No warnings, safety suspensions, or penalty deductions on record. Account is eligible for instant priority match queues and top tier creator earnings bonuses.'
                      : 'Account under active policy review. Please ensure compliance with community standards during live sessions.'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Verified Caller Reviews Feed */}
          <div className="p-5 sm:p-6 bg-[#13161F] border border-slate-800 rounded-3xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-yellow-400 font-mono text-[9px] font-bold select-all">
                  CR-4.3
                </span>
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400/20" />
                <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
                  Recent Verified Caller Reviews
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">Real-time caller feedback ({hostReviews.length})</span>
            </div>

            <div className="space-y-3">
              {hostReviews.length > 0 ? (
                hostReviews.map((review) => (
                  <div
                    key={review.id}
                    className="p-4 bg-slate-950 border border-slate-800/80 rounded-2xl space-y-2.5 hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center space-x-3">
                        <img
                          src={normalizeMediaUrl(review.callerAvatar)}
                          alt={review.callerName || 'Caller'}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = getFallbackAvatar(review.callerName, 'male');
                          }}
                          className="w-10 h-10 rounded-xl object-cover ring-1 ring-slate-700 bg-slate-900 shrink-0"
                        />
                        <div>
                          <div className="font-bold text-white text-xs flex items-center space-x-2">
                            <span>{review.callerName || 'Verified Caller'}</span>
                            {review.callerCountry && (
                              <span className="text-[10px] text-slate-500 font-mono">({review.callerCountry})</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Call Duration: {Math.max(1, Math.round((review.callDurationSeconds || 60) / 60))}m • {review.createdAt || 'Recently'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 text-yellow-400 text-xs font-mono font-bold">
                        <div className="flex space-x-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3.5 h-3.5 ${
                                s <= review.stars ? 'fill-yellow-400 text-yellow-400' : 'text-slate-700'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="ml-1 font-black text-white">{review.stars.toFixed(1)}</span>
                      </div>
                    </div>

                    {review.comment && (
                      <p className="text-xs text-slate-300 italic bg-[#0A0C10] p-2.5 rounded-xl border border-slate-800/80">
                        "{review.comment}"
                      </p>
                    )}

                    {review.tags && review.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {review.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-md bg-pink-500/10 border border-pink-500/20 text-pink-300 text-[10px] font-mono"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl text-center space-y-2">
                  <div className="text-slate-400 text-xs font-mono">No caller reviews recorded yet.</div>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    Incoming calls and reviews will appear here in real-time as users connect with you.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. SECTION 4: WITHDRAWAL & PAYOUT HISTORY */}
      {activeSection === 'payouts' && (
        <div className="space-y-6">
          <div className="p-5 sm:p-6 bg-[#13161F] border border-slate-800 rounded-3xl space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider flex items-center space-x-2">
                  <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-emerald-400 font-mono text-[9px] font-bold select-all">
                    CR-5.1
                  </span>
                  <History className="w-4 h-4 text-emerald-400" />
                  <span>Withdrawal Requests & Payout Ledger</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Track the real-time settlement status of your earnings payouts across all channels.
                </p>
              </div>

              <button
                onClick={handleOpenPayoutModal}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit New Withdrawal</span>
              </button>
            </div>

            {/* Payout Requests Table */}
            {myRequests.length === 0 ? (
              <div className="p-10 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-2">
                <History className="w-8 h-8 text-slate-600 mx-auto" />
                <div className="font-bold text-white text-xs">No Payout Requests on Record</div>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  When you request withdrawals of your earned coins, their tracking status and bank/crypto reference IDs will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                    <tr>
                      <th className="py-3 px-4">Request ID</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Method & Account</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Note / Gateway Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {myRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-indigo-400">{req.id}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-black text-white text-sm">${req.amountUSD.toFixed(2)} USD</div>
                          <div className="text-[10px] text-emerald-400">{(req.amountCoins ?? 0).toLocaleString()} coins</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-200">{req.payoutMethod}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{req.accountDetails}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center space-x-1 ${
                              req.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : req.status === 'processing'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : req.status === 'rejected'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            <span>{req.status}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 text-[11px]">{req.requestDate}</td>
                        <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                          {req.adminNote || 'Automatic gateway batch queue'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. PAYOUT REQUEST MODAL */}
      {showPayoutModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
          onClick={() => setShowPayoutModal(false)}
        >
          <div
            className="relative w-full max-w-lg bg-[#0F121A] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-emerald-400 font-mono text-[9px] font-bold select-all">
                  CR-5.2
                </span>
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-black text-white font-mono uppercase tracking-wider">
                  Request Earnings Withdrawal
                </h3>
              </div>
              <button
                onClick={() => setShowPayoutModal(false)}
                className="text-slate-400 hover:text-white transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Coins to Withdraw</span>
                  <span className="text-emerald-400 font-bold">
                    Est. ${requestedUSD.toFixed(2)} USD
                  </span>
                </label>
                <input
                  type="number"
                  min={systemSettings.minPayoutThresholdUSD / systemSettings.femalePayoutRatioUSD}
                  max={currentUser.earningsCoins}
                  value={payoutCoins}
                  onChange={(e) => setPayoutCoins(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
                <div className="text-[10px] text-slate-500 font-mono mt-1 flex justify-between">
                  <span>Available: {(currentUser?.earningsCoins ?? 8400).toLocaleString()} coins</span>
                  <span>Min: ${(systemSettings.minPayoutThresholdUSD).toFixed(2)} USD</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 mb-1.5">
                  Select Payout Gateway
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setPayoutMethod('paypal')}
                    className={`p-2.5 rounded-xl border text-xs font-mono font-bold flex flex-col items-center justify-center space-y-1 ${
                      payoutMethod === 'paypal'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Wallet className="w-4 h-4" />
                    <span>PayPal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayoutMethod('bank')}
                    className={`p-2.5 rounded-xl border text-xs font-mono font-bold flex flex-col items-center justify-center space-y-1 ${
                      payoutMethod === 'bank'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Building className="w-4 h-4" />
                    <span>Bank Wire</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayoutMethod('crypto')}
                    className={`p-2.5 rounded-xl border text-xs font-mono font-bold flex flex-col items-center justify-center space-y-1 ${
                      payoutMethod === 'crypto'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Zap className="w-4 h-4" />
                    <span>USDT Crypto</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayoutMethod('local')}
                    className={`p-2.5 rounded-xl border text-xs font-mono font-bold flex flex-col items-center justify-center space-y-1 ${
                      payoutMethod === 'local'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>E-Wallet</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 mb-1">
                  Recipient Account Details / Wallet Address *
                </label>
                <input
                  type="text"
                  required
                  value={accountDetails}
                  onChange={(e) => setAccountDetails(e.target.value)}
                  placeholder={
                    payoutMethod === 'paypal'
                      ? 'your-paypal@email.com'
                      : payoutMethod === 'bank'
                      ? 'IBAN / Routing & Account #'
                      : payoutMethod === 'crypto'
                      ? 'USDT TRC20 / ERC20 Address'
                      : 'Revolut / PIX / GCash ID'
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Gross Withdrawal:</span>
                  <span className="text-white">${requestedUSD.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between">
                  <span>Gateway Settlement Fee:</span>
                  <span className="text-emerald-400 font-bold">$0.00 (Free)</span>
                </div>
                <div className="flex justify-between text-white font-bold pt-1 border-t border-slate-800">
                  <span>Net Payout to Account:</span>
                  <span className="text-emerald-400">${requestedUSD.toFixed(2)} USD</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingPayout || !isAboveThreshold}
                className={`w-full py-3 rounded-xl font-mono font-black text-xs transition-all flex items-center justify-center space-x-2 shadow-lg cursor-pointer ${
                  isAboveThreshold
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:brightness-110 shadow-emerald-500/20'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>
                  {isSubmittingPayout
                    ? 'Processing...'
                    : `Confirm & Submit Payout ($${requestedUSD.toFixed(2)} USD)`}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
