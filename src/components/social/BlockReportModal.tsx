import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, ShieldAlert, Ban, Flag, CheckCircle2 } from 'lucide-react';

interface BlockReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId: string | null;
}

export const BlockReportModal: React.FC<BlockReportModalProps> = ({ isOpen, onClose, targetUserId }) => {
  const { users, blockUser, reportUser } = useApp();
  const [actionType, setActionType] = useState<'report' | 'block'>('report');
  const [selectedReason, setSelectedReason] = useState<string>('Inappropriate Conduct / Content');
  const [customNote, setCustomNote] = useState<string>('');

  if (!isOpen || !targetUserId) return null;

  const targetUser = users.find((u) => u.id === targetUserId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = selectedReason === 'Other' ? customNote || 'User Flagged' : selectedReason;

    if (actionType === 'block') {
      blockUser(targetUserId, finalReason);
    } else {
      reportUser(targetUserId, finalReason);
    }

    onClose();
  };

  const reasons = [
    'Inappropriate Conduct / Content',
    'Nudity or Sexual Harassment',
    'Fake Profile / Impersonation',
    'Commercial Spam or Scams',
    'Abusive Language',
    'Other'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-[#161920] border border-slate-800 rounded-xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-[#0F1115] border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <h2 className="text-sm font-black text-white uppercase tracking-wider font-mono">
              Safety Control & Moderation
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {targetUser && (
            <div className="flex items-center space-x-3 p-3 bg-[#0F1115] border border-slate-800 rounded-lg">
              <img
                src={targetUser.avatarUrl}
                alt={targetUser.name}
                className="w-10 h-10 rounded-full object-cover border border-slate-700"
              />
              <div>
                <div className="font-bold text-white text-xs">{targetUser.name}</div>
                <div className="text-[10px] text-slate-400 font-mono">User ID: {targetUser.id}</div>
              </div>
            </div>
          )}

          {/* Action Selector */}
          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
              Select Action Type
            </label>
            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => setActionType('report')}
                className={`py-2 px-3 rounded font-bold flex items-center justify-center space-x-1.5 border transition-all ${
                  actionType === 'report'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                    : 'bg-[#0F1115] text-slate-400 border-slate-800'
                }`}
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Flag / Report</span>
              </button>

              <button
                type="button"
                onClick={() => setActionType('block')}
                className={`py-2 px-3 rounded font-bold flex items-center justify-center space-x-1.5 border transition-all ${
                  actionType === 'block'
                    ? 'bg-rose-600 text-white border-rose-500'
                    : 'bg-[#0F1115] text-slate-400 border-slate-800'
                }`}
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Block User</span>
              </button>
            </div>
          </div>

          {/* Reason Radio Options */}
          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2">
              Primary Reason
            </label>
            <div className="space-y-1.5">
              {reasons.map((r) => (
                <label
                  key={r}
                  onClick={() => setSelectedReason(r)}
                  className={`flex items-center justify-between p-2.5 rounded border text-xs cursor-pointer transition-all ${
                    selectedReason === r
                      ? 'bg-indigo-500/10 border-indigo-500 text-white font-bold'
                      : 'bg-[#0F1115] border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span>{r}</span>
                  {selectedReason === r && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />}
                </label>
              ))}
            </div>

            {selectedReason === 'Other' && (
              <textarea
                placeholder="Describe the issue for AI moderators..."
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                className="w-full mt-2 p-2.5 bg-[#0F1115] border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-indigo-500"
                rows={2}
              />
            )}
          </div>

          {/* Submit */}
          <div className="flex items-center space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded text-xs font-semibold text-slate-400 bg-[#0F1115] border border-slate-800 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`flex-1 py-2 rounded text-xs font-mono font-bold text-white border transition-all ${
                actionType === 'block'
                  ? 'bg-rose-600 hover:bg-rose-500 border-rose-500'
                  : 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500'
              }`}
            >
              {actionType === 'block' ? 'Confirm Block' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
