import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { DevPersonaBar } from './components/dev/DevPersonaBar';
import { DiscoveryGrid } from './components/discovery/DiscoveryGrid';
import { SwipeMatchDeck } from './components/discovery/SwipeMatchDeck';
import { ProfileDetailModal } from './components/discovery/ProfileDetailModal';
import { MomentsFeed } from './components/social/MomentsFeed';
import { QuickMatchRoulette } from './components/discovery/QuickMatchRoulette';
import { FemaleEarningsDashboard } from './components/earnings/FemaleEarningsDashboard';
import { FemaleCallLogsView } from './components/earnings/FemaleCallLogsView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { TeamLeaderDashboard } from './components/teamleader/TeamLeaderDashboard';
import { UserProfilePage } from './components/profile/UserProfilePage';
import { HomePage } from './components/home/HomePage';
import { PolicyDetailModal } from './components/home/PolicyDetailModal';
import { VideoCallStudio } from './components/videocall/VideoCallStudio';
import { PostCallRatingModal } from './components/videocall/PostCallRatingModal';
import { CoinStoreModal } from './components/store/CoinStoreModal';
import { AuthModal } from './components/auth/AuthModal';
import { VipModal } from './components/vip/VipModal';
import { DailyRewardsModal } from './components/rewards/DailyRewardsModal';
import { ChatDrawer } from './components/chat/ChatDrawer';
import { FriendsFavoritesDrawer } from './components/social/FriendsFavoritesDrawer';
import { GlobalBottomNav } from './components/navigation/GlobalBottomNav';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard';
import { ServerSetupWizard } from './components/setup/ServerSetupWizard';
import { UserProfile } from './types';
import { CheckCircle2, AlertTriangle, Info, AlertCircle, X } from 'lucide-react';
import { ErrorBoundary } from './components/common/ErrorBoundary';



const MainApp: React.FC = () => {
  const {
    activeCall,
    startCall,
    toast,
    hideToast,
    users,
    currentUser,
    updateUserProfile,
    isLoggedIn,
    pendingRatingCall,
    setPendingRatingCall,
    isDailyRewardsModalOpen,
    closeDailyRewardsModal,
  } = useApp();

  const [activeTab, setActiveTab] = useState<string>('home');
  const [currentUtcTime, setCurrentUtcTime] = useState<string>(() =>
    new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentUtcTime(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC');
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // URL route detection for /server-setup or #server-setup
  const [isSetupRoute, setIsSetupRoute] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return (
        window.location.pathname.includes('server-setup') ||
        window.location.hash.includes('server-setup') ||
        window.location.pathname.includes('installer') ||
        window.location.hash.includes('setup')
      );
    }
    return false;
  });

  useEffect(() => {
    const handleHashChange = () => {
      if (
        window.location.pathname.includes('server-setup') ||
        window.location.hash.includes('server-setup') ||
        window.location.pathname.includes('installer') ||
        window.location.hash.includes('setup')
      ) {
        setIsSetupRoute(true);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  // Automatically kick out from admin/team_leader tab if permissions do not match
  useEffect(() => {
    if (activeTab === 'admin' && (!isLoggedIn || currentUser.role !== 'admin')) {
      setActiveTab('home');
    }
    if (activeTab === 'team_leader' && (!isLoggedIn || (currentUser.role !== 'team_leader' && currentUser.role !== 'admin'))) {
      setActiveTab('home');
    }
  }, [activeTab, isLoggedIn, currentUser.role]);

  // Dedicated full-screen Server Setup Wizard when accessing /server-setup
  if (isSetupRoute || activeTab === 'server_setup') {
    return (
      <ServerSetupWizard
        onExit={() => {
          setIsSetupRoute(false);
          window.location.hash = '';
          setActiveTab('home');
        }}
        onComplete={() => {
          setIsSetupRoute(false);
          window.location.hash = '';
          setActiveTab('home');
        }}
      />
    );
  }
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isVipOpen, setIsVipOpen] = useState(false);
  const [isSocialCircleOpen, setIsSocialCircleOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMatchOpen, setIsMatchOpen] = useState(false);
  const [chatUserId, setChatUserId] = useState<string | null>(null);
  const [selectedDeckUser, setSelectedDeckUser] = useState<UserProfile | null>(null);

  const handleOpenAuth = (mode: 'login' | 'register' = 'register') => {
    setAuthInitialMode(mode);
    setIsAuthOpen(true);
  };

  const handleOpenChat = (targetUserId?: string) => {
    setIsChatOpen(true);
    setChatUserId(targetUserId || null);
  };

  const handleCloseOverlays = () => {
    setIsChatOpen(false);
    setChatUserId(null);
    setIsMatchOpen(false);
    setIsSocialCircleOpen(false);
    setIsStoreOpen(false);
    setIsVipOpen(false);
    setIsAuthOpen(false);
    setSelectedDeckUser(null);
  };

  return (
    <div className="min-h-screen bg-[#0F1115] text-slate-300 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Dev Persona Switcher Bar (Temporary Dev Toolbar, Toggleable from Admin) */}
      <DevPersonaBar onOpenAuth={() => handleOpenAuth('register')} />

      {/* App Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenStore={() => setIsStoreOpen(true)}
        onOpenAuth={(mode) => handleOpenAuth(mode || 'register')}
        onOpenVip={() => setIsVipOpen(true)}
        onOpenSocialCircle={() => setIsSocialCircleOpen(true)}
        onOpenChat={(id) => handleOpenChat(id)}
        onOpenMatch={() => setIsMatchOpen(true)}
      />

      {/* Main View Content */}
      <main className={`flex-1 ${isLoggedIn ? 'pb-20 md:pb-10' : 'pb-6'}`}>
        {activeTab === 'home' && (
          <HomePage
            onStartCall={(id) => startCall(id)}
            onOpenChat={(id) => handleOpenChat(id)}
            onOpenMatch={() => setIsMatchOpen(true)}
            onOpenStore={() => setIsStoreOpen(true)}
            onOpenVip={() => setIsVipOpen(true)}
            onOpenAuth={(mode) => handleOpenAuth(mode || 'register')}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'discovery' && (
          <DiscoveryGrid
            onStartCall={(id) => startCall(id)}
            onOpenChat={(id) => setChatUserId(id)}
            onOpenMatch={() => setIsMatchOpen(true)}
            onNavigateToSwipe={() => setActiveTab('swipe')}
          />
        )}

        {activeTab === 'swipe' && (
          <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
            <SwipeMatchDeck onOpenDetailModal={(user) => setSelectedDeckUser(user)} />
            <ProfileDetailModal
              user={selectedDeckUser}
              onClose={() => setSelectedDeckUser(null)}
              onStartCall={(id) => startCall(id)}
              onOpenChat={(id) => handleOpenChat(id)}
            />
          </div>
        )}

        {activeTab === 'moments' && (
          <MomentsFeed
            onStartCall={(id) => startCall(id)}
            onOpenChat={(id) => setChatUserId(id)}
            onOpenStore={() => setIsStoreOpen(true)}
          />
        )}

        {activeTab === 'earnings' && (
          <FemaleEarningsDashboard
            onOpenStore={() => setIsStoreOpen(true)}
            onOpenVip={() => setIsVipOpen(true)}
            onStartCall={(id) => startCall(id)}
            onOpenChat={(id) => setChatUserId(id)}
            onOpenCallLogs={() => setActiveTab('call_logs')}
          />
        )}

        {activeTab === 'call_logs' && (
          <FemaleCallLogsView
            onOpenChat={(id) => setChatUserId(id)}
            onStartCall={(id) => startCall(id)}
          />
        )}

        {activeTab === 'profile' && (
          <UserProfilePage
            onOpenStore={() => setIsStoreOpen(true)}
            onOpenVip={() => setIsVipOpen(true)}
            onOpenChat={(id) => handleOpenChat(id)}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'team_leader' && isLoggedIn && (currentUser.role === 'team_leader' || currentUser.role === 'admin') && (
          <TeamLeaderDashboard
            onStartCall={(id) => startCall(id)}
            onOpenChat={(id) => handleOpenChat(id)}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'admin' && isLoggedIn && currentUser.role === 'admin' && <AdminDashboard />}
      </main>

      {/* High Density Terminal System Footer */}
      <footer className="h-8 bg-[#161920] border-t border-slate-800 px-4 sm:px-8 flex items-center justify-between text-[10px] text-slate-500 font-mono">
        <div className="flex gap-4 items-center">
          <span className="text-slate-500">SYSTEM: <span className="text-slate-300">LIVE-NODE</span></span>
          <span className="hidden sm:inline text-slate-500">WEBRTC: <span className="text-emerald-400 font-bold">READY</span></span>
          <span className="hidden md:inline text-slate-500">REGISTRY: <span className="text-indigo-400">{users.length} PROFILES</span></span>
        </div>
        <div className="flex gap-4 items-center">
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            REAL-TIME ECONOMY SYNCED
          </span>
          <span className="hidden sm:inline text-slate-400">{currentUtcTime}</span>
        </div>
      </footer>

      {/* Global Active Call Studio */}
      {activeCall && <VideoCallStudio onOpenStore={() => setIsStoreOpen(true)} />}

      {/* Global Modals */}
      <CoinStoreModal isOpen={isStoreOpen} onClose={() => setIsStoreOpen(false)} />
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialMode={authInitialMode}
        onNavigateToTab={(tab) => setActiveTab(tab)}
      />
      {isOnboardingOpen && currentUser && (
        <OnboardingWizard
          user={currentUser}
          onComplete={(updated) => {
            updateUserProfile(updated.id, updated);
            setIsOnboardingOpen(false);
          }}
          onCancel={() => setIsOnboardingOpen(false)}
        />
      )}
      <VipModal isOpen={isVipOpen} onClose={() => setIsVipOpen(false)} />
      <DailyRewardsModal
        isOpen={isDailyRewardsModalOpen}
        onClose={closeDailyRewardsModal}
        onNavigateTab={(tab) => setActiveTab(tab)}
      />
      <QuickMatchRoulette
        isOpen={isMatchOpen}
        onClose={() => setIsMatchOpen(false)}
        onOpenChat={(id) => handleOpenChat(id)}
      />
      <FriendsFavoritesDrawer
        isOpen={isSocialCircleOpen}
        onClose={() => setIsSocialCircleOpen(false)}
        onStartCall={(id) => startCall(id)}
        onOpenChat={(id) => setChatUserId(id)}
      />
      <ChatDrawer
        isOpen={isChatOpen || chatUserId !== null}
        userId={chatUserId}
        onClose={() => {
          setIsChatOpen(false);
          setChatUserId(null);
        }}
        onStartCall={(id) => startCall(id)}
      />
      <PolicyDetailModal onNavigateToTab={(tab) => setActiveTab(tab)} />
      {pendingRatingCall && (
        <PostCallRatingModal
          creatorId={pendingRatingCall.creatorId}
          creatorName={pendingRatingCall.creatorName}
          creatorAvatar={pendingRatingCall.creatorAvatar}
          callLogId={pendingRatingCall.callLogId}
          durationSeconds={pendingRatingCall.durationSeconds}
          onClose={() => setPendingRatingCall(null)}
        />
      )}

      {/* Global Bottom Sticky Navigation Bar - Persists across all modals and screens in signed-in state */}
      {isLoggedIn && (
        <GlobalBottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenMatch={() => setIsMatchOpen(true)}
          onOpenChat={(id) => handleOpenChat(id)}
          isChatOpen={isChatOpen || chatUserId !== null}
          isMatchOpen={isMatchOpen}
          onCloseOverlays={handleCloseOverlays}
        />
      )}

      {/* PWA Install Banner Prompt */}
      <PWAInstallPrompt />

      {/* Toast Notification Banner - Positioned directly below top header for clear visibility in mobile & desktop */}
      {toast && (
        <div
          id="global-toast-alert"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-1.25rem)] max-w-md pointer-events-none transition-all animate-in slide-in-from-top-3 fade-in duration-200"
        >
          <div
            className={`p-3.5 sm:p-4 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-start space-x-3 text-xs pointer-events-auto overflow-hidden relative ${
              toast.type === 'success'
                ? 'bg-[#0b1b14]/95 border-emerald-500/70 text-emerald-100 shadow-emerald-950/50'
                : toast.type === 'error'
                ? 'bg-[#220d13]/95 border-rose-500/70 text-rose-100 shadow-rose-950/50'
                : toast.type === 'warning'
                ? 'bg-[#231808]/95 border-amber-500/70 text-amber-100 shadow-amber-950/50'
                : 'bg-[#101420]/95 border-sky-500/70 text-sky-100 shadow-sky-950/50'
            }`}
          >
            {/* Type Indicator Icon */}
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' ? (
                <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                </div>
              ) : toast.type === 'error' ? (
                <div className="w-7 h-7 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                  <AlertCircle className="w-4 h-4 stroke-[2.5]" />
                </div>
              ) : toast.type === 'warning' ? (
                <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
                  <Info className="w-4 h-4 stroke-[2.5]" />
                </div>
              )}
            </div>

            {/* Alert Message Content */}
            <div className="flex-1 min-w-0 pr-1 space-y-0.5">
              <h4 className="font-extrabold text-xs sm:text-sm text-white tracking-tight flex items-center space-x-1.5">
                <span>{toast.title}</span>
              </h4>
              <p className="leading-snug text-[11px] sm:text-xs opacity-90 break-words">{toast.message}</p>
            </div>

            {/* Quick Dismiss Button */}
            <button
              onClick={hideToast}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
              title="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainApp />
      </AppProvider>
    </ErrorBoundary>
  );
}
