import React, { useState, useEffect } from 'react';
import {
  Radio,
  Tv,
  Server,
  Wifi,
  Volume2,
  CheckCircle2,
  Shield,
  ArrowRight,
  RefreshCw,
  Sparkles,
  School,
  Sliders,
  Play,
  Check,
} from 'lucide-react';
import { Classroom, DeviceRole } from '../types';
import { playAttentionChime } from '../utils/audioSynth';
import { ThemeToggle } from './ThemeToggle';
import { PWAInstallButton } from './PWAInstallButton';

interface SetupPageProps {
  onConfigureRole: (
    role: DeviceRole,
    details?: {
      classroom?: Partial<Classroom>;
      serverHost?: string;
      transmitterName?: string;
    }
  ) => void;
  initialServerHost?: string;
}

export const SetupPage: React.FC<SetupPageProps> = ({
  onConfigureRole,
  initialServerHost,
}) => {
  const [selectedRole, setSelectedRole] = useState<DeviceRole>('receiver');
  const [serverHost, setServerHost] = useState(
    initialServerHost || window.location.host
  );
  const [isDetectingServer, setIsDetectingServer] = useState(false);
  const [serverDetected, setServerDetected] = useState(true);
  const [detectedServerIp, setDetectedServerIp] = useState<string>('');

  // Classroom Receiver Form Fields
  const [roomNumber, setRoomNumber] = useState('104');
  const [roomName, setRoomName] = useState('Grade 4 Classroom');
  const [grade, setGrade] = useState('Grade 4');
  const [wing, setWing] = useState('North Wing');
  const [panelModel, setPanelModel] = useState('Android IFB 75" Touch Panel');
  const [panelVolume, setPanelVolume] = useState(85);
  const [isPlayingTestAudio, setIsPlayingTestAudio] = useState(false);

  // Transmitter Form Fields
  const [transmitterName, setTransmitterName] = useState('Principal Miller (Mobile)');

  // Auto-detect server on mount
  useEffect(() => {
    detectServer();
  }, []);

  const detectServer = async () => {
    setIsDetectingServer(true);
    try {
      const res = await fetch('/api/server-info');
      if (res.ok) {
        const data = await res.json();
        setServerDetected(true);
        setDetectedServerIp(data.serverIp || window.location.hostname);
        if (!initialServerHost) {
          setServerHost(window.location.host);
        }
      } else {
        setServerDetected(false);
      }
    } catch {
      setServerDetected(false);
    } finally {
      setIsDetectingServer(false);
    }
  };

  const handleTestSpeaker = async () => {
    setIsPlayingTestAudio(true);
    try {
      await playAttentionChime(panelVolume / 100);
    } finally {
      setIsPlayingTestAudio(false);
    }
  };

  const handleCompleteSetup = () => {
    if (selectedRole === 'receiver') {
      const classroomData: Partial<Classroom> = {
        id: `room-${roomNumber.toLowerCase().replace(/\s+/g, '-')}`,
        roomNumber: roomNumber.trim(),
        name: roomName.trim() || `Classroom ${roomNumber}`,
        grade,
        wing,
        volume: panelVolume,
        panelModel,
        isOnline: true,
      };

      onConfigureRole('receiver', {
        classroom: classroomData,
        serverHost,
      });
    } else if (selectedRole === 'principal') {
      onConfigureRole('principal', {
        transmitterName: transmitterName.trim(),
        serverHost,
      });
    } else if (selectedRole === 'server') {
      onConfigureRole('server', {
        serverHost,
      });
    }
  };

  return (
    <div
      id="setup-page-container"
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white overflow-x-hidden max-w-full"
    >
      {/* Top Brand Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-3 sm:px-6 py-3 sm:py-4 max-w-full">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
              <School className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white truncate">
                  School PA System
                </h1>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 whitespace-nowrap">
                  Setup
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate max-w-[240px] sm:max-w-none">
                School-wide public address, bells &amp; emergency alerts
              </p>
            </div>
          </div>

          {/* Right Header Controls: Theme Toggle, Install Button & Server Detection */}
          <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2">
            <PWAInstallButton />
            <ThemeToggle />

            {/* Server Auto-Detection Pill */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-slate-800/70 border border-slate-700/60 text-xs shrink-0 max-w-full">
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${
                  serverDetected
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                    : 'bg-amber-400 animate-pulse'
                }`}
              />
              <span className="text-slate-300 font-medium truncate max-w-[170px] xs:max-w-[220px] sm:max-w-none">
                {isDetectingServer
                  ? 'Probing Server...'
                  : serverDetected
                  ? `Server: ${detectedServerIp || window.location.host}`
                  : 'Server Discovery Active'}
              </span>
              <button
                id="refresh-server-detection-btn"
                onClick={detectServer}
                disabled={isDetectingServer}
                className="p-1 text-slate-400 hover:text-white transition-colors shrink-0"
                title="Rescan network for server"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isDetectingServer ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Configuration Content */}
      <main className="max-w-6xl mx-auto w-full px-3 sm:px-6 py-6 sm:py-8 flex-1 min-w-0">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Configure This Device
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Select the role for this hardware terminal. Classroom receivers will be locked to their designated room, while transmitters provide administrative broadcast capabilities.
          </p>
        </div>

        {/* 3 Role Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {/* Card 1: Principal Transmitter */}
          <div
            id="role-card-principal"
            onClick={() => setSelectedRole('principal')}
            className={`cursor-pointer rounded-2xl p-6 border transition-all duration-200 relative flex flex-col justify-between ${
              selectedRole === 'principal'
                ? 'bg-indigo-950/40 border-indigo-500 shadow-[0_0_25px_rgba(99,102,241,0.25)] ring-2 ring-indigo-500/50'
                : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
            }`}
          >
            {selectedRole === 'principal' && (
              <div className="absolute top-4 right-4 text-indigo-400">
                <CheckCircle2 className="w-5 h-5 fill-indigo-500/20" />
              </div>
            )}
            <div>
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${
                  selectedRole === 'principal'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Radio className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">
                Principal Transmitter
              </h3>
              <p className="text-xs font-medium text-indigo-400 mt-0.5">
                Android Phone, Tablet, or PC
              </p>
              <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                For administrative staff. Broadcast live microphone audio, text-to-speech, scheduled bells, and emergency lockdowns to individual rooms or the entire school.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Multi-device simultaneous</span>
              <span className="font-semibold text-indigo-300">Admin Mode</span>
            </div>
          </div>

          {/* Card 2: Classroom Receiver (Primary IFB focus) */}
          <div
            id="role-card-receiver"
            onClick={() => setSelectedRole('receiver')}
            className={`cursor-pointer rounded-2xl p-6 border transition-all duration-200 relative flex flex-col justify-between ${
              selectedRole === 'receiver'
                ? 'bg-indigo-950/40 border-indigo-500 shadow-[0_0_25px_rgba(99,102,241,0.25)] ring-2 ring-indigo-500/50'
                : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
            }`}
          >
            {selectedRole === 'receiver' && (
              <div className="absolute top-4 right-4 text-indigo-400">
                <CheckCircle2 className="w-5 h-5 fill-indigo-500/20" />
              </div>
            )}
            <div>
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${
                  selectedRole === 'receiver'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Tv className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">
                Classroom Receiver
              </h3>
              <p className="text-xs font-medium text-indigo-400 mt-0.5">
                Android Interactive Flat Panel (IFB)
              </p>
              <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                Assigns this panel to a specific classroom. Runs seamlessly in the background, auto-reconnects, and displays full-screen announcement overlays when called.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Tamper-locked to room</span>
              <span className="font-semibold text-emerald-400">IFB Optimized</span>
            </div>
          </div>

          {/* Card 3: Central Server */}
          <div
            id="role-card-server"
            onClick={() => setSelectedRole('server')}
            className={`cursor-pointer rounded-2xl p-6 border transition-all duration-200 relative flex flex-col justify-between ${
              selectedRole === 'server'
                ? 'bg-indigo-950/40 border-indigo-500 shadow-[0_0_25px_rgba(99,102,241,0.25)] ring-2 ring-indigo-500/50'
                : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
            }`}
          >
            {selectedRole === 'server' && (
              <div className="absolute top-4 right-4 text-indigo-400">
                <CheckCircle2 className="w-5 h-5 fill-indigo-500/20" />
              </div>
            )}
            <div>
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${
                  selectedRole === 'server'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Server className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">
                Central Linux Server
              </h3>
              <p className="text-xs font-medium text-indigo-400 mt-0.5">
                Linux Host / Server Console
              </p>
              <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                Central node managing real-time WebSocket communication, device heartbeats, classroom database, and network dispatch between all school panels.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Central Node</span>
              <span className="font-semibold text-indigo-300">Linux Daemon</span>
            </div>
          </div>
        </div>

        {/* Dynamic Configuration Form Based on Selection */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          {/* Server Connection details for all roles */}
          <div className="mb-6 pb-6 border-b border-slate-800">
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-3">
              <Wifi className="w-4 h-4 text-indigo-400" />
              Central Server Connection
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">
                  Server Address / IP (Auto-detected or Manual Fallback)
                </label>
                <input
                  id="server-host-input"
                  type="text"
                  value={serverHost}
                  onChange={(e) => setServerHost(e.target.value)}
                  placeholder="e.g. 192.168.1.100:3000 or schoolpa.local"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  id="test-server-ping-btn"
                  onClick={detectServer}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Verify Link
                </button>
              </div>
            </div>
          </div>

          {/* Classroom Receiver Installation Form */}
          {selectedRole === 'receiver' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Tv className="w-5 h-5 text-indigo-400" />
                  Classroom Panel Details
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Enter the room identification. Once locked, this panel will identify as this classroom on the Principal's board.
                </p>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400 mr-1">Quick Presets:</span>
                {[
                  { num: '104', name: 'Grade 4 Classroom', wing: 'North Wing', grade: 'Grade 4' },
                  { num: '205', name: 'Grade 5 Classroom', wing: 'North Wing', grade: 'Grade 5' },
                  { num: '304', name: 'Music & Band Hall', wing: 'Arts Wing', grade: 'All Grades' },
                  { num: 'GYM', name: 'Athletic Arena', wing: 'Gym & Athletics', grade: 'All Grades' },
                ].map((preset) => (
                  <button
                    key={preset.num}
                    id={`preset-${preset.num}`}
                    onClick={() => {
                      setRoomNumber(preset.num);
                      setRoomName(preset.name);
                      setWing(preset.wing);
                      setGrade(preset.grade);
                    }}
                    className="px-3 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 transition-colors"
                  >
                    Room {preset.num}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Room Number / Identifier *
                  </label>
                  <input
                    id="room-number-input"
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="e.g. 104, 201, GYM"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Classroom / Room Description *
                  </label>
                  <input
                    id="room-name-input"
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="e.g. Grade 4 Classroom, Room 104"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    School Wing / Building Zone
                  </label>
                  <input
                    id="room-wing-input"
                    type="text"
                    list="wing-options-list"
                    value={wing}
                    onChange={(e) => setWing(e.target.value)}
                    placeholder="e.g. North Wing, East Hall, Science Lab Wing"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <datalist id="wing-options-list">
                    <option value="North Wing" />
                    <option value="South Wing" />
                    <option value="East Hall" />
                    <option value="Science Wing" />
                    <option value="Arts Wing" />
                    <option value="Gym & Athletics" />
                    <option value="Administration" />
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Grade Level
                  </label>
                  <input
                    id="room-grade-input"
                    type="text"
                    list="grade-options-list"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="e.g. Grade 4, Kindergarten, All Grades"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <datalist id="grade-options-list">
                    <option value="Kindergarten" />
                    <option value="Grade 1" />
                    <option value="Grade 2" />
                    <option value="Grade 3" />
                    <option value="Grade 4" />
                    <option value="Grade 5" />
                    <option value="Middle School" />
                    <option value="High School" />
                    <option value="All Grades" />
                  </datalist>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Hardware / IFB Panel Model Description
                  </label>
                  <input
                    id="panel-model-input"
                    type="text"
                    value={panelModel}
                    onChange={(e) => setPanelModel(e.target.value)}
                    placeholder="e.g. ViewSonic ViewBoard 75, Promethean ActivPanel, SMART Board"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Speaker Volume & Test */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="w-full sm:w-1/2">
                  <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Volume2 className="w-4 h-4 text-indigo-400" />
                      Classroom Speaker Calibration (%)
                    </span>
                    <input
                      id="panel-volume-input"
                      type="number"
                      min="20"
                      max="100"
                      value={panelVolume}
                      onChange={(e) => {
                        const val = Math.max(20, Math.min(100, Number(e.target.value) || 20));
                        setPanelVolume(val);
                      }}
                      className="w-16 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-center font-mono font-bold text-xs text-indigo-300"
                    />
                  </div>
                  <input
                    id="panel-volume-slider"
                    type="range"
                    min="20"
                    max="100"
                    value={panelVolume}
                    onChange={(e) => setPanelVolume(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                <button
                  id="test-panel-speakers-btn"
                  onClick={handleTestSpeaker}
                  disabled={isPlayingTestAudio}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs font-bold text-indigo-300 border border-indigo-500/40 transition-all flex items-center justify-center gap-2"
                >
                  <Play className={`w-3.5 h-3.5 ${isPlayingTestAudio ? 'animate-spin' : ''}`} />
                  {isPlayingTestAudio ? 'Playing Chime...' : 'Test Speakers Now'}
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>Persistence Guaranteed:</strong> After clicking finish, this device will automatically boot into Room {roomNumber} Receiver mode and lock itself against tampering.
                </span>
              </div>
            </div>
          )}

          {/* Principal Transmitter Form */}
          {selectedRole === 'principal' && (
            <div className="space-y-5">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Radio className="w-5 h-5 text-indigo-400" />
                  Principal Transmitter Console
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Connect as an administrator to initiate school-wide or targeted voice, bell, and emergency broadcasts.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Transmitter Identity / Station Name
                </label>
                <input
                  id="transmitter-name-input"
                  type="text"
                  value={transmitterName}
                  onChange={(e) => setTransmitterName(e.target.value)}
                  placeholder="e.g. Principal Miller (Mobile), Main Office Desk"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Server Workstation Form */}
          {selectedRole === 'server' && (
            <div className="space-y-5">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Server className="w-5 h-5 text-indigo-400" />
                  Linux Server Management Console
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Access the central control server view to monitor connected classroom IFB panels, network discovery, and announcement audit records.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 space-y-2">
                <p className="font-semibold text-slate-200">
                  Linux Daemon Status: <span className="text-emerald-400">RUNNING (Port 3000)</span>
                </p>
                <p className="text-slate-400 leading-relaxed">
                  The WebSocket dispatcher service is currently running and ready to service Android transmitters and classroom receivers across the school local area network.
                </p>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400">
              Selected Role:{' '}
              <span className="font-semibold text-white uppercase">
                {selectedRole}
              </span>
            </div>

            <button
              id="confirm-setup-btn"
              onClick={handleCompleteSetup}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 active:scale-95 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
            >
              <span>
                {selectedRole === 'receiver'
                  ? `Install & Lock as Room ${roomNumber} Receiver`
                  : selectedRole === 'principal'
                  ? 'Launch Principal Console'
                  : 'Open Server Dashboard'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 px-6 py-4 text-center text-xs text-slate-500">
        School Public Address & Emergency Broadcasting Terminal • Android IFB & Linux Compatible
      </footer>
    </div>
  );
};
