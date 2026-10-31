/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShoppingBag, Search, Sparkles, LayoutDashboard, User as UserIcon, Menu as MenuIcon } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  onGoHome: () => void;
  onOpenAdmin: () => void;
  onOpenTracking: () => void;
  onOpenAccount: () => void;
  onOpenLogin: () => void;
  onOpenMenu: () => void;
  onOpenAiAssistant: () => void;
  onOpenAbout: () => void;
  onOpenVideoGallery?: () => void;
  onOpenPrivacy: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isAdmin?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onGoHome,
  onOpenAdmin,
  onOpenTracking,
  onOpenAccount,
  onOpenMenu,
  onOpenAiAssistant,
  onOpenAbout,
  onOpenVideoGallery,
  onOpenPrivacy,
  searchQuery,
  onSearchChange,
  isAdmin = false,
}) => {
  const { itemCount, setIsCartOpen } = useCart();
  const { userProfile } = useAuth();
  const [showSearch, setShowSearch] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const brandLogoUrl = '/assets/aistudio/Gemini_Generated_Image_4bi49x4bi49x4bi4_b4aaa34e.jpg';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-rose-100 shadow-xs">
      {/* Main Navigation Bar */}
      <div className="w-full px-2.5 sm:px-6 lg:px-8 py-2.5 sm:py-3">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Logo & Brand Zone */}
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onGoHome();
              }}
              className="flex flex-col items-start group"
            >
              <div className="flex items-center gap-1.5">
                {!logoFailed ? (
                  <img
                    src={brandLogoUrl}
                    alt="Dokandari"
                    className="h-8 sm:h-11 w-auto object-contain"
                    referrerPolicy="no-referrer"
                    onError={() => setLogoFailed(true)}
                  />
                ) : (
                  <span className="text-lg sm:text-2xl font-black text-[#E11D48] tracking-tight">
                    Dokandari
                  </span>
                )}
              </div>
              <span className="text-[10px] sm:text-[11px] font-medium text-rose-600 tracking-tight mt-0.5 truncate max-w-[165px] sm:max-w-none">
                আপনার সৌন্দর্য আমাদের ঐতিহ্য
              </span>
            </a>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden xl:flex items-center gap-2 text-xs font-semibold">
            <button
              onClick={onGoHome}
              className="px-3.5 py-1.5 rounded-full bg-[#E11D48] text-white shadow-xs transition-colors cursor-pointer"
            >
              হোম
            </button>

            <button
              onClick={onOpenTracking}
              className="px-3 py-1.5 text-stone-700 hover:text-rose-600 transition-colors cursor-pointer"
            >
              অর্ডার ট্র্যাকিং
            </button>

            <button
              onClick={onOpenAbout}
              className="px-3 py-1.5 text-stone-700 hover:text-rose-600 transition-colors cursor-pointer"
            >
              ব্র্যান্ড পরিচিতি
            </button>

            <button
              onClick={onOpenVideoGallery || onOpenTracking}
              className="px-3 py-1.5 text-stone-700 hover:text-rose-600 transition-colors cursor-pointer"
            >
              ভিডিও গ্যালারি
            </button>

            <button
              onClick={onOpenPrivacy}
              className="px-3 py-1.5 text-stone-700 hover:text-rose-600 transition-colors cursor-pointer"
            >
              প্রাইভেসি পলিসি
            </button>

            <button
              onClick={onOpenAiAssistant}
              className="px-3 py-1.5 text-[#E11D48] hover:bg-rose-50 rounded-full flex items-center gap-1 transition-colors cursor-pointer font-bold"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#E11D48]" />
              <span>AI সহকারী</span>
            </button>

            {/* Admin Dashboard Button ONLY shown when Admin is logged in */}
            {isAdmin && (
              <button
                onClick={onOpenAdmin}
                className="px-3.5 py-1.5 rounded-full bg-rose-50 hover:bg-[#E11D48] text-[#E11D48] hover:text-white border border-rose-200 flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer font-bold"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>এডমিন ড্যাশবোর্ড</span>
              </button>
            )}
          </nav>

          {/* Right Action Affordances: Search + Cart + Prominent Menu Button */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Search Button */}
            {showSearch ? (
              <div className="flex items-center bg-stone-100 rounded-full px-2.5 py-1 border border-stone-300">
                <Search className="w-3.5 h-3.5 text-stone-400 mr-1.5 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="পণ্য খুঁজুন..."
                  className="w-24 sm:w-44 text-xs bg-transparent focus:outline-none"
                  autoFocus
                  onBlur={() => !searchQuery && setShowSearch(false)}
                />
                <button
                  onClick={() => {
                    onSearchChange('');
                    setShowSearch(false);
                  }}
                  className="text-stone-400 text-xs ml-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSearch(true)}
                className="p-2 rounded-xl bg-rose-50/70 hover:bg-rose-100 text-stone-700 hover:text-[#E11D48] border border-rose-100 transition-colors cursor-pointer"
                title="পণ্য খুঁজুন"
              >
                <Search className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}

            {/* Logged-in Customer Profile Pill (only if customer is already logged in, on sm+ screens) */}
            {userProfile && (
              <button
                onClick={onOpenAccount}
                className="hidden sm:flex px-3 py-1.5 text-xs font-semibold rounded-xl border border-rose-200 hover:border-rose-400 text-stone-700 hover:bg-rose-50 items-center gap-1.5 cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5 text-[#E11D48]" />
                <span className="max-w-20 truncate">
                  {userProfile.displayName?.toLowerCase().includes('dokandari')
                    ? 'অ্যাডমিন'
                    : userProfile.displayName.split(' ')[0]}
                </span>
              </button>
            )}

            {/* Cart Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 rounded-xl bg-rose-50/70 hover:bg-rose-100 text-stone-700 hover:text-[#E11D48] border border-rose-100 transition-colors cursor-pointer"
              title="শপিং ব্যাগ"
            >
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#E11D48] text-white text-[10px] font-bold rounded-full flex items-center justify-center tabular-nums shadow-2xs">
                  {itemCount}
                </span>
              )}
            </button>

            {/* Prominent Menu Button (Opens Full Store Menu Drawer with all Pages, Categories & Product Links) */}
            <button
              type="button"
              onClick={onOpenMenu}
              aria-label="সম্পূর্ণ মেনু খুলুন"
              className="px-3 sm:px-4 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] active:scale-95 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
            >
              <MenuIcon className="w-4 h-4 text-white shrink-0" />
              <span>মেনু</span>
            </button>
          </div>

        </div>

      </div>
    </header>
  );
};

