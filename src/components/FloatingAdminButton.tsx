/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface FloatingAdminButtonProps {
  onClick: () => void;
}

export const FloatingAdminButton: React.FC<FloatingAdminButtonProps> = ({ onClick }) => {
  return (
    <aside aria-label="Admin quick action" className="fixed bottom-5 right-5 z-40">
      <button
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
