import React, { useEffect, useState, useRef } from 'react';
import { Volume2, VolumeX, AlertTriangle, Radio, Bell, ShieldAlert, Sparkles, X } from 'lucide-react';
import { Announcement } from '../types';
import { playChimeByType, playEmergencyTone, speakText, getAudioContext } from '../utils/audioSynth';

interface AnnouncementOverlayProps {
  announcement: Announcement | null;
  panelVolume: number;
  onFinished: () => void;
}

export const AnnouncementOverlay: React.FC<AnnouncementOverlayProps> = ({
  announcement,
  panelVolume,
  onFinished,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const activeSoundRef = useRef<{ stop?: () => void } | null>(null);

  useEffect(() => {
    if (!announcement) {
      setIsPlaying(false);
      setCountdown(null);
      return;
    }

    setIsPlaying(true);
    setAudioBlocked(false);

    const isEmergency = announcement.type === 'emergency' || announcement.priority === 'emergency';
    // For real emergencies, always override to full 100% volume for life safety
    const normVolume = isEmergency ? 1.0 : (panelVolume ?? 80) / 100;

    const runAudio = async () => {
      try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') {
          await ctx.resume().catch(() => {
            setAudioBlocked(true);
          });
        }

        if (announcement.type === 'chime' && announcement.chimeType) {
          await playChimeByType(announcement.chimeType, normVolume);
          // auto close after 2 seconds
          setTimeout(onFinished, 2000);
        } else if (announcement.type === 'emergency' && announcement.emergencyType) {
          const sound = playEmergencyTone(announcement.emergencyType, normVolume);
          activeSoundRef.current = sound;
          await sound.promise;

          // If emergency announcement has message, speak it
          if (announcement.message) {
            await speakText(announcement.message, 0.95);
          }
          // Remain visible for safety
          setCountdown(8);
        } else if (announcement.type === 'tts') {
          // Play introductory chime first
          await playChimeByType('attention', normVolume * 0.8);
          if (announcement.message) {
            await speakText(announcement.message, 1.0);
          }
          setTimeout(onFinished, 3000);
        } else if (announcement.type === 'voice') {
          if (announcement.audioData) {
            const audio = new Audio(announcement.audioData);
            audio.volume = normVolume;
            audio.onended = () => {
              setTimeout(onFinished, 2000);
            };
            audio.onerror = () => {
              setTimeout(onFinished, 2000);
            };
            await audio.play().catch(() => {
              setAudioBlocked(true);
            });
          } else {
            // Live voice stream indicator
            await playChimeByType('attention', normVolume * 0.7);
          }
        }
      } catch (err) {
        console.warn('Audio playback error:', err);
        setAudioBlocked(true);
      }
    };

    runAudio();

    return () => {
      if (activeSoundRef.current?.stop) {
        activeSoundRef.current.stop();
      }
    };
  }, [announcement, panelVolume]);

  // Handle countdown for emergency
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      onFinished();
      return;
    }
    const timer = setInterval(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown, onFinished]);

  if (!announcement) return null;

  const isEmergency = announcement.type === 'emergency' || announcement.priority === 'emergency';

  return (
    <div
      id="announcement-overlay"
      className={`fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-10 backdrop-blur-md transition-all duration-300 ${
        isEmergency
          ? 'bg-rose-950/90 animate-pulse border-8 border-rose-600'
          : 'bg-slate-950/90 border-4 border-indigo-500/50'
      }`}
    >
      <div
        id="announcement-overlay-card"
        className={`w-full max-w-3xl rounded-3xl shadow-2xl p-8 sm:p-12 text-white relative overflow-hidden transition-transform ${
          isEmergency
            ? 'bg-gradient-to-b from-rose-900 to-slate-950 border border-rose-500/60 shadow-[0_0_50px_rgba(225,29,72,0.4)]'
            : 'bg-gradient-to-b from-slate-900 to-slate-950 border border-indigo-500/40 shadow-[0_0_40px_rgba(99,102,241,0.25)]'
        }`}
      >
        {/* Close Button for panel operator/admin in urgent manual dismiss */}
        <button
          id="dismiss-announcement-overlay-btn"
          onClick={onFinished}
          className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
          title="Dismiss announcement"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Top Header Badge */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            {isEmergency ? (
              <div className="p-3 rounded-2xl bg-rose-600 text-white shadow-lg animate-bounce">
                <ShieldAlert className="w-8 h-8" />
              </div>
            ) : announcement.type === 'voice' ? (
              <div className="p-3 rounded-2xl bg-indigo-600 text-white shadow-lg animate-pulse">
                <Radio className="w-8 h-8" />
              </div>
            ) : announcement.type === 'chime' ? (
              <div className="p-3 rounded-2xl bg-amber-500 text-white shadow-lg">
                <Bell className="w-8 h-8" />
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-blue-600 text-white shadow-lg">
                <Volume2 className="w-8 h-8" />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                    isEmergency
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-indigo-500/30 text-indigo-300 border border-indigo-500/40'
                  }`}
                >
                  {isEmergency
                    ? 'CRITICAL EMERGENCY BROADCAST'
                    : announcement.type === 'voice'
                    ? 'LIVE PRINCIPAL VOICE'
                    : announcement.type === 'chime'
                    ? 'OFFICIAL SCHOOL CHIME'
                    : 'PUBLIC ADDRESS ANNOUNCEMENT'}
                </span>
                <span className="text-xs text-slate-400">
                  Vol: {panelVolume}%
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 text-slate-100">
                {announcement.title || 'Official PA Announcement'}
              </h2>
            </div>
          </div>
        </div>

        {/* Audio Unblock Notice if browser required interaction */}
        {audioBlocked && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <VolumeX className="w-6 h-6 text-amber-400" />
              <p className="text-sm font-medium">
                Audio playback is paused by panel security. Tap to enable speaker output.
              </p>
            </div>
            <button
              id="enable-audio-btn"
              onClick={() => {
                getAudioContext().resume();
                setAudioBlocked(false);
              }}
              className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold text-sm hover:bg-amber-400 active:scale-95 transition-all"
            >
              Enable Audio
            </button>
          </div>
        )}

        {/* Sender Info Banner */}
        <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 mb-6 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Origin:</span>
            <span className="font-semibold text-slate-200">
              {announcement.sender || 'Principal Desk'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Target:</span>
            <span className="font-semibold text-slate-200">
              {announcement.targetType === 'all'
                ? 'All School Classrooms'
                : 'Selected Classrooms'}
            </span>
          </div>
        </div>

        {/* Audio Visualizer Waves */}
        <div className="my-8 flex items-center justify-center gap-1.5 h-16 sm:h-20 px-4">
          {[
            'h-6', 'h-10', 'h-14', 'h-8', 'h-16', 'h-12', 'h-18', 'h-10', 'h-14',
            'h-20', 'h-16', 'h-12', 'h-18', 'h-8', 'h-14', 'h-10', 'h-6',
          ].map((h, i) => (
            <div
              key={i}
              className={`w-2 sm:w-2.5 rounded-full transition-all duration-150 ${h} ${
                isEmergency
                  ? 'bg-rose-400 animate-pulse shadow-[0_0_10px_rgba(251,113,133,0.8)]'
                  : 'bg-indigo-400 animate-pulse shadow-[0_0_8px_rgba(129,140,248,0.7)]'
              }`}
              style={{
                animationDelay: `${(i % 5) * 0.12}s`,
                animationDuration: isEmergency ? '0.5s' : '0.8s',
              }}
            />
          ))}
        </div>

        {/* Announcement Message Content */}
        {announcement.message && (
          <div className="p-6 rounded-2xl bg-black/40 border border-white/10 mb-6">
            <p className="text-lg sm:text-2xl font-medium text-slate-100 leading-relaxed text-center">
              "{announcement.message}"
            </p>
          </div>
        )}

        {/* Emergency Specific Instructions */}
        {isEmergency && announcement.emergencyType === 'lockdown' && (
          <div className="p-4 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-200 text-sm font-semibold text-center">
            LOCK ALL DOORS • TURN OFF LIGHTS • REMAIN SILENT • MOVE OUT OF SIGHT
          </div>
        )}

        {isEmergency && announcement.emergencyType === 'evacuation' && (
          <div className="p-4 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-200 text-sm font-semibold text-center">
            EVACUATE BUILDING CALMLY • USE NEAREST EMERGENCY EXIT • REPORT TO ASSEMBLY POST
          </div>
        )}

        {/* Bottom Status / Countdown */}
        <div className="mt-6 flex items-center justify-between text-xs text-slate-400 border-t border-white/10 pt-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Classroom Speaker Active</span>
          </div>

          <div>
            {countdown !== null ? (
              <span>Auto-dismissing in {countdown}s</span>
            ) : (
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Live Broadcast In Progress
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
