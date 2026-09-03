import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Home as HomeIcon,
  LayoutGrid,
  Layers,
  Image as ImageIcon,
  Zap,
  MessageCircle,
  PhoneCall,
  Settings,
  Crown,
} from 'lucide-react';

interface GlobalBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenMatch: () => void;
  onOpenChat: (userId?: string) => void;
  isChatOpen: boolean;
  isMatchOpen: boolean;
  onCloseOverlays: () => void;
}

export const GlobalBottomNav: React.FC<GlobalBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenMatch,
  onOpenChat,
  isChatOpen,
  isMatchOpen,
  onCloseOverlays,
}) => {
  const { currentUser, isLoggedIn, unreadMessagesCount, pendingFriendRequestsCount } = useApp();

  if (!isLoggedIn) {
    return null;
  }

  const isFemale = currentUser.gender === 'female' || currentUser.role === 'female_creator' || currentUser.role === 'female_host';
  const isAdmin = isLoggedIn && currentUser.role === 'admin';

  const handleTabClick = (tab: string) => {
    onCloseOverlays();
    setActiveTab(tab);
  };

  const handleMatchClick = () => {
    onCloseOverlays();
    onOpenMatch();
  };

  const handleChatClick = () => {
    if (isChatOpen) {
      onCloseOverlays();
    } else {
      onCloseOverlays();
      onOpenChat();
    }
  };

  return (
    <nav
      id="global-bottom-navigation-bar"
      className="md:hidden fixed bottom-0 left-0 right-0 z-[9000] bg-[#0F1117]/95 backdrop-blur-xl border-t border-slate-800/90 text-slate-300 shadow-[0_-10px_35px_rgba(0,0,0,0.85)] px-2 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {/* 1. Home Tab */}
        <button
          id="global-nav-home"
          onClick={() => handleTabClick('home')}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'home' && !isChatOpen && !isMatchOpen
              ? 'text-pink-400 font-bold bg-pink-500/15 shadow-sm scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Home Page"
        >
          <HomeIcon className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] leading-tight">Home</span>
        </button>

        {/* 2. Discovery Tab */}
        <button
          id="global-nav-discovery"
          onClick={() => handleTabClick('discovery')}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'discovery' && !isChatOpen && !isMatchOpen
              ? 'text-pink-400 font-bold bg-pink-500/15 shadow-sm scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Discovery Grid"
        >
          <LayoutGrid className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] leading-tight">Discovery</span>
        </button>

        {/* 3. Swipe Tab */}
        <button
          id="global-nav-swipe"
          onClick={() => handleTabClick('swipe')}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'swipe' && !isChatOpen && !isMatchOpen
              ? 'text-pink-400 font-bold bg-pink-500/15 shadow-sm scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Swipe Deck"
        >
          <Layers className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] leading-tight">Swipe</span>
        </button>

        {/* 4. Moments Tab */}
        <button
          id="global-nav-moments"
          onClick={() => handleTabClick('moments')}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'moments' && !isChatOpen && !isMatchOpen
              ? 'text-pink-400 font-bold bg-pink-500/15 shadow-sm scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Moments Feed"
        >
          <ImageIcon className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] leading-tight">Moments</span>
        </button>

        {/* 5. Match (Quick Roulette) Tab */}
        <button
          id="global-nav-match"
          onClick={handleMatchClick}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all relative cursor-pointer active:scale-95 group ${
            isMatchOpen
              ? 'text-amber-300 font-bold bg-amber-500/15 shadow-sm ring-1 ring-amber-500/30 scale-105'
              : 'text-slate-400 hover:text-amber-300'
          }`}
          title="Instant Quick Match"
        >
          <div className="relative">
            <Zap className={`w-4 h-4 mb-0.5 transition-transform ${isMatchOpen ? 'text-amber-400 fill-amber-400/30 scale-110' : 'text-amber-400 group-hover:scale-110 fill-amber-400/20'}`} />
            <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          </div>
          <span className="text-[10px] leading-tight">Match</span>
        </button>

        {/* 6. Chat / Messages Tab */}
        <button
          id="global-nav-chat"
          onClick={handleChatClick}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all relative cursor-pointer active:scale-95 ${
            isChatOpen
              ? 'text-pink-300 font-bold bg-gradient-to-b from-pink-500/20 to-rose-500/20 ring-1 ring-pink-500/40 shadow-sm scale-105'
              : pendingFriendRequestsCount > 0
              ? 'bg-gradient-to-b from-pink-500/15 to-purple-500/15 text-pink-300 ring-1 ring-pink-500/40 shadow-sm'
              : unreadMessagesCount > 0
              ? 'text-pink-300 font-bold bg-pink-500/10'
              : 'text-slate-400 hover:text-pink-300'
          }`}
          title="Direct Chat & Inbox"
        >
          {/* Friend Request Floating Attention Tag */}
          {pendingFriendRequestsCount > 0 && !isChatOpen && (
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 via-rose-500 to-pink-500 text-white font-black text-[7.5px] uppercase tracking-tight shadow-lg whitespace-nowrap animate-bounce flex items-center space-x-0.5 border border-[#0F1117] z-20">
              <span className="text-[8px]">👥</span>
              <span>{pendingFriendRequestsCount} Req</span>
            </span>
          )}

          <div className="relative">
            <MessageCircle
              className={`w-4 h-4 mb-0.5 ${
                isChatOpen
                  ? 'text-pink-400 fill-pink-500/20'
                  : pendingFriendRequestsCount > 0 || unreadMessagesCount > 0
                  ? 'text-pink-400'
                  : 'text-slate-400'
              }`}
            />

            {/* Unread Chat Messages Counter */}
            {unreadMessagesCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 px-1 min-w-[15px] h-[15px] rounded-full bg-gradient-to-r from-pink-600 to-rose-600 text-white text-[9px] font-black flex items-center justify-center border border-[#0F1117] shadow-md animate-pulse">
                {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
              </span>
            )}

            {/* Pulse if only pending request */}
            {unreadMessagesCount === 0 && pendingFriendRequestsCount > 0 && !isChatOpen && (
              <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-amber-400 border border-[#12141a] animate-ping" />
            )}
          </div>
          <span className="text-[10px] leading-tight">Chat</span>
        </button>

        {/* 7. Call Logs Tab (Female & Admin) */}
        {(isFemale || isAdmin) && (
          <button
            id="global-nav-call-logs"
            onClick={() => handleTabClick('call_logs')}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'call_logs' && !isChatOpen && !isMatchOpen
                ? 'text-pink-400 font-bold bg-pink-500/15 shadow-sm scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Call Logs"
          >
            <PhoneCall className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] leading-tight">Logs</span>
          </button>
        )}

        {/* 8. Team Leader Dashboard Tab (Team Leader Only) */}
        {currentUser.role === 'team_leader' && (
          <button
            id="global-nav-team-leader"
            onClick={() => handleTabClick('team_leader')}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'team_leader' && !isChatOpen && !isMatchOpen
                ? 'text-amber-400 font-bold bg-amber-500/15 shadow-sm scale-105'
                : 'text-slate-400 hover:text-amber-300'
            }`}
            title="Agency Leader Hub"
          >
            <Crown className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] leading-tight">Agency</span>
          </button>
        )}

        {/* 9. Admin Dashboard Tab (Admin Only) */}
        {isAdmin && (
          <button
            id="global-nav-admin"
            onClick={() => handleTabClick('admin')}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'admin' && !isChatOpen && !isMatchOpen
                ? 'text-purple-400 font-bold bg-purple-500/15 shadow-sm scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Admin Console"
          >
            <Settings className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] leading-tight">Admin</span>
          </button>
        )}
      </div>
    </nav>
  );
};
