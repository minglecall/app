import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShieldCheck,
  Lock,
  FileText,
  Coins,
  Sparkles,
  UserCheck,
  X,
  ExternalLink,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { PolicyDocument } from '../../types';

interface PolicyDetailModalProps {
  onNavigateToTab?: (tab: string) => void;
}

export const PolicyDetailModal: React.FC<PolicyDetailModalProps> = ({ onNavigateToTab }) => {
  const {
    activePolicyDoc,
    closePolicyModal,
    policyDocuments,
    openPolicyModal,
    currentUser,
  } = useApp();

  if (!activePolicyDoc) return null;

  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'Lock':
        return <Lock className="w-5 h-5 text-indigo-400" />;
      case 'FileText':
        return <FileText className="w-5 h-5 text-emerald-400" />;
      case 'Coins':
        return <Coins className="w-5 h-5 text-amber-400" />;
      case 'Sparkles':
        return <Sparkles className="w-5 h-5 text-pink-400" />;
      case 'UserCheck':
        return <UserCheck className="w-5 h-5 text-cyan-400" />;
      case 'ShieldCheck':
      default:
        return <ShieldCheck className="w-5 h-5 text-rose-400" />;
    }
  };

  const formatContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return (
          <h3 key={idx} className="text-base font-extrabold text-white mt-5 mb-2 flex items-center space-x-2 border-b border-slate-800 pb-1">
            <span className="w-2 h-2 rounded-full bg-pink-500 inline-block"></span>
            <span>{line.replace('### ', '')}</span>
          </h3>
        );
      }
      if (line.startsWith('* ') || line.startsWith('- ')) {
        const itemText = line.replace(/^[\*\-]\s+/, '');
        // Highlight bold text inside bullet
        return (
          <li key={idx} className="text-slate-300 text-xs sm:text-sm pl-2 py-1 leading-relaxed list-disc list-inside">
            {itemText}
          </li>
        );
      }
      if (line.trim() === '') {
        return <div key={idx} className="h-2"></div>;
      }
      return (
        <p key={idx} className="text-slate-300 text-xs sm:text-sm leading-relaxed py-0.5">
          {line}
        </p>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="bg-[#12151C] border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-[#181C26] to-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center shadow-inner">
              {getCategoryIcon(activePolicyDoc.icon)}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono font-bold uppercase tracking-wider">
                  {activePolicyDoc.category} Policy
                </span>
                <span className="text-[10px] text-slate-500 flex items-center space-x-1">
                  <Calendar className="w-3 h-3" />
                  <span>Updated: {activePolicyDoc.lastUpdated}</span>
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight leading-tight mt-0.5">
                {activePolicyDoc.title}
              </h2>
            </div>
          </div>

          <button
            onClick={closePolicyModal}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors shrink-0"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Quick Tabs */}
        <div className="px-4 py-2.5 bg-[#0D1017] border-b border-slate-800/80 flex space-x-1.5 overflow-x-auto no-scrollbar shrink-0">
          {policyDocuments.map((doc) => {
            const isSelected = doc.id === activePolicyDoc.id;
            return (
              <button
                key={doc.id}
                onClick={() => openPolicyModal(doc.id)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                    : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <span>{doc.title.split('&')[0].trim()}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Policy Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-slate-200">
          {/* Summary Callout Banner */}
          <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 flex items-start space-x-3">
            <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-indigo-200 leading-snug">
              <span className="font-bold text-white block mb-0.5">Official Platform Standard:</span>
              {activePolicyDoc.summary}
            </div>
          </div>

          {/* Policy Text / Clauses */}
          <div className="space-y-2 bg-[#0B0D13] p-4 rounded-2xl border border-slate-800/80">
            {formatContent(activePolicyDoc.content)}
          </div>

          {/* External Legal Link if provided */}
          {activePolicyDoc.externalUrl && (
            <div className="pt-2">
              <a
                href={activePolicyDoc.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-indigo-200 text-xs font-bold border border-slate-700 transition-all"
              >
                <span>View Full Legal PDF Document</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#0D1017] border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px] text-slate-400 font-mono">100% Verified Community Standard</span>
          </div>

          <div className="flex items-center space-x-2">
            {currentUser.role === 'admin' && onNavigateToTab && (
              <button
                onClick={() => {
                  closePolicyModal();
                  onNavigateToTab('admin');
                }}
                className="px-3 py-1.5 rounded-xl bg-purple-950/60 border border-purple-500/40 text-purple-300 hover:bg-purple-900/60 text-xs font-semibold transition-all flex items-center space-x-1"
              >
                <span>Edit CMS</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={closePolicyModal}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
            >
              I Understand & Agree
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
