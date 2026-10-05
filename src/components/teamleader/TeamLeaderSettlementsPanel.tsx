/**
 * Team Leader settlement batches — amounts from /api/v1/finance/tl/* only.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  DollarSign,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Users,
  Landmark,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  fetchTlFinanceBatch,
  fetchTlFinanceBatches,
  postTlConfirmReceived,
} from '../../services/financeApi';

function formatUsd(n: number | undefined | null) {
  return `$${(Number(n) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`;
}

function formatWhen(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  } catch {
    return String(iso);
  }
}

function statusTone(status: string) {
  if (status === 'tl_confirmed') return 'bg-emerald-950 text-emerald-300 border-emerald-500/40';
  if (status === 'admin_paid') return 'bg-indigo-950 text-indigo-300 border-indigo-500/40';
  if (status === 'cancelled') return 'bg-rose-950 text-rose-300 border-rose-500/40';
  return 'bg-amber-950 text-amber-300 border-amber-500/40';
}

export const TeamLeaderSettlementsPanel: React.FC = () => {
  const { showToast, users } = useApp();
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    batch: any;
    lineItems: any[];
    events: any[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) map.set(u.id, u.name || u.email || u.id);
    return map;
  }, [users]);

  const loadBatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchTlFinanceBatches({ limit: 50 });
    setLoading(false);
    if (!res.success) {
      setError(res.error?.message || 'Failed to load settlement batches');
      setBatches([]);
      return;
    }
    const list = res.data?.batches || [];
    setBatches(list);
    setSelectedId((prev) => prev || list[0]?.id || null);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetchTlFinanceBatch(id);
    if (!res.success || !res.data) {
      setDetail(null);
      showToast('Batch load failed', res.error?.message || 'Error', 'error');
      return;
    }
    setDetail(res.data);
  }, [showToast]);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const hostLines = useMemo(() => {
    const lines = detail?.lineItems || [];
    // Group host payees for a per-host payable table
    const byHost = new Map<
      string,
      { payeeUserId: string; components: any[]; totalUsd: number; salaryStatus: string }
    >();
    for (const li of lines) {
      if (li.payeeRole !== 'host') continue;
      const prev = byHost.get(li.payeeUserId) || {
        payeeUserId: li.payeeUserId,
        components: [] as any[],
        totalUsd: 0,
        salaryStatus: 'paid',
      };
      prev.components.push(li);
      prev.totalUsd += Number(li.amountUsd) || 0;
      if (li.hostSalaryStatus !== 'paid') prev.salaryStatus = 'pending';
      byHost.set(li.payeeUserId, prev);
    }
    return Array.from(byHost.values());
  }, [detail]);

  const tlCommissionLines = useMemo(
    () => (detail?.lineItems || []).filter((li: any) => li.payeeRole === 'team_leader'),
    [detail]
  );

  const confirmReceived = async () => {
    if (!selectedId) return;
    setBusy(true);
    const res = await postTlConfirmReceived(selectedId, { note: note || undefined });
    setBusy(false);
    if (!res.success) {
      showToast('Confirm failed', res.error?.message || 'Error', 'error');
      return;
    }
    showToast('Confirmed', 'Settlement marked as received. Host salaries updated to Paid.', 'success');
    setNote('');
    await loadBatches();
    await loadDetail(selectedId);
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/40 rounded-2xl p-4 flex items-start gap-3">
        <Landmark className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-xs sm:text-sm font-bold text-emerald-200">
            Agency settlement batches (Financial Module)
          </h4>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Each batch is one admin remittance for your agency: managed host salaries + your TL commission.
            Confirm received after admin marks the batch paid.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadBatches()}
          disabled={loading || busy}
          className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-700/50 text-rose-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-2 bg-[#12151F] border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-400" />
              Your batches
            </h3>
            <span className="text-[10px] font-mono text-slate-500">{batches.length}</span>
          </div>
          <div className="max-h-[460px] overflow-y-auto divide-y divide-slate-800/70">
            {batches.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No settlement batches yet. They appear after period close.
              </div>
            ) : (
              batches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedId(b.id)}
                  className={`w-full text-left p-3.5 hover:bg-slate-900/60 cursor-pointer ${
                    selectedId === b.id ? 'bg-amber-950/20 border-l-2 border-amber-400' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${statusTone(b.status)}`}>
                      {b.status}
                    </span>
                    <span className="text-sm font-black text-emerald-400 font-mono">
                      {formatUsd(b.totalDueUsd)}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400 font-mono space-y-0.5">
                    <div>Hosts {formatUsd(b.totalHostSalaryUsd)}</div>
                    <div>Your commission {formatUsd(b.totalTlCommissionUsd)}</div>
                    <div className="text-slate-600">{formatWhen(b.createdAt)}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="xl:col-span-3 bg-[#12151F] border border-slate-800 rounded-2xl p-4 space-y-4">
          {!detail ? (
            <div className="p-10 text-center text-slate-500 text-xs">Select a batch to view host amounts.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white">Batch detail</h3>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">{detail.batch?.id}</p>
                </div>
                <span className={`px-2.5 py-1 rounded border text-[10px] font-mono font-bold ${statusTone(detail.batch?.status)}`}>
                  {detail.batch?.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-slate-500">Host salaries</div>
                  <div className="font-black text-white mt-1 font-mono">{formatUsd(detail.batch?.totalHostSalaryUsd)}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-slate-500">TL commission</div>
                  <div className="font-black text-amber-300 mt-1 font-mono">{formatUsd(detail.batch?.totalTlCommissionUsd)}</div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-700/40">
                  <div className="text-emerald-400/80">Total due</div>
                  <div className="font-black text-emerald-300 mt-1 font-mono">{formatUsd(detail.batch?.totalDueUsd)}</div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  Managed host payables
                </h4>
                <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-[240px]">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-950 text-slate-400 sticky top-0">
                      <tr>
                        <th className="p-2">Host</th>
                        <th className="p-2">Components</th>
                        <th className="p-2">Amount USD</th>
                        <th className="p-2">Salary status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hostLines.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-slate-500">
                            No host line items in this batch.
                          </td>
                        </tr>
                      ) : (
                        hostLines.map((h) => (
                          <tr key={h.payeeUserId} className="border-t border-slate-800/80">
                            <td className="p-2">
                              <div className="font-semibold text-slate-200">
                                {nameById.get(h.payeeUserId) || 'Host'}
                              </div>
                              <div className="font-mono text-[10px] text-slate-500 truncate max-w-[120px]">
                                {h.payeeUserId}
                              </div>
                            </td>
                            <td className="p-2 font-mono text-amber-300">
                              {h.components.map((c: any) => c.component).join(', ')}
                            </td>
                            <td className="p-2 font-mono font-bold text-emerald-400">
                              {formatUsd(h.totalUsd)}
                            </td>
                            <td className="p-2 font-mono">
                              <span
                                className={`px-2 py-0.5 rounded border text-[10px] ${
                                  h.salaryStatus === 'paid'
                                    ? 'border-emerald-500/40 text-emerald-300'
                                    : 'border-amber-500/40 text-amber-300'
                                }`}
                              >
                                {h.salaryStatus}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {tlCommissionLines.length > 0 && (
                <div className="text-xs font-mono text-slate-400 space-y-1">
                  <div className="font-bold text-slate-300">Your commission lines</div>
                  {tlCommissionLines.map((li: any) => (
                    <div key={li.id} className="flex justify-between gap-2 bg-slate-950/60 rounded-lg px-2 py-1.5">
                      <span>{li.component}</span>
                      <span className="text-amber-300">{formatUsd(li.amountUsd)}</span>
                    </div>
                  ))}
                </div>
              )}

              {detail.batch?.status === 'admin_paid' && (
                <div className="border-t border-slate-800 pt-3 space-y-2">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Optional note"
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void confirmReceived()}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-black flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Confirm received
                  </button>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Confirms funds received and marks agency host salaries as Paid.
                  </p>
                </div>
              )}

              {detail.batch?.status === 'pending_admin_pay' && (
                <p className="text-[11px] text-amber-300/90 bg-amber-950/20 border border-amber-700/30 rounded-xl p-3">
                  Waiting for admin remittance. Confirm received unlocks after status is <span className="font-mono">admin_paid</span>.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
