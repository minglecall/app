import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Crown,
  Check,
  Zap,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { VIP_PLANS } from '../../constants/appDefaults';

interface VipModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VipModal: React.FC<VipModalProps> = ({ isOpen, onClose }) => {
  const { purchaseVip, currentUser } = useApp();
  const [selectedPlanId, setSelectedPlanId] = useState<'bronze' | 'silver' | 'gold' | 'diamond'>('gold');

  if (!isOpen) return null;

  const handleSubscribe = () => {
    purchaseVip(selectedPlanId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[88vh] sm:max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-amber-950/80 via-purple-950/60 to-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-amber-400 font-mono text-[9px] font-bold select-all">
              VP-1
            </span>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-500 text-slate-950 flex items-center justify-center font-black text-xl shadow-lg shadow-amber-500/20 shrink-0">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-xl font-extrabold text-white">LiveCall VIP Membership Tiers</h2>
              <p className="text-xs text-slate-300">Unlock daily free login coins, discounted call rates & priority search badges.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-full transition-colors shrink-0 cursor-pointer">
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Tiers Grid & Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 overscroll-contain">
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-amber-400 font-mono text-[9px] font-bold select-all">
                VP-2
              </span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select VIP Tier</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {VIP_PLANS.map((plan) => {
                const isSelected = selectedPlanId === plan.id;
                const isCurrent = currentUser.vipTier === plan.id;

                return (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/50 shadow-xl'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-amber-400 mb-1">{plan.badge}</div>
                      <h3 className="font-extrabold text-base text-white">{plan.name}</h3>
                      <div className="text-xl font-black text-white mt-1">
                        ${plan.priceMonthlyUSD.toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">/ mo</span>
                      </div>

                      <ul className="mt-3 space-y-1.5 text-[11px] text-slate-300">
                        {plan.features.map((feat, idx) => (
                          <li key={idx} className="flex items-start space-x-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {isCurrent && (
                      <div className="mt-3 px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold text-center border border-emerald-500/40">
                        Current Active Plan
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-amber-400 font-mono text-[9px] font-bold select-all">
                VP-3
              </span>
              <span className="text-xs text-slate-400">Instant VIP Activation</span>
            </div>
            <button
              onClick={handleSubscribe}
              className="w-full py-3.5 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-extrabold text-sm rounded-xl shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Crown className="w-4 h-4 fill-current" />
              <span>Upgrade to {selectedPlanId.toUpperCase()} VIP & Get Free Daily Coins</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
