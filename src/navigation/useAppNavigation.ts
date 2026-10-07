import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_TAB,
  isKnownAppPath,
  isSetupLocation,
  normalizePath,
  readTabFromLocation,
  tabToPath,
} from './appRoutes';

export const APP_NAV_STATE_KEY = '__mingleNav' as const;

export interface AppNavHistoryState {
  [APP_NAV_STATE_KEY]: true;
  tab: string;
  /** Depth within this SPA session (0 = entry / root). Used for exit fallback. */
  idx: number;
}

function isAppNavState(state: unknown): state is AppNavHistoryState {
  return (
    !!state &&
    typeof state === 'object' &&
    (state as AppNavHistoryState)[APP_NAV_STATE_KEY] === true &&
    typeof (state as AppNavHistoryState).tab === 'string'
  );
}

function getHistoryIdx(): number {
  const state = window.history.state;
  if (isAppNavState(state) && typeof state.idx === 'number' && state.idx >= 0) {
    return state.idx;
  }
  return 0;
}

function buildState(tab: string, idx: number): AppNavHistoryState {
  return { [APP_NAV_STATE_KEY]: true, tab, idx };
}

export interface NavigateOptions {
  /** Use replaceState instead of pushState (redirects, auth kickouts, same-tab URL sync). */
  replace?: boolean;
}

export interface UseAppNavigationResult {
  activeTab: string;
  /** Push a new history entry when the tab changes; no-op for same tab (prevents loops). */
  setActiveTab: (tab: string) => void;
  /** Replace the current history entry (auth redirects, setup exit). */
  replaceTab: (tab: string) => void;
  /**
   * Attempt to close the PWA/window. If the environment blocks close(),
   * fall back to the SPA root without trapping the user.
   */
  exitApp: () => void;
  /** True when Back would stay inside the SPA (idx > 0). */
  canGoBackInApp: boolean;
}

/**
 * Centralized SPA navigation + History API sync.
 *
 * - Meaningful URLs for each major tab
 * - Browser Back/Forward updates the screen without re-pushing
 * - Same-tab navigations do not create duplicate history entries
 * - Entry/root Back is left alone so the user can exit the PWA/browser tab
 */
export function useAppNavigation(): UseAppNavigationResult {
  const [activeTab, setActiveTabState] = useState<string>(() => readTabFromLocation());
  const [canGoBackInApp, setCanGoBackInApp] = useState(() => getHistoryIdx() > 0);

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  /** When true, URL/history already reflects the tab — do not push/replace again. */
  const applyingHistoryRef = useRef(false);

  const syncCanGoBack = useCallback(() => {
    setCanGoBackInApp(getHistoryIdx() > 0);
  }, []);

  const applyTabFromHistory = useCallback((tab: string) => {
    applyingHistoryRef.current = true;
    activeTabRef.current = tab;
    setActiveTabState(tab);
    syncCanGoBack();
    // Clear on next macrotask so React effects that call setActiveTab during the same
    // popstate turn do not accidentally push a duplicate entry.
    window.setTimeout(() => {
      applyingHistoryRef.current = false;
    }, 0);
  }, [syncCanGoBack]);

  // Stamp / normalize the initial history entry once (replace only — never push on mount).
  useEffect(() => {
    const tab = readTabFromLocation();
    const path = tabToPath(tab);
    const currentPath = normalizePath(window.location.pathname);
    const targetPath = normalizePath(path);

    const existing = window.history.state;
    const idx = isAppNavState(existing) && typeof existing.idx === 'number' ? existing.idx : 0;
    const state = buildState(tab, idx);

    // Unknown deep paths → canonical home URL without adding a history entry.
    if (!isKnownAppPath(currentPath) && !isSetupLocation() && currentPath !== '/') {
      window.history.replaceState(state, '', path);
    } else if (currentPath !== targetPath) {
      window.history.replaceState(state, '', path);
    } else if (!isAppNavState(existing) || existing.tab !== tab) {
      window.history.replaceState(state, '', `${path}${window.location.search}${window.location.hash}`);
    }

    if (tab !== activeTabRef.current) {
      applyTabFromHistory(tab);
    } else {
      syncCanGoBack();
    }
  }, [applyTabFromHistory, syncCanGoBack]);

  // Sync screen ← browser Back/Forward
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      let tab: string;
      if (isAppNavState(event.state)) {
        tab = event.state.tab;
      } else if (isSetupLocation()) {
        tab = 'server_setup';
      } else {
        tab = readTabFromLocation();
      }
      applyTabFromHistory(tab);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [applyTabFromHistory]);

  const navigateTo = useCallback(
    (tab: string, options?: NavigateOptions) => {
      const next = tab || DEFAULT_TAB;

      if (applyingHistoryRef.current) {
        return;
      }

      const path = tabToPath(next);
      const currentPath = normalizePath(window.location.pathname);
      const targetPath = normalizePath(path);
      const sameTab = next === activeTabRef.current;
      const sameUrl = currentPath === targetPath;

      // Same screen + same URL: ignore (re-renders, repeated taps, effect noise, redirect no-ops).
      if (sameTab && sameUrl) {
        return;
      }

      // Same tab but URL out of sync (rare): repair with replace, never push.
      if (sameTab && !sameUrl) {
        window.history.replaceState(buildState(next, getHistoryIdx()), '', path);
        syncCanGoBack();
        return;
      }

      const replace = options?.replace === true;
      const idx = replace ? getHistoryIdx() : getHistoryIdx() + 1;
      const state = buildState(next, idx);

      if (replace) {
        window.history.replaceState(state, '', path);
      } else {
        window.history.pushState(state, '', path);
      }

      activeTabRef.current = next;
      setActiveTabState(next);
      syncCanGoBack();
    },
    [syncCanGoBack]
  );

  const setActiveTab = useCallback(
    (tab: string) => {
      navigateTo(tab, { replace: false });
    },
    [navigateTo]
  );

  const replaceTab = useCallback(
    (tab: string) => {
      navigateTo(tab, { replace: true });
    },
    [navigateTo]
  );

  const exitApp = useCallback(() => {
    // Prefer native close when the browser/PWA allows it (standalone / script-opened).
    try {
      window.close();
    } catch {
      // ignore — many browsers block window.close()
    }

    const finalizeRoot = () => {
      const state = buildState(DEFAULT_TAB, 0);
      window.history.replaceState(state, '', tabToPath(DEFAULT_TAB));
      activeTabRef.current = DEFAULT_TAB;
      setActiveTabState(DEFAULT_TAB);
      setCanGoBackInApp(false);
    };

    // If close() is ignored, unwind SPA history to the entry then land on root.
    window.setTimeout(() => {
      if (document.hidden || (window as Window & { closed?: boolean }).closed) {
        return;
      }
      const idx = getHistoryIdx();
      if (idx > 0) {
        const onPop = () => {
          window.removeEventListener('popstate', onPop);
          finalizeRoot();
        };
        window.addEventListener('popstate', onPop);
        window.history.go(-idx);
        // Safety: if go() does not fire (edge cases), still reset.
        window.setTimeout(() => {
          window.removeEventListener('popstate', onPop);
          if (activeTabRef.current !== DEFAULT_TAB || normalizePath(window.location.pathname) !== '/') {
            finalizeRoot();
          }
        }, 300);
      } else {
        finalizeRoot();
      }
    }, 150);
  }, []);

  return {
    activeTab,
    setActiveTab,
    replaceTab,
    exitApp,
    canGoBackInApp,
  };
}
