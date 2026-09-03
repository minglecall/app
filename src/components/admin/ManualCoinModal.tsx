import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Coins, PlusCircle, MinusCircle, ShieldCheck, Sparkles, User, RefreshCw } from 'lucide-react';
import { UserProfile } from '../../types';

interface ManualCoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId?: string | null;
}

export const ManualCoinModal: React.FC<ManualCoinModalProps> = ({
  isOpen,
  onClose,
  targetUserId,
}) => {
  const { users, manualGrantCoins } = useApp();

  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [amount, setAmount] = useState<number>(500);
  const [operation, setOperation] = useState<'add' | 'subtract' | 'set'>('add');
  const [reason, setReason] = useState<string>('🎁 Loyalty / Promotional Gift');
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (targetUserId) {
      setSelectedUserId(targetUserId);
    } else if (users.length > 0 && !selectedUserId) {
      setSelectedUserId(users[0].id);
    }
  }, [targetUserId, users]);

  if (!isOpen) return null;

  const targetUser: UserProfile | undefined = users.find((u) => u.id === selectedUserId) || users[0];
  const currentBalance = targetUser?.coinBalance || 0;

  // Calculate new balance preview
  let newBalancePreview = currentBalance;
  if (operation === 'add') {
    newBalancePreview = currentBalance + (Number(amount) || 0);
  } else if (operation === 'subtract') {
    newBalancePreview = Math.max(0, currentBalance - (Number(amount) || 0));
  } else if (operation === 'set') {
    newBalancePreview = Math.max(0, Number(amount) || 0);
  }

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;

    setIsSubmitting(true);
    const numAmount = Math.max(0, Number(amount) || 0);
    const finalReason = reason === 'Other / Custom' ? customReason || 'Manual Admin Credit' : reason;

    if (operation === 'add') {
      manualGrantCoins(targetUser.id, numAmount, finalReason);
    } else if (operation === 'subtract') {
      manualGrantCoins(targetUser.id, -numAmount, finalReason);
    } else if (operation === 'set') {
      const currentBal = Number(targetUser.coinBalance) || 0;
      const diff = numAmount - currentBal;
      manualGrantCoins(targetUser.id, diff, `Balance Set to ${numAmount} (${finalReason})`);
    }

    setIsSubmitting(false);
    onClose();
  };

  const presetAmounts = [100, 500, 1000, 5000, 10000, 50000];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#161920] border border-slate-800 rounded-xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-[#0F1115] border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm shadow-md">
              🪙
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-black text-white uppercase tracking-wider font-mono">Manual Coin Credit & Debit</h2>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono font-bold">
                  ADMIN TOOL
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-sans">
                Instantly adjust coin balance for any user account with audit tracking.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleApply} className="p-5 space-y-4">
          {/* User Selection */}
          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">
              Select Target User Account
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2 bg-[#0F1115] border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email}) — Balance: {(u.coinBalance ?? 0).toLocaleString()} Coins [{(u.role || 'user').toUpperCase()}]
                </option>
              ))}
            </select>
          </div>

          {/* User Profile Card */}
          {targetUser && (
            <div className="flex items-center justify-between p-3 bg-[#0F1115] border border-slate-800/80 rounded-lg">
              <div className="flex items-center space-x-3">
                <img
                  src={targetUser.avatarUrl}
                  alt={targetUser.name}
                  className="w-10 h-10 rounded-full object-cover border border-slate-700"
                />
                <div>
                  <div className="font-bold text-xs text-white flex items-center space-x-1.5">
                    <span>{targetUser.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 font-mono">
                      {targetUser.id}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    Role: <span className="text-slate-200 uppercase">{targetUser.role.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>
              <div className="text-right font-mono">
                <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Current Balance</div>
                <div className="text-sm font-extrabold text-amber-300">🪙 {(currentBalance ?? 0).toLocaleString()}</div>
              </div>
            </div>
          )}

          {/* Operation Toggle */}
          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
              Adjustment Operation
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setOperation('add')}
                className={`py-1.5 px-3 rounded text-xs font-mono font-bold flex items-center justify-center space-x-1 border transition-all ${
                  operation === 'add'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/20'
                    : 'bg-[#0F1115] text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Credit (+)</span>
              </button>

              <button
                type="button"
                onClick={() => setOperation('subtract')}
                className={`py-1.5 px-3 rounded text-xs font-mono font-bold flex items-center justify-center space-x-1 border transition-all ${
                  operation === 'subtract'
                    ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/20'
                    : 'bg-[#0F1115] text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <MinusCircle className="w-3.5 h-3.5" />
                <span>Debit (-)</span>
              </button>

              <button
                type="button"
                onClick={() => setOperation('set')}
                className={`py-1.5 px-3 rounded text-xs font-mono font-bold flex items-center justify-center space-x-1 border transition-all ${
                  operation === 'set'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                    : 'bg-[#0F1115] text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Set Exact (=)</span>
              </button>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
              Quick Preset Amount
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {presetAmounts.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(preset)}
                  className={`py-1 px-2 rounded text-[11px] font-mono font-bold border transition-all ${
                    amount === preset
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/60'
                      : 'bg-[#0F1115] text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                  }`}
                >
                  +{preset >= 1000 ? `${preset / 1000}k` : preset}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">
              Custom Amount (Coins)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-amber-400 font-mono">🪙</span>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full pl-8 pr-3 py-2 bg-[#0F1115] border border-slate-800 rounded text-xs text-white font-mono focus:outline-none focus:border-indigo-500 font-bold"
              />
            </div>
          </div>

          {/* Reason Selection */}
          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">
              Reason / Transaction Note
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-[#0F1115] border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-indigo-500 font-sans"
            >
              <option value="🎁 Loyalty / Promotional Gift">🎁 Loyalty / Promotional Gift</option>
              <option value="🎧 Customer Support Compensation">🎧 Customer Support Compensation</option>
              <option value="🧪 System & Call Testing">🧪 System & Call Testing</option>
              <option value="🏆 VIP Welcome Reward">🏆 VIP Welcome Reward</option>
              <option value="Other / Custom">Other / Custom Note...</option>
            </select>

            {reason === 'Other / Custom' && (
              <input
                type="text"
                placeholder="Enter custom reason for audit log..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full mt-2 px-3 py-2 bg-[#0F1115] border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-indigo-500 font-sans"
              />
            )}
          </div>

          {/* Audit Impact Box */}
          <div className="p-3 bg-[#0F1115] border border-slate-800 rounded-lg flex items-center justify-between text-xs font-mono">
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-bold">New Account Balance</div>
              <div className="text-slate-400 font-bold">
                {(currentBalance ?? 0).toLocaleString()} ➔{' '}
                <span
                  className={
                    newBalancePreview > currentBalance
                      ? 'text-emerald-400 font-extrabold'
                      : newBalancePreview < currentBalance
                      ? 'text-rose-400 font-extrabold'
                      : 'text-amber-300 font-extrabold'
                  }
                >
                  {(newBalancePreview ?? 0).toLocaleString()} Coins
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                VERIFIED ADMIN ACTION
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded text-xs font-semibold text-slate-400 hover:text-white bg-[#0F1115] border border-slate-800 hover:border-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2 rounded text-xs font-mono font-bold text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 shadow-lg shadow-indigo-600/30 transition-all"
            >
              {isSubmitting ? 'Processing...' : 'Confirm Coin Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
