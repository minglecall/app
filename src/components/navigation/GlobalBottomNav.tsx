import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Home as HomeIcon,
  Compass,
  Flame,
  MessageCircle,
  User,
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

  const isFemale =
    currentUser.gender === 'female' ||
    currentUser.role === 'female_creator' ||
    currentUser.role === 'female_host';
  const isAdmin = currentUser.role === 'admin';
  const isLeader = currentUser.role === 'team_leader';

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

  const item = (active: boolean) =>
    `flex flex-col items-center justify-center min-w-[3.25rem] px-2 py-1 rounded-full transition-all cursor-pointer ${
      active ? 'text-brand' : 'text-app-muted hover:text-app-heading'
    }`;

  const glow = (active: boolean) =>
    active ? 'drop-shadow-[0_0_8px_rgba(255,51,102,0.55)]' : '';

  return (
    <nav
      id="global-bottom-navigation-bar"
      className="md:hidden fixed bottom-0 left-0 right-0 z-[9000] pointer-events-none pb-[max(0.75rem,env(safe-area-inset-bottom))] px-4"
    >
      <div className="pointer-events-auto mx-auto max-w-md flex items-center justify-center gap-1.5">
        <div className="flex items-center justify-around gap-0.5 px-2 py-1.5 rounded-full bg-chrome backdrop-blur-xl border border-hairline shadow-app-lg">
          <button
            id="global-nav-home"
            onClick={() => handleTabClick('home')}
            className={item(activeTab === 'home' && !isChatOpen && !isMatchOpen)}
            title="Home"
          >
            <HomeIcon className={`w-5 h-5 mb-0.5 ${glow(activeTab === 'home' && !isChatOpen && !isMatchOpen)} ${activeTab === 'home' && !isChatOpen && !isMatchOpen ? 'fill-brand/20' : ''}`} />
            <span className="text-[9px] font-medium leading-none">Home</span>
          </button>

          <button
            id="global-nav-discovery"
            onClick={() => handleTabClick('discovery')}
            className={item((activeTab === 'discovery' || activeTab === 'swipe') && !isChatOpen && !isMatchOpen)}
            title="Discover"
          >
            <Compass className={`w-5 h-5 mb-0.5 ${glow((activeTab === 'discovery' || activeTab === 'swipe') && !isChatOpen && !isMatchOpen)}`} />
            <span className="text-[9px] font-medium leading-none">Discover</span>
          </button>

          <button
            id="global-nav-match"
            onClick={handleMatchClick}
            className={item(isMatchOpen)}
            title="Match"
          >
            <Flame className={`w-5 h-5 mb-0.5 ${glow(isMatchOpen)} ${isMatchOpen ? 'fill-brand/25' : ''}`} />
            <span className="text-[9px] font-medium leading-none">Match</span>
          </button>

          <button
            id="global-nav-chat"
            onClick={handleChatClick}
            className={`${item(isChatOpen || unreadMessagesCount > 0)} relative`}
            title="Chat"
          >
            <div className="relative">
              <MessageCircle className={`w-5 h-5 mb-0.5 ${glow(isChatOpen)} ${isChatOpen ? 'fill-brand/20' : ''}`} />
              {unreadMessagesCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 px-1 min-w-[14px] h-[14px] rounded-full bg-brand text-white text-[8px] font-bold flex items-center justify-center border-2 border-[var(--app-bg)]">
                  {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                </span>
              )}
              {unreadMessagesCount === 0 && pendingFriendRequestsCount > 0 && !isChatOpen && (
                <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-amber-400 border-2 border-[var(--app-bg)]" />
              )}
            </div>
            <span className="text-[9px] font-medium leading-none">Chat</span>
          </button>

          <button
            id="global-nav-profile"
            onClick={() => handleTabClick('profile')}
            className={item(activeTab === 'profile' && !isChatOpen && !isMatchOpen)}
            title="Profile"
          >
            <User className={`w-5 h-5 mb-0.5 ${glow(activeTab === 'profile' && !isChatOpen && !isMatchOpen)}`} />
            <span className="text-[9px] font-medium leading-none">Profile</span>
          </button>
        </div>

        {(isFemale || isAdmin || isLeader) && (
          <div className="flex items-center gap-0.5 px-1.5 py-1.5 rounded-full bg-chrome backdrop-blur-xl border border-hairline shadow-app">
            {(isFemale || isAdmin) && (
              <button
                id="global-nav-call-logs"
                onClick={() => handleTabClick('call_logs')}
                className={item(activeTab === 'call_logs' && !isChatOpen && !isMatchOpen)}
                title="Call Logs"
              >
                <PhoneCall className="w-4.5 h-4.5 mb-0.5" />
                <span className="text-[8px] font-medium leading-none">Logs</span>
              </button>
            )}
            {isLeader && (
              <button
                id="global-nav-team-leader"
                onClick={() => handleTabClick('team_leader')}
                className={item(activeTab === 'team_leader' && !isChatOpen && !isMatchOpen)}
                title="Agency"
              >
                <Crown className="w-4.5 h-4.5 mb-0.5" />
                <span className="text-[8px] font-medium leading-none">Agency</span>
              </button>
            )}
            {isAdmin && (
              <button
                id="global-nav-admin"
                onClick={() => handleTabClick('admin')}
                className={item(activeTab === 'admin' && !isChatOpen && !isMatchOpen)}
                title="Admin"
              >
                <Settings className="w-4.5 h-4.5 mb-0.5" />
                <span className="text-[8px] font-medium leading-none">Admin</span>
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};
