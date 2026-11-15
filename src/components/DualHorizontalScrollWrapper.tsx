import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeftRight } from 'lucide-react';

interface DualHorizontalScrollWrapperProps {
  children: React.ReactNode;
  dependencyKey?: string | number;
  darkMode?: boolean;
  className?: string;
}

/**
 * Dual Synchronized Horizontal Scroll Container for Wide Admin Order Management Tables.
 * Provides:
 * 1. Sticky Top Horizontal Scrollbar (native scrollbar + touch-friendly drag/button bar)
 * 2. Native Bottom Horizontal Scrollbar on the Table Container
 * 3. Lock-guarded bi-directional scrollLeft synchronization (0 infinite loops, 0 memory leaks)
 * 4. Automatic ResizeObserver & window resize width recalculation
 */
export const DualHorizontalScrollWrapper: React.FC<DualHorizontalScrollWrapperProps> = ({
  children,
  dependencyKey,
  darkMode = false,
  className = '',
}) => {
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = useRef<HTMLDivElement | null>(null);
  const activeScrollSourceRef = useRef<'top' | 'bottom' | null>(null);
  const rafLockRef = useRef<number | null>(null);

  const [tableScrollWidth, setTableScrollWidth] = useState<number>(1200);
  const [containerClientWidth, setContainerClientWidth] = useState<number>(1000);
  const [currentScrollLeft, setCurrentScrollLeft] = useState<number>(0);

  const releaseScrollLock = useCallback(() => {
    if (rafLockRef.current !== null) {
      cancelAnimationFrame(rafLockRef.current);
    }
    rafLockRef.current = requestAnimationFrame(() => {
      activeScrollSourceRef.current = null;
      rafLockRef.current = null;
    });
  }, []);

  const recalculateDimensions = useCallback(() => {
    const bottomEl = bottomScrollRef.current;
    if (!bottomEl) return;

    const firstChild = bottomEl.firstElementChild as HTMLElement | null;
    const measuredScrollWidth = Math.max(
      bottomEl.scrollWidth || 0,
      firstChild?.scrollWidth || 0,
      firstChild?.offsetWidth || 0
    );
    const measuredClientWidth = bottomEl.clientWidth || 0;

    setTableScrollWidth((prev) =>
      Math.abs(prev - measuredScrollWidth) > 1 ? measuredScrollWidth : prev
    );
    setContainerClientWidth((prev) =>
      Math.abs(prev - measuredClientWidth) > 1 ? measuredClientWidth : prev
    );

    if (topScrollRef.current && Math.abs(topScrollRef.current.scrollLeft - bottomEl.scrollLeft) > 1) {
      topScrollRef.current.scrollLeft = bottomEl.scrollLeft;
    }
    setCurrentScrollLeft(bottomEl.scrollLeft);
  }, []);

  useEffect(() => {
    recalculateDimensions();
    const timer = window.setTimeout(recalculateDimensions, 120);

    const bottomEl = bottomScrollRef.current;
    const tableEl = bottomEl?.firstElementChild as HTMLElement | null;

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        recalculateDimensions();
      });
      if (bottomEl) resizeObserver.observe(bottomEl);
      if (tableEl) resizeObserver.observe(tableEl);
    }

    window.addEventListener('resize', recalculateDimensions, { passive: true });

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', recalculateDimensions);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (rafLockRef.current !== null) {
        cancelAnimationFrame(rafLockRef.current);
      }
    };
  }, [recalculateDimensions, dependencyKey]);

  const handleTopScroll = useCallback(() => {
    if (activeScrollSourceRef.current === 'bottom') return;
    const topEl = topScrollRef.current;
    const bottomEl = bottomScrollRef.current;
    if (!topEl || !bottomEl) return;

    activeScrollSourceRef.current = 'top';
    const nextLeft = topEl.scrollLeft;
    if (Math.abs(bottomEl.scrollLeft - nextLeft) > 0.5) {
      bottomEl.scrollLeft = nextLeft;
    }
    setCurrentScrollLeft(nextLeft);
    releaseScrollLock();
  }, [releaseScrollLock]);

  const handleBottomScroll = useCallback(() => {
    if (activeScrollSourceRef.current === 'top') return;
    const topEl = topScrollRef.current;
    const bottomEl = bottomScrollRef.current;
    if (!bottomEl) return;

    activeScrollSourceRef.current = 'bottom';
    const nextLeft = bottomEl.scrollLeft;
    if (topEl && Math.abs(topEl.scrollLeft - nextLeft) > 0.5) {
      topEl.scrollLeft = nextLeft;
    }
    setCurrentScrollLeft(nextLeft);
    releaseScrollLock();
  }, [releaseScrollLock]);

  const scrollByAmount = (delta: number) => {
    const bottomEl = bottomScrollRef.current;
    const topEl = topScrollRef.current;
    if (!bottomEl) return;
    const maxScroll = Math.max(0, bottomEl.scrollWidth - bottomEl.clientWidth);
    const target = Math.max(0, Math.min(maxScroll, bottomEl.scrollLeft + delta));
    bottomEl.scrollTo({ left: target, behavior: 'smooth' });
    if (topEl) {
      topEl.scrollTo({ left: target, behavior: 'smooth' });
    }
    setCurrentScrollLeft(target);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = Number(e.target.value) || 0;
    const bottomEl = bottomScrollRef.current;
    const topEl = topScrollRef.current;
    activeScrollSourceRef.current = 'top';
    if (bottomEl) bottomEl.scrollLeft = target;
    if (topEl) topEl.scrollLeft = target;
    setCurrentScrollLeft(target);
    releaseScrollLock();
  };

  const maxScrollLeft = Math.max(0, tableScrollWidth - containerClientWidth);
  const hasHorizontalOverflow = maxScrollLeft > 4;

  return (
    <div className={`relative w-full ${className}`}>
      {/* STICKY TOP HORIZONTAL SCROLLBAR BAR */}
      <div
        className={`sticky top-0 z-20 px-3 sm:px-5 py-2 border-b transition-colors ${
          darkMode
            ? 'bg-slate-900/95 border-slate-800 text-slate-200 backdrop-blur-xs shadow-xs'
            : 'bg-[#FFF5F7]/95 border-rose-200 text-stone-800 backdrop-blur-xs shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-extrabold">
            <ArrowLeftRight
              className={`w-3.5 h-3.5 shrink-0 ${
                darkMode ? 'text-amber-400' : 'text-[#E11D48]'
              }`}
            />
            <span>টেবিল ডানে-বামে স্ক্রল বার (উপরে ও নিচে সিঙ্ক্রোনাইজড)</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => scrollByAmount(-260)}
              disabled={currentScrollLeft <= 2}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold inline-flex items-center gap-0.5 border cursor-pointer transition-all disabled:opacity-40 ${
                darkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700'
                  : 'bg-white border-rose-200 text-stone-800 hover:bg-rose-50'
              }`}
              title="টেবিল বামে স্ক্রল করুন"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-[#E11D48]" />
              <span>বামে</span>
            </button>

            <input
              type="range"
              min={0}
              max={Math.max(1, maxScrollLeft)}
              value={Math.min(currentScrollLeft, Math.max(1, maxScrollLeft))}
              onChange={handleSliderChange}
              aria-label="টেবিল ডানে-বামে স্ক্রল স্লাইডার"
              className="w-24 sm:w-40 h-2 rounded-lg accent-[#E11D48] cursor-pointer"
            />

            <button
              type="button"
              onClick={() => scrollByAmount(260)}
              disabled={hasHorizontalOverflow && currentScrollLeft >= maxScrollLeft - 2}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold inline-flex items-center gap-0.5 border cursor-pointer transition-all disabled:opacity-40 ${
                darkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700'
                  : 'bg-white border-rose-200 text-stone-800 hover:bg-rose-50'
              }`}
              title="টেবিল ডানে স্ক্রল করুন"
            >
              <span>ডানে</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#E11D48]" />
            </button>
          </div>
        </div>

        {/* Native Top Horizontal Scrollbar Track synchronized 1:1 with the Table below */}
        <div
          ref={topScrollRef}
          onScroll={handleTopScroll}
          data-testid="order-table-top-scrollbar"
          className="w-full overflow-x-auto overflow-y-hidden dokandari-sync-scrollbar rounded-full"
          style={{ height: '14px' }}
        >
          <div
            style={{
              width: `${Math.max(tableScrollWidth, containerClientWidth + 1)}px`,
              height: '1px',
            }}
          />
        </div>
      </div>

      {/* BOTTOM TABLE SCROLL CONTAINER (Synchronized 1:1 with Top Scrollbar) */}
      <div
        ref={bottomScrollRef}
        onScroll={handleBottomScroll}
        data-testid="order-table-bottom-scrollbar"
        className="w-full overflow-x-auto dokandari-sync-scrollbar"
      >
        {children}
      </div>
    </div>
  );
};
