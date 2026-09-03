import React from 'react';
import { useApp } from '../../context/AppContext';
import { Users, EyeOff, Plus, Shield, Sparkles, Check } from 'lucide-react';
import { getCountryFlag } from '../../utils/flags';

interface DevPersonaBarProps {
  onOpenAuth?: () => void;
}

export const DevPersonaBar: React.FC<DevPersonaBarProps> = ({ onOpenAuth }) => {
  const { users, currentUser, isLoggedIn, switchUser, systemSettings, updateSystemSettings, showToast } = useApp();

  // Strictly enforce: Only admin users who are successfully logged in can see the Dev / Admin bar
  const isAdmin = isLoggedIn && (currentUser.role === 'admin' || (currentUser as any).isAdmin === true);
  if (!isAdmin || systemSettings.showDevPersonaBar === false) {
    return null;
  }

  const handleHideBar = () => {
    updateSystemSettings({ showDevPersonaBar: false });
    showToast(
      'Dev Bar Hidden',
      'Persona switcher bar is hidden. You can re-enable it anytime in Admin Dashboard → Config.',
      'info'
    );
  };

  return (
    <aside
      id="dev-persona-switcher-bar"
      aria-label="Development Persona Switcher"
      className="bg-[#0B0D13] border-b border-indigo-500/30 text-slate-200 px-2 sm:px-4 py-1.5 z-50 text-xs shadow-lg"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4 min-w-0">
        {/* Left Label */}
        <div className="flex items-center space-x-2 shrink-0">
          <div className="flex items-center space-x-1.5 bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
            <Users className="w-3 h-3 text-indigo-400" />
            <span className="hidden sm:inline">Dev Switcher</span>
            <span className="sm:hidden">Dev</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
            Quick Persona:
          </span>
        </div>

        {/* Scrollable Personas List */}
        <div className="flex items-center space-x-1.5 overflow-x-auto py-0.5 custom-scrollbar min-w-0 flex-1">
          {users.map((u) => {
            const isSelected = u.id === currentUser.id;
            const isFemale = u.gender === 'female' || u.role === 'female_creator' || u.role === 'female_host';
            const isAdmin = u.role === 'admin';
            const isTeamLeader = u.role === 'team_leader';

            return (
              <button
                key={u.id}
                id={`dev-persona-btn-${u.id}`}
                onClick={() => switchUser(u.id)}
                className={`flex items-center space-x-1.5 px-2 py-1 rounded-lg text-xs transition-all shrink-0 border cursor-pointer ${
                  isSelected
                    ? isTeamLeader
                      ? 'bg-gradient-to-r from-amber-950/90 to-yellow-950/90 border-amber-400 text-amber-100 font-bold ring-1 ring-amber-400/60 shadow-md'
                      : isFemale
                      ? 'bg-gradient-to-r from-pink-950/80 to-rose-950/80 border-pink-500 text-white font-bold ring-1 ring-pink-500/50 shadow-md'
                      : isAdmin
                      ? 'bg-gradient-to-r from-purple-950/80 to-indigo-950/80 border-purple-500 text-white font-bold ring-1 ring-purple-500/50 shadow-md'
                      : 'bg-gradient-to-r from-indigo-950/80 to-blue-950/80 border-indigo-500 text-white font-bold ring-1 ring-indigo-500/50 shadow-md'
                    : isTeamLeader
                    ? 'bg-amber-950/30 hover:bg-amber-900/50 border-amber-800/40 text-amber-200'
                    : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'
                }`}
                title={`Switch to ${u.name} (${u.role})`}
              >
                {/* Avatar with status indicator */}
                <div className="relative shrink-0">
                  <img
                    src={u.avatarUrl}
                    alt={u.name}
                    className="w-5 h-5 rounded-full object-cover ring-1 ring-slate-700"
                  />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-slate-950 ${
                      u.onlineStatus === 'online'
                        ? 'bg-emerald-400'
                        : u.onlineStatus === 'busy' || u.onlineStatus === 'in_call'
                        ? 'bg-amber-400'
                        : 'bg-rose-500'
                    }`}
                  />
                </div>

                {/* Name & Gender Icon */}
                <div className="flex items-center space-x-1 min-w-0">
                  <span className="truncate max-w-[80px] sm:max-w-[100px] text-[11px]">
                    {u.name.split(' ')[0]}
                  </span>
                  <span className="text-[10px] shrink-0">
                    {isAdmin ? '🛡️' : isTeamLeader ? '👑' : isFemale ? '👩' : '👨'}
                  </span>
                </div>

                {/* Flag & Role Tag */}
                <span className="text-[10px] shrink-0" title={u.nationality}>
                  {getCountryFlag(u.countryCode, u.nationality)}
                </span>

                {/* Active Pill */}
                {isSelected && (
                  <span className="hidden sm:inline-flex items-center px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-mono font-bold">
                    <Check className="w-2.5 h-2.5 mr-0.5" />
                    active
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Controls */}
        <div className="flex items-center space-x-1.5 shrink-0">
          {/* Hide bar button */}
          <button
            id="dev-bar-hide-btn"
            onClick={handleHideBar}
            className="p-1 px-1.5 bg-slate-900/80 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-700/50 rounded-md text-[10px] flex items-center space-x-1 transition-all"
            title="Hide Dev Bar (Can be re-enabled in Admin Dashboard → Config)"
          >
            <EyeOff className="w-3 h-3" />
            <span className="hidden sm:inline">Hide</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
