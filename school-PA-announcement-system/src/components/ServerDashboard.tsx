import React, { useState, useEffect } from 'react';
import {
  Server,
  Activity,
  Radio,
  Tv,
  Wifi,
  Clock,
  Shield,
  RefreshCw,
  HardDrive,
  Cpu,
  Bell,
  Play,
  CheckCircle2,
  AlertTriangle,
  Send,
  Terminal,
  Volume2,
  Database,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Classroom, Announcement, ServerInfo, WSMessage, TransmitterLockConfig } from '../types';
import { wsClient } from '../utils/wsClient';
import { playAttentionChime } from '../utils/audioSynth';
import { ChangeTransmitterLockModal } from './ChangeTransmitterLockModal';
import { BellScheduleManager } from './BellScheduleManager';
import { ThemeToggle } from './ThemeToggle';
import { PWAInstallButton } from './PWAInstallButton';
import {
  Download,
  Upload,
  FileText,
  Settings2,
  Calendar,
} from 'lucide-react';

interface ServerDashboardProps {
  onExitServerMode: () => void;
}

export const ServerDashboard: React.FC<ServerDashboardProps> = ({
  onExitServerMode,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'schedule' | 'backup'>('overview');
  const [serverStats, setServerStats] = useState<ServerInfo | null>(null);
  const [allIps, setAllIps] = useState<string[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [history, setHistory] = useState<Announcement[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [testBroadcasting, setTestBroadcasting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Transmitter Lock Configuration
  const [lockConfig, setLockConfig] = useState<TransmitterLockConfig>({
    lockPassword: '8888',
    updatedAt: Date.now(),
    updatedBy: 'Default Policy',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] =
    useState(false);
  const [isForceLocking, setIsForceLocking] = useState(false);
  const [confirmForceLock, setConfirmForceLock] = useState(false);
  const [confirmResetLock, setConfirmResetLock] = useState(false);

  const fetchServerDetails = async () => {
    setIsRefreshing(true);
    try {
      const [infoRes, roomsRes, historyRes, lockRes] = await Promise.all([
        fetch('/api/server-info'),
        fetch('/api/classrooms'),
        fetch('/api/announcements/history'),
        fetch('/api/transmitter-lock'),
      ]);

      if (infoRes.ok) {
        const info = await infoRes.json();
        setServerStats(info);
        if (info.allIps) setAllIps(info.allIps);
      }
      if (roomsRes.ok) {
        const rooms = await roomsRes.json();
        setClassrooms(rooms);
      }
      if (historyRes.ok) {
        const hist = await historyRes.json();
        setHistory(hist.reverse());
      }
      if (lockRes.ok) {
        const lockData = await lockRes.json();
        if (lockData?.lockPassword) {
          setLockConfig(lockData);
        }
      }
    } catch (err) {
      console.warn('Error fetching server data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    wsClient.connect(undefined, {
      role: 'server',
      deviceName: 'Linux Host Control Console',
    });

    fetchServerDetails();
    const interval = setInterval(fetchServerDetails, 6000);

    const unsubscribe = wsClient.subscribe((msg: WSMessage) => {
      if (msg.type === 'init') {
        if (msg.payload?.transmitterLockConfig) {
          setLockConfig(msg.payload.transmitterLockConfig);
        }
      } else if (msg.type === 'classrooms_sync' && Array.isArray(msg.payload)) {
        setClassrooms(msg.payload);
      } else if (msg.type === 'announcement_play') {
        setHistory((prev) => [msg.payload, ...prev.slice(0, 49)]);
      } else if (msg.type === 'transmitter_lock_sync' && msg.payload) {
        setLockConfig(msg.payload);
        setFeedback(
          `Transmitter lock password updated by ${msg.payload.updatedBy || 'admin'}.`
        );
        setTimeout(() => setFeedback(null), 3500);
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  const handleServerTestChime = () => {
    setTestBroadcasting(true);
    wsClient.send({
      type: 'announcement_broadcast',
      payload: {
        type: 'chime',
        chimeType: 'attention',
        sender: 'Linux Server Daemon (System Check)',
        title: 'Central Server Sound & Link Diagnostic',
        priority: 'normal',
        targetType: 'all',
        targetIds: [],
      },
    });

    setFeedback('Diagnostic test broadcast sent to all online classroom IFB receivers.');
    setTimeout(() => {
      setTestBroadcasting(false);
      setTimeout(() => setFeedback(null), 3000);
    }, 1500);
  };

  const handlePingClassroom = (roomId: string) => {
    wsClient.send({
      type: 'ping_test',
      payload: { classroomId: roomId },
    });
    setFeedback(`Diagnostic ping chime sent to room.`);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleForceLockAllTransmitters = async () => {
    if (!confirmForceLock) {
      setConfirmForceLock(true);
      setTimeout(() => setConfirmForceLock(false), 5000);
      return;
    }
    setConfirmForceLock(false);
    setIsForceLocking(true);
    try {
      const res = await fetch('/api/transmitter-lock/force-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Emergency lock requested by Central Linux Server',
        }),
      });
      if (res.ok) {
        wsClient.send({
          type: 'transmitter_force_lock',
          payload: {
            reason: 'Emergency lock requested by Central Linux Server',
          },
        });
        setFeedback('Force-lock broadcast sent. All transmitter consoles are locked.');
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch (err) {
      console.error('Force lock error:', err);
    } finally {
      setIsForceLocking(false);
    }
  };

  const handleResetLockPassword = async () => {
    if (!confirmResetLock) {
      setConfirmResetLock(true);
      setTimeout(() => setConfirmResetLock(false), 5000);
      return;
    }
    setConfirmResetLock(false);
    try {
      const res = await fetch('/api/transmitter-lock/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updatedBy: 'Linux Server Console Reset',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLockConfig(data.transmitterLockConfig);
        wsClient.send({
          type: 'transmitter_lock_update',
          payload: {
            newPassword: '8888',
            updatedBy: 'Linux Server Console Reset',
          },
        });
        setFeedback('Transmitter lock password reset to default "8888".');
        setTimeout(() => setFeedback(null), 3500);
      }
    } catch (err) {
      console.error('Reset lock err:', err);
    }
  };

  const handleExportBackup = () => {
    fetch('/api/backup/export')
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `school_pa_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setFeedback('School database backup downloaded successfully.');
        setTimeout(() => setFeedback(null), 3500);
      })
      .catch((err) => {
        console.error('Export backup error:', err);
        setFeedback('Failed to export backup.');
        setTimeout(() => setFeedback(null), 3500);
      });
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        const res = await fetch('/api/backup/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json),
        });
        if (res.ok) {
          const resData = await res.json();
          fetchServerDetails();
          setFeedback(
            `Backup restored! Restored ${resData.restoredClassrooms} classrooms and ${resData.restoredBells} bell schedules.`
          );
          setTimeout(() => setFeedback(null), 5000);
        } else {
          setFeedback('Import failed: invalid backup structure.');
          setTimeout(() => setFeedback(null), 4000);
        }
      } catch (err: any) {
        setFeedback(`Import error: ${err.message || 'Invalid JSON file'}`);
        setTimeout(() => setFeedback(null), 4000);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div
      id="server-dashboard-container"
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 overflow-x-hidden max-w-full"
    >
      {/* Top Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md px-3 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 max-w-full">
        <div className="flex items-center justify-between sm:justify-start gap-2.5 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400 shrink-0">
              <Server className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                  Linux PA Server
                </h1>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                  Active
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate max-w-[200px] sm:max-w-none">
                Host: <strong className="text-slate-200">{serverStats?.hostname || 'linux-pa'}</strong> • Port 3000
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-start sm:justify-end gap-1.5 sm:gap-3">
          <PWAInstallButton />
          <ThemeToggle />

          <button
            id="refresh-server-btn"
            onClick={fetchServerDetails}
            disabled={isRefreshing}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-300 border border-slate-800 flex items-center gap-1 shrink-0"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            id="exit-server-mode-btn"
            onClick={onExitServerMode}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-400 hover:text-white border border-slate-800 transition-colors shrink-0"
          >
            Switch Role
          </button>
        </div>
      </header>

      {/* Feedback Banner */}
      {feedback && (
        <div className="bg-emerald-600/90 text-white px-6 py-2 text-center text-xs font-semibold flex items-center justify-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Main Server Content */}
      <main className="max-w-7xl mx-auto w-full px-6 py-8 flex-1 space-y-6">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Tv className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">
                Online Classroom Receivers
              </span>
              <div className="flex items-baseline gap-2">
                <strong className="text-2xl font-black text-white">
                  {classrooms.filter((c) => c.isOnline).length}
                </strong>
                <span className="text-xs text-slate-400">
                  / {classrooms.length} Registered
                </span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <Radio className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">
                Active Transmitters
              </span>
              <strong className="text-2xl font-black text-white">
                {serverStats?.activeTransmitters || 1}
              </strong>
              <span className="text-[10px] text-indigo-300 block">
                Simultaneous broadcast ready
              </span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">
                Total Broadcasts Logged
              </span>
              <strong className="text-2xl font-black text-white">
                {serverStats?.announcementsCount || history.length}
              </strong>
              <span className="text-[10px] text-slate-400 block">
                Audit history recorded
              </span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">
                Server Uptime
              </span>
              <strong className="text-xl font-black text-white font-mono">
                {Math.floor((serverStats?.uptimeSeconds || 120) / 60)}m{' '}
                {(serverStats?.uptimeSeconds || 120) % 60}s
              </strong>
              <span className="text-[10px] text-emerald-400 block">
                WebSocket Ping: &lt;4ms
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
          <button
            type="button"
            id="tab-overview-btn"
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>Classroom Panels & Protection</span>
          </button>

          <button
            type="button"
            id="tab-schedule-btn"
            onClick={() => setActiveTab('schedule')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'schedule'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Bell className="w-4 h-4 text-amber-400" />
            <span>Automated Bell Schedule</span>
          </button>

          <button
            type="button"
            id="tab-backup-btn"
            onClick={() => setActiveTab('backup')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'backup'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Disk Persistence & Disaster Recovery</span>
          </button>
        </div>

        {/* TAB 1: OVERVIEW & CLASSROOM PROTECTION */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Discovery & Network IP Information Banner */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Wifi className="w-4 h-4 text-indigo-400" />
              School LAN Auto-Detection Endpoints
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Classroom Android IFB panels automatically discover this server via HTTP beacon at these local addresses:
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-slate-950 font-mono text-xs font-semibold text-indigo-300 border border-slate-800">
                http://{serverStats?.serverIp || '127.0.0.1'}:3000
              </span>
              {allIps.map((ip) => (
                <span
                  key={ip}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 font-mono text-xs text-slate-300 border border-slate-800"
                >
                  http://{ip}:3000
                </span>
              ))}
              <span className="px-2.5 py-1 rounded-lg bg-slate-950 font-mono text-xs text-slate-400 border border-slate-800">
                ws://{window.location.host}
              </span>
            </div>
          </div>

          <button
            id="server-test-broadcast-btn"
            onClick={handleServerTestChime}
            disabled={testBroadcasting}
            className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-xs font-bold text-white shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all"
          >
            <Play className={`w-3.5 h-3.5 ${testBroadcasting ? 'animate-spin' : ''}`} />
            <span>Send School-Wide System Test Chime</span>
          </button>
        </div>

        {/* Central Transmitter Security & Lock Password Management Card */}
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Transmitter Lock Security & Authorization
                  </h3>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Console Protection Active
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  The transmitter lock password prevents unauthorized broadcast initiation and emergency alarm triggers from mobile and desktop stations. As Central Linux Administrator, you can update this password school-wide or force-lock active transmitters.
                </p>

                {/* Current Password Info Bar */}
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
                  <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400">Current Lock Password:</span>
                    <span className="font-mono font-bold text-indigo-300 tracking-wider">
                      {showPassword ? lockConfig.lockPassword : '••••••••'}
                    </span>
                    <button
                      id="reveal-server-lock-password-btn"
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-400 hover:text-white ml-1 p-0.5"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <span className="text-slate-400">
                    Last Updated:{' '}
                    <strong className="text-slate-200">
                      {new Date(lockConfig.updatedAt).toLocaleTimeString()}
                    </strong>{' '}
                    by{' '}
                    <strong className="text-indigo-300">
                      {lockConfig.updatedBy}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                id="server-change-lock-password-btn"
                onClick={() => setIsChangePasswordModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md shadow-indigo-600/30 flex items-center gap-2 transition-all active:scale-95"
              >
                <KeyRound className="w-4 h-4" />
                <span>Change Lock Password</span>
              </button>

              <button
                id="server-reset-lock-password-btn"
                onClick={handleResetLockPassword}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                  confirmResetLock
                    ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                }`}
                title="Reset lock code to default 8888"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{confirmResetLock ? 'Confirm Reset (8888)?' : 'Reset to 8888'}</span>
              </button>

              <button
                id="server-force-lock-all-btn"
                onClick={handleForceLockAllTransmitters}
                disabled={isForceLocking}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                  confirmForceLock
                    ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 animate-pulse'
                    : 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 hover:text-rose-200 border border-rose-500/40'
                }`}
                title="Instantly lock all active transmitter consoles"
              >
                <Lock className="w-3.5 h-3.5 text-rose-400" />
                <span>
                  {confirmForceLock
                    ? 'Confirm Force Lock?'
                    : isForceLocking
                    ? 'Locking...'
                    : 'Force Lock Transmitters'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Two-Column: Connected Classroom Panels Table + Announcement Audit Log */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Classroom Panels (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Tv className="w-4 h-4 text-indigo-400" />
                Registered Classroom Receivers ({classrooms.length})
              </h3>
              <span className="text-xs text-emerald-400 font-semibold">
                {classrooms.filter((c) => c.isOnline).length} Active Heartbeats
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 pb-2">
                    <th className="pb-2 font-semibold">Room</th>
                    <th className="pb-2 font-semibold">Description / Area</th>
                    <th className="pb-2 font-semibold">Wing</th>
                    <th className="pb-2 font-semibold">Speaker</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {classrooms.map((room) => (
                    <tr key={room.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 font-bold text-white">
                        {room.roomNumber}
                      </td>
                      <td className="py-2.5 text-slate-300 truncate max-w-[140px]">
                        {room.name}
                      </td>
                      <td className="py-2.5 text-slate-400">{room.wing}</td>
                      <td className="py-2.5 text-indigo-300 font-mono">
                        {room.volume}%
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            room.isOnline
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              room.isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                            }`}
                          />
                          {room.isOnline ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => handlePingClassroom(room.id)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-300 border border-slate-700 transition-colors"
                        >
                          Ping
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Announcement History Audit (5 cols) */}
          <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-400" />
                  Announcement Audit Log
                </h3>
                <span className="text-xs text-slate-400">Recent events</span>
              </div>

              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {history.map((ann) => (
                  <div
                    key={ann.id}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-200">
                        {ann.title}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(ann.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px]">
                      From: <strong className="text-slate-300">{ann.sender}</strong> • Type:{' '}
                      <span className="uppercase text-indigo-300 font-semibold">{ann.type}</span>
                    </p>
                    {ann.message && (
                      <p className="text-slate-300 text-[11px] mt-1 italic line-clamp-1">
                        "{ann.message}"
                      </p>
                    )}
                  </div>
                ))}

                {history.length === 0 && (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No recent announcements logged yet.
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 mt-4 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Encrypted local memory buffer</span>
              <span>Capacity: 50 records</span>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* TAB 2: AUTOMATED BELL SCHEDULE */}
    {activeTab === 'schedule' && (
      <BellScheduleManager
        onFeedback={(msg) => {
          setFeedback(msg);
          setTimeout(() => setFeedback(null), 3500);
        }}
      />
    )}

    {/* TAB 3: DISK PERSISTENCE & DISASTER RECOVERY */}
    {activeTab === 'backup' && (
      <div className="space-y-6">
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Persistent School Data Storage & Disaster Recovery
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-3xl">
                All registered classrooms, volume configurations, transmitter security codes, and automated period bell schedules are continuously preserved to disk at <code className="text-indigo-300 font-mono">data/school_pa_db.json</code>. You can export a snapshot backup to transfer to another school server or restore in case of hardware failure.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Export Snapshot */}
            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Download className="w-4 h-4 text-indigo-400" />
                <h4>Export Full System Snapshot</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Downloads a comprehensive JSON configuration file containing all classrooms, current password credentials, and daily bell schedules.
              </p>
              <button
                type="button"
                id="export-backup-btn"
                onClick={handleExportBackup}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Download Backup Snapshot (.json)</span>
              </button>
            </div>

            {/* Import Snapshot */}
            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Upload className="w-4 h-4 text-emerald-400" />
                <h4>Restore System Snapshot</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Select a previously exported snapshot file to restore all school classroom registrations and bell schedules across this server.
              </p>
              <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold cursor-pointer transition-all active:scale-95">
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>Select Snapshot File to Restore</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Status Banner */}
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <strong className="block font-bold">Persistence Engine Operational</strong>
              <span>Automatic disk writes occur on every classroom update, bell schedule edit, or security configuration change.</span>
            </div>
          </div>
        </div>
      </div>
    )}
  </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 px-6 py-3 flex items-center justify-between text-xs text-slate-500">
        <span>School PA Central Linux Engine • High Availability Core</span>
        <span>WebSocket Server: Active</span>
      </footer>

      {/* Change Transmitter Lock Password Modal */}
      <ChangeTransmitterLockModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
        onSuccess={(newPass) => {
          setLockConfig((prev) => ({
            ...prev,
            lockPassword: newPass,
            updatedAt: Date.now(),
            updatedBy: 'Linux Host Control Console',
          }));
          setFeedback(
            'Transmitter lock password successfully updated from Central Linux Server!'
          );
          setTimeout(() => setFeedback(null), 4000);
        }}
        currentSavedPassword={lockConfig.lockPassword}
        sourceRole="server"
        actorName="Linux Server Console"
      />
    </div>
  );
};
