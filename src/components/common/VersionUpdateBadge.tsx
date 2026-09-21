import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface VersionResponse {
  version: string;
  buildTimestamp: number;
  serverBootTime?: number;
  commit?: string;
  environment?: string;
}

export function VersionUpdateBadge() {
  const [currentVersion, setCurrentVersion] = useState<string>('v1.5.0');
  const [initialBuildTimestamp, setInitialBuildTimestamp] = useState<number | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const initialTimestampRef = useRef<number | null>(null);

  const checkVersion = useCallback(async () => {
    try {
      setIsChecking(true);
      // Cache-busting timestamp query parameter
      const res = await fetch(`/api/version?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data: VersionResponse = await res.json();
        const serverVersion = data.version ? (data.version.startsWith('v') ? data.version : `v${data.version}`) : 'v1.5.0';
        const serverTimestamp = data.serverBootTime || data.buildTimestamp;

        if (initialTimestampRef.current === null) {
          initialTimestampRef.current = serverTimestamp;
          setInitialBuildTimestamp(serverTimestamp);
          setCurrentVersion(serverVersion);
        } else if (serverTimestamp > initialTimestampRef.current) {
          // Newer build or server restart detected
          setUpdateAvailable(true);
          setCurrentVersion(serverVersion);
        }
      }
      setLastChecked(new Date());
    } catch (err) {
      console.warn('[VersionMonitor] Failed to poll /api/version:', err);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    // Initial check
    checkVersion();

    // Polls every 60 seconds
    const interval = setInterval(() => {
      checkVersion();
    }, 60000);

    // Poll on window focus
    const handleFocus = () => {
      checkVersion();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkVersion]);

  // Handle reload on update click
  const handleReload = () => {
    // Clean cache-busting reload
    const url = new URL(window.location.href);
    url.searchParams.set('_v_reload', Date.now().toString());
    window.location.href = url.toString();
  };

  if (updateAvailable) {
    return (
      <button
        onClick={handleReload}
        className="relative flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-xs bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20 transition-all cursor-pointer animate-pulse hover:animate-none"
        title="A new server version was detected. Click to perform a clean reload."
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
        </span>
        <Sparkles className="w-3.5 h-3.5 text-yellow-200" />
        <span>Update Available — Click to Reload</span>
      </button>
    );
  }

  // State 1: Latest - Greyed out and subtle
  return (
    <div
      onClick={() => checkVersion()}
      className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-neutral-400 hover:text-neutral-600 bg-neutral-100 hover:bg-neutral-200/70 rounded-md transition-colors cursor-pointer select-none"
      title={`Current build is active. Click to verify. Last checked: ${lastChecked.toLocaleTimeString()}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 inline-block"></span>
      <span className="font-mono font-medium">{currentVersion} Up to date</span>
      {isChecking && <RefreshCw className="w-2.5 h-2.5 animate-spin text-neutral-400 ml-0.5" />}
    </div>
  );
}
