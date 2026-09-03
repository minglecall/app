import React from 'react';
import { UserProfile } from '../../types';
import { AnalyticsDashboardHub } from '../earnings/AnalyticsDashboardHub';
import {
  X,
  TrendingUp,
  DollarSign,
  Coins,
  ShieldCheck,
  User,
  LogIn,
  Clock,
  Sparkles,
  Award,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface UserAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
}

export const UserAnalyticsModal: React.FC<UserAnalyticsModalProps> = ({
  isOpen,
  onClose,
  user,
}) => {
  const { switchUser } = useApp();

  if (!isOpen || !user) return null;

  const isFemaleHost = user.gender === 'female' || user.role === 'female_creator';

  return (
    <div
      id="admin-user-analytics-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-7xl max-h-[92vh] flex flex-col bg-[#0B0F17] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Top Header Bar */}
        <div className="shrink-0 px-4 sm:px-6 py-4 bg-slate-900/90 border-b border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
            {/* User Avatar with status */}
            <div className="relative shrink-0">
              <img
                src={user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                alt={user.name}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover ring-2 ring-slate-700 shadow-md"
              />
              <span
                className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#0B0F17] ${
                  user.onlineStatus === 'online'
                    ? 'bg-emerald-400'
                    : user.onlineStatus === 'in_call'
                    ? 'bg-indigo-400'
                    : user.onlineStatus === 'busy'
                    ? 'bg-amber-400'
                    : 'bg-slate-500'
                }`}
              />
            </div>

            {/* User Info & Badge */}
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-black text-white truncate">{user.name}</h2>
                {user.isVerified && (
                  <span title="Verified Creator">
                    <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 ${
                    isFemaleHost
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  }`}
                >
                  {isFemaleHost ? 'Female Host' : 'Male User'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 font-mono mt-0.5">
                <span>ID: <strong className="text-slate-300">{user.id}</strong></span>
                <span>•</span>
                <span>{user.email || user.username || 'No email attached'}</span>
                {user.country && (
                  <>
                    <span>•</span>
                    <span>{user.country}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Metrics & Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3 self-stretch sm:self-auto justify-between sm:justify-end">
            <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs">
              <span className="text-slate-400">
                {isFemaleHost ? 'Accumulated Revenue:' : 'Coin Balance:'}
              </span>
              <strong className={isFemaleHost ? 'text-emerald-400' : 'text-amber-400'}>
                {isFemaleHost
                  ? `$${(user.totalLifetimeEarnedUSD || (user.earningsCoins || 0) * 0.008).toFixed(2)} USD`
                  : `🪙 ${(user.coinBalance ?? 0).toLocaleString()}`}
              </strong>
            </div>

            <button
              onClick={() => {
                switchUser(user.id);
                onClose();
              }}
              className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 hover:text-purple-200 text-xs font-mono font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
              title="Switch session and browse as this user"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Login as User</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
              aria-label="Close Analytics View"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6 custom-scrollbar bg-[#090C13]">
          <AnalyticsDashboardHub user={user} />
        </div>
      </div>
    </div>
  );
};
