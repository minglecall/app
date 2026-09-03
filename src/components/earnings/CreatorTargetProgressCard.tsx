import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Flame,
  Clock,
  Coins,
  Crown,
  Award,
  Sparkles,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Zap,
} from 'lucide-react';
import { CreatorTier } from '../../types';
import { isCurrentlyPeakHour } from '../../utils/discoveryAlgorithm';

export const CreatorTargetProgressCard: React.FC = () => {
  const { currentUser, systemSettings, myCreatorMetrics, toggleReadyNow, sendCreatorHeartbeat } = useApp();

  const metrics = myCreatorMetrics || {
    creatorId: currentUser.id,
    activeOnlineSeconds: (currentUser.totalCallMinutes || 0) * 60,
    activeOnlineHours: Number(((currentUser.totalCallMinutes || 0) / 60).toFixed(2)),
    coinsEarnedFromCalls: currentUser.earningsCoins || 0,
    coinsEarnedFromGifts: 0,
    totalTargetCoins: currentUser.earningsCoins || 0,
    currentStreakDays: 1,
    totalCallsOffered: currentUser.totalCallsHosted || 0,
    totalCallsAnswered: currentUser.totalCallsHosted || 0,
    totalCallsDeclined: 0,
    totalCallsMissed: 0,
    responseHealthScore: 100,
    performanceTier: 'bronze' as CreatorTier,
    isReadyNowActive: false,
    bonusEarnedCoins: 0,
    bonusEarnedUSD: 0,
    lastActiveDate: new Date().toISOString().split('T')[0],
  };

  const cycle = systemSettings.creatorTargetCycle || 'weekly';
  const isPeak = isCurrentlyPeakHour(systemSettings.peakHoursStart || '18:00', systemSettings.peakHoursEnd || '00:00');

  // Tier Thresholds Config
  const tiers = {
    bronze: {
      hours: systemSettings.creatorTargetBronzeHours ?? 20,
      coins: systemSettings.creatorTargetBronzeCoins ?? 5000,
      bonusUSD: systemSettings.creatorTargetBronzeBonusUSD ?? 15,
    },
    silver: {
      hours: systemSettings.creatorTargetSilverHours ?? 40,
      coins: systemSettings.creatorTargetSilverCoins ?? 20000,
      bonusUSD: systemSettings.creatorTargetSilverBonusUSD ?? 50,
    },
    gold: {
      hours: systemSettings.creatorTargetGoldHours ?? 60,
      coins: systemSettings.creatorTargetGoldCoins ?? 60000,
      bonusUSD: systemSettings.creatorTargetGoldBonusUSD ?? 150,
    },
  };

  const currentHours = metrics.activeOnlineHours || 0;
  const currentCoins = metrics.totalTargetCoins || (metrics.coinsEarnedFromCalls + metrics.coinsEarnedFromGifts) || 0;

  // Determine current tier and next tier target
  let currentTier: CreatorTier = 'bronze';
  let nextTier: 'silver' | 'gold' | 'max' = 'silver';
  let targetHours = tiers.silver.hours;
  let targetCoins = tiers.silver.coins;
  let nextBonusUSD = tiers.silver.bonusUSD;

  if (currentHours >= tiers.gold.hours && currentCoins >= tiers.gold.coins) {
    currentTier = 'gold';
    nextTier = 'max';
    targetHours = tiers.gold.hours;
    targetCoins = tiers.gold.coins;
    nextBonusUSD = tiers.gold.bonusUSD;
  } else if (currentHours >= tiers.silver.hours && currentCoins >= tiers.silver.coins) {
    currentTier = 'silver';
    nextTier = 'gold';
    targetHours = tiers.gold.hours;
    targetCoins = tiers.gold.coins;
    nextBonusUSD = tiers.gold.bonusUSD;
  } else {
    currentTier = 'bronze';
    nextTier = 'silver';
    targetHours = tiers.silver.hours;
    targetCoins = tiers.silver.coins;
    nextBonusUSD = tiers.silver.bonusUSD;
  }

  // Progress Percentages (0 - 100)
  const hoursPct = Math.min(100, Math.round((currentHours / Math.max(1, targetHours)) * 100));
  const coinsPct = Math.min(100, Math.round((currentCoins / Math.max(1, targetCoins)) * 100));
  const overallDualPct = Math.round((hoursPct + coinsPct) / 2);

  // Time remaining in current period calculation (Simulated weekly/monthly countdown)
  const timeRemainingDays = cycle === 'weekly' ? 4 : 18;

  return (
    <div className="bg-gradient-to-br from-[#161920] via-[#1a1d27] to-[#12141c] border border-slate-800/90 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-5 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header with Tier & Cycle Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div className="flex items-center space-x-3">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg border ${
            currentTier === 'gold'
              ? 'bg-gradient-to-tr from-yellow-600 to-amber-400 text-slate-950 border-yellow-300 shadow-yellow-950/50'
              : currentTier === 'silver'
              ? 'bg-gradient-to-tr from-slate-300 to-slate-100 text-slate-950 border-white shadow-slate-950/50'
              : 'bg-gradient-to-tr from-amber-800 to-amber-600 text-white border-amber-500/50 shadow-amber-950/50'
          }`}>
            {currentTier === 'gold' ? <Crown className="w-6 h-6 fill-current" /> : currentTier === 'silver' ? <Award className="w-6 h-6 fill-current" /> : <TrendingUp className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-amber-400 font-mono text-[9px] font-bold select-all">
                CR-1.1
              </span>
              <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400 font-mono">
                {cycle.toUpperCase()} TARGET ENGINE
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                currentTier === 'gold'
                  ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                  : currentTier === 'silver'
                  ? 'bg-slate-300/20 text-slate-200 border-slate-300/40'
                  : 'bg-amber-800/20 text-amber-300 border-amber-700/40'
              }`}>
                {currentTier.toUpperCase()} TIER
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-1.5">
              Dual-Metric Goal Progress
              <Sparkles className="w-4 h-4 text-amber-400" />
            </h3>
          </div>
        </div>

        {/* Ready Now Peak Hour Surge Toggle */}
        <div className="flex items-center justify-between sm:justify-end gap-3 bg-[#0F1115]/90 border border-slate-800 rounded-xl px-3.5 py-2.5 shadow-inner">
          <div className="flex flex-col">
            <div className="flex items-center space-x-1.5">
              <Flame className={`w-4 h-4 ${metrics.isReadyNowActive ? 'text-orange-400 animate-bounce' : 'text-slate-500'}`} />
              <span className="text-xs font-bold text-white">Ready Now Surge</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {isPeak ? '⚡ Peak Hours Active (18:00 - 00:00)' : 'Normal Matching Hours'}
            </span>
          </div>

          <button
            onClick={() => toggleReadyNow(!metrics.isReadyNowActive)}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center space-x-1 cursor-pointer border ${
              metrics.isReadyNowActive
                ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white border-orange-400 shadow-lg shadow-orange-950/60'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            <span>{metrics.isReadyNowActive ? 'ACTIVE 🔥' : 'TOGGLE ON'}</span>
          </button>
        </div>
      </div>

      {/* Dual Metrics Progress Trackers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
        {/* 1. Active Online Hours */}
        <div className="bg-[#0F1115]/80 border border-slate-800/80 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-300 font-bold text-xs">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>Active Online Hours</span>
            </div>
            <span className="text-xs font-mono font-extrabold text-white">
              {currentHours}h <span className="text-slate-500">/ {targetHours}h</span>
            </span>
          </div>

          <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800 p-0.5">
            <div
              className="bg-gradient-to-r from-indigo-600 to-blue-400 h-full rounded-full transition-all duration-700 shadow-sm"
              style={{ width: `${hoursPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>{hoursPct}% Completed</span>
            <span>{Math.max(0, Number((targetHours - currentHours).toFixed(1)))}h remaining</span>
          </div>
        </div>

        {/* 2. Coin Revenue Target */}
        <div className="bg-[#0F1115]/80 border border-slate-800/80 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-300 font-bold text-xs">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>Coin Earnings Revenue</span>
            </div>
            <span className="text-xs font-mono font-extrabold text-white">
              {currentCoins.toLocaleString()} <span className="text-slate-500">/ {targetCoins.toLocaleString()} 🪙</span>
            </span>
          </div>

          <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800 p-0.5">
            <div
              className="bg-gradient-to-r from-amber-600 to-yellow-400 h-full rounded-full transition-all duration-700 shadow-sm"
              style={{ width: `${coinsPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>{coinsPct}% Completed</span>
            <span>{Math.max(0, targetCoins - currentCoins).toLocaleString()} coins remaining</span>
          </div>
        </div>
      </div>

      {/* Target Reward & Bonus Callout Banner */}
      <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-amber-950/40 border border-indigo-500/20 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">
              {nextTier === 'max'
                ? '🏆 Maximum Gold Tier Achieved! Top Discovery Rotation Active.'
                : `Reach ${nextTier.toUpperCase()} Tier to unlock +$${nextBonusUSD.toFixed(2)} USD Cash Bonus`}
            </h4>
            <p className="text-[11px] text-slate-400">
              All target bonuses are credited as withdrawable earnings immediately upon window completion.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
          <span className="px-2.5 py-1 rounded bg-slate-900/90 text-slate-300 border border-slate-800 text-[11px] font-mono flex items-center space-x-1.5">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span>Cycle Reset in {timeRemainingDays} days</span>
          </span>
        </div>
      </div>
    </div>
  );
};
