/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShoppingBag, Search, Sparkles, LayoutDashboard, User as UserIcon, Menu as MenuIcon, X } from 'lucide-react';
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
}

export const Header: React.FC<HeaderProps> = ({
  onGoHome,
  onOpenAdmin,
  onOpenTracking,
  onOpenAccount,
  onOpenLogin,
  onOpenMenu,
  onOpenAiAssistant,
  onOpenAbout,
  onOpenVideoGallery,
  onOpenPrivacy,
  searchQuery,
  onSearchChange,
}) => {
  const { itemCount, setIsCartOpen } = useCart();
  const { userProfile } = useAuth();
  const [showSearch, setShowSearch] = useState(false);

  const brandLogoUrl = '/assets/aistudio/Gemini_Generated_Image_4bi49x4bi49x4bi4_b4aaa34e.jpg';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-rose-100 shadow-xs">
      {/* Main Navigation Bar */}
      <div className="w-full px-3 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          
          {/* Logo & Brand Zone */}
          <div className="flex items-center gap-3 shrink-0">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onGoHome();
              }}
              className="flex flex-col items-start group"
            >
              <div className="flex items-center gap-2">
                <img
                  src={brandLogoUrl}
                  alt="Dokandari"
                  className="h-10 sm:h-12 w-auto object-contain"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    // Fallback to text logo if image fails
                    const target = e.currentTarget;
                    target.style.display = 'none';
                  }}
                />
              </div>
              <span className="text-[11px] font-medium text-rose-600 tracking-tight mt-0.5">
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

            {/* Admin Dashboard Button in Brand Crimson */}
            <button
              onClick={onOpenAdmin}
              className="px-3.5 py-1.5 rounded-full bg-rose-50 hover:bg-[#E11D48] text-[#E11D48] hover:text-white border border-rose-200 flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer font-bold"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>এডমিন ড্যাশবোর্ড</span>
            </button>
          </nav>

          {/* Right Action Affordances */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Search Button */}
            {showSearch ? (
              <div className="flex items-center bg-stone-100 rounded-full px-3 py-1 border border-stone-300">
                <Search className="w-3.5 h-3.5 text-stone-400 mr-2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="খুঁজুন..."
                  className="w-28 sm:w-44 text-xs bg-transparent focus:outline-none"
                  autoFocus
                  onBlur={() => !searchQuery && setShowSearch(false)}
                />
                <button onClick={() => setShowSearch(false)} className="text-stone-400 text-xs">
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSearch(true)}
                className="p-2 text-stone-600 hover:text-rose-600 transition-colors cursor-pointer"
                title="Search Products"
              >
                <Search className="w-5 h-5" />
              </button>
            )}

            {/* Login / Profile Button */}
            {userProfile ? (
              <button
                onClick={onOpenAccount}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-full border border-rose-200 hover:border-rose-400 text-stone-700 hover:bg-rose-50 flex items-center gap-1.5 cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5 text-[#E11D48]" />
                <span className="max-w-24 truncate">
                  {userProfile.displayName?.toLowerCase().includes('dokandari')
                    ? 'অ্যাডমিন প্রোফাইল'
                    : userProfile.displayName.split(' ')[0]}
                </span>
              </button>
            ) : (
              <button
                onClick={onOpenLogin}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-full border border-stone-300 hover:border-stone-400 text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer"
              >
                লগইন
              </button>
            )}

            {/* Cart Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 text-stone-700 hover:text-rose-600 transition-colors cursor-pointer"
              title="Shopping Bag"
            >
              <ShoppingBag className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-[#E11D48] text-white text-[10px] font-bold rounded-full flex items-center justify-center tabular-nums">
                  {itemCount}
                </span>
              )}
            </button>

            {/* Menu Button (Opens full MenuDrawer) */}
            <button
              onClick={onOpenMenu}
              className="px-3 py-1.5 rounded-full border border-stone-300 hover:border-stone-400 text-stone-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer hover:bg-rose-50"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>মেনু</span>
            </button>
          </div>

        </div>

      </div>
    </header>
  );
};
