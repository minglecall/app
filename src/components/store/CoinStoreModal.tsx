import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Coins,
  CreditCard,
  Smartphone,
  Bitcoin,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface CoinStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CoinStoreModal: React.FC<CoinStoreModalProps> = ({ isOpen, onClose }) => {
  const { coinPackages, buyCoinPackage, currentUser, manualGrantCoins, systemSettings } = useApp();
  const [selectedPackageId, setSelectedPackageId] = useState<string>(
    coinPackages.find((p) => p.popular)?.id || coinPackages[0]?.id || ''
  );
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'apple' | 'crypto'>('card');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const selectedPkg = coinPackages.find((p) => p.id === selectedPackageId) || coinPackages[0];

  const handleCheckout = () => {
    if (!selectedPkg) return;
    setIsProcessing(true);

    setTimeout(() => {
      buyCoinPackage(selectedPkg.id);
      setIsProcessing(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[88vh] sm:max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden my-auto">
        {/* Header - Fixed & Always Visible */}
        <div className="flex items-center justify-between p-4 sm:p-6 bg-slate-950/90 border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-amber-400 font-mono text-[9px] font-bold select-all">
              CS-1
            </span>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-500 text-slate-950 flex items-center justify-center font-black text-xl shadow-lg shadow-amber-500/20 shrink-0">
              🪙
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white">Refill LiveCall Coins</h2>
              <p className="text-xs text-slate-400">Current Balance: <span className="font-bold text-amber-300">{currentUser.coinBalance} Coins</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-colors shrink-0 cursor-pointer"
            title="Close modal"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Scrollable Store SKUs Grid & Payment Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 overscroll-contain">
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-amber-400 font-mono text-[9px] font-bold select-all">
                CS-2
              </span>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Coin Bundle SKU</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {coinPackages.map((pkg) => {
                const isSelected = selectedPackageId === pkg.id;
                const totalCoins = pkg.coins + pkg.bonusCoins;

                return (
                  <div
                    key={pkg.id}
                    onClick={() => setSelectedPackageId(pkg.id)}
                    className={`relative p-3.5 sm:p-4 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/50 shadow-lg shadow-amber-500/10'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Badge Tag */}
                    {pkg.badgeTag && (
                      <span className="absolute -top-2.5 right-3 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-extrabold text-[9px] uppercase tracking-wider shadow-md">
                        {pkg.badgeTag}
                      </span>
                    )}

                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">🪙</span>
                        <div>
                          <div className="font-extrabold text-sm sm:text-base text-white">{pkg.coins} Coins</div>
                          {pkg.bonusCoins > 0 && (
                            <div className="text-[10px] text-emerald-400 font-extrabold">+ {pkg.bonusCoins} BONUS COINS</div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base sm:text-lg font-black text-amber-300">${pkg.priceUSD.toFixed(2)}</div>
                        <div className="text-[10px] text-slate-400">USD</div>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-400 font-medium">
                      Approx. {Math.floor(totalCoins / systemSettings.coinBurnRatePerMin)} minutes of HD video calling
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <div className="flex items-center space-x-2 mb-2.5">
              <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-pink-400 font-mono text-[9px] font-bold select-all">
                CS-3
              </span>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Payment Gateway</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`p-2.5 sm:p-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 sm:space-x-2 transition-all cursor-pointer ${
                  paymentMethod === 'card'
                    ? 'bg-pink-500/20 text-pink-300 border-pink-500 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">Card</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('apple')}
                className={`p-2.5 sm:p-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 sm:space-x-2 transition-all cursor-pointer ${
                  paymentMethod === 'apple'
                    ? 'bg-pink-500/20 text-pink-300 border-pink-500 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">Apple/Google</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('crypto')}
                className={`p-2.5 sm:p-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 sm:space-x-2 transition-all cursor-pointer ${
                  paymentMethod === 'crypto'
                    ? 'bg-pink-500/20 text-pink-300 border-pink-500 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Bitcoin className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">USDT Crypto</span>
              </button>
            </div>
          </div>

          {/* Secure Guarantee */}
          <div className="flex items-center space-x-2 text-[11px] text-slate-400 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Encrypted 256-bit SSL billing. Coins are credited instantly to your wallet.</span>
          </div>

          {/* Checkout CTA & Manual Quick Add */}
          <div className="space-y-2 pt-1 pb-2">
            <button
              id="coin-store-checkout-btn"
              onClick={handleCheckout}
              disabled={isProcessing}
              className="w-full py-3.5 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 rounded-xl font-extrabold text-sm flex items-center justify-center space-x-2 shadow-xl shadow-amber-500/20 transition-all cursor-pointer"
            >
              {isProcessing ? (
                <span className="animate-pulse">Processing Payment...</span>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-current" />
                  <span>Pay ${selectedPkg?.priceUSD.toFixed(2)} & Get {(selectedPkg?.coins || 0) + (selectedPkg?.bonusCoins || 0)} Coins</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                manualGrantCoins(currentUser.id, 500, 'Manual Store Quick Credit');
              }}
              className="w-full py-2 bg-slate-950 border border-slate-800 hover:border-amber-500/50 text-amber-300 hover:text-amber-200 rounded-xl text-xs font-mono font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
            >
              <span>🪙</span>
              <span>Manual Test Grant (+500 Free Coins)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
