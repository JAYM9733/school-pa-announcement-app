import React, { useState } from 'react';
import {
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  X,
  Shield,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { wsClient } from '../utils/wsClient';
import { TransmitterLockConfig } from '../types';

interface ChangeTransmitterLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newPassword: string) => void;
  currentSavedPassword?: string;
  sourceRole: 'principal' | 'server';
  actorName?: string;
}

export const ChangeTransmitterLockModal: React.FC<ChangeTransmitterLockModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentSavedPassword = '8888',
  sourceRole,
  actorName = 'Administrator',
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validation
    const effectiveCurrent = currentSavedPassword || '8888';
    if (sourceRole === 'principal') {
      if (!currentPassword) {
        setErrorMsg('Please enter your current lock password.');
        return;
      }
      if (currentPassword !== effectiveCurrent) {
        setErrorMsg('Current lock password does not match.');
        return;
      }
    }

    const trimmedNew = newPassword.trim();
    if (trimmedNew.length < 4) {
      setErrorMsg('New password must be at least 4 characters or digits.');
      return;
    }

    if (trimmedNew !== confirmPassword.trim()) {
      setErrorMsg('New password and confirmation do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Send to central REST API
      const res = await fetch('/api/transmitter-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPassword: trimmedNew,
          currentPassword: sourceRole === 'principal' ? currentPassword : undefined,
          updatedBy: `${actorName} (${sourceRole === 'server' ? 'Central Server' : 'Transmitter Console'})`,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update lock password on server.');
      }

      // 2. Also broadcast via WebSocket for immediate real-time synchronization
      wsClient.send({
        type: 'transmitter_lock_update',
        payload: {
          newPassword: trimmedNew,
          updatedBy: `${actorName} (${sourceRole === 'server' ? 'Central Server' : 'Transmitter'})`,
        },
      });

      // 3. Persist locally as fallback
      localStorage.setItem('pa_transmitter_lock_pin', trimmedNew);
      localStorage.setItem('pa_admin_pin', trimmedNew);

      setSuccessMsg('Transmitter lock password updated and synchronized across the school network!');
      setTimeout(() => {
        onSuccess(trimmedNew);
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while updating the password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetToDefault = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setConfirmReset(false);

    try {
      await fetch('/api/transmitter-lock/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updatedBy: `${actorName} (Reset to 8888)`,
        }),
      });

      wsClient.send({
        type: 'transmitter_lock_update',
        payload: {
          newPassword: '8888',
          updatedBy: `${actorName} (Reset to 8888)`,
        },
      });

      localStorage.setItem('pa_transmitter_lock_pin', '8888');
      localStorage.setItem('pa_admin_pin', '8888');

      setSuccessMsg('Reset to default password "8888" successfully!');
      setTimeout(() => {
        onSuccess('8888');
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reset password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="change-lock-password-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
    >
      <div
        id="change-lock-password-card"
        className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl p-6 sm:p-7 text-white relative overflow-hidden"
      >
        {/* Accent Glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Change Transmitter Lock Password
              </h3>
              <p className="text-xs text-slate-400">
                {sourceRole === 'server'
                  ? 'Central Linux Host • Master Security Policy'
                  : 'Console Security • Principal Authority'}
              </p>
            </div>
          </div>
          <button
            id="close-change-password-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Current Password Field (for Principal role) */}
          {sourceRole === 'principal' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Current Lock Password *</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  {currentSavedPassword && currentSavedPassword !== '8888' ? 'Your active custom password' : 'Default: 8888'}
                </span>
              </label>
              <div className="relative">
                <input
                  id="input-current-lock-password"
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  autoComplete="off"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {sourceRole === 'server' && (
            <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-300 flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                As Central Linux Server Administrator, you hold master root authority to override and update the transmitter lock password without entering the previous code.
              </span>
            </div>
          )}

          {/* New Password Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              New Lock Password *
            </label>
            <div className="relative">
              <input
                id="input-new-lock-password"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new 4+ digit PIN or password"
                autoComplete="new-password"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Supports 4-to-8 digit numeric PINs (e.g. 5432) or alphanumeric passwords (e.g. SchoolAdmin26).
            </p>
          </div>

          {/* Confirm New Password Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Confirm New Password *
            </label>
            <div className="relative">
              <input
                id="input-confirm-lock-password"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Quick Digit Shortcuts */}
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Quick PIN preset suggestions:</span>
            <div className="flex items-center gap-1.5 font-mono">
              {['2026', '9900', '1234', '7788'].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setNewPassword(suggestion);
                    setConfirmPassword(suggestion);
                  }}
                  className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-indigo-900/60 hover:text-indigo-200 text-slate-300 border border-slate-800 text-[11px] transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              id="reset-password-default-btn"
              onClick={handleResetToDefault}
              disabled={isSubmitting}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                confirmReset
                  ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
              }`}
              title="Reset to default code 8888"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{confirmReset ? 'Confirm Reset (8888)?' : 'Reset to 8888'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="save-new-lock-password-btn"
                disabled={isSubmitting || !newPassword || !confirmPassword}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none text-xs font-bold text-white shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all active:scale-95"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Saving & Syncing...' : 'Save New Password'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
