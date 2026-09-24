// Web Audio API Synthesizer for School Bells, Chimes, and Emergency Sirens
import { ChimeType, EmergencyType } from '../types';

let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play a two-tone ding-dong attention chime (standard PA prelude)
 */
export function playAttentionChime(volume = 0.8): Promise<void> {
  return new Promise((resolve) => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume * 0.4, now);
    masterGain.connect(ctx.destination);

    // Tone 1: 784 Hz (G5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(783.99, now);
    gain1.gain.setValueAtTime(0.7, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc1.connect(gain1);
    gain1.connect(masterGain);

    // Tone 2: 587.33 Hz (D5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(587.33, now + 0.35);
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.setValueAtTime(0.8, now + 0.35);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
    osc2.connect(gain2);
    gain2.connect(masterGain);

    osc1.start(now);
    osc1.stop(now + 1.0);
    osc2.start(now + 0.35);
    osc2.stop(now + 1.5);

    setTimeout(resolve, 1500);
  });
}

/**
 * Play Westminster Chime (classic 4-note melodic bell chime)
 */
export function playWestminsterChime(volume = 0.8): Promise<void> {
  return new Promise((resolve) => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume * 0.4, now);
    masterGain.connect(ctx.destination);

    // Notes: E4, G#4, F#4, B3
    const notes = [
      { freq: 329.63, start: 0, dur: 0.8 },
      { freq: 415.30, start: 0.7, dur: 0.8 },
      { freq: 369.99, start: 1.4, dur: 0.8 },
      { freq: 246.94, start: 2.1, dur: 1.6 },
    ];

    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, now + n.start);

      // Add slight harmonic overtone for chime richness
      const overtone = ctx.createOscillator();
      const otGain = ctx.createGain();
      overtone.type = 'triangle';
      overtone.frequency.setValueAtTime(n.freq * 2, now + n.start);
      otGain.gain.setValueAtTime(0.2, now + n.start);
      otGain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);
      overtone.connect(otGain);
      otGain.connect(masterGain);

      gain.gain.setValueAtTime(0.8, now + n.start);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now + n.start);
      osc.stop(now + n.start + n.dur + 0.1);
      overtone.start(now + n.start);
      overtone.stop(now + n.start + n.dur + 0.1);
    });

    setTimeout(resolve, 4000);
  });
}

/**
 * Play authentic School Period Dismissal Bell (resonant vibrating electric bell)
 */
export function playPeriodBell(volume = 0.8, durationSec = 3.0): Promise<void> {
  return new Promise((resolve) => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume * 0.35, now);
    masterGain.connect(ctx.destination);

    // Bell body fundamental
    const bellFreqs = [740, 920, 1180, 1420];
    const oscillators: OscillatorNode[] = [];

    bellFreqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      // Rapid amplitude modulation (clapper strike rate ~ 18Hz)
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(18, now);
      lfoGain.gain.setValueAtTime(0.4, now);
      lfo.connect(lfoGain.gain);

      gain.gain.setValueAtTime(0.6, now);
      gain.gain.setValueAtTime(0.6, now + durationSec);
      gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec + 0.8);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + durationSec + 1.0);
      lfo.start(now);
      lfo.stop(now + durationSec + 1.0);
      oscillators.push(osc);
    });

    setTimeout(resolve, (durationSec + 1.0) * 1000);
  });
}

/**
 * Play Morning Greeting Bell (bright rising arpeggio)
 */
export function playMorningChime(volume = 0.8): Promise<void> {
  return new Promise((resolve) => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume * 0.4, now);
    masterGain.connect(ctx.destination);

    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    freqs.forEach((freq, idx) => {
      const start = idx * 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0.8, now + start);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + 1.2);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now + start);
      osc.stop(now + start + 1.3);
    });

    setTimeout(resolve, 2500);
  });
}

/**
 * Play Lunch Announcement Bell (playful two-chord chime)
 */
export function playLunchChime(volume = 0.8): Promise<void> {
  return new Promise((resolve) => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume * 0.4, now);
    masterGain.connect(ctx.destination);

    const chord1 = [440, 554.37, 659.25]; // A major
    const chord2 = [587.33, 739.99, 880];   // D major

    chord1.forEach((f) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.9);
    });

    chord2.forEach((f) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + 0.45);
      gain.gain.setValueAtTime(0.6, now + 0.45);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now + 0.45);
      osc.stop(now + 1.9);
    });

    setTimeout(resolve, 2200);
  });
}

/**
 * Dispatch specific school chime by type
 */
export function playChimeByType(type: ChimeType, volume = 0.8): Promise<void> {
  switch (type) {
    case 'attention':
      return playAttentionChime(volume);
    case 'westminster':
      return playWestminsterChime(volume);
    case 'period_bell':
      return playPeriodBell(volume);
    case 'morning':
      return playMorningChime(volume);
    case 'lunch':
      return playLunchChime(volume);
    default:
      return playAttentionChime(volume);
  }
}

/**
 * Play Emergency Alert Sirens
 */
export function playEmergencyTone(type: EmergencyType, volume = 0.9): { stop: () => void; promise: Promise<void> } {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(volume * 0.5, now);
  masterGain.connect(ctx.destination);

  let active = true;
  let timerId: any = null;

  const stop = () => {
    active = false;
    if (timerId) clearTimeout(timerId);
    try {
      masterGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    } catch {
      // ignore
    }
  };

  const promise = new Promise<void>((resolve) => {
    if (type === 'lockdown') {
      // Rapid intermittent high-low emergency tone
      const cycleDuration = 0.6;
      const totalCycles = 7; // ~4.2 seconds
      for (let i = 0; i < totalCycles; i++) {
        const t = now + i * cycleDuration;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(950, t);
        osc.frequency.setValueAtTime(650, t + cycleDuration / 2);
        gain.gain.setValueAtTime(0.6, t);
        gain.gain.setValueAtTime(0.6, t + cycleDuration - 0.05);
        gain.gain.linearRampToValueAtTime(0.001, t + cycleDuration);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + cycleDuration);
      }
      timerId = setTimeout(() => {
        resolve();
      }, totalCycles * cycleDuration * 1000);
    } else if (type === 'evacuation') {
      // Classic fire alarm horn sweep (continuous ramping tone)
      const sweeps = 5;
      const sweepTime = 0.8;
      for (let i = 0; i < sweeps; i++) {
        const t = now + i * sweepTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(1400, t + sweepTime - 0.1);
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.setValueAtTime(0.5, t + sweepTime - 0.1);
        gain.gain.linearRampToValueAtTime(0.001, t + sweepTime);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + sweepTime);
      }
      timerId = setTimeout(resolve, sweeps * sweepTime * 1000);
    } else if (type === 'severe_weather') {
      // Rising and falling tornado / civil defense siren
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.linearRampToValueAtTime(850, now + 1.8);
      osc.frequency.linearRampToValueAtTime(450, now + 3.6);
      gain.gain.setValueAtTime(0.7, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 4.2);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 4.2);
      timerId = setTimeout(resolve, 4200);
    } else if (type === 'medical') {
      // Fast alert pulse (three quick beeps, pause, repeated)
      for (let i = 0; i < 3; i++) {
        const cycleStart = now + i * 1.0;
        for (let j = 0; j < 3; j++) {
          const t = cycleStart + j * 0.18;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1100, t);
          gain.gain.setValueAtTime(0.7, t);
          gain.gain.linearRampToValueAtTime(0.001, t + 0.12);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(t);
          osc.stop(t + 0.13);
        }
      }
      timerId = setTimeout(resolve, 3200);
    } else {
      // All clear: bright peaceful ascending chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(1040, now + 1.2);
      gain.gain.setValueAtTime(0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 2.1);
      timerId = setTimeout(resolve, 2200);
    }
  });

  return { stop, promise };
}

/**
 * Text-to-Speech synthesizer using Web Speech API
 */
export function speakText(text: string, rate = 1.0, voiceIndex = 0): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported');
      return resolve();
    }

    window.speechSynthesis.cancel(); // cancel any active speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      // Prefer English voice
      const englishVoice = voices.find((v) => v.lang.startsWith('en') && !v.name.includes('Google')) || voices[0];
      utterance.voice = englishVoice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    window.speechSynthesis.speak(utterance);
  });
}
