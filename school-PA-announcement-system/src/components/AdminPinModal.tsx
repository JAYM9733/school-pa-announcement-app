import React, { useState } from 'react';
import { Lock, X, Check, ShieldAlert, KeyRound } from 'lucide-react';

interface AdminPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = 'Administrator PIN Required',
  description = 'This receiver panel is locked to prevent classroom tampering. Enter installer PIN to proceed.',
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      setError(false);
      if (newPin.length === 4) {
        verifyPin(newPin);
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  };

  const handleClear = () => {
    setPin('');
    setError(false);
  };

  const verifyPin = (code: string) => {
    const configuredPin =
      localStorage.getItem('pa_transmitter_lock_pin') ||
      localStorage.getItem('pa_admin_pin') ||
      '8888';

    // Strict validation: Must match the configured PIN exactly!
    // Never allow the default '8888' bypass if a custom PIN is configured.
    if (code === configuredPin) {
      setTimeout(() => {
        setPin('');
        setError(false);
        onSuccess();
      }, 150);
    } else {
      setError(true);
      setTimeout(() => {
        setPin('');
      }, 800);
    }
  };

  return (
    <div
      id="admin-pin-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div
        id="admin-pin-card"
        className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 text-white"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">{title}</h3>
              <p className="text-xs text-slate-400">Security Gate</p>
            </div>
          </div>
          <button
            id="close-pin-modal-btn"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="mt-4 text-xs text-slate-400 leading-relaxed">{description}</p>

        {/* PIN Indicators */}
        <div className="my-6 flex justify-center gap-4">
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            return (
              <div
                key={index}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  error
                    ? 'bg-rose-500 scale-110 animate-shake'
                    : isFilled
                    ? 'bg-indigo-400 scale-110 shadow-[0_0_12px_rgba(129,140,248,0.6)]'
                    : 'bg-slate-700'
                }`}
              />
            );
          })}
        </div>

        {error && (
          <div className="mb-4 flex items-center justify-center gap-1.5 text-xs text-rose-400 font-medium">
            <ShieldAlert className="w-4 h-4" />
            <span>Incorrect PIN. Please try again.</span>
          </div>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              id={`pin-btn-${num}`}
              onClick={() => handleDigit(num)}
              className="h-13 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-indigo-600 active:scale-95 text-xl font-medium text-slate-100 border border-slate-700/60 transition-all flex items-center justify-center"
            >
              {num}
            </button>
          ))}
          <button
            id="pin-clear-btn"
            onClick={handleClear}
            className="h-13 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-xs font-medium text-slate-400 border border-slate-800 transition-all flex items-center justify-center"
          >
            Clear
          </button>
          <button
            id="pin-btn-0"
            onClick={() => handleDigit('0')}
            className="h-13 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-indigo-600 active:scale-95 text-xl font-medium text-slate-100 border border-slate-700/60 transition-all flex items-center justify-center"
          >
            0
          </button>
          <button
            id="pin-delete-btn"
            onClick={handleDelete}
            className="h-13 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-xs font-medium text-slate-400 border border-slate-800 transition-all flex items-center justify-center"
          >
            Del
          </button>
        </div>

        <div className="mt-5 p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/40 text-center">
          <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
            {localStorage.getItem('pa_transmitter_lock_pin') || localStorage.getItem('pa_admin_pin')
              ? 'Enter your school custom administrator PIN'
              : <>Default technician PIN: <span className="font-mono font-bold text-indigo-300">8888</span></>}
          </p>
        </div>
      </div>
    </div>
  );
};
