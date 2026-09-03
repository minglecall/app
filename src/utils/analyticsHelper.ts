import { CallLogItem, PayoutRequest, UserProfile, TransactionReceipt, WalletLedgerEntry, SystemSettings } from '../types';

export interface EarningsDataPoint {
  period: string;
  videoCallsUSD: number;
  audioCallsUSD: number;
  giftsUSD: number;
  rouletteUSD: number;
  totalUSD: number;
  callMinutes: number;
  coinsEarned: number;
}

export interface SpendingDataPoint {
  period: string;
  videoCallsCoins: number;
  chatCoins: number;
  giftsCoins: number;
  momentsCoins: number;
  totalCoins: number;
  totalUSD: number;
}

export interface PeakHourMetric {
  hourLabel: string;
  callVolumePercent: number;
  minutesHosted: number;
  earningsCoins: number;
}

export interface HostMetrics {
  totalCalls: number;
  totalMinutes: number;
  totalCoinsEarned: number;
  lifetimeUSD: number;
  totalCallersCount: number;
  repeatCallersCount: number;
  repeatCallerRatePercent: number;
  videoMinutes: number;
  videoSessions: number;
  videoPercent: number;
  videoAvgMins: number;
  audioMinutes: number;
  audioSessions: number;
  audioPercent: number;
  audioAvgMins: number;
  rouletteMinutes: number;
  rouletteSessions: number;
  roulettePercent: number;
  rouletteAvgMins: number;
  peakHours: PeakHourMetric[];
  peakWindowLabel: string;
  hostQualityScore: number;
  acceptanceRatePercent: number;
}

export interface CallerMetrics {
  totalMinutes: number;
  videoMinutes: number;
  audioMinutes: number;
  totalCoinsSpent: number;
  totalUSDSpent: number;
  monthlyCoinsSpent: number;
  monthlyUSDSpent: number;
  totalGiftsCount: number;
  friendSavingsCoins: number;
  friendSavingsUSD: number;
}

export interface FavoriteHostStat {
  creatorId: string;
  name: string;
  avatarUrl: string;
  nationality: string;
  countryCode: string;
  totalMinutes: number;
  totalCoinsSpent: number;
  totalUSDSpent: number;
  callsCount: number;
  giftsSentCount: number;
  lastCallDate: string;
  isFriend: boolean;
  hourlyCoinRate: number;
  friendHourlyRate: number;
}

/**
 * Generate female host earnings data points dynamically from live call logs
 */
export function computeHostEarningsData(
  hostId: string,
  callLogs: CallLogItem[],
  femalePayoutRatioUSD: number = 0.008,
  timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'daily'
): EarningsDataPoint[] {
  const hostLogs = callLogs.filter((log) => log.receiverId === hostId || log.callerId === hostId);
  const now = new Date();
  const points: EarningsDataPoint[] = [];

  if (timeframe === 'daily') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dayName = days[d.getDay()];
      const monthDay = `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
      const periodLabel = `${dayName} (${monthDay})`;

      const dayLogs = hostLogs.filter((l) => {
        const logDate = new Date(l.startTime || l.timestamp || Date.now());
        return logDate.toDateString() === d.toDateString();
      });

      const coinsEarned = dayLogs.reduce((acc, l) => acc + (l.coinsEarned || 0), 0);
      const minutes = dayLogs.reduce((acc, l) => acc + Math.round((l.durationSeconds || 0) / 60), 0);
      const totalUSD = coinsEarned * femalePayoutRatioUSD;

      points.push({
        period: periodLabel,
        videoCallsUSD: Number((totalUSD * 0.85).toFixed(2)),
        audioCallsUSD: Number((totalUSD * 0.10).toFixed(2)),
        giftsUSD: Number((totalUSD * 0.05).toFixed(2)),
        rouletteUSD: 0,
        totalUSD: Number(totalUSD.toFixed(2)),
        callMinutes: minutes,
        coinsEarned,
      });
    }
  } else if (timeframe === 'weekly') {
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(now.getDate() - i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const weekLabel = `${weekStart.toLocaleString('default', { month: 'short' })} ${weekStart.getDate()}`;

      const weekLogs = hostLogs.filter((l) => {
        const logDate = new Date(l.startTime || l.timestamp || Date.now());
        return logDate >= weekStart && logDate <= weekEnd;
      });

      const coinsEarned = weekLogs.reduce((acc, l) => acc + (l.coinsEarned || 0), 0);
      const minutes = weekLogs.reduce((acc, l) => acc + Math.round((l.durationSeconds || 0) / 60), 0);
      const totalUSD = coinsEarned * femalePayoutRatioUSD;

      points.push({
        period: weekLabel,
        videoCallsUSD: Number((totalUSD * 0.85).toFixed(2)),
        audioCallsUSD: Number((totalUSD * 0.10).toFixed(2)),
        giftsUSD: Number((totalUSD * 0.05).toFixed(2)),
        rouletteUSD: 0,
        totalUSD: Number(totalUSD.toFixed(2)),
        callMinutes: minutes,
        coinsEarned,
      });
    }
  } else if (timeframe === 'monthly') {
    for (let i = 5; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = m.toLocaleString('default', { month: 'short', year: 'numeric' });

      const monthLogs = hostLogs.filter((l) => {
        const logDate = new Date(l.startTime || l.timestamp || Date.now());
        return logDate.getMonth() === m.getMonth() && logDate.getFullYear() === m.getFullYear();
      });

      const coinsEarned = monthLogs.reduce((acc, l) => acc + (l.coinsEarned || 0), 0);
      const minutes = monthLogs.reduce((acc, l) => acc + Math.round((l.durationSeconds || 0) / 60), 0);
      const totalUSD = coinsEarned * femalePayoutRatioUSD;

      points.push({
        period: monthLabel,
        videoCallsUSD: Number((totalUSD * 0.85).toFixed(2)),
        audioCallsUSD: Number((totalUSD * 0.10).toFixed(2)),
        giftsUSD: Number((totalUSD * 0.05).toFixed(2)),
        rouletteUSD: 0,
        totalUSD: Number(totalUSD.toFixed(2)),
        callMinutes: minutes,
        coinsEarned,
      });
    }
  } else {
    // Yearly
    for (let i = 2; i >= 0; i--) {
      const year = now.getFullYear() - i;
      const yearLogs = hostLogs.filter((l) => {
        const logDate = new Date(l.startTime || l.timestamp || Date.now());
        return logDate.getFullYear() === year;
      });

      const coinsEarned = yearLogs.reduce((acc, l) => acc + (l.coinsEarned || 0), 0);
      const minutes = yearLogs.reduce((acc, l) => acc + Math.round((l.durationSeconds || 0) / 60), 0);
      const totalUSD = coinsEarned * femalePayoutRatioUSD;

      points.push({
        period: `${year}`,
        videoCallsUSD: Number((totalUSD * 0.85).toFixed(2)),
        audioCallsUSD: Number((totalUSD * 0.10).toFixed(2)),
        giftsUSD: Number((totalUSD * 0.05).toFixed(2)),
        rouletteUSD: 0,
        totalUSD: Number(totalUSD.toFixed(2)),
        callMinutes: minutes,
        coinsEarned,
      });
    }
  }

  return points;
}

/**
 * Compute real host comprehensive metrics from database call logs
 */
export function computeHostMetrics(
  user: UserProfile,
  callLogs: CallLogItem[],
  femalePayoutRatioUSD: number = 0.008
): HostMetrics {
  const hostLogs = callLogs.filter((l) => l.receiverId === user.id);
  const totalCalls = hostLogs.length || (user.totalCallsHosted || 0);
  const totalMinutes = hostLogs.reduce((acc, l) => acc + Math.round((l.durationSeconds || 0) / 60), 0) || (user.totalCallMinutes || 0);
  const totalCoinsEarned = user.earningsCoins ?? hostLogs.reduce((acc, l) => acc + (l.coinsEarned || 0), 0);
  const lifetimeUSD = user.totalLifetimeEarnedUSD || (totalCoinsEarned * femalePayoutRatioUSD);

  // Callers
  const callerIds = hostLogs.map((l) => l.callerId);
  const callerCountMap = new Map<string, number>();
  callerIds.forEach((id) => {
    callerCountMap.set(id, (callerCountMap.get(id) || 0) + 1);
  });
  const totalCallersCount = callerCountMap.size;
  let repeatCallersCount = 0;
  callerCountMap.forEach((count) => {
    if (count > 1) repeatCallersCount++;
  });
  const repeatCallerRatePercent = totalCallersCount > 0 ? Number(((repeatCallersCount / totalCallersCount) * 100).toFixed(1)) : 0;

  // Session Types
  const videoLogs = hostLogs.filter((l) => !l.isAudioOnly && !l.isRoulette);
  const audioLogs = hostLogs.filter((l) => l.isAudioOnly);
  const rouletteLogs = hostLogs.filter((l) => l.isRoulette);

  const videoMinutes = videoLogs.reduce((acc, l) => acc + Math.round((l.durationSeconds || 0) / 60), 0);
  const audioMinutes = audioLogs.reduce((acc, l) => acc + Math.round((l.durationSeconds || 0) / 60), 0);
  const rouletteMinutes = rouletteLogs.reduce((acc, l) => acc + Math.round((l.durationSeconds || 0) / 60), 0);

  const totalTypeMins = (videoMinutes + audioMinutes + rouletteMinutes) || 1;
  const videoPercent = Math.round((videoMinutes / totalTypeMins) * 100);
  const audioPercent = Math.round((audioMinutes / totalTypeMins) * 100);
  const roulettePercent = Math.max(0, 100 - videoPercent - audioPercent);

  const videoAvgMins = videoLogs.length > 0 ? Number((videoMinutes / videoLogs.length).toFixed(1)) : 0;
  const audioAvgMins = audioLogs.length > 0 ? Number((audioMinutes / audioLogs.length).toFixed(1)) : 0;
  const rouletteAvgMins = rouletteLogs.length > 0 ? Number((rouletteMinutes / rouletteLogs.length).toFixed(1)) : 0;

  // Peak Hours Heatmap (8 3-hour windows)
  const hourBuckets = [
    { label: '12 AM', start: 0, end: 2 },
    { label: '3 AM', start: 3, end: 5 },
    { label: '6 AM', start: 6, end: 8 },
    { label: '9 AM', start: 9, end: 11 },
    { label: '12 PM', start: 12, end: 14 },
    { label: '3 PM', start: 15, end: 17 },
    { label: '6 PM', start: 18, end: 20 },
    { label: '9 PM', start: 21, end: 23 },
  ];

  let maxBucketIndex = -1;
  let maxBucketCount = -1;

  const peakHours: PeakHourMetric[] = hourBuckets.map((bucket, idx) => {
    const bucketLogs = hostLogs.filter((l) => {
      const d = new Date(l.startTime || l.timestamp || Date.now());
      const h = d.getHours();
      return h >= bucket.start && h <= bucket.end;
    });

    const mins = bucketLogs.reduce((acc, l) => acc + Math.round((l.durationSeconds || 0) / 60), 0);
    const coins = bucketLogs.reduce((acc, l) => acc + (l.coinsEarned || 0), 0);
    const percent = hostLogs.length > 0 ? Math.round((bucketLogs.length / hostLogs.length) * 100) : 0;

    if (bucketLogs.length > maxBucketCount) {
      maxBucketCount = bucketLogs.length;
      maxBucketIndex = idx;
    }

    return {
      hourLabel: bucket.label,
      callVolumePercent: percent,
      minutesHosted: mins,
      earningsCoins: coins,
    };
  });

  const peakWindowLabel = hostLogs.length > 0 && maxBucketIndex >= 0
    ? `${hourBuckets[maxBucketIndex].label} - ${hourBuckets[(maxBucketIndex + 1) % 8].label}`
    : '8 PM - 1 AM';

  return {
    totalCalls,
    totalMinutes,
    totalCoinsEarned,
    lifetimeUSD: Number(lifetimeUSD.toFixed(2)),
    totalCallersCount,
    repeatCallersCount,
    repeatCallerRatePercent,
    videoMinutes,
    videoSessions: videoLogs.length,
    videoPercent,
    videoAvgMins,
    audioMinutes,
    audioSessions: audioLogs.length,
    audioPercent,
    audioAvgMins,
    rouletteMinutes,
    rouletteSessions: rouletteLogs.length,
    roulettePercent,
    rouletteAvgMins,
    peakHours,
    peakWindowLabel,
    hostQualityScore: user.ratingScore || 5.0,
    acceptanceRatePercent: user.acceptanceRatePercent || 100,
  };
}

/**
 * Generate male caller spending points dynamically from live call logs
 */
export function computeCallerSpendingData(
  callerId: string,
  callLogs: CallLogItem[],
  coinToUSDRatio: number = 0.01,
  timeframe: 'daily' | 'weekly' = 'daily'
): SpendingDataPoint[] {
  const userLogs = callLogs.filter((log) => log.callerId === callerId);
  const now = new Date();
  const points: SpendingDataPoint[] = [];

  if (timeframe === 'daily') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dayName = days[d.getDay()];
      const monthDay = `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
      const periodLabel = `${dayName} (${monthDay})`;

      const dayLogs = userLogs.filter((l) => {
        const logDate = new Date(l.startTime || l.timestamp || Date.now());
        return logDate.toDateString() === d.toDateString();
      });

      const totalCoins = dayLogs.reduce((acc, l) => acc + (l.coinsSpent || 0), 0);

      points.push({
        period: periodLabel,
        videoCallsCoins: totalCoins,
        chatCoins: 0,
        giftsCoins: 0,
        momentsCoins: 0,
        totalCoins,
        totalUSD: Number((totalCoins * coinToUSDRatio).toFixed(2)),
      });
    }
  } else {
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(now.getDate() - i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const weekLabel = `${weekStart.toLocaleString('default', { month: 'short' })} ${weekStart.getDate()}`;

      const weekLogs = userLogs.filter((l) => {
        const logDate = new Date(l.startTime || l.timestamp || Date.now());
        return logDate >= weekStart && logDate <= weekEnd;
      });

      const totalCoins = weekLogs.reduce((acc, l) => acc + (l.coinsSpent || 0), 0);

      points.push({
        period: weekLabel,
        videoCallsCoins: totalCoins,
        chatCoins: 0,
        giftsCoins: 0,
        momentsCoins: 0,
        totalCoins,
        totalUSD: Number((totalCoins * coinToUSDRatio).toFixed(2)),
      });
    }
  }

  return points;
}

/**
 * Compute real male caller comprehensive metrics
 */
export function computeCallerMetrics(
  user: UserProfile,
  callLogs: CallLogItem[],
  systemSettings: SystemSettings
): CallerMetrics {
  const userLogs = callLogs.filter((l) => l.callerId === user.id);
  const totalMinutes = userLogs.reduce((acc, l) => acc + Math.round((l.durationSeconds || 0) / 60), 0);
  const videoLogs = userLogs.filter((l) => !l.isAudioOnly);
  const audioLogs = userLogs.filter((l) => l.isAudioOnly);

  const videoMinutes = videoLogs.reduce((acc, l) => acc + Math.round((l.durationSeconds || 0) / 60), 0);
  const audioMinutes = audioLogs.reduce((acc, l) => acc + Math.round((l.durationSeconds || 0) / 60), 0);

  const totalCoinsSpent = userLogs.reduce((acc, l) => acc + (l.coinsSpent || 0), 0);
  const coinToUSDRatio = systemSettings.coinToUSDRatio || 0.01;
  const totalUSDSpent = Number((totalCoinsSpent * coinToUSDRatio).toFixed(2));

  // Current month spend
  const now = new Date();
  const currentMonthLogs = userLogs.filter((l) => {
    const d = new Date(l.startTime || l.timestamp || Date.now());
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthlyCoinsSpent = currentMonthLogs.reduce((acc, l) => acc + (l.coinsSpent || 0), 0);
  const monthlyUSDSpent = Number((monthlyCoinsSpent * coinToUSDRatio).toFixed(2));

  // Friend rate savings: (standardRate - friendRate) * callMinutes
  const standardRate = systemSettings.coinBurnRatePerMin || 120;
  const friendRate = systemSettings.coinBurnRateFriendPerMin || 80;
  const discountPerMin = Math.max(0, standardRate - friendRate);

  const friendSavingsCoins = userLogs
    .filter((l) => l.wasFriendCall)
    .reduce((acc, l) => acc + Math.round((l.durationSeconds || 0) / 60) * discountPerMin, 0);

  const friendSavingsUSD = Number((friendSavingsCoins * coinToUSDRatio).toFixed(2));

  return {
    totalMinutes,
    videoMinutes,
    audioMinutes,
    totalCoinsSpent,
    totalUSDSpent,
    monthlyCoinsSpent,
    monthlyUSDSpent,
    totalGiftsCount: 0,
    friendSavingsCoins,
    friendSavingsUSD,
  };
}

/**
 * Build dynamic favorite hosts for a male caller from call logs
 */
export function computeFavoriteHosts(
  callerId: string,
  callLogs: CallLogItem[],
  allUsers: UserProfile[],
  friendsList: string[] = []
): FavoriteHostStat[] {
  const userLogs = callLogs.filter((l) => l.callerId === callerId);
  const hostMap = new Map<string, { minutes: number; coins: number; count: number; lastDate: string }>();

  userLogs.forEach((l) => {
    const prev = hostMap.get(l.receiverId) || { minutes: 0, coins: 0, count: 0, lastDate: l.timestamp };
    hostMap.set(l.receiverId, {
      minutes: prev.minutes + Math.round((l.durationSeconds || 0) / 60),
      coins: prev.coins + (l.coinsSpent || 0),
      count: prev.count + 1,
      lastDate: l.timestamp || prev.lastDate,
    });
  });

  const results: FavoriteHostStat[] = [];
  hostMap.forEach((stat, hostId) => {
    const host = allUsers.find((u) => u.id === hostId);
    if (host) {
      results.push({
        creatorId: host.id,
        name: host.name,
        avatarUrl: host.avatarUrl,
        nationality: host.nationality,
        countryCode: host.countryCode || 'US',
        totalMinutes: stat.minutes,
        totalCoinsSpent: stat.coins,
        totalUSDSpent: Number((stat.coins * 0.01).toFixed(2)),
        callsCount: stat.count,
        giftsSentCount: 0,
        lastCallDate: stat.lastDate,
        isFriend: friendsList.includes(host.id),
        hourlyCoinRate: host.hourlyCoinRate || 120,
        friendHourlyRate: Math.floor((host.hourlyCoinRate || 120) * 0.5),
      });
    }
  });

  return results.sort((a, b) => b.totalMinutes - a.totalMinutes);
}

/**
 * Build transaction receipts from user transactions and call logs
 */
export function computeTransactionReceipts(
  userId: string,
  callLogs: CallLogItem[]
): TransactionReceipt[] {
  const userLogs = callLogs.filter((l) => l.callerId === userId);
  return userLogs.slice(0, 15).map((l, idx) => ({
    id: `rec_${l.id || idx}`,
    invoiceNumber: `INV-${new Date(l.startTime || Date.now()).getFullYear()}-${String(idx + 1).padStart(4, '0')}`,
    userId,
    userName: l.callerName || 'Member',
    packageTitle: `1-on-1 Call Session (${Math.round((l.durationSeconds || 0) / 60)} min)`,
    coinsCredited: l.coinsSpent || 0,
    bonusCoins: 0,
    amountUSD: Number(((l.coinsSpent || 0) * 0.01).toFixed(2)),
    taxUSD: 0,
    paymentGateway: 'stripe',
    status: 'paid',
    createdAt: l.timestamp || new Date(l.startTime || Date.now()).toLocaleDateString(),
  }));
}

/**
 * Build wallet ledger entries from authoritative wallet_ledger rows.
 * Falls back to synthetic call_logs reconstruction when ledger is empty.
 */
export function mapWalletLedgerRows(
  rows: Array<{
    id: string;
    userId: string;
    callId?: string;
    transactionType: string;
    amount: number;
    balanceAfter: number;
    billingMinute?: number;
    metadata?: Record<string, any>;
    createdAt?: string;
  }>
): WalletLedgerEntry[] {
  return rows.map((row) => {
    const isDebit = row.transactionType === 'CALL_DEBIT' || Number(row.amount) < 0;
    const category: WalletLedgerEntry['category'] =
      row.transactionType === 'HOST_EARN' || row.transactionType === 'TL_EARN'
        ? 'host_earning'
        : 'call_spend';
    const title =
      row.transactionType === 'CALL_DEBIT'
        ? `Call billing · minute ${row.billingMinute ?? '?'}`
        : row.transactionType === 'HOST_EARN'
        ? `Host earnings · minute ${row.billingMinute ?? '?'}`
        : row.transactionType === 'TL_EARN'
        ? `Team leader commission · minute ${row.billingMinute ?? '?'}`
        : 'Wallet entry';

    return {
      id: row.id,
      userId: row.userId,
      type: isDebit ? 'debit' : 'credit',
      category,
      title,
      description: row.callId ? `Call ${row.callId}` : undefined,
      coins: Number(row.amount) || 0,
      balanceAfter: Number(row.balanceAfter) || 0,
      timestamp: row.createdAt ? new Date(row.createdAt).toLocaleString() : 'Recent',
      referenceId: row.callId || row.id,
    };
  });
}

/**
 * Build wallet ledger entries
 */
export function computeWalletLedger(
  user: UserProfile,
  callLogs: CallLogItem[],
  ledgerRows?: Array<{
    id: string;
    userId: string;
    callId?: string;
    transactionType: string;
    amount: number;
    balanceAfter: number;
    billingMinute?: number;
    metadata?: Record<string, any>;
    createdAt?: string;
  }> | null
): WalletLedgerEntry[] {
  if (ledgerRows && ledgerRows.length > 0) {
    return mapWalletLedgerRows(ledgerRows);
  }

  const userLogs = callLogs.filter((l) => l.callerId === user.id);
  const list: WalletLedgerEntry[] = [
    {
      id: 'led_init',
      userId: user.id,
      type: 'credit',
      category: 'daily_bonus',
      title: 'Initial Account Balance',
      coins: user.coinBalance || 0,
      balanceAfter: user.coinBalance || 0,
      timestamp: user.createdAt ? new Date(user.createdAt).toLocaleString() : 'Recent',
      referenceId: 'balance_initial',
    },
  ];

  let currentBal = user.coinBalance || 0;
  userLogs.forEach((l) => {
    currentBal = Math.max(0, currentBal - (l.coinsSpent || 0));
    list.push({
      id: `led_${l.id}`,
      userId: user.id,
      type: 'debit',
      category: 'call_spend',
      title: `Call with ${l.receiverName || 'Host'}`,
      coins: -(l.coinsSpent || 0),
      balanceAfter: currentBal,
      counterpartName: l.receiverName,
      counterpartAvatar: l.receiverAvatar,
      timestamp: l.timestamp || 'Recent',
      referenceId: l.id,
    });
  });

  return list.reverse();
}

/**
 * Platform retention from a burned minute using creator split rules.
 * female_creator: host% + tl% to parties, remainder platform.
 * otherwise: 100% platform.
 */
export function computePlatformRetentionCoins(
  coinsBurned: number,
  hostEarned: number,
  tlEarned: number
): number {
  return Math.max(0, (coinsBurned || 0) - (hostEarned || 0) - (tlEarned || 0));
}
