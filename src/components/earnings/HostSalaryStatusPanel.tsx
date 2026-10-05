/**
 * Host salary status + closed-period earnings breakdown (call base / true-up / bonus).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import {
  fetchHostSalaryStatus,
  fetchHostPeriodEarnings,
  type HostSalaryStatusItem,
  type HostPeriodEarningsItem,
} from '../../services/financeApi';
import { HostPeriodEarningsBreakdown } from '../finance/HostPeriodEarningsBreakdown';

function formatPeriodWindow(start: string | null, end: string | null) {
  if (!start || !end) return '—';
  try {
    const s = new Date(start).toISOString().slice(0, 10);
    const e = new Date(end).toISOString().slice(0, 10);
    return `${s} → ${e} UTC`;
  } catch {
    return '—';
  }
}

/** Defensive: never surface amount-like keys even if API regresses. */
function sanitizeStatusItem(raw: any): HostSalaryStatusItem | null {
  if (!raw || typeof raw !== 'object') return null;
  return {
    periodId: String(raw.periodId || ''),
    cycleType: raw.cycleType ?? null,
    periodStart: raw.periodStart ?? null,
    periodEnd: raw.periodEnd ?? null,
    periodStatus: raw.periodStatus ?? null,
    batchId: String(raw.batchId || ''),
    batchKind: String(raw.batchKind || ''),
    batchStatus: String(raw.batchStatus || ''),
    salaryStatus: raw.salaryStatus === 'paid' ? 'paid' : 'pending',
  };
}

export const HostSalaryStatusPanel: React.FC = () => {
  const [items, setItems] = useState<HostSalaryStatusItem[]>([]);
  const [periodEarnings, setPeriodEarnings] = useState<HostPeriodEarningsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [statusRes, earningsRes] = await Promise.all([
      fetchHostSalaryStatus({ limit: 40 }),
      fetchHostPeriodEarnings({ limit: 12 }),
    ]);
    setLoading(false);

    if (!statusRes.success) {
      setError(statusRes.error?.message || 'Failed to load salary status');
      setItems([]);
    } else {
      const cleaned = (statusRes.data?.items || [])
        .map(sanitizeStatusItem)
        .filter(Boolean) as HostSalaryStatusItem[];
      setItems(cleaned);
    }

    if (earningsRes.success) {
      setPeriodEarnings(earningsRes.data?.periods || []);
    } else if (statusRes.success) {
      // Soft-fail earnings — status table still useful
      setPeriodEarnings([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="p-5 sm:p-6 bg-[#13161F] border border-slate-800 rounded-3xl space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Salary settlement status</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Pending / Paid per closed period. After close, true-up (if any) appears in the breakdown
              below — live call minutes still use base share.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-700/50 text-rose-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {items.length === 0 && !loading ? (
          <div className="p-10 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-2">
            <Calendar className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="font-bold text-white text-xs">No settlement periods yet</div>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              After a period closes and your salary is included in a settlement batch, Pending / Paid
              status and earnings breakdown will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                <tr>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4">Cycle</th>
                  <th className="py-3 px-4">Batch status</th>
                  <th className="py-3 px-4">Salary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {items.map((item) => (
                  <tr key={`${item.batchId}-${item.periodId}`} className="hover:bg-slate-900/40">
                    <td className="py-3.5 px-4">
                      <div className="text-slate-200 font-semibold">
                        {formatPeriodWindow(item.periodStart, item.periodEnd)}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[200px]">
                        {item.periodId}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 uppercase text-slate-400">{item.cycleType || '—'}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded border border-slate-700 text-[10px]">
                        {item.batchStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {item.salaryStatus === 'paid' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          <CheckCircle2 className="w-3 h-3" />
                          Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {periodEarnings.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-black text-white font-mono uppercase tracking-wider px-1">
            Closed period earnings
          </h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {periodEarnings.map((p) => (
              <HostPeriodEarningsBreakdown
                key={p.periodId}
                breakdown={p.breakdown}
                title={formatPeriodWindow(p.periodStart, p.periodEnd)}
                subtitle={`${(p.cycleType || 'period').toUpperCase()} · ${
                  p.hasTrueUp ? 'includes share true-up' : 'no share true-up'
                } · ${p.salaryStatus || p.periodStatus || ''}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
