import React, { useState, useEffect } from 'react';
import {
  Bell,
  Clock,
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  AlertCircle,
  Save,
  Volume2,
  Calendar,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { BellScheduleConfig, BellScheduleItem, ChimeType, WSMessage } from '../types';
import { wsClient } from '../utils/wsClient';
import { playChimeByType } from '../utils/audioSynth';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PRESET_PROFILES: { name: string; items: BellScheduleItem[] }[] = [
  {
    name: 'Standard School Day',
    items: [
      { id: 'bell-1', name: 'Morning Warning Bell', time: '08:30', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'morning', enabled: true },
      { id: 'bell-2', name: 'Period 1 Begins', time: '08:35', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'period_bell', enabled: true },
      { id: 'bell-3', name: 'Period 2 Begins', time: '09:25', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'period_bell', enabled: true },
      { id: 'bell-4', name: 'Morning Recess / Break', time: '10:15', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'attention', enabled: true },
      { id: 'bell-5', name: 'Period 3 Begins', time: '10:35', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'period_bell', enabled: true },
      { id: 'bell-6', name: 'Period 4 Begins', time: '11:25', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'period_bell', enabled: true },
      { id: 'bell-7', name: 'Lunch Period Starts', time: '12:15', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'lunch', enabled: true },
      { id: 'bell-8', name: 'Period 5 Begins', time: '13:00', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'period_bell', enabled: true },
      { id: 'bell-9', name: 'Period 6 Begins', time: '13:50', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'period_bell', enabled: true },
      { id: 'bell-10', name: 'School Dismissal Bell', time: '14:40', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'westminster', enabled: true },
    ],
  },
  {
    name: 'Half-Day / Early Dismissal',
    items: [
      { id: 'bell-h1', name: 'Morning Warning Bell', time: '08:30', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'morning', enabled: true },
      { id: 'bell-h2', name: 'Period 1 Begins', time: '08:35', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'period_bell', enabled: true },
      { id: 'bell-h3', name: 'Period 2 Begins', time: '09:20', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'period_bell', enabled: true },
      { id: 'bell-h4', name: 'Period 3 Begins', time: '10:05', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'period_bell', enabled: true },
      { id: 'bell-h5', name: 'Period 4 Begins', time: '10:50', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'period_bell', enabled: true },
      { id: 'bell-h6', name: 'Brunch / Snack Break', time: '11:35', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'lunch', enabled: true },
      { id: 'bell-h7', name: 'Final Assembly & Dismissal', time: '12:15', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'westminster', enabled: true },
    ],
  },
  {
    name: 'Examination Day Schedule',
    items: [
      { id: 'bell-e1', name: 'Hall Doors Open & Seating', time: '08:45', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'morning', enabled: true },
      { id: 'bell-e2', name: 'Morning Exam Commences', time: '09:00', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'period_bell', enabled: true },
      { id: 'bell-e3', name: 'Morning Exam Concludes', time: '11:30', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'attention', enabled: true },
      { id: 'bell-e4', name: 'Afternoon Exam Commences', time: '13:00', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'period_bell', enabled: true },
      { id: 'bell-e5', name: 'Exam Day Dismissal', time: '15:00', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'westminster', enabled: true },
    ],
  },
];

interface BellScheduleManagerProps {
  onFeedback?: (msg: string) => void;
}

export const BellScheduleManager: React.FC<BellScheduleManagerProps> = ({ onFeedback }) => {
  const [config, setConfig] = useState<BellScheduleConfig>({
    enabled: true,
    activeProfileName: 'Standard School Day',
    items: PRESET_PROFILES[0].items,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [testingChimeId, setTestingChimeId] = useState<string | null>(null);
  const [localFeedback, setLocalFeedback] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setLocalFeedback(msg);
    if (onFeedback) onFeedback(msg);
    setTimeout(() => setLocalFeedback(null), 3500);
  };

  useEffect(() => {
    fetch('/api/bell-schedule')
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.items)) {
          setConfig(data);
        }
      })
      .catch((err) => console.warn('Could not load bell schedule:', err));

    const unsubscribe = wsClient.subscribe((msg: WSMessage) => {
      if (msg.type === 'bell_schedule_sync' && msg.payload) {
        setConfig(msg.payload);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleSave = async (customConfig?: BellScheduleConfig) => {
    setIsSaving(true);
    const target = customConfig || config;
    try {
      const res = await fetch('/api/bell-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(target),
      });
      if (res.ok) {
        showToast('Bell schedule successfully saved and synced to all school panels!');
      } else {
        showToast('Failed to save bell schedule to server.');
      }
    } catch {
      showToast('Network error while saving schedule.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleGlobal = () => {
    const updated = { ...config, enabled: !config.enabled };
    setConfig(updated);
    handleSave(updated);
  };

  const handleLoadPreset = (profile: { name: string; items: BellScheduleItem[] }) => {
    const updated: BellScheduleConfig = {
      ...config,
      activeProfileName: profile.name,
      items: profile.items.map((it) => ({ ...it, id: `bell-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` })),
    };
    setConfig(updated);
    handleSave(updated);
    showToast(`Loaded preset profile: "${profile.name}"`);
  };

  const handleToggleItem = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item)),
    }));
  };

  const handleItemChange = (id: string, updates: Partial<BellScheduleItem>) => {
    setConfig((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    }));
  };

  const handleToggleDay = (id: string, dayIndex: number) => {
    setConfig((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== id) return item;
        const exists = item.daysOfWeek.includes(dayIndex);
        const newDays = exists ? item.daysOfWeek.filter((d) => d !== dayIndex) : [...item.daysOfWeek, dayIndex].sort();
        return { ...item, daysOfWeek: newDays };
      }),
    }));
  };

  const handleAddBell = () => {
    const newItem: BellScheduleItem = {
      id: `bell-${Date.now()}`,
      name: `Period ${config.items.length + 1}`,
      time: '12:00',
      daysOfWeek: [1, 2, 3, 4, 5],
      chimeType: 'period_bell',
      enabled: true,
    };
    setConfig((prev) => ({
      ...prev,
      items: [...prev.items, newItem].sort((a, b) => a.time.localeCompare(b.time)),
    }));
  };

  const handleDeleteBell = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }));
  };

  const handleTestRing = async (item: BellScheduleItem) => {
    setTestingChimeId(item.id);
    try {
      // 1. Play local preview
      await playChimeByType(item.chimeType, 0.85);

      // 2. Broadcast live test ring across school receivers via server
      await fetch('/api/bell-schedule/test-ring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chimeType: item.chimeType,
          name: `Manual Test Ring: ${item.name}`,
          sender: 'Central Bell Scheduler',
        }),
      });
      showToast(`Rang test bell "${item.name}" across all classrooms!`);
    } catch {
      showToast('Error ringing bell test.');
    } finally {
      setTestingChimeId(null);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">Automated Bell Schedule</h2>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                  config.enabled
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                }`}
              >
                {config.enabled ? 'Active Daily' : 'Bells Paused'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Autonomous class period bells & tone triggers synchronized across all classroom IFB panels
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleToggleGlobal}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
              config.enabled
                ? 'bg-rose-900/40 hover:bg-rose-900/60 text-rose-300 border-rose-700/50'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-600/30'
            }`}
          >
            {config.enabled ? 'Pause All Bells' : 'Enable Automated Bells'}
          </button>

          <button
            type="button"
            onClick={() => handleSave()}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save & Sync'}</span>
          </button>
        </div>
      </div>

      {localFeedback && (
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{localFeedback}</span>
        </div>
      )}

      {/* Preset Profiles Picker */}
      <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>
            Active Schedule Profile: <strong className="text-white font-bold">{config.activeProfileName}</strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-400">Load Presets:</span>
          {PRESET_PROFILES.map((profile) => (
            <button
              key={profile.name}
              type="button"
              onClick={() => handleLoadPreset(profile)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                config.activeProfileName === profile.name
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              {profile.name}
            </button>
          ))}
        </div>
      </div>

      {/* Bell Table List */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 pb-2">
              <th className="pb-3 font-semibold w-12 text-center">Active</th>
              <th className="pb-3 font-semibold">Bell / Period Name</th>
              <th className="pb-3 font-semibold w-24">Time</th>
              <th className="pb-3 font-semibold">Sound Tone</th>
              <th className="pb-3 font-semibold">Active Days</th>
              <th className="pb-3 font-semibold text-right w-28">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {config.items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-800/20 group">
                {/* Active Checkbox */}
                <td className="py-3 text-center">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={() => handleToggleItem(item.id)}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-800 w-4 h-4 cursor-pointer"
                  />
                </td>

                {/* Name */}
                <td className="py-3">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleItemChange(item.id, { name: e.target.value })}
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium outline-none"
                    placeholder="e.g. Period 1"
                  />
                </td>

                {/* Time */}
                <td className="py-3">
                  <input
                    type="time"
                    value={item.time}
                    onChange={(e) => handleItemChange(item.id, { time: e.target.value })}
                    className="bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-lg px-2 py-1.5 text-xs text-amber-300 font-mono font-bold outline-none cursor-pointer"
                  />
                </td>

                {/* Chime Type */}
                <td className="py-3">
                  <select
                    value={item.chimeType}
                    onChange={(e) => handleItemChange(item.id, { chimeType: e.target.value as ChimeType })}
                    className="bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none cursor-pointer"
                  >
                    <option value="period_bell">🔔 Electric School Bell</option>
                    <option value="westminster">🎵 Westminster Chimes</option>
                    <option value="morning">🌅 Gentle Morning Tone</option>
                    <option value="lunch">🥪 Lunchtime Melodic</option>
                    <option value="attention">⚡ Attention 2-Tone</option>
                  </select>
                </td>

                {/* Days of Week */}
                <td className="py-3">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5, 6, 0].map((dayIdx) => {
                      const isSelected = item.daysOfWeek.includes(dayIdx);
                      return (
                        <button
                          key={dayIdx}
                          type="button"
                          onClick={() => handleToggleDay(item.id, dayIdx)}
                          className={`w-6 h-6 rounded text-[10px] font-bold transition-colors ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-800/80 text-slate-500 hover:text-slate-300'
                          }`}
                          title={`Toggle ${DAY_NAMES[dayIdx]}`}
                        >
                          {DAY_NAMES[dayIdx][0]}
                        </button>
                      );
                    })}
                  </div>
                </td>

                {/* Actions */}
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleTestRing(item)}
                      disabled={testingChimeId === item.id}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition-colors"
                      title="Ring Test Tone Across Classrooms"
                    >
                      <Play className={`w-3.5 h-3.5 ${testingChimeId === item.id ? 'animate-spin' : ''}`} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteBell(item.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
                      title="Delete Scheduled Bell"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer / Add Bell */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
        <button
          type="button"
          onClick={handleAddBell}
          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 font-semibold flex items-center gap-1.5 w-fit"
        >
          <Plus className="w-4 h-4" />
          <span>Add Scheduled Bell</span>
        </button>

        <div className="flex items-center gap-2 text-slate-500">
          <Clock className="w-3.5 h-3.5" />
          <span>Server timekeeper checks schedule every 10 seconds. All IFB panels receive automatic chime broadcasts.</span>
        </div>
      </div>
    </div>
  );
};
