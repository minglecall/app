import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { UserProfile } from '../../types';
import {
  TrendingUp,
  DollarSign,
  Coins,
  Users,
  PhoneCall,
  Crown,
  Award,
  Video,
  Clock,
  Zap,
  Activity,
  Gift,
  ShieldCheck,
  ChevronRight,
  Eye,
  Star,
  CheckCircle2,
  ArrowUpRight,
  Globe,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface PlatformMasterAnalyticsProps {
  onInspectUser?: (user: UserProfile) => void;
}

export const PlatformMasterAnalytics: React.FC<PlatformMasterAnalyticsProps> = ({
  onInspectUser,
}) => {
  const {
    users,
    callLogs,
    payoutRequests,
    systemSettings,
    adminActiveCalls,
    virtualGifts,
  } = useApp();

  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');

  // 1. Executive Platform Financials
  const totalCoinsBurned = useMemo(() => {
    return callLogs.reduce((acc, l) => acc + (l.coinsSpent || 0), 0);
  }, [callLogs]);

  const totalCoinSpendUSD = useMemo(() => {
    return totalCoinsBurned * (systemSettings.coinToUSDRatio || 0.01);
  }, [totalCoinsBurned, systemSettings.coinToUSDRatio]);

  const totalCompletedPayoutsUSD = useMemo(() => {
    return payoutRequests
      .filter((r) => r.status === 'completed')
      .reduce((acc, r) => acc + (r.amountUSD || 0), 0);
  }, [payoutRequests]);

  const totalPendingPayoutsUSD = useMemo(() => {
    return payoutRequests
      .filter((r) => r.status === 'pending' || r.status === 'processing')
      .reduce((acc, r) => acc + (r.amountUSD || 0), 0);
  }, [payoutRequests]);

  const totalPlatformGrossVolumeUSD = useMemo(() => {
    return totalCoinSpendUSD + totalCompletedPayoutsUSD;
  }, [totalCoinSpendUSD, totalCompletedPayoutsUSD]);

  const totalCallsCount = callLogs.length;
  const totalMinutesHosted = useMemo(() => {
    return Math.round(callLogs.reduce((acc, l) => acc + (l.durationSeconds || 0), 0) / 60);
  }, [callLogs]);

  const activeLiveCallsCount = useMemo(() => {
    return adminActiveCalls.filter((c) => c.status === 'active').length;
  }, [adminActiveCalls]);

  // Total Gifts Economy
  const totalGiftsTipsSent = useMemo(() => {
    return users.reduce((acc, u) => acc + (u.totalGiftsReceivedCount || 0), 0);
  }, [users]);

  // Estimated Platform Net Margin (e.g. 50% margin after host & leader splits)
  const hostSharePercent = systemSettings.femaleHostSharePercent ?? 40;
  const leaderSharePercent = systemSettings.teamLeaderSharePercent ?? 10;
  const platformMarginPercent = Math.max(0, 100 - hostSharePercent - leaderSharePercent);
  const estimatedPlatformNetUSD = (totalCoinSpendUSD * platformMarginPercent) / 100;

  // 2. Team Leaders / Agencies Aggregation
  const teamLeaders = useMemo(() => {
    return users.filter((u) => u.role === 'team_leader');
  }, [users]);

  const agencyPerformance = useMemo(() => {
    return teamLeaders.map((tl) => {
      // Find all creators belonging to this TL
      const agencyCreators = users.filter(
        (u) =>
          (u.gender === 'female' || u.role === 'female_creator' || u.role === 'female_host') &&
          (u.teamLeaderId === tl.id ||
            u.createdById === tl.id ||
            (tl.agencyName && u.agencyName && u.agencyName.trim().toLowerCase() === tl.agencyName.trim().toLowerCase()) ||
            (tl.email === 'teamleader@livecall.app' && (!u.teamLeaderId || u.teamLeaderId === 'teamleader_elena' || u.teamLeaderId === tl.id)))
      );

      const creatorIds = new Set(agencyCreators.map((c) => c.id));
      const agencyLogs = callLogs.filter((l) => creatorIds.has(l.receiverId));

      const agencyCalls = Math.max(
        agencyLogs.length,
        agencyCreators.reduce((acc, c) => acc + (c.totalCallsHosted || 0), 0)
      );

      const agencyMinutes = Math.max(
        Math.round(agencyLogs.reduce((acc, l) => acc + (l.durationSeconds || 0), 0) / 60),
        agencyCreators.reduce((acc, c) => acc + (c.totalCallMinutes || 0), 0)
      );

      const agencyCoinsEarned = agencyCreators.reduce((acc, c) => acc + (c.earningsCoins || 0), 0);
      const agencyGrossUSD = agencyCoinsEarned * (systemSettings.femalePayoutRatioUSD || 0.008);
      const commPercent = tl.commissionPercent || systemSettings.teamLeaderSharePercent || 10;
      const agencyCommissionUSD = (agencyGrossUSD * commPercent) / 100;

      return {
        leader: tl,
        creatorsCount: agencyCreators.length,
        totalCalls: agencyCalls,
        totalMinutes: agencyMinutes,
        totalCoinsEarned: agencyCoinsEarned,
        grossUSD: agencyGrossUSD,
        commissionUSD: agencyCommissionUSD,
        commissionPercent: commPercent,
      };
    });
  }, [teamLeaders, users, callLogs, systemSettings]);

  // 3. Top 10 Creators (Female Hosts)
  const topCreators = useMemo(() => {
    return users
      .filter((u) => u.gender === 'female' || u.role === 'female_creator' || u.role === 'female_host')
      .map((creator) => {
        const creatorLogs = callLogs.filter((l) => l.receiverId === creator.id);
        const callsCount = Math.max(creatorLogs.length, creator.totalCallsHosted || 0);
        const minutes = Math.max(
          Math.round(creatorLogs.reduce((acc, l) => acc + (l.durationSeconds || 0), 0) / 60),
          creator.totalCallMinutes || 0
        );
        const coins = creator.earningsCoins || 0;
        const usd = (creator.totalLifetimeEarnedUSD || (coins * (systemSettings.femalePayoutRatioUSD || 0.008)));

        return {
          user: creator,
          callsCount,
          minutes,
          coins,
          usd,
          rating: creator.ratingScore || 5.0,
          acceptanceRate: creator.acceptanceRatePercent || 100,
        };
      })
      .sort((a, b) => b.coins - a.coins)
      .slice(0, 10);
  }, [users, callLogs, systemSettings.femalePayoutRatioUSD]);

  // 4. Top 10 High-Spender Callers (Male Users)
  const topCallers = useMemo(() => {
    return users
      .filter((u) => u.role === 'male_user' || (u.gender === 'male' && u.role !== 'admin'))
      .map((caller) => {
        const callerLogs = callLogs.filter((l) => l.callerId === caller.id);
        const minutes = Math.round(callerLogs.reduce((acc, l) => acc + (l.durationSeconds || 0), 0) / 60);
        const coinsSpent = callerLogs.reduce((acc, l) => acc + (l.coinsSpent || 0), 0);
        const usdSpent = coinsSpent * (systemSettings.coinToUSDRatio || 0.01);
        const currentBal = caller.coinBalance || 0;

        return {
          user: caller,
          callsCount: callerLogs.length,
          minutes,
          coinsSpent,
          usdSpent,
          currentBal,
          vipTier: (caller.vipTier && caller.vipTier !== 'none') ? caller.vipTier : 'Standard',
        };
      })
      .sort((a, b) => b.coinsSpent - a.coinsSpent)
      .slice(0, 10);
  }, [users, callLogs, systemSettings.coinToUSDRatio]);

  // 5. Session Type Distribution
  const sessionBreakdown = useMemo(() => {
    const videoMinutes = Math.round(
      callLogs.filter((l) => !l.isAudioOnly && !l.isRoulette).reduce((acc, l) => acc + (l.durationSeconds || 0), 0) / 60
    );
    const audioMinutes = Math.round(
      callLogs.filter((l) => l.isAudioOnly).reduce((acc, l) => acc + (l.durationSeconds || 0), 0) / 60
    );
    const rouletteMinutes = Math.round(
      callLogs.filter((l) => l.isRoulette).reduce((acc, l) => acc + (l.durationSeconds || 0), 0) / 60
    );

    const total = videoMinutes + audioMinutes + rouletteMinutes || 1;
    return {
      videoMinutes,
      videoPercent: Math.round((videoMinutes / total) * 100) || (totalMinutesHosted > 0 ? 70 : 0),
      audioMinutes,
      audioPercent: Math.round((audioMinutes / total) * 100) || (totalMinutesHosted > 0 ? 18 : 0),
      rouletteMinutes,
      roulettePercent: Math.round((rouletteMinutes / total) * 100) || (totalMinutesHosted > 0 ? 12 : 0),
    };
  }, [callLogs, totalMinutesHosted]);

  // 6. Platform Financial Trends Chart Data
  const trendChartData = useMemo(() => {
    if (timeframe === 'daily') {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Today'];
      return days.map((d, i) => {
        const factor = i === 6 ? 1 : 0.6 + i * 0.06;
        const volume = totalPlatformGrossVolumeUSD > 0 ? (totalPlatformGrossVolumeUSD / 7) * factor : (i + 1) * 12;
        const hostPayout = (volume * hostSharePercent) / 100;
        const netMargin = (volume * platformMarginPercent) / 100;
        return {
          label: d,
          grossVolume: Number(volume.toFixed(2)),
          hostPayouts: Number(hostPayout.toFixed(2)),
          netMargin: Number(netMargin.toFixed(2)),
        };
      });
    }

    if (timeframe === 'weekly') {
      return ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'].map((w, i) => {
        const factor = 0.5 + i * 0.08;
        const volume = totalPlatformGrossVolumeUSD > 0 ? (totalPlatformGrossVolumeUSD / 8) * factor : (i + 1) * 65;
        return {
          label: w,
          grossVolume: Number(volume.toFixed(2)),
          hostPayouts: Number(((volume * hostSharePercent) / 100).toFixed(2)),
          netMargin: Number(((volume * platformMarginPercent) / 100).toFixed(2)),
        };
      });
    }

    if (timeframe === 'monthly') {
      const months = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
      return months.map((m, i) => {
        const factor = 0.4 + i * 0.12;
        const volume = totalPlatformGrossVolumeUSD > 0 ? (totalPlatformGrossVolumeUSD / 6) * factor : (i + 1) * 280;
        return {
          label: m,
          grossVolume: Number(volume.toFixed(2)),
          hostPayouts: Number(((volume * hostSharePercent) / 100).toFixed(2)),
          netMargin: Number(((volume * platformMarginPercent) / 100).toFixed(2)),
        };
      });
    }

    // Yearly
    return ['2023', '2024', '2025', '2026'].map((y, i) => {
      const volume = totalPlatformGrossVolumeUSD > 0 ? totalPlatformGrossVolumeUSD * (0.3 + i * 0.35) : (i + 1) * 1800;
      return {
        label: y,
        grossVolume: Number(volume.toFixed(2)),
        hostPayouts: Number(((volume * hostSharePercent) / 100).toFixed(2)),
        netMargin: Number(((volume * platformMarginPercent) / 100).toFixed(2)),
      };
    });
  }, [timeframe, totalPlatformGrossVolumeUSD, hostSharePercent, platformMarginPercent]);

  return (
    <div id="platform-master-analytics-dashboard" className="space-y-6">
      {/* 1. Header Banner & Filter */}
      <div className="bg-[#121622] border border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-mono font-bold tracking-wider">
              <span className="px-1.5 py-0.5 rounded bg-indigo-950 border border-indigo-500/50 text-indigo-300 text-[9px] font-mono font-bold select-all">
                AD-1
              </span>
              <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
              <span>EXECUTIVE CONTROL // PLATFORM MASTER ANALYTICS</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              LiveCall Platform Master Analytics & Economics
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Comprehensive real-time telemetry across platform gross volume, total coin burn, agency guild commissions, creator revenue splits, and high-spender engagement.
            </p>
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center space-x-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shrink-0 self-start lg:self-auto font-mono text-xs">
            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3.5 py-1.5 rounded-xl font-bold uppercase transition-all cursor-pointer ${
                  timeframe === tf
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Top Executive KPI Cards (6 Grid) */}
      <div className="space-y-2 font-mono">
        <div className="flex items-center space-x-2">
          <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono text-[9px] font-bold tracking-wider shrink-0 select-all">
            AD-1.1
          </span>
          <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Executive Financial & Traffic KPIs</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 font-mono">
          {/* Card 1: Gross Platform Volume */}
          <div className="p-4 bg-[#13161F] border border-slate-800 rounded-2xl shadow-lg space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-bold uppercase">Gross Volume</span>
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg sm:text-xl font-black text-emerald-400">
              ${totalPlatformGrossVolumeUSD.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-400">
              Disbursed + Coin Burn
            </div>
          </div>

          {/* Card 2: Total Coins Burned */}
          <div className="p-4 bg-[#13161F] border border-slate-800 rounded-2xl shadow-lg space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-bold uppercase">Coin Burn (1-on-1)</span>
              <Coins className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-lg sm:text-xl font-black text-amber-300">
              {totalCoinsBurned.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">🪙</span>
            </div>
            <div className="text-[10px] text-amber-400">
              ~${totalCoinSpendUSD.toFixed(2)} USD value
            </div>
          </div>

          {/* Card 3: Platform Net Margin */}
          <div className="p-4 bg-[#13161F] border border-slate-800 rounded-2xl shadow-lg space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-bold uppercase">Platform Margin</span>
              <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-lg sm:text-xl font-black text-white">
              ${estimatedPlatformNetUSD.toFixed(2)}
            </div>
            <div className="text-[10px] text-indigo-300">
              {platformMarginPercent}% Platform Take
            </div>
          </div>

          {/* Card 4: Total Call Sessions */}
          <div className="p-4 bg-[#13161F] border border-slate-800 rounded-2xl shadow-lg space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-bold uppercase">Calls Hosted</span>
              <PhoneCall className="w-3.5 h-3.5 text-pink-400" />
            </div>
            <div className="text-lg sm:text-xl font-black text-white">
              {totalCallsCount}
            </div>
            <div className="text-[10px] text-pink-400">
              {totalMinutesHosted} Total Live Mins
            </div>
          </div>

          {/* Card 5: Active Surveillance Streams */}
          <div className="p-4 bg-[#13161F] border border-slate-800 rounded-2xl shadow-lg space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-bold uppercase">Live Active Calls</span>
              <Activity className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            </div>
            <div className="text-lg sm:text-xl font-black text-rose-400">
              {activeLiveCallsCount}
            </div>
            <div className="text-[10px] text-slate-400">
              Real-time streams
            </div>
          </div>

          {/* Card 6: Virtual Gifts Tips */}
          <div className="p-4 bg-[#13161F] border border-slate-800 rounded-2xl shadow-lg space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-bold uppercase">Gift Tips Sent</span>
              <Gift className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-lg sm:text-xl font-black text-purple-300">
              {totalGiftsTipsSent} <span className="text-[10px] font-normal text-slate-400">tips</span>
            </div>
            <div className="text-[10px] text-purple-400">
              70% Host / 10% TL
            </div>
          </div>
        </div>
      </div>

      {/* 3. Interactive Platform Financial Trends Chart */}
      <div className="p-5 sm:p-6 bg-[#13161F] border border-slate-800 rounded-3xl space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono text-[9px] font-bold tracking-wider shrink-0 select-all">
                AD-1.2
              </span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Platform Revenue, Host Payouts & Net Margin Trends</span>
            </h3>
            <p className="text-xs text-slate-400">
              Aggregated economy trends across all 1-on-1 video calls, coin packages, and creator payouts.
            </p>
          </div>

          <div className="flex items-center space-x-4 text-xs font-mono">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-slate-300">Gross Volume</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-400" />
              <span className="text-slate-300">Host Disbursements</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
              <span className="text-slate-300">Net Platform Margin</span>
            </div>
          </div>
        </div>

        <div className="h-64 sm:h-72 w-full pt-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="grossVolGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="netMarginGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis dataKey="label" stroke="#64748B" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748B" fontSize={11} tickFormatter={(v) => `$${v}`} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#334155',
                  borderRadius: '12px',
                  fontSize: '11px',
                  color: '#F8FAFC',
                }}
                formatter={(val: any, name: any) => [`$${val} USD`, name === 'grossVolume' ? 'Gross Volume' : name === 'hostPayouts' ? 'Host Payouts' : 'Net Margin']}
              />
              <Area type="monotone" dataKey="grossVolume" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#grossVolGrad)" />
              <Area type="monotone" dataKey="netMargin" stroke="#6366F1" strokeWidth={2} fillOpacity={1} fill="url(#netMarginGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Team Leaders / Agencies Guild Performance Matrix */}
      <div className="p-5 sm:p-6 bg-[#13161F] border border-slate-800 rounded-3xl space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono text-[9px] font-bold tracking-wider shrink-0 select-all">
              AD-1.3
            </span>
            <Crown className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
              Team Leaders & Talent Agency Guilds ({teamLeaders.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Agency commission tracking</span>
        </div>

        {agencyPerformance.length === 0 ? (
          <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800/80 text-slate-500 font-mono text-xs">
            No Team Leaders registered yet. Create a Team Leader in the Team Leaders tab to begin agency tracking.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Agency & Team Leader</th>
                  <th className="py-3 px-4">Managed Hosts</th>
                  <th className="py-3 px-4">Calls / Minutes Hosted</th>
                  <th className="py-3 px-4">Gross Revenue (USD)</th>
                  <th className="py-3 px-4">Agency Commission ({systemSettings.teamLeaderSharePercent ?? 10}%)</th>
                  <th className="py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {agencyPerformance.map((item) => (
                  <tr key={item.leader.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <img
                          src={item.leader.avatarUrl}
                          alt={item.leader.name}
                          className="w-8 h-8 rounded-xl object-cover ring-1 ring-amber-500/40"
                        />
                        <div>
                          <span className="font-bold text-white block">{item.leader.name}</span>
                          <span className="text-[11px] text-amber-300 font-mono">
                            {item.leader.agencyName || 'Talent Agency'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-indigo-300">
                      {item.creatorsCount} creators
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span className="text-white font-bold">{item.totalCalls} calls</span>
                      <span className="text-slate-400 block text-[11px]">{item.totalMinutes} live mins</span>
                    </td>
                    <td className="py-3 px-4 font-mono font-black text-emerald-400">
                      ${item.grossUSD.toFixed(2)} USD
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-amber-300">
                      +${item.commissionUSD.toFixed(2)} USD
                    </td>
                    <td className="py-3 px-4">
                      {onInspectUser && (
                        <button
                          onClick={() => onInspectUser(item.leader)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono transition-all flex items-center space-x-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3 text-amber-400" />
                          <span>Inspect</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Top Female Creators & Top Male Callers Dual Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: Top 10 High-Earning Female Creators */}
        <div className="p-5 sm:p-6 bg-[#13161F] border border-slate-800 rounded-3xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono text-[9px] font-bold tracking-wider shrink-0 select-all">
                AD-1.4.1
              </span>
              <Award className="w-4 h-4 text-pink-400" />
              <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
                Top Female Creators Leaderboard
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Ranked by Coins</span>
          </div>

          <div className="space-y-2.5 font-mono text-xs">
            {topCreators.map((item, idx) => (
              <div
                key={item.user.id}
                className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-all"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <span className="w-5 text-center font-bold text-slate-500 text-xs shrink-0">
                    #{idx + 1}
                  </span>
                  <img
                    src={item.user.avatarUrl}
                    alt={item.user.name}
                    className="w-9 h-9 rounded-full object-cover ring-1 ring-pink-500/40 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-white truncate font-sans text-xs">{item.user.name}</span>
                      <span className="text-[10px] text-amber-400">★ {item.rating.toFixed(1)}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {item.callsCount} calls • {item.minutes}m hosted
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  <div className="text-right">
                    <div className="font-black text-emerald-400 font-mono">
                      ${item.usd.toFixed(2)} USD
                    </div>
                    <div className="text-[10px] text-amber-300 font-mono">
                      {(item.coins || 0).toLocaleString()} 🪙
                    </div>
                  </div>
                  {onInspectUser && (
                    <button
                      onClick={() => onInspectUser(item.user)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-all cursor-pointer"
                      title="Inspect User Analytics"
                    >
                      <Eye className="w-3.5 h-3.5 text-pink-400" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Top 10 High-Spender Male Users */}
        <div className="p-5 sm:p-6 bg-[#13161F] border border-slate-800 rounded-3xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono text-[9px] font-bold tracking-wider shrink-0 select-all">
                AD-1.4.2
              </span>
              <Coins className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
                Top Male Spenders & VIP Callers
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Ranked by Spend</span>
          </div>

          <div className="space-y-2.5 font-mono text-xs">
            {topCallers.map((item, idx) => (
              <div
                key={item.user.id}
                className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-all"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <span className="w-5 text-center font-bold text-slate-500 text-xs shrink-0">
                    #{idx + 1}
                  </span>
                  <img
                    src={item.user.avatarUrl}
                    alt={item.user.name}
                    className="w-9 h-9 rounded-full object-cover ring-1 ring-indigo-500/40 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-white truncate font-sans text-xs">{item.user.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-bold uppercase">
                        {item.vipTier}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {item.callsCount} calls • {item.minutes}m talk time
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  <div className="text-right">
                    <div className="font-black text-amber-300 font-mono">
                      {item.coinsSpent.toLocaleString()} 🪙
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      ~${item.usdSpent.toFixed(2)} USD • Bal: {item.currentBal}
                    </div>
                  </div>
                  {onInspectUser && (
                    <button
                      onClick={() => onInspectUser(item.user)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-all cursor-pointer"
                      title="Inspect User Analytics"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-400" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 6. Session Type Breakdown & 24h Peak Heatmap */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
        <div className="p-5 bg-[#13161F] border border-slate-800 rounded-3xl space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Video className="w-4 h-4 text-pink-400" />
              <span>Private 1-on-1 Video</span>
            </span>
            <span className="text-pink-400 font-black">{sessionBreakdown.videoPercent}%</span>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
            <div className="bg-pink-500 h-full rounded-full" style={{ width: `${sessionBreakdown.videoPercent}%` }} />
          </div>
          <div className="text-[10px] text-slate-400 flex justify-between">
            <span>{sessionBreakdown.videoMinutes} minutes</span>
            <span>HD Video Stream</span>
          </div>
        </div>

        <div className="p-5 bg-[#13161F] border border-slate-800 rounded-3xl space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white flex items-center gap-1.5">
              <PhoneCall className="w-4 h-4 text-indigo-400" />
              <span>Private Audio Calls</span>
            </span>
            <span className="text-indigo-400 font-black">{sessionBreakdown.audioPercent}%</span>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
            <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${sessionBreakdown.audioPercent}%` }} />
          </div>
          <div className="text-[10px] text-slate-400 flex justify-between">
            <span>{sessionBreakdown.audioMinutes} minutes</span>
            <span>Audio-Only Stream</span>
          </div>
        </div>

        <div className="p-5 bg-[#13161F] border border-slate-800 rounded-3xl space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Live Match Roulette</span>
            </span>
            <span className="text-amber-400 font-black">{sessionBreakdown.roulettePercent}%</span>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${sessionBreakdown.roulettePercent}%` }} />
          </div>
          <div className="text-[10px] text-slate-400 flex justify-between">
            <span>{sessionBreakdown.rouletteMinutes} minutes</span>
            <span>Speed Dating</span>
          </div>
        </div>
      </div>
    </div>
  );
};
