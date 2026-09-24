import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, Smartphone, X, Check, HelpCircle } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'compact' | 'full';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'compact',
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Close modal on Escape key and prevent background scrolling while open
  useEffect(() => {
    if (!showGuideModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowGuideModal(false);
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showGuideModal]);

  // If already running as standalone installed app, don't display
  if (isInstalled) {
    return null;
  }

  const modalContent = showGuideModal && typeof document !== 'undefined' ? (
    createPortal(
      <div
        id="android-guide-modal-backdrop"
        onClick={() => setShowGuideModal(false)}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-200"
      >
        <div
          id="android-guide-modal-card"
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-white max-h-[88vh] flex flex-col overflow-hidden my-auto"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0 bg-slate-900/90">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white truncate">
                  Run on Android &amp; IFB Panels
                </h3>
                <p className="text-[11px] text-slate-400 truncate">
                  Native app installation &amp; LAN setup
                </p>
              </div>
            </div>
            <button
              id="close-android-guide-btn"
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 ml-2"
              aria-label="Close Android setup guide"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Scrollable Body */}
          <div className="p-6 overflow-y-auto modal-scrollable flex-1 space-y-4 text-xs">
            {/* Option 1: PWA Add to Home Screen */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center gap-2 font-bold text-slate-200 mb-2">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] shrink-0 font-bold">
                  1
                </span>
                <span className="text-sm">Install as Native App (Chrome on Android)</span>
              </div>
              <p className="text-slate-400 leading-relaxed pl-7">
                Open this URL in <strong>Google Chrome</strong> or <strong>Edge</strong> on your Android phone or IFB smart panel:
              </p>
              <ol className="list-decimal pl-12 mt-2 space-y-1.5 text-slate-300">
                <li>Tap the browser menu (<strong>⋮</strong> three vertical dots in top right).</li>
                <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
                <li>Tap <strong>Install</strong>. The app will launch full-screen with its own icon on your Android home screen!</li>
              </ol>
            </div>

            {/* Option 2: Connect via School Wi-Fi */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center gap-2 font-bold text-slate-200 mb-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] shrink-0 font-bold">
                  2
                </span>
                <span className="text-sm">Connect to Linux Server via School Wi-Fi</span>
              </div>
              <p className="text-slate-400 leading-relaxed pl-7">
                Make sure your Android device is on the same local Wi-Fi / LAN network as your Linux PA Server, then enter:
              </p>
              <div className="mt-2 ml-7 p-2.5 rounded-xl bg-slate-900 border border-slate-700 font-mono text-[11px] text-indigo-300 text-center select-all break-all">
                http://&lt;LINUX_PC_IP&gt;:3000
              </div>
            </div>

            {/* Option 3: Run Server directly on Android via Termux */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center gap-2 font-bold text-slate-200 mb-2">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[11px] shrink-0 font-bold">
                  3
                </span>
                <span className="text-sm">Want to host the Server on Android? (Termux)</span>
              </div>
              <p className="text-slate-400 leading-relaxed pl-7">
                You can host the central Node.js server directly on an Android device using the free <strong>Termux</strong> terminal app:
              </p>
              <div className="mt-2 ml-7 p-2.5 rounded-xl bg-slate-900 border border-slate-700 font-mono text-[11px] text-slate-300 space-y-1 select-all">
                <div>pkg update &amp;&amp; pkg install nodejs git</div>
                <div>npm install</div>
                <div>npm start</div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/90 shrink-0">
            <button
              id="dismiss-android-guide-btn"
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] font-bold text-xs text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
  ) : null;

  return (
    <>
      {isInstallable ? (
        <button
          id="pwa-install-app-btn"
          type="button"
          onClick={install}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition-all ${className}`}
          title="Install School PA App on Android phone, tablet or IFB panel"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{variant === 'full' ? 'Install Android / PWA App' : 'Install App'}</span>
        </button>
      ) : (
        <button
          id="pwa-guide-btn"
          type="button"
          onClick={() => setShowGuideModal(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white border border-slate-800 transition-colors ${className}`}
          title="How to install or run on Android"
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Android Guide</span>
          <span className="sm:hidden">Android</span>
        </button>
      )}

      {/* Android Installation Modal Guide Portaled to document.body */}
      {modalContent}
    </>
  );
};
