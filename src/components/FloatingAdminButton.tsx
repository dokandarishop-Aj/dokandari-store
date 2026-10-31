/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShieldCheck, EyeOff, RefreshCw, Check } from 'lucide-react';
import { syncAllLocalProductsToFirestore } from '../lib/storeSync';

interface FloatingAdminButtonProps {
  onClick: () => void;
  onExitAdminMode?: () => void;
}

export const FloatingAdminButton: React.FC<FloatingAdminButtonProps> = ({
  onClick,
  onExitAdminMode,
}) => {
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);

  const handleLiveSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/catalog/recover-real-images', { method: 'POST' }).catch(() => null);
      await syncAllLocalProductsToFirestore();
      setSyncDone(true);
      setTimeout(() => setSyncDone(false), 3000);
    } catch (err) {
      console.warn('Live sync note:', err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <aside
      aria-label="Admin quick action"
      className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2"
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleLiveSync}
          disabled={syncing}
          className="px-3 py-1.5 bg-white/95 hover:bg-rose-50 text-[#E11D48] border border-rose-200 font-bold text-[11px] rounded-full shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
          title="প্রিভিউ ও আসল ডোমেইনের সকল প্রোডাক্ট ছবি লাইভ ফায়ারস্টোরে সিঙ্ক করুন"
        >
          {syncDone ? (
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          )}
          <span>{syncDone ? 'সিঙ্ক সম্পন্ন!' : syncing ? 'সিঙ্ক হচ্ছে...' : 'লাইভ ছবি সিঙ্ক'}</span>
        </button>

        {onExitAdminMode && (
          <button
            type="button"
            onClick={onExitAdminMode}
            className="px-3 py-1.5 bg-stone-900/90 hover:bg-stone-950 text-white font-bold text-[11px] rounded-full shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
            title="কাস্টমার ভিউ দেখুন (সকল এডিট ও Admin Control বাটন লুকিয়ে ফেলুন)"
          >
            <EyeOff className="w-3.5 h-3.5 text-rose-300" />
            <span>কাস্টমার ভিউ</span>
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onClick}
        className="group flex items-center gap-2 pl-2 pr-4 py-2 bg-gradient-to-r from-[#E11D48] to-[#BE123C] hover:from-[#BE123C] hover:to-[#9F1239] text-white font-bold text-xs rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 border border-rose-300/50 cursor-pointer"
        title="Open Admin Hub"
      >
        <div className="w-7 h-7 rounded-full bg-white/20 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
          <ShieldCheck className="w-4 h-4 text-white" />
        </div>
        <span className="font-extrabold tracking-wide">Admin Control</span>
      </button>
    </aside>
  );
};

