import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  Mic,
  MicOff,
  Volume2,
  Bell,
  AlertTriangle,
  Type,
  CheckSquare,
  Square,
  Users,
  Settings,
  ShieldAlert,
  Play,
  Square as StopIcon,
  Sparkles,
  Wifi,
  WifiOff,
  Search,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Clock,
  Send,
  X,
  Sliders,
  Check,
  School,
  Lock,
  KeyRound,
} from 'lucide-react';
import {
  Classroom,
  Announcement,
  AnnouncementType,
  ChimeType,
  EmergencyType,
  WSMessage,
} from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { wsClient } from '../utils/wsClient';
import {
  playChimeByType,
  playEmergencyTone,
  speakText,
} from '../utils/audioSynth';
import { TransmitterLockScreen } from './TransmitterLockScreen';
import { ChangeTransmitterLockModal } from './ChangeTransmitterLockModal';
import { ThemeToggle } from './ThemeToggle';

interface PrincipalTransmitterProps {
  transmitterName: string;
  onExitTransmitterMode: () => void;
}

// Generates a synthetic vocal-like audio stream for testing/broadcasting when no physical mic is attached
const createVirtualMicStream = () => {
  const AudioContextClass =
    window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  const dest = audioCtx.createMediaStreamDestination();

  // Create dual oscillators for vocal-like simulation with bandpass resonance
  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(170, audioCtx.currentTime); // Vocal fundamental

  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(340, audioCtx.currentTime); // 1st overtone

  // LFO to simulate human speech cadence & prosody
  const lfo = audioCtx.createOscillator();
  const lfoGain = audioCtx.createGain();
  lfo.frequency.setValueAtTime(2.8, audioCtx.currentTime);
  lfoGain.gain.setValueAtTime(25, audioCtx.currentTime);
  lfo.connect(osc1.frequency);
  lfo.start();

  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(850, audioCtx.currentTime);
  filter.Q.setValueAtTime(2.5, audioCtx.currentTime);

  gain.gain.setValueAtTime(0.25, audioCtx.currentTime);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  osc1.start();
  osc2.start();

  return {
    stream: dest.stream,
    audioCtx,
    stop: () => {
      try {
        osc1.stop();
      } catch {}
      try {
        osc2.stop();
      } catch {}
      try {
        lfo.stop();
      } catch {}
      try {
        audioCtx.close();
      } catch {}
    },
  };
};

export const PrincipalTransmitter: React.FC<PrincipalTransmitterProps> = ({
  transmitterName,
  onExitTransmitterMode,
}) => {
  const [isConnected, setIsConnected] = useState(wsClient.isConnected);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<
    'voice' | 'tts' | 'chime' | 'emergency'
  >('voice');

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWingFilter, setSelectedWingFilter] = useState<string>('all');

  // Broadcast Feedback
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastFeedback, setBroadcastFeedback] = useState<string | null>(
    null
  );

  // Live Voice State
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [micAudioLevel, setMicAudioLevel] = useState(0);
  const [isUsingVirtualMic, setIsUsingVirtualMic] = useState(false);
  const virtualMicCleanupRef = useRef<(() => void) | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // Non-blocking Toast Notification State (replaces window.alert for iframe safety)
  const [toastNotice, setToastNotice] = useState<{
    message: string;
    type: 'info' | 'warning' | 'error';
  } | null>(null);

  const showToast = (
    message: string,
    type: 'info' | 'warning' | 'error' = 'info'
  ) => {
    setToastNotice({ message, type });
  };

  useEffect(() => {
    if (!toastNotice) return;
    const timer = setTimeout(() => setToastNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [toastNotice]);

  // TTS State
  const [ttsText, setTtsText] = useState('');
  const [ttsIncludeChime, setTtsIncludeChime] = useState(true);
  const [ttsSpeed, setTtsSpeed] = useState(1.0);

  // Emergency Lockout Guard
  const [emergencyUnlocked, setEmergencyUnlocked] = useState(false);

  // Panel Management Modal
  const [isPanelManageOpen, setIsPanelManageOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Classroom | null>(null);
  const [isNewRoomModal, setIsNewRoomModal] = useState(false);

  // Transmitter Lock and Security State
  const [isConsoleLocked, setIsConsoleLocked] = useState(false);
  const [lockPassword, setLockPassword] = useState<string>(
    () => localStorage.getItem('pa_transmitter_lock_pin') || '8888'
  );
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] =
    useState(false);

  // New room form state
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomWing, setNewRoomWing] = useState('North Wing');
  const [newRoomGrade, setNewRoomGrade] = useState('Grade 1');
  const [newRoomVolume, setNewRoomVolume] = useState(85);

  // Connect to WebSocket with principal registration
  useEffect(() => {
    wsClient.connect(undefined, {
      role: 'principal',
      deviceName: transmitterName || 'Principal Mobile Console',
    });

    // Fetch initial list via REST
    fetch('/api/classrooms')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setClassrooms(data);
          // Select all rooms by default
          setSelectedRoomIds(data.map((c) => c.id));
        }
      })
      .catch((err) => console.warn('Fetch classrooms err:', err));

    // Fetch master lock configuration
    fetch('/api/transmitter-lock')
      .then((res) => res.json())
      .then((cfg) => {
        if (cfg?.lockPassword) {
          setLockPassword(cfg.lockPassword);
          localStorage.setItem('pa_transmitter_lock_pin', cfg.lockPassword);
        }
      })
      .catch((err) => console.warn('Fetch lock config err:', err));

    const unsubscribe = wsClient.subscribe((msg: WSMessage) => {
      if (msg.type === 'init') {
        setIsConnected(wsClient.isConnected);
        if (msg.payload?.classrooms) {
          setClassrooms(msg.payload.classrooms);
          setSelectedRoomIds((prev) =>
            prev.length > 0 ? prev : msg.payload.classrooms.map((c: any) => c.id)
          );
        }
        if (msg.payload?.transmitterLockConfig?.lockPassword) {
          setLockPassword(msg.payload.transmitterLockConfig.lockPassword);
          localStorage.setItem(
            'pa_transmitter_lock_pin',
            msg.payload.transmitterLockConfig.lockPassword
          );
        }
      } else if (msg.type === 'classrooms_sync') {
        if (Array.isArray(msg.payload)) {
          setClassrooms(msg.payload);
        }
      } else if (msg.type === 'heartbeat') {
        setIsConnected(wsClient.isConnected);
      } else if (msg.type === 'announcement_dispatched') {
        setIsBroadcasting(false);
        setBroadcastFeedback('Broadcast delivered to classroom receivers.');
        setTimeout(() => setBroadcastFeedback(null), 4000);
      } else if (msg.type === 'transmitter_lock_sync') {
        if (msg.payload?.lockPassword) {
          setLockPassword(msg.payload.lockPassword);
          localStorage.setItem('pa_transmitter_lock_pin', msg.payload.lockPassword);
          setBroadcastFeedback('Transmitter lock password updated & synced!');
          setTimeout(() => setBroadcastFeedback(null), 3000);
        }
      } else if (msg.type === 'transmitter_force_lock') {
        setIsConsoleLocked(true);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [transmitterName]);

  // Unique wings list for filtering
  const allWings = Array.from(new Set(classrooms.map((c) => c.wing)));

  // Filtered rooms
  const filteredRooms = classrooms.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.roomNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.wing.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesWing =
      selectedWingFilter === 'all' || r.wing === selectedWingFilter;
    return matchesSearch && matchesWing;
  });

  // Toggle single room
  const toggleRoomSelection = (id: string) => {
    setSelectedRoomIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Select all / none
  const handleSelectAll = () => {
    setSelectedRoomIds(classrooms.map((c) => c.id));
  };

  const handleDeselectAll = () => {
    setSelectedRoomIds([]);
  };

  const handleSelectByWing = (wing: string) => {
    const roomIdsInWing = classrooms
      .filter((c) => c.wing === wing)
      .map((c) => c.id);
    setSelectedRoomIds(roomIdsInWing);
  };

  // Dispatch Broadcast Helper
  const sendBroadcast = (params: {
    type: AnnouncementType;
    title: string;
    message?: string;
    chimeType?: ChimeType;
    emergencyType?: EmergencyType;
    priority?: 'normal' | 'high' | 'emergency';
    audioData?: string;
    targetAll?: boolean;
  }) => {
    if (
      !params.targetAll &&
      params.type !== 'emergency' &&
      selectedRoomIds.length === 0
    ) {
      showToast('Please select at least one classroom to receive this announcement.', 'warning');
      return;
    }

    setIsBroadcasting(true);
    setBroadcastFeedback('Transmitting broadcast across school network...');

    const isEmergency = params.type === 'emergency';
    const payload = {
      type: params.type,
      sender: transmitterName,
      title: params.title,
      message: params.message,
      chimeType: params.chimeType,
      emergencyType: params.emergencyType,
      priority: params.priority || (isEmergency ? 'emergency' : 'normal'),
      targetType: isEmergency || params.targetAll ? 'all' : 'rooms',
      targetIds: isEmergency || params.targetAll ? [] : selectedRoomIds,
      audioData: params.audioData,
    };

    wsClient.send({
      type: 'announcement_broadcast',
      payload,
    });
  };

  // --- Live Voice Recording ---
  const startLiveRecording = async () => {
    let stream: MediaStream | null = null;
    let isVirtual = false;

    try {
      if (
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === 'function'
      ) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsUsingVirtualMic(false);
      } else {
        throw new Error('getUserMedia not available in current window context');
      }
    } catch (err: any) {
      // Gracefully catch missing physical hardware or blocked permissions without throwing console errors
      console.warn(
        'Physical microphone not detected or unavailable. Activating Virtual Voice generator fallback:',
        err?.message || err
      );
      try {
        const virtualMic = createVirtualMicStream();
        stream = virtualMic.stream;
        virtualMicCleanupRef.current = virtualMic.stop;
        isVirtual = true;
        setIsUsingVirtualMic(true);
        showToast(
          'No physical mic detected. Broadcasting via Virtual Voice audio generator.',
          'info'
        );
      } catch (synthErr) {
        console.warn('Virtual mic initialization error:', synthErr);
        showToast(
          'Microphone unavailable. Please switch to the Text-to-Speech (TTS) tab.',
          'warning'
        );
        return;
      }
    }

    if (!stream) {
      showToast('Unable to initialize audio stream. Please use Text-to-Speech.', 'warning');
      return;
    }

    try {
      audioChunksRef.current = [];

      // Create audio context to visualize mic levels
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setMicAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
        }
        setMicAudioLevel(0);
        try {
          stream?.getTracks().forEach((track) => track.stop());
        } catch {}
        try {
          audioCtx.close();
        } catch {}
        if (virtualMicCleanupRef.current) {
          virtualMicCleanupRef.current();
          virtualMicCleanupRef.current = null;
        }

        // Convert chunks to base64 audio and broadcast
        const audioBlob = new Blob(audioChunksRef.current, {
          type: 'audio/webm',
        });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          sendBroadcast({
            type: 'voice',
            title: isVirtual
              ? 'Live Voice Announcement (Virtual Mic)'
              : 'Live Voice Announcement',
            audioData: base64data,
          });
        };
      };

      mediaRecorder.start();
      setIsRecordingMic(true);
    } catch (recorderErr) {
      console.warn('Error starting recorder:', recorderErr);
      showToast(
        'Recording not supported in this browser. Please use Text-to-Speech.',
        'warning'
      );
      if (virtualMicCleanupRef.current) {
        virtualMicCleanupRef.current();
        virtualMicCleanupRef.current = null;
      }
    }
  };

  const stopLiveRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn('Error stopping media recorder:', err);
      }
    }
    if (virtualMicCleanupRef.current) {
      virtualMicCleanupRef.current();
      virtualMicCleanupRef.current = null;
    }
    setIsRecordingMic(false);
  };

  // --- TTS Broadcast ---
  const handleTTSBroadcast = () => {
    if (!ttsText.trim()) {
      showToast('Please enter an announcement message before transmitting.', 'warning');
      return;
    }
    sendBroadcast({
      type: 'tts',
      title: 'Official School Announcement',
      message: ttsText.trim(),
    });
  };

  // --- Chime Broadcast ---
  const handleChimeBroadcast = (chime: ChimeType, title: string) => {
    sendBroadcast({
      type: 'chime',
      title,
      chimeType: chime,
    });
  };

  // --- Emergency Broadcast ---
  const handleEmergencyBroadcast = (
    type: EmergencyType,
    title: string,
    message: string
  ) => {
    sendBroadcast({
      type: 'emergency',
      title,
      message,
      emergencyType: type,
      priority: 'emergency',
      targetAll: true,
    });
  };

  // --- Panel Management Actions ---
  const handleAddNewRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomNumber.trim()) return;

    try {
      const res = await fetch('/api/classrooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomNumber: newRoomNumber.trim(),
          name: newRoomName.trim() || `Classroom ${newRoomNumber}`,
          wing: newRoomWing,
          grade: newRoomGrade,
          volume: newRoomVolume,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setClassrooms((prev) => [...prev, data.classroom]);
        setSelectedRoomIds((prev) => [...prev, data.classroom.id]);
        setIsNewRoomModal(false);
        setNewRoomNumber('');
        setNewRoomName('');
      }
    } catch (err) {
      console.error('Failed to add room:', err);
    }
  };

  const handleUpdateRoom = async (updated: Classroom) => {
    try {
      const res = await fetch(`/api/classrooms/${updated.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        setClassrooms((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c))
        );
        setEditingRoom(null);
      }
    } catch (err) {
      console.error('Failed to update room:', err);
    }
  };

  const handleDeleteRoom = async (id: string) => {
    if (!confirm('Are you sure you want to delete this classroom panel?')) return;
    try {
      const res = await fetch(`/api/classrooms/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setClassrooms((prev) => prev.filter((c) => c.id !== id));
        setSelectedRoomIds((prev) => prev.filter((rId) => rId !== id));
      }
    } catch (err) {
      console.error('Failed to delete room:', err);
    }
  };

  const handlePingRoom = (id: string) => {
    wsClient.send({
      type: 'ping_test',
      payload: { classroomId: id },
    });
    setBroadcastFeedback(`Test ping sent to Room.`);
    setTimeout(() => setBroadcastFeedback(null), 3000);
  };

  return (
    <div
      id="principal-transmitter-container"
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white overflow-x-hidden max-w-full"
    >
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md px-3 sm:px-8 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 max-w-full">
        <div className="flex items-center justify-between sm:justify-start gap-2.5 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30 shrink-0">
              <Radio className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                  Principal Transmitter
                </h1>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 whitespace-nowrap">
                  Console
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate max-w-[200px] sm:max-w-none">
                Station: <strong className="text-slate-200">{transmitterName}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Right Status Controls */}
        <div className="flex flex-wrap items-center justify-start sm:justify-end gap-1.5 sm:gap-2">
          <PWAInstallButton />
          <ThemeToggle />

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

          {/* Lock Console Action Button */}
          <button
            id="lock-transmitter-console-btn"
            onClick={() => setIsConsoleLocked(true)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-amber-300 hover:text-amber-200 border border-slate-800 hover:border-amber-500/30 transition-all flex items-center gap-1 shrink-0"
            title="Lock transmitter console to prevent unauthorized broadcasts"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Lock</span>
          </button>

          {/* Change Lock Password Action Button */}
          <button
            id="change-transmitter-password-btn"
            onClick={() => setIsChangePasswordModalOpen(true)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white border border-slate-800 transition-all flex items-center gap-1 shrink-0"
            title="Change transmitter unlock PIN or password"
          >
            <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">PIN</span>
          </button>

          <button
            id="manage-panels-btn"
            onClick={() => setIsPanelManageOpen(true)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors flex items-center gap-1 shrink-0"
          >
            <Settings className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Manage Panels</span>
            <span className="sm:hidden">Panels</span>
          </button>

          <button
            id="exit-to-setup-btn"
            onClick={onExitTransmitterMode}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-400 hover:text-white border border-slate-800 transition-colors shrink-0"
          >
            Exit
          </button>
        </div>
      </header>

      {/* Broadcast Feedback Banner */}
      {broadcastFeedback && (
        <div className="bg-indigo-600/90 text-white px-6 py-2 text-center text-xs font-semibold flex items-center justify-center gap-2 animate-in fade-in duration-150">
          <Sparkles className="w-4 h-4" />
          <span>{broadcastFeedback}</span>
        </div>
      )}

      {/* Main Studio Body: 2-Column Responsive Layout */}
      <main className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 min-w-0 max-w-full">
        {/* Left Column (5 Cols): Classroom Selector & Matrix */}
        <section className="lg:col-span-5 flex flex-col gap-4 min-w-0">
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg flex-1 flex flex-col justify-between min-w-0">
            {/* Header & Quick Actions */}
            <div>
              <div className="flex items-center justify-between mb-3 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Users className="w-4 h-4 text-indigo-400 shrink-0" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider truncate">
                    Target Classrooms
                  </h2>
                </div>
                <span className="text-xs font-bold text-indigo-300 px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/30 whitespace-nowrap">
                  {selectedRoomIds.length} of {classrooms.length} Selected
                </span>
              </div>

              {/* Quick Select Buttons */}
              <div className="flex items-center gap-2 mb-3">
                <button
                  id="select-all-rooms-btn"
                  onClick={handleSelectAll}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-xs font-semibold transition-colors"
                >
                  All School ({classrooms.length})
                </button>
                <button
                  id="deselect-all-rooms-btn"
                  onClick={handleDeselectAll}
                  className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-medium transition-colors"
                >
                  Clear Selection
                </button>
              </div>

              {/* Zone Wings Quick Filter */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 text-xs scrollbar-none max-w-full">
                <button
                  onClick={() => setSelectedWingFilter('all')}
                  className={`px-2.5 py-1 rounded-full whitespace-nowrap text-[11px] font-medium transition-colors ${
                    selectedWingFilter === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  All Wings
                </button>
                {allWings.map((wing) => (
                  <button
                    key={wing}
                    onClick={() => setSelectedWingFilter(wing)}
                    className={`px-2.5 py-1 rounded-full whitespace-nowrap text-[11px] font-medium transition-colors ${
                      selectedWingFilter === wing
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {wing}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative mb-3">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search room number, name, or wing..."
                  className="w-full pl-8 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Room List Scrollable Matrix */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {filteredRooms.map((room) => {
                const isSelected = selectedRoomIds.includes(room.id);
                return (
                  <div
                    key={room.id}
                    id={`room-item-${room.id}`}
                    onClick={() => toggleRoomSelection(room.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500/70 shadow-sm'
                        : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-slate-500 border border-slate-700'
                        }`}
                      >
                        {isSelected ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : null}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <span className="text-sm font-bold text-white whitespace-nowrap">
                            Room {room.roomNumber}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 truncate max-w-[80px] sm:max-w-none">
                            {room.wing}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate max-w-[130px] xs:max-w-[170px] sm:max-w-[200px]">
                          {room.name}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Volume2 className="w-3 h-3 text-indigo-400" />
                        <span>{room.volume}%</span>
                      </div>
                      <div
                        className={`w-2 h-2 rounded-full ${
                          room.isOnline
                            ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                            : 'bg-slate-600'
                        }`}
                        title={room.isOnline ? 'Online' : 'Offline'}
                      />
                    </div>
                  </div>
                );
              })}

              {filteredRooms.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-500">
                  No classroom panels match your search query.
                </div>
              )}
            </div>

            {/* Bottom Target Summary */}
            <div className="pt-3 mt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span className="truncate mr-2">
                Broadcast target:{' '}
                <strong className="text-white">
                  {selectedRoomIds.length === classrooms.length
                    ? 'Entire School'
                    : `${selectedRoomIds.length} Rooms`}
                </strong>
              </span>
              <button
                id="add-room-quick-btn"
                onClick={() => setIsNewRoomModal(true)}
                className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3 h-3" />
                Add Room
              </button>
            </div>
          </div>
        </section>

        {/* Right Column (7 Cols): Studio Broadcast Controls */}
        <section className="lg:col-span-7 flex flex-col gap-4 min-w-0">
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl flex-1 flex flex-col min-w-0">
            {/* Mode Selector Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 mb-4 sm:mb-6 p-1 sm:p-1.5 rounded-2xl bg-slate-950/70 border border-slate-800">
              <button
                id="tab-voice-btn"
                onClick={() => setActiveTab('voice')}
                className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 sm:gap-1.5 ${
                  activeTab === 'voice'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">Live Voice</span>
              </button>

              <button
                id="tab-tts-btn"
                onClick={() => setActiveTab('tts')}
                className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 sm:gap-1.5 ${
                  activeTab === 'tts'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Type className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">Text-To-Speech</span>
              </button>

              <button
                id="tab-chime-btn"
                onClick={() => setActiveTab('chime')}
                className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 sm:gap-1.5 ${
                  activeTab === 'chime'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">Bells & Chimes</span>
              </button>

              <button
                id="tab-emergency-btn"
                onClick={() => setActiveTab('emergency')}
                className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 sm:gap-1.5 ${
                  activeTab === 'emergency'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                    : 'text-rose-400 hover:text-rose-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">Emergency</span>
              </button>
            </div>

            {/* TAB 1: LIVE VOICE PUSH-TO-TALK */}
            {activeTab === 'voice' && (
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Mic className="w-4 h-4 text-indigo-400" />
                      Live Microphone Broadcast
                    </h3>
                    <span className="text-xs text-slate-400">
                      High-fidelity Web Audio stream
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-6">
                    Press and hold or toggle the microphone button to broadcast your voice in real time to the {selectedRoomIds.length} selected classroom IFB speakers.
                  </p>
                </div>

                {/* Big Push-To-Talk Mic Control */}
                <div className="py-6 flex flex-col items-center justify-center text-center">
                  <div className="relative mb-6">
                    {/* Pulsing Ripple rings when recording */}
                    {isRecordingMic && (
                      <div className="absolute inset-0 -m-6 rounded-full bg-rose-500/20 animate-ping" />
                    )}

                    <button
                      id="mic-broadcast-btn"
                      onClick={
                        isRecordingMic ? stopLiveRecording : startLiveRecording
                      }
                      className={`w-32 h-32 sm:w-36 sm:h-36 rounded-full flex flex-col items-center justify-center transition-all duration-200 relative z-10 shadow-2xl ${
                        isRecordingMic
                          ? 'bg-rose-600 text-white shadow-[0_0_40px_rgba(225,29,72,0.6)] scale-105'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_30px_rgba(99,102,241,0.4)] active:scale-95'
                      }`}
                    >
                      {isRecordingMic ? (
                        <>
                          <StopIcon className="w-10 h-10 fill-current mb-1" />
                          <span className="text-xs font-extrabold uppercase tracking-wider">
                            TAP TO STOP
                          </span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-10 h-10 mb-1" />
                          <span className="text-xs font-extrabold uppercase tracking-wider">
                            TAP TO SPEAK
                          </span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Audio Level VU Meter */}
                  <div className="w-full max-w-xs">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                      <span>Mic Audio Input Level</span>
                      <span className="font-mono font-bold text-indigo-300">
                        {isRecordingMic ? `${micAudioLevel}%` : 'Idle'}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-75 ${
                          micAudioLevel > 80
                            ? 'bg-rose-500'
                            : micAudioLevel > 50
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                        }`}
                        style={{
                          width: `${isRecordingMic ? micAudioLevel : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <p className="mt-4 text-xs font-medium text-slate-300">
                    {isRecordingMic
                      ? '🎙️ Broadcasting live audio to selected classrooms...'
                      : `Ready to broadcast to ${selectedRoomIds.length} classrooms.`}
                  </p>

                  {isUsingVirtualMic && (
                    <div className="mt-2.5 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 text-[11px] flex items-center justify-center gap-1.5 max-w-xs mx-auto">
                      <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                      <span>Virtual Voice Mode (Synthesized Mic Test)</span>
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                  <span>Android Microphone Filter: Active</span>
                  <span className="text-indigo-300 font-semibold">Latency: ~25ms</span>
                </div>
              </div>
            )}

            {/* TAB 2: TEXT-TO-SPEECH (TTS) */}
            {activeTab === 'tts' && (
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Type className="w-4 h-4 text-indigo-400" />
                      Text-To-Speech Broadcast
                    </h3>
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ttsIncludeChime}
                        onChange={(e) => setTtsIncludeChime(e.target.checked)}
                        className="accent-indigo-500 rounded"
                      />
                      <span>Play prelude chime first</span>
                    </label>
                  </div>

                  {/* Message Input */}
                  <textarea
                    id="tts-message-input"
                    rows={4}
                    value={ttsText}
                    onChange={(e) => setTtsText(e.target.value)}
                    placeholder="Type the announcement to be spoken through classroom speakers..."
                    className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
                  />

                  {/* School Templates */}
                  <div className="mt-3">
                    <span className="text-xs text-slate-400 block mb-1.5">
                      Quick School Templates:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        {
                          label: 'Morning Pledge',
                          text: 'Please stand for the Pledge of Allegiance. I pledge allegiance to the flag of the United States of America.',
                        },
                        {
                          label: 'Bus Dismissal',
                          text: 'Attention all students: Buses 14, 22, and 35 have arrived in the main bus loop. Bus riders please proceed immediately.',
                        },
                        {
                          label: 'Testing In Progress',
                          text: 'Standardized testing is now underway in the science wing. Please maintain absolute quiet in all corridors.',
                        },
                        {
                          label: 'Early Dismissal',
                          text: 'Good afternoon. Reminder that tomorrow is an early dismissal day at 12:30 PM for staff professional development.',
                        },
                      ].map((tmpl) => (
                        <button
                          key={tmpl.label}
                          onClick={() => setTtsText(tmpl.text)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-300 border border-slate-700 transition-colors"
                        >
                          {tmpl.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Speed & Actions */}
                <div className="pt-4 border-t border-slate-800/80 mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                    <span className="text-xs text-slate-400">Speech Rate:</span>
                    <button
                      onClick={() => setTtsSpeed(0.9)}
                      className={`px-2 py-1 rounded text-xs ${
                        ttsSpeed === 0.9 ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      Slow
                    </button>
                    <button
                      onClick={() => setTtsSpeed(1.0)}
                      className={`px-2 py-1 rounded text-xs ${
                        ttsSpeed === 1.0 ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      Normal
                    </button>
                    <button
                      onClick={() => setTtsSpeed(1.15)}
                      className={`px-2 py-1 rounded text-xs ${
                        ttsSpeed === 1.15 ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      Brisk
                    </button>
                    <div className="flex items-center gap-1 ml-1">
                      <input
                        id="tts-speed-custom-input"
                        type="number"
                        step="0.05"
                        min="0.5"
                        max="2.0"
                        value={ttsSpeed}
                        onChange={(e) => setTtsSpeed(parseFloat(e.target.value) || 1.0)}
                        className="w-16 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-center text-indigo-300 font-mono"
                        placeholder="1.0"
                      />
                      <span className="text-[11px] text-slate-500">x</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
                    <button
                      id="preview-tts-btn"
                      onClick={() => speakText(ttsText || 'Testing classroom speech output.', ttsSpeed)}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Test Preview
                    </button>

                    <button
                      id="broadcast-tts-btn"
                      onClick={handleTTSBroadcast}
                      disabled={!ttsText.trim() || isBroadcasting}
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Broadcast ({selectedRoomIds.length} Rooms)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: BELLS & AUDIO CHIMES */}
            {activeTab === 'chime' && (
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                    <Bell className="w-4 h-4 text-indigo-400" />
                    School Bells & Audio Chimes
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Trigger official school bells and alert tones to signal schedule changes or grab classroom attention.
                  </p>

                  {/* Chimes Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {[
                      {
                        type: 'westminster' as ChimeType,
                        title: 'Westminster 4-Tone Chime',
                        desc: 'Classic formal school melodic chime',
                        tag: 'Formal Announcement',
                      },
                      {
                        type: 'attention' as ChimeType,
                        title: 'Attention 2-Tone Chime',
                        desc: 'Standard Ding-Dong attention signal',
                        tag: 'Standard Call',
                      },
                      {
                        type: 'period_bell' as ChimeType,
                        title: 'Period Dismissal Bell',
                        desc: 'Vibrating resonant electric class bell',
                        tag: 'Class Change',
                      },
                      {
                        type: 'morning' as ChimeType,
                        title: 'Morning Welcome Bell',
                        desc: 'Bright rising arpeggio greeting chime',
                        tag: 'Start of Day',
                      },
                      {
                        type: 'lunch' as ChimeType,
                        title: 'Lunch Time Bell',
                        desc: 'Playful two-chord dining alert',
                        tag: 'Cafeteria',
                      },
                    ].map((chime) => (
                      <div
                        key={chime.type}
                        className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold text-white">
                              {chime.title}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              {chime.tag}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">{chime.desc}</p>
                        </div>

                        <div className="mt-4 flex items-center gap-2">
                          <button
                            id={`test-${chime.type}-btn`}
                            onClick={() => playChimeByType(chime.type, 0.8)}
                            className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 flex items-center justify-center gap-1"
                          >
                            <Play className="w-3 h-3" />
                            Preview
                          </button>

                          <button
                            id={`broadcast-${chime.type}-btn`}
                            onClick={() =>
                              handleChimeBroadcast(chime.type, chime.title)
                            }
                            className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md shadow-indigo-600/30 flex items-center justify-center gap-1"
                          >
                            <Bell className="w-3 h-3" />
                            Broadcast
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                  <span>Target: {selectedRoomIds.length} selected classrooms</span>
                  <span className="text-indigo-400 font-semibold">Zero Audio Latency</span>
                </div>
              </div>
            )}

            {/* TAB 4: EMERGENCY ALERT SYSTEM */}
            {activeTab === 'emergency' && (
              <div className="flex-1 flex flex-col justify-between emergency-panel-container">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5" />
                      School Emergency Priority Override
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Safety Guard:</span>
                      <button
                        id="toggle-emergency-guard-btn"
                        onClick={() => setEmergencyUnlocked(!emergencyUnlocked)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          emergencyUnlocked
                            ? 'bg-rose-600 text-white'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {emergencyUnlocked ? 'ALERTS ARMED' : 'GUARD LOCKED'}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-rose-400 mb-4 leading-relaxed emergency-override-desc">
                    <strong className="font-extrabold text-rose-600">CRITICAL OVERRIDE:</strong> Emergency broadcasts instantly target <u>ALL</u> school classrooms, override mute settings, flash full-screen strobe warning banners, and play sirens.
                  </p>

                  {/* Emergency Presets */}
                  <div className="space-y-3 emergency-presets-container">
                    {[
                      {
                        type: 'lockdown' as EmergencyType,
                        title: 'CODE RED: IMMEDIATE LOCKDOWN',
                        desc: 'Active threat / armed intruder protocol. Locks doors, lights out, silence.',
                        message:
                          'ATTENTION: This is an emergency lockdown. Secure all doors, turn off classroom lights, and move away from windows immediately.',
                        color: 'border-rose-600/80 bg-rose-950/40 text-rose-900 emergency-card-lockdown',
                        titleColor: 'text-rose-950 dark:text-rose-100',
                        descColor: 'text-rose-900/80 dark:text-rose-200/70',
                        btnColor: 'bg-rose-600 hover:bg-rose-500 text-white',
                      },
                      {
                        type: 'evacuation' as EmergencyType,
                        title: 'BUILDING EVACUATION (FIRE / GAS)',
                        desc: 'Audible fire horn sweep. Immediate calm evacuation via primary exit.',
                        message:
                          'ATTENTION: Please evacuate the building immediately via the nearest emergency exit. Proceed to your designated field post.',
                        color: 'border-amber-600/80 bg-amber-950/40 text-amber-900 emergency-card-evacuation',
                        titleColor: 'text-amber-950 dark:text-amber-100',
                        descColor: 'text-amber-900/80 dark:text-amber-200/70',
                        btnColor: 'bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold',
                      },
                      {
                        type: 'severe_weather' as EmergencyType,
                        title: 'SEVERE WEATHER / TORNADO WARNING',
                        desc: 'Tornado / civil defense siren. Move to interior structural corridors.',
                        message:
                          'ATTENTION: Severe weather warning. Proceed immediately to designated interior hallway shelter locations.',
                        color: 'border-yellow-600/80 bg-yellow-950/40 text-yellow-900 emergency-card-weather',
                        titleColor: 'text-yellow-950 dark:text-yellow-100',
                        descColor: 'text-yellow-900/80 dark:text-yellow-200/70',
                        btnColor: 'bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold',
                      },
                      {
                        type: 'medical' as EmergencyType,
                        title: 'MEDICAL EMERGENCY RESPONSE',
                        desc: 'Rapid alert for campus medical team and administrators.',
                        message:
                          'Medical response team required immediately. All hallways must remain clear.',
                        color: 'border-blue-600/80 bg-blue-950/40 text-blue-900 emergency-card-medical',
                        titleColor: 'text-blue-950 dark:text-blue-100',
                        descColor: 'text-blue-900/80 dark:text-blue-200/70',
                        btnColor: 'bg-blue-600 hover:bg-blue-500 text-white',
                      },
                      {
                        type: 'all_clear' as EmergencyType,
                        title: 'ALL CLEAR / RESUME NORMAL SCHEDULE',
                        desc: 'Calm harmonic resolution chime indicating emergency has ended.',
                        message:
                          'All clear. The emergency condition has been resolved. Faculty and students may resume normal classroom schedules.',
                        color: 'border-emerald-600/80 bg-emerald-950/40 text-emerald-900 emergency-card-allclear',
                        titleColor: 'text-emerald-950 dark:text-emerald-100',
                        descColor: 'text-emerald-900/80 dark:text-emerald-200/70',
                        btnColor: 'bg-emerald-600 hover:bg-emerald-500 text-white',
                      },
                    ].map((alertItem) => (
                      <div
                        key={alertItem.type}
                        className={`p-4 rounded-2xl border ${alertItem.color} emergency-alert-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}
                      >
                        <div className="flex-1">
                          <h4 className={`text-sm font-extrabold tracking-wide ${alertItem.titleColor} emergency-card-title`}>
                            {alertItem.title}
                          </h4>
                          <p className={`text-xs ${alertItem.descColor} mt-0.5 emergency-card-desc`}>
                            {alertItem.desc}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <button
                            id={`test-${alertItem.type}-btn`}
                            onClick={() =>
                              playEmergencyTone(alertItem.type, 0.6)
                            }
                            className="emergency-sound-test-btn py-2 px-3 rounded-xl bg-black/40 hover:bg-black/60 text-xs font-semibold text-slate-200 border border-white/10"
                          >
                            Sound Test
                          </button>

                          <button
                            id={`trigger-${alertItem.type}-btn`}
                            onClick={() =>
                              handleEmergencyBroadcast(
                                alertItem.type,
                                alertItem.title,
                                alertItem.message
                              )
                            }
                            disabled={!emergencyUnlocked}
                            className={`flex-1 sm:flex-none py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed ${alertItem.btnColor}`}
                          >
                            Trigger All Rooms
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {!emergencyUnlocked && (
                  <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 text-center">
                    Tap <strong>"GUARD LOCKED"</strong> in top right to unlock emergency transmission controls.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 px-6 py-3 flex items-center justify-between text-xs text-slate-500">
        <span>Public Address Master Control • Multi-Device Synchronized</span>
        <span>Connected Panels: {classrooms.filter((c) => c.isOnline).length} Active</span>
      </footer>

      {/* MODAL: MANAGE CLASSROOM PANELS */}
      {isPanelManageOpen && (
        <div
          onClick={() => setIsPanelManageOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 text-white max-h-[85vh] flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">
                  Classroom Panels Directory
                </h3>
              </div>
              <button
                onClick={() => setIsPanelManageOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List */}
            <div className="my-4 overflow-y-auto modal-scrollable flex-1 space-y-2.5 pr-1">
              {classrooms.map((room) => (
                <div
                  key={room.id}
                  className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-wrap items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">
                        Room {room.roomNumber}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        ({room.name})
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {room.wing}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Grade: {room.grade} • Volume: {room.volume}% • Panel: {room.panelModel || 'Android IFB'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      id={`ping-panel-${room.id}`}
                      onClick={() => handlePingRoom(room.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1"
                    >
                      <Bell className="w-3 h-3 text-indigo-400" />
                      Ping Chime
                    </button>

                    <button
                      id={`edit-panel-${room.id}`}
                      onClick={() => setEditingRoom(room)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                      title="Edit Room"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      id={`delete-panel-${room.id}`}
                      onClick={() => handleDeleteRoom(room.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-rose-400"
                      title="Delete Room"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => {
                  setIsPanelManageOpen(false);
                  setIsNewRoomModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Register New Classroom Panel
              </button>

              <button
                onClick={() => setIsPanelManageOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT CLASSROOM PANEL */}
      {editingRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 text-white shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-indigo-400" />
              Edit Room {editingRoom.roomNumber} Details
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Classroom / Room Description</label>
                <input
                  type="text"
                  value={editingRoom.name}
                  onChange={(e) =>
                    setEditingRoom({ ...editingRoom, name: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Building Zone / Wing</label>
                <input
                  type="text"
                  list="edit-room-wing-list"
                  value={editingRoom.wing}
                  onChange={(e) =>
                    setEditingRoom({ ...editingRoom, wing: e.target.value })
                  }
                  placeholder="e.g. North Wing"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500 text-sm"
                />
                <datalist id="edit-room-wing-list">
                  <option value="North Wing" />
                  <option value="South Wing" />
                  <option value="Science Wing" />
                  <option value="East Hall" />
                  <option value="Gym & Athletics" />
                  <option value="Arts Wing" />
                </datalist>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Grade Level</label>
                <input
                  type="text"
                  list="edit-room-grade-list"
                  value={editingRoom.grade || ''}
                  onChange={(e) =>
                    setEditingRoom({ ...editingRoom, grade: e.target.value })
                  }
                  placeholder="e.g. Grade 4, High School, All Grades"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500 text-sm"
                />
                <datalist id="edit-room-grade-list">
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

              <div>
                <label className="block text-slate-400 mb-1">
                  Speaker Output Volume (%)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="20"
                    max="100"
                    value={editingRoom.volume}
                    onChange={(e) =>
                      setEditingRoom({
                        ...editingRoom,
                        volume: Number(e.target.value),
                      })
                    }
                    className="flex-1 accent-indigo-500"
                  />
                  <input
                    type="number"
                    min="20"
                    max="100"
                    value={editingRoom.volume}
                    onChange={(e) => {
                      const val = Math.max(20, Math.min(100, Number(e.target.value) || 20));
                      setEditingRoom({
                        ...editingRoom,
                        volume: val,
                      });
                    }}
                    className="w-16 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-center text-sm font-mono text-indigo-300"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setEditingRoom(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                id="save-edited-room-btn"
                onClick={() => handleUpdateRoom(editingRoom)}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER NEW CLASSROOM PANEL */}
      {isNewRoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <form
            onSubmit={handleAddNewRoom}
            className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 text-white shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-400" />
              Register New Classroom Receiver Panel
            </h3>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Room Number *</label>
              <input
                type="text"
                required
                value={newRoomNumber}
                onChange={(e) => setNewRoomNumber(e.target.value)}
                placeholder="e.g. 204, 301, GYM-2"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Room Description / Name</label>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="e.g. Grade 5 Classroom, Science Lab"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Wing</label>
                <input
                  type="text"
                  list="new-room-wing-list"
                  value={newRoomWing}
                  onChange={(e) => setNewRoomWing(e.target.value)}
                  placeholder="e.g. North Wing"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                />
                <datalist id="new-room-wing-list">
                  <option value="North Wing" />
                  <option value="South Wing" />
                  <option value="Science Wing" />
                  <option value="East Hall" />
                  <option value="Gym & Athletics" />
                  <option value="Arts Wing" />
                </datalist>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Grade</label>
                <input
                  type="text"
                  list="new-room-grade-list"
                  value={newRoomGrade}
                  onChange={(e) => setNewRoomGrade(e.target.value)}
                  placeholder="e.g. Grade 1"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                />
                <datalist id="new-room-grade-list">
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
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Default Speaker Volume (%)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={newRoomVolume}
                  onChange={(e) => setNewRoomVolume(Number(e.target.value))}
                  className="flex-1 accent-indigo-500"
                />
                <input
                  type="number"
                  min="20"
                  max="100"
                  value={newRoomVolume}
                  onChange={(e) => {
                    const val = Math.max(20, Math.min(100, Number(e.target.value) || 20));
                    setNewRoomVolume(val);
                  }}
                  className="w-16 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-center text-xs font-mono text-indigo-300"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsNewRoomModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                id="create-new-room-btn"
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md"
              >
                Register Panel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Transmitter Full-Screen Lock Overlay */}
      <TransmitterLockScreen
        isLocked={isConsoleLocked}
        onUnlock={() => setIsConsoleLocked(false)}
        savedPassword={lockPassword}
        transmitterName={transmitterName}
        onOpenChangePassword={() => setIsChangePasswordModalOpen(true)}
      />

      {/* Change Transmitter Lock Password Modal */}
      <ChangeTransmitterLockModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
        onSuccess={(newPass) => {
          setLockPassword(newPass);
          setBroadcastFeedback('Transmitter lock password updated and synchronized!');
          setTimeout(() => setBroadcastFeedback(null), 3500);
        }}
        currentSavedPassword={lockPassword}
        sourceRole="principal"
        actorName={transmitterName}
      />
      {/* Floating Toast Notification Banner */}
      {toastNotice && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={`p-3.5 rounded-2xl shadow-xl border flex items-start gap-3 text-xs font-medium ${
              toastNotice.type === 'warning'
                ? 'bg-amber-950/95 text-amber-200 border-amber-500/50 backdrop-blur-md shadow-amber-950/40'
                : toastNotice.type === 'error'
                ? 'bg-rose-950/95 text-rose-200 border-rose-500/50 backdrop-blur-md shadow-rose-950/40'
                : 'bg-slate-900/95 text-slate-100 border-indigo-500/50 backdrop-blur-md shadow-indigo-950/40'
            }`}
          >
            <span className="text-base shrink-0">
              {toastNotice.type === 'warning'
                ? '⚠️'
                : toastNotice.type === 'error'
                ? '🛑'
                : 'ℹ️'}
            </span>
            <div className="flex-1 min-w-0 leading-relaxed">{toastNotice.message}</div>
            <button
              onClick={() => setToastNotice(null)}
              className="text-slate-400 hover:text-white p-0.5 rounded transition-colors shrink-0"
              aria-label="Close notification"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
