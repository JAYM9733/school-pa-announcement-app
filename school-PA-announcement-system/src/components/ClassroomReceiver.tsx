import React, { useState, useEffect } from 'react';
import {
  Tv,
  Wifi,
  WifiOff,
  Volume2,
  Lock,
  Clock,
  Calendar,
  Sparkles,
  ShieldCheck,
  Radio,
  Minimize2,
  Maximize2,
  Play,
  VolumeX,
  Bell,
  CheckCircle2,
  Expand,
  Shrink,
} from 'lucide-react';
import { Classroom, Announcement, WSMessage, BellScheduleConfig } from '../types';
import { wsClient } from '../utils/wsClient';
import { AnnouncementOverlay } from './AnnouncementOverlay';
import { AdminPinModal } from './AdminPinModal';
import { playAttentionChime, getAudioContext } from '../utils/audioSynth';
import { ThemeToggle } from './ThemeToggle';
import { PWAInstallButton } from './PWAInstallButton';

interface ClassroomReceiverProps {
  classroom: Classroom;
  onExitReceiverMode: () => void;
  onUpdateClassroom: (updated: Partial<Classroom>) => void;
}

export const ClassroomReceiver: React.FC<ClassroomReceiverProps> = ({
  classroom,
  onExitReceiverMode,
  onUpdateClassroom,
}) => {
  const [isConnected, setIsConnected] = useState(wsClient.isConnected);
  const [activeAnnouncement, setActiveAnnouncement] = useState<Announcement | null>(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isCompactDock, setIsCompactDock] = useState(false);
  const [lastAnnouncementTime, setLastAnnouncementTime] = useState<string>('None today');
  const [testingSpeaker, setTestingSpeaker] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [bellSchedule, setBellSchedule] = useState<BellScheduleConfig | null>(null);
  const [audioArmed, setAudioArmed] = useState<boolean>(() => {
    try {
      return getAudioContext().state === 'running';
    } catch {
      return false;
    }
  });

  // Screen Wake Lock API for IFB Smart Panels
  useEffect(() => {
    let wakeLock: any = null;
    const acquireLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch {
        // Handled silently
      }
    };
    acquireLock();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        acquireLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, []);

  // Fetch bell schedule
  useEffect(() => {
    fetch('/api/bell-schedule')
      .then((res) => res.json())
      .then((cfg) => {
        if (cfg?.items) setBellSchedule(cfg);
      })
      .catch((err) => console.warn('Fetch bell schedule err:', err));
  }, []);

  // Keep digital clock updated
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Arm Audio function (bypasses browser autoplay restrictions)
  const handleArmAudio = async () => {
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      setAudioArmed(true);
      await playAttentionChime((classroom.volume ?? 80) / 100);
    } catch (err) {
      console.warn('Could not arm audio context:', err);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Connect to WebSocket with classroom receiver registration
  useEffect(() => {
    const registerDevice = () => {
      wsClient.connect(undefined, {
        role: 'receiver',
        classroomId: classroom.id,
        deviceName: `IFB Panel - Room ${classroom.roomNumber}`,
        classroomData: classroom,
      });
    };

    registerDevice();

    // Fetch initial master lock configuration
    fetch('/api/transmitter-lock')
      .then((res) => res.json())
      .then((cfg) => {
        if (cfg?.lockPassword) {
          localStorage.setItem('pa_transmitter_lock_pin', cfg.lockPassword);
        }
      })
      .catch((err) => console.warn('Fetch lock config err on receiver:', err));

    const unsubscribe = wsClient.subscribe((msg: WSMessage) => {
      if (msg.type === 'init' || msg.type === 'heartbeat') {
        setIsConnected(wsClient.isConnected);
        if (msg.type === 'init') {
          if (msg.payload?.transmitterLockConfig?.lockPassword) {
            localStorage.setItem('pa_transmitter_lock_pin', msg.payload.transmitterLockConfig.lockPassword);
          }
          if (msg.payload?.bellScheduleConfig) {
            setBellSchedule(msg.payload.bellScheduleConfig);
          }
        }
      } else if (msg.type === 'transmitter_lock_sync') {
        if (msg.payload?.lockPassword) {
          localStorage.setItem('pa_transmitter_lock_pin', msg.payload.lockPassword);
        }
      } else if (msg.type === 'bell_schedule_sync') {
        if (msg.payload) {
          setBellSchedule(msg.payload);
        }
      } else if (msg.type === 'announcement_play') {
        const ann: Announcement = msg.payload;
        // Check if targeted to this room or all
        let isForUs = false;
        if (ann.targetType === 'all') {
          isForUs = true;
        } else if (ann.targetType === 'rooms' && ann.targetIds.includes(classroom.id)) {
          isForUs = true;
        } else if (ann.targetType === 'wings' && ann.targetIds.includes(classroom.wing)) {
          isForUs = true;
        }

        if (isForUs) {
          if (ann.emergencyType === 'all_clear') {
            setActiveAnnouncement(null);
            playAttentionChime((classroom.volume ?? 80) / 100);
            setLastAnnouncementTime(`All-Clear (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`);
          } else {
            setActiveAnnouncement(ann);
            setLastAnnouncementTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          }

          // Send ACK to server
          wsClient.send({
            type: 'announcement_ack',
            payload: {
              announcementId: ann.id,
              classroomId: classroom.id,
              status: 'playing',
            },
          });
        }
      } else if (msg.type === 'ping_test_received') {
        if (msg.payload?.classroomId === classroom.id) {
          playAttentionChime((classroom.volume ?? 80) / 100);
        }
      } else if (msg.type === 'volume_change') {
        if (msg.payload?.classroomId === classroom.id && msg.payload?.volume !== undefined) {
          onUpdateClassroom({ volume: msg.payload.volume });
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [classroom.id, classroom.wing, classroom.volume]);

  // Compute next scheduled bell
  const getNextBell = () => {
    if (!bellSchedule || !bellSchedule.enabled || !bellSchedule.items?.length) return null;
    const now = new Date();
    const day = now.getDay();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    const todayItems = bellSchedule.items
      .filter((b) => b.enabled && b.daysOfWeek.includes(day))
      .map((b) => {
        const [h, m] = b.time.split(':').map(Number);
        return { ...b, minutes: h * 60 + m };
      })
      .sort((a, b) => a.minutes - b.minutes);

    const upcoming = todayItems.find((b) => b.minutes > currentMins);
    return upcoming || null;
  };

  const nextBell = getNextBell();

  const handleTestSpeaker = async () => {
    setTestingSpeaker(true);
    try {
      await playAttentionChime((classroom.volume ?? 80) / 100);
    } finally {
      setTestingSpeaker(false);
    }
  };

  const handleAnnouncementFinished = () => {
    if (activeAnnouncement) {
      wsClient.send({
        type: 'announcement_ack',
        payload: {
          announcementId: activeAnnouncement.id,
          classroomId: classroom.id,
          status: 'finished',
        },
      });
    }
    setActiveAnnouncement(null);
  };

  // Compact Dock Mode: allows users to use the panel whiteboard/apps while PA runs in background
  if (isCompactDock) {
    return (
      <div id="classroom-receiver-compact" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
        {/* Floating Top Bar for Non-Interfering Background IFB Usage */}
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-400 flex items-center justify-center">
              <Tv className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">Room {classroom.roomNumber}</span>
                <span className="text-xs text-slate-400 font-medium">({classroom.name})</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {classroom.wing}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                PA Listener Active in Background • Normal Touchscreen Available
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Status Indicator */}
            <div className="flex items-center gap-1.5 text-xs">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-rose-500 animate-pulse'
                }`}
              />
              <span className={isConnected ? 'text-emerald-400' : 'text-rose-400'}>
                {isConnected ? 'Server Linked' : 'Reconnecting...'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>{classroom.volume}%</span>
            </div>

            <ThemeToggle showLabel={false} />

            <button
              id="expand-receiver-view-btn"
              onClick={() => setIsCompactDock(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center gap-1.5"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Display Mode
            </button>

            <button
              id="admin-unlock-btn"
              onClick={() => setIsPinModalOpen(true)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              title="Admin Unlock / Settings"
            >
              <Lock className="w-4 h-4 text-indigo-400" />
            </button>
          </div>
        </div>

        {/* Normal Panel Background / Whiteboard Placeholder */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
          <div className="max-w-md p-8 rounded-3xl bg-slate-900/40 border border-slate-800/80">
            <Tv className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-300">
              Interactive Panel Operational
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              The School PA listener runs continuously in the background without blocking teaching activities. Any broadcast from the Principal will instantly project audio and visual overlays here.
            </p>
          </div>
        </div>

        {/* Active Announcement Modal Overlay */}
        <AnnouncementOverlay
          announcement={activeAnnouncement}
          panelVolume={classroom.volume}
          onFinished={handleAnnouncementFinished}
        />

        <AdminPinModal
          isOpen={isPinModalOpen}
          onClose={() => setIsPinModalOpen(false)}
          onSuccess={() => {
            setIsPinModalOpen(false);
            onExitReceiverMode();
          }}
          title="Exit Receiver Mode"
          description="Enter the 4-digit installer PIN to unlock this classroom IFB panel and return to system setup."
        />
      </div>
    );
  }

  // Full IFB Classroom Ambient / Dashboard Mode
  return (
    <div
      id="classroom-receiver-fullscreen"
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative selection:bg-indigo-500"
    >
      {/* Top Receiver Status Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md px-3 sm:px-10 py-3 sm:py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 max-w-full">
        <div className="flex items-center justify-between sm:justify-start gap-2.5 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400 shrink-0">
              <Tv className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                  Room {classroom.roomNumber}
                </h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold whitespace-nowrap">
                  {classroom.wing}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 whitespace-nowrap">
                  {classroom.grade}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-none">{classroom.name}</p>
            </div>
          </div>
        </div>

        {/* Right Status Indicators */}
        <div className="flex flex-wrap items-center justify-start sm:justify-end gap-1.5 sm:gap-3">
          <PWAInstallButton />

          {/* Connection Status */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs shrink-0">
            {isConnected ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-rose-400 animate-pulse shrink-0" />
            )}
            <span className={isConnected ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
              {isConnected ? 'Linked' : 'Connecting...'}
            </span>
          </div>

          {/* Volume Control Indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 shrink-0">
            <Volume2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Vol: <strong className="text-white">{classroom.volume}%</strong></span>
          </div>

          {/* Fullscreen Kiosk Toggle */}
          <button
            id="toggle-fullscreen-btn"
            onClick={toggleFullscreen}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors shrink-0"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Kiosk Mode'}
          >
            {isFullscreen ? <Shrink className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
          </button>

          <ThemeToggle />

          {/* Minimize to dock */}
          <button
            id="minimize-receiver-dock-btn"
            onClick={() => setIsCompactDock(true)}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors shrink-0"
            title="Compact Background Dock"
          >
            <Minimize2 className="w-4 h-4" />
          </button>

          {/* Admin Lock Button */}
          <button
            id="admin-pin-lock-btn"
            onClick={() => setIsPinModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 border border-slate-800 hover:border-slate-700 transition-colors shrink-0"
            title="Enter Admin PIN to Exit or Change Settings"
          >
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden xs:inline sm:inline">Locked</span>
          </button>
        </div>
      </header>

      {/* Center Classroom Ambient View */}
      <main className="max-w-5xl mx-auto w-full px-6 py-8 flex-1 flex flex-col justify-center items-center text-center">
        {/* Audio Arming Banner for Browser Autoplay Policy */}
        {!audioArmed && (
          <button
            id="arm-ifb-audio-btn"
            onClick={handleArmAudio}
            className="mb-8 w-full max-w-2xl px-5 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:brightness-110 text-slate-950 font-bold text-sm sm:text-base flex items-center justify-between shadow-xl shadow-amber-500/20 active:scale-[0.99] transition-all animate-pulse"
          >
            <div className="flex items-center gap-3 text-left">
              <div className="p-2 rounded-xl bg-slate-950/20 text-slate-950">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <p className="font-extrabold leading-tight">Tap Anywhere to Arm IFB Smart Speaker</p>
                <p className="text-xs text-slate-900/80 font-medium">Unlocks browser audio for automated period bells, chimes & principal broadcasts</p>
              </div>
            </div>
            <span className="px-3.5 py-1.5 bg-slate-950 text-amber-300 rounded-xl text-xs font-black shrink-0 tracking-wide">
              Arm Audio
            </span>
          </button>
        )}

        {/* Large Digital Clock & Date Display */}
        <div className="mb-8">
          <div className="text-6xl sm:text-8xl font-extrabold tracking-tighter text-white font-mono drop-shadow-md">
            {currentTime.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </div>
          <div className="flex items-center justify-center gap-2 text-slate-400 mt-2 text-sm sm:text-base font-medium">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span>
              {currentTime.toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>

          {/* Next Period Bell Indicator */}
          {nextBell && (
            <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs sm:text-sm font-medium">
              <Bell className="w-3.5 h-3.5 text-indigo-400 animate-bounce" />
              <span>
                Next Scheduled Bell: <strong className="text-white font-semibold">{nextBell.name}</strong> at <strong className="text-amber-300 font-semibold">{nextBell.time}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Ambient Panel Card */}
        <div className="w-full max-w-2xl rounded-3xl bg-slate-900/60 border border-slate-800 p-6 sm:p-8 backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2 text-left">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Classroom IFB Panel Active</h3>
                <p className="text-xs text-slate-400">Listening on School LAN Channel</p>
              </div>
            </div>

            <button
              id="test-speaker-btn"
              onClick={handleTestSpeaker}
              disabled={testingSpeaker}
              className="px-4 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-xs font-semibold flex items-center gap-2 transition-all active:scale-95"
            >
              <Play className={`w-3.5 h-3.5 ${testingSpeaker ? 'animate-spin' : ''}`} />
              {testingSpeaker ? 'Testing...' : 'Test Speaker'}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 text-left">
            <div className="p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800/80">
              <span className="text-[11px] text-slate-500 block">Classroom</span>
              <strong className="text-sm text-slate-200">Room {classroom.roomNumber}</strong>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800/80">
              <span className="text-[11px] text-slate-500 block">Building Zone</span>
              <strong className="text-sm text-slate-200">{classroom.wing}</strong>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800/80">
              <span className="text-[11px] text-slate-500 block">Speaker Output</span>
              <strong className="text-sm text-indigo-300">{classroom.volume}%</strong>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800/80">
              <span className="text-[11px] text-slate-500 block">Last Broadcast</span>
              <strong className="text-sm text-slate-200">{lastAnnouncementTime}</strong>
            </div>
          </div>

          {/* Tamper Protection Notice */}
          <div className="mt-6 p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800/80 flex items-center justify-between text-xs text-slate-400 text-left">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Panel is tamper-protected. Users cannot exit receiver mode without administrator PIN.
              </span>
            </div>
            <button
              id="admin-settings-link"
              onClick={() => setIsPinModalOpen(true)}
              className="text-indigo-400 hover:text-indigo-300 font-semibold underline shrink-0 ml-2"
            >
              Admin Unlock
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 px-6 py-3 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>PA System Background Service v2.4 (Active)</span>
        </div>
        <div>
          <span>Hardware Model: {classroom.panelModel || 'Android IFB Panel'}</span>
        </div>
      </footer>

      {/* Active Announcement Modal Overlay */}
      <AnnouncementOverlay
        announcement={activeAnnouncement}
        panelVolume={classroom.volume}
        onFinished={handleAnnouncementFinished}
      />

      {/* Admin PIN Unlock Modal */}
      <AdminPinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={() => {
          setIsPinModalOpen(false);
          onExitReceiverMode();
        }}
        title="Exit Receiver Mode"
        description="Enter the 4-digit administrator PIN to unlock this classroom panel and return to the system setup screen."
      />
    </div>
  );
};
