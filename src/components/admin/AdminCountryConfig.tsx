import React, { useState, useMemo } from 'react';
import {
  Globe,
  Search,
  CheckSquare,
  Square,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Filter,
  RefreshCw,
  Save,
} from 'lucide-react';
import { ALL_WORLDWIDE_COUNTRIES, CountryItem } from '../../utils/countries';
import { useApp } from '../../context/AppContext';

export const AdminCountryConfig: React.FC = () => {
  const { systemSettings, updateSystemSettings, showToast } = useApp();

  // Allowed country codes from system settings (default to all if not set or empty)
  const initialSelectedCodes = useMemo(() => {
    if (systemSettings.allowedCountryCodes && systemSettings.allowedCountryCodes.length > 0) {
      return new Set(systemSettings.allowedCountryCodes.map((c) => c.toUpperCase()));
    }
    // Default: all countries enabled
    return new Set(ALL_WORLDWIDE_COUNTRIES.map((c) => c.code.toUpperCase()));
  }, [systemSettings.allowedCountryCodes]);

  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(initialSelectedCodes);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Available regions for filter
  const regions = useMemo(() => {
    const set = new Set<string>();
    ALL_WORLDWIDE_COUNTRIES.forEach((c) => set.add(c.region));
    return ['all', 'Tier 1 Only', ...Array.from(set)];
  }, []);

  // Filtered countries
  const filteredCountries = useMemo(() => {
    return ALL_WORLDWIDE_COUNTRIES.filter((country) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        country.code.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (selectedRegion === 'all') return true;
      if (selectedRegion === 'Tier 1 Only') return country.isTier1;
      return country.region === selectedRegion;
    });
  }, [searchQuery, selectedRegion]);

  const toggleCountry = (code: string) => {
    const next = new Set(selectedCodes);
    const upper = code.toUpperCase();
    if (next.has(upper)) {
      next.delete(upper);
    } else {
      next.add(upper);
    }
    setSelectedCodes(next);
    setHasUnsavedChanges(true);
  };

  const handleSelectAll = () => {
    const next = new Set(ALL_WORLDWIDE_COUNTRIES.map((c) => c.code.toUpperCase()));
    setSelectedCodes(next);
    setHasUnsavedChanges(true);
    showToast('All Countries Selected', `Enabled all ${ALL_WORLDWIDE_COUNTRIES.length} worldwide countries for user registration.`, 'info');
  };

  const handleDeselectAll = () => {
    setSelectedCodes(new Set());
    setHasUnsavedChanges(true);
    showToast('All Countries Deselected', 'Please select at least 1 country to allow user registrations.', 'warning');
  };

  const handleSelectTier1Only = () => {
    const next = new Set(
      ALL_WORLDWIDE_COUNTRIES.filter((c) => c.isTier1).map((c) => c.code.toUpperCase())
    );
    setSelectedCodes(next);
    setHasUnsavedChanges(true);
    showToast('Tier 1 Countries Enabled', `Enabled ${next.size} high-GDP Tier 1 countries.`, 'info');
  };

  const handleSelectRegionOnly = (region: string) => {
    const next = new Set(
      ALL_WORLDWIDE_COUNTRIES.filter((c) => c.region === region).map((c) => c.code.toUpperCase())
    );
    setSelectedCodes(next);
    setHasUnsavedChanges(true);
    showToast(`${region} Countries Selected`, `Selected all countries in ${region}.`, 'info');
  };

  const handleSaveCountryConfig = () => {
    const codeList = Array.from(selectedCodes);
    updateSystemSettings({
      allowedCountryCodes: codeList,
    });
    setHasUnsavedChanges(false);
    showToast(
      'Country List Updated 🌍',
      `Saved ${codeList.length} enabled countries to registration dropdown & system database.`,
      'success'
    );
  };

  const percentAllowed = Math.round((selectedCodes.size / ALL_WORLDWIDE_COUNTRIES.length) * 100);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Stats */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Globe className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-black text-white tracking-wide">
                Worldwide Countries & Geolocation Control
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              Manage which countries appear in the user registration and onboarding dropdown list.
              Admin can enable, disable, select all, or curate high-value regions. Changes take effect
              live across registration forms and user profiles.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              id="admin-save-countries-btn"
              type="button"
              onClick={handleSaveCountryConfig}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 shadow-lg transition-all cursor-pointer ${
                hasUnsavedChanges
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/30 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{hasUnsavedChanges ? 'Save Active Countries *' : 'Save Country Settings'}</span>
            </button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Worldwide DB</div>
            <div className="text-lg font-black text-white mt-0.5">{ALL_WORLDWIDE_COUNTRIES.length} Countries</div>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active In Registration</div>
            <div className="text-lg font-black text-emerald-400 mt-0.5">
              {selectedCodes.size} Enabled ({percentAllowed}%)
            </div>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tier 1 Target Hubs</div>
            <div className="text-lg font-black text-amber-400 mt-0.5">
              {ALL_WORLDWIDE_COUNTRIES.filter((c) => c.isTier1).length} High-GDP
            </div>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sync Status</div>
            <div className="text-sm font-bold text-indigo-400 mt-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Synced with Onboarding</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Toolbar & Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Quick Batch Actions */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={handleSelectAll}
            className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Select All ({ALL_WORLDWIDE_COUNTRIES.length})</span>
          </button>
          <button
            type="button"
            onClick={handleDeselectAll}
            className="px-3 py-1.5 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Square className="w-3.5 h-3.5" />
            <span>Deselect All</span>
          </button>
          <button
            type="button"
            onClick={handleSelectTier1Only}
            className="px-3 py-1.5 rounded-lg bg-amber-600/15 hover:bg-amber-600/25 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Tier 1 Only</span>
          </button>
        </div>

        {/* Search & Region Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search country or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="relative shrink-0">
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {regions.map((reg) => (
                <option key={reg} value={reg}>
                  {reg === 'all' ? 'All Regions' : reg}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Countries Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div className="text-xs font-bold text-slate-400">
            Showing {filteredCountries.length} countries{' '}
            {selectedRegion !== 'all' && `(${selectedRegion})`}
          </div>
          <div className="text-xs font-mono text-indigo-400">
            Selected: {selectedCodes.size} / {ALL_WORLDWIDE_COUNTRIES.length}
          </div>
        </div>

        {filteredCountries.length === 0 ? (
          <div className="py-12 text-center text-slate-500 space-y-2">
            <Globe className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-xs">No countries match your search filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[600px] overflow-y-auto pr-1">
            {filteredCountries.map((country) => {
              const isSelected = selectedCodes.has(country.code.toUpperCase());
              return (
                <div
                  key={country.code}
                  onClick={() => toggleCountry(country.code)}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer select-none ${
                    isSelected
                      ? 'bg-slate-800/90 border-indigo-500/50 shadow-sm'
                      : 'bg-slate-950/40 border-slate-800/60 opacity-60 hover:opacity-100 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 overflow-hidden">
                    <span className="text-xl shrink-0">{country.flag}</span>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-bold text-white truncate">{country.name}</span>
                        {country.isTier1 && (
                          <span className="px-1 py-0.2 text-[9px] bg-amber-500/20 text-amber-300 rounded font-mono shrink-0">
                            T1
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {country.code} • {country.region}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 ml-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleCountry(country.code)}
                      className="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
