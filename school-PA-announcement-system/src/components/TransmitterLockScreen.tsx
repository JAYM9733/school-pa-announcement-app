import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  KeyRound,
  Shield,
  Eye,
  EyeOff,
  AlertCircle,
  Radio,
  Clock,
  Settings,
  Delete,
  Check,
} from 'lucide-react';

interface TransmitterLockScreenProps {
  isLocked: boolean;
  onUnlock: () => void;
  savedPassword: string;
  transmitterName: string;
  onOpenChangePassword: () => void;
}

export const TransmitterLockScreen: React.FC<TransmitterLockScreenProps> = ({
  isLocked,
  onUnlock,
  savedPassword,
  transmitterName,
  onOpenChangePassword,
}) => {
  const [enteredPass, setEnteredPass] = useState('');
  const [showText, setShowText] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  if (!isLocked) return null;

  const verifyAndUnlock = (passToVerify: string) => {
    const effectivePass = savedPassword || localStorage.getItem('pa_transmitter_lock_pin') || '8888';
    if (passToVerify === effectivePass) {
      setHasError(false);
      setErrorText(null);
      setEnteredPass('');
      onUnlock();
    } else {
      setHasError(true);
      setErrorText('Incorrect password. Please try again.');
      setTimeout(() => {
        setEnteredPass('');
        setHasError(false);
      }, 900);
    }
  };

  const handleDigitClick = (digit: string) => {
    if (enteredPass.length < 12) {
      const next = enteredPass + digit;
      setEnteredPass(next);
      setHasError(false);
      setErrorText(null);

      const effectivePass = savedPassword || localStorage.getItem('pa_transmitter_lock_pin') || '8888';
      // Auto-unlock if matching 4-digit PIN
      if (next.length === 4 && next === effectivePass) {
        verifyAndUnlock(next);
      }
    }
  };

  const handleDelete = () => {
    setEnteredPass((prev) => prev.slice(0, -1));
    setHasError(false);
    setErrorText(null);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enteredPass) return;
    verifyAndUnlock(enteredPass);
  };

  return (
    <div
      id="transmitter-lock-screen"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-xl p-4 sm:p-6 text-white select-none animate-in fade-in duration-300"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -translate-y-1/2 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl p-6 sm:p-8 flex flex-col items-center relative z-10">
        {/* Lock Icon Emblem */}
        <div
          className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-4 transition-all duration-300 ${
            hasError
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-shake'
              : 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
          }`}
        >
          <Lock className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-black text-white tracking-tight text-center">
          Transmitter Console Locked
        </h2>
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-400 font-medium text-center">
          <Radio className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="truncate max-w-[200px]">{transmitterName}</span>
        </div>

        <p className="mt-2 text-xs text-slate-400 text-center leading-relaxed">
          Enter transmitter lock password or PIN to unlock broadcasting and emergency alert controls.
        </p>

        {/* Error notice */}
        {errorText && (
          <div className="mt-3 p-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-1.5 animate-in fade-in">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorText}</span>
          </div>
        )}

        {/* Input & Form */}
        <form onSubmit={handleFormSubmit} className="w-full mt-4">
          <div className="relative w-full">
            <input
              id="transmitter-unlock-input"
              type={showText ? 'text' : 'password'}
              value={enteredPass}
              onChange={(e) => {
                setEnteredPass(e.target.value);
                setHasError(false);
                setErrorText(null);
              }}
              placeholder="Enter PIN / Password"
              autoFocus
              className={`w-full px-4 py-3 rounded-2xl bg-slate-950 border text-center text-lg font-mono tracking-widest text-white placeholder-slate-600 focus:outline-none focus:ring-2 transition-all ${
                hasError
                  ? 'border-rose-500 focus:ring-rose-500'
                  : 'border-slate-700 focus:ring-indigo-500'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowText(!showText)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
            >
              {showText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="submit"
            id="transmitter-unlock-submit-btn"
            disabled={!enteredPass}
            className="w-full mt-3 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Unlock className="w-4 h-4" />
            <span>Unlock Console</span>
          </button>
        </form>

        {/* Touch Numeric Keypad */}
        <div className="w-full grid grid-cols-3 gap-2.5 mt-5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              id={`keypad-${digit}`}
              onClick={() => handleDigitClick(digit)}
              className="py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-base font-bold font-mono text-slate-100 border border-slate-700/60 shadow-sm transition-all"
            >
              {digit}
            </button>
          ))}

          <button
            type="button"
            id="keypad-clear"
            onClick={() => setEnteredPass('')}
            className="py-3 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-xs font-semibold text-slate-400 border border-slate-800 transition-colors"
          >
            Clear
          </button>

          <button
            type="button"
            id="keypad-0"
            onClick={() => handleDigitClick('0')}
            className="py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-base font-bold font-mono text-slate-100 border border-slate-700/60 shadow-sm transition-all"
          >
            0
          </button>

          <button
            type="button"
            id="keypad-delete"
            onClick={handleDelete}
            className="py-3 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 flex items-center justify-center transition-colors"
          >
            <Delete className="w-4 h-4" />
          </button>
        </div>

        {/* Change Password Link */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 w-full flex items-center justify-between text-xs">
          <span className="text-slate-400">
            {savedPassword && savedPassword !== '8888' ? 'Custom password configured' : 'Default: 8888'}
          </span>
          <button
            id="open-change-password-from-lock-btn"
            type="button"
            onClick={onOpenChangePassword}
            className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1.5 transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Change Lock Password</span>
          </button>
        </div>
      </div>
    </div>
  );
};
