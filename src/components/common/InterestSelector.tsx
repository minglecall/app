import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Heart,
  Sparkles,
  Flame,
  Music,
  Palette,
  Gamepad2,
  Coffee,
  HeartPulse,
  Users,
  Search,
  Check,
  Plus,
  X,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { InterestItem, InterestCategory } from '../../types';
import {
  ALL_INTERESTS,
  INTEREST_CATEGORIES,
  getAllowedInterests,
  findInterestByIdOrName,
} from '../../utils/taxonomies';
import { useApp } from '../../context/AppContext';

interface InterestSelectorProps {
  selectedInterests: string[]; // e.g. ['Travel & Adventure', 'Gaming & Esports'] or ids
  onChange: (interests: string[]) => void;
  allowedInterests?: string[];
  maxSelectable?: number;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

// Category Icon Mapper
export const getCategoryIcon = (category: InterestCategory, className = 'w-3.5 h-3.5') => {
  switch (category) {
    case 'lifestyle':
      return <Sparkles className={className} />;
    case 'sports':
      return <Flame className={className} />;
    case 'music':
      return <Music className={className} />;
    case 'art':
      return <Palette className={className} />;
    case 'tech':
      return <Gamepad2 className={className} />;
    case 'food':
      return <Coffee className={className} />;
    case 'wellness':
      return <HeartPulse className={className} />;
    case 'social':
      return <Users className={className} />;
    default:
      return <Heart className={className} />;
  }
};

export const InterestSelector: React.FC<InterestSelectorProps> = ({
  selectedInterests = [],
  onChange,
  allowedInterests,
  maxSelectable = 15,
  label = 'Interests & Passions',
  placeholder = 'Add interests (e.g., Travel, Gaming, Music)...',
  className = '',
  disabled = false,
}) => {
  const { systemSettings } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const containerRef = useRef<HTMLDivElement>(null);

  // Available interests derived from system settings
  const activeAllowed = allowedInterests || systemSettings.allowedInterests;
  const availableInterests = useMemo(() => {
    return getAllowedInterests(activeAllowed);
  }, [activeAllowed]);

  // Selected names normalized
  const selectedNormalized = useMemo(() => {
    return new Set(
      selectedInterests.map((itemStr) => {
        const found = findInterestByIdOrName(itemStr);
        return found ? found.name : itemStr;
      })
    );
  }, [selectedInterests]);

  // Filtered interests
  const filteredInterests = useMemo(() => {
    return availableInterests.filter((item) => {
      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesCat = item.category.toLowerCase().includes(q);
        return matchesName || matchesCat;
      }
      return true;
    });
  }, [availableInterests, selectedCategory, searchQuery]);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const toggleInterest = (itemName: string) => {
    const exists = selectedNormalized.has(itemName);
    if (exists) {
      const next = selectedInterests.filter((i) => {
        const found = findInterestByIdOrName(i);
        const name = found ? found.name : i;
        return name !== itemName;
      });
      onChange(next);
    } else {
      if (selectedInterests.length >= maxSelectable) return;
      onChange([...selectedInterests, itemName]);
    }
  };

  const removeInterest = (itemName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = selectedInterests.filter((i) => {
      const found = findInterestByIdOrName(i);
      const name = found ? found.name : i;
      return name !== itemName;
    });
    onChange(next);
  };

  return (
    <div className={`space-y-2 ${className}`} ref={containerRef}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>{label}</span>
          </label>
          <span className="text-[10px] font-mono text-slate-400">
            {selectedInterests.length} / {maxSelectable} selected
          </span>
        </div>
      )}

      {/* Selected Chips Box / Dropdown Opener */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`min-h-[48px] p-2 bg-slate-950 border rounded-xl sm:rounded-2xl flex flex-wrap items-center gap-1.5 transition-all cursor-pointer select-none relative ${
          isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-slate-900 shadow-lg'
            : 'border-slate-800 hover:border-slate-700'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {selectedInterests.length === 0 ? (
          <span className="text-xs text-slate-500 px-1">{placeholder}</span>
        ) : (
          selectedInterests.map((itemStr) => {
            const itemObj = findInterestByIdOrName(itemStr);
            const displayName = itemObj ? itemObj.name : itemStr;
            const category = itemObj ? itemObj.category : 'lifestyle';

            return (
              <span
                key={displayName}
                className="inline-flex items-center space-x-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-indigo-950/70 border border-indigo-500/30 text-indigo-300 text-xs font-semibold shadow-sm animate-in fade-in zoom-in-95 duration-100"
              >
                <span className="text-indigo-400">{getCategoryIcon(category, 'w-3 h-3')}</span>
                <span>{displayName}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => removeInterest(displayName, e)}
                    className="p-0.5 hover:bg-indigo-500/30 text-indigo-300 hover:text-white rounded-md transition-colors ml-0.5"
                    title={`Remove ${displayName}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            );
          })
        )}

        <div className="ml-auto pl-1 flex items-center space-x-1 shrink-0 text-slate-400">
          <Plus className="w-4 h-4 hover:text-indigo-400 transition-colors" />
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-400' : ''}`} />
        </div>
      </div>

      {/* Interactive Categorized Drawer */}
      {isOpen && (
        <div className="relative z-50">
          <div className="absolute left-0 right-0 top-1 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-80">
            {/* Search & Action Bar */}
            <div className="p-2.5 border-b border-slate-800 bg-slate-950/90 sticky top-0 z-10 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search interests & passions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-8 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-medium"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shrink-0 transition-colors"
                >
                  Done ({selectedInterests.length})
                </button>
              </div>

              {/* Category Pills Slider */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5 scrollbar-none text-[11px] font-medium select-none">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-2.5 py-1 rounded-lg shrink-0 transition-colors flex items-center space-x-1 ${
                    selectedCategory === 'all'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>All Categories</span>
                </button>

                {INTEREST_CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setSelectedCategory(cat.key)}
                    className={`px-2.5 py-1 rounded-lg shrink-0 transition-colors flex items-center space-x-1 ${
                      selectedCategory === cat.key
                        ? 'bg-indigo-600 text-white font-bold shadow'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    <span>{getCategoryIcon(cat.key, 'w-3 h-3')}</span>
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Categorized Interests Grid */}
            <div className="overflow-y-auto p-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 max-h-56">
              {filteredInterests.length === 0 ? (
                <div className="col-span-full py-8 text-center text-xs text-slate-500 font-mono">
                  No active interests found in this category.
                </div>
              ) : (
                filteredInterests.map((interest) => {
                  const isSelected = selectedNormalized.has(interest.name);
                  return (
                    <button
                      key={interest.id}
                      type="button"
                      onClick={() => toggleInterest(interest.name)}
                      className={`p-2 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer select-none ${
                        isSelected
                          ? 'bg-indigo-600/25 text-indigo-200 border border-indigo-500/40 shadow-sm'
                          : 'bg-slate-950/50 hover:bg-slate-800 border border-slate-800/60 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2 min-w-0 pr-1">
                        <span className={`p-1 rounded-md shrink-0 ${
                          isSelected ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-900 text-slate-400'
                        }`}>
                          {getCategoryIcon(interest.category, 'w-3 h-3')}
                        </span>
                        <span className={`text-xs font-bold truncate ${isSelected ? 'text-indigo-300' : 'text-white'}`}>
                          {interest.name}
                        </span>
                      </div>

                      <div className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border transition-all ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'border-slate-700 bg-slate-900'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
