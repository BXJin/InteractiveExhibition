import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ─────────────────────────────────────
// Types
// ─────────────────────────────────────

export interface SideMenuProps {
  /** 열림/닫힘 상태 */
  open: boolean;
  /** 상태 변경 콜백 */
  onToggle: () => void;
  /** 메뉴 너비 (px). 기본 230 */
  width?: number;
  /** 어느 쪽에서 슬라이드되는지. 기본 right */
  side?: 'left' | 'right';
  /** 메뉴 내용 */
  children: React.ReactNode;
}

// ─────────────────────────────────────
// Component
// ─────────────────────────────────────

/**
 * 사이드 슬라이드 메뉴.
 *
 * 게임 패널에서 버튼 그룹을 접었다 펼칠 때 사용.
 * 터치 이벤트 버블링을 자동 차단 → 아래의 TouchPad로 새어나가지 않음.
 */
export const SideMenu: React.FC<SideMenuProps> = ({
  open,
  onToggle,
  width = 230,
  side = 'right',
  children,
}) => {
  const isRight = side === 'right';
  const ArrowOpen  = isRight ? ChevronLeft  : ChevronRight;
  const ArrowClose = isRight ? ChevronRight : ChevronLeft;

  return (
    <>
      {/* Toggle tab */}
      <button
        className={`absolute top-1/2 -translate-y-1/2 z-30 h-14 w-7 bg-white/5 border border-white/10
          flex items-center justify-center active:bg-white/10 transition-colors
          ${isRight
            ? 'right-0 rounded-l-xl border-r-0'
            : 'left-0 rounded-r-xl border-l-0'}`}
        onClick={onToggle}
      >
        {open
          ? <ArrowClose size={14} className="text-white/40" />
          : <ArrowOpen  size={14} className="text-white/40" />}
      </button>

      {/* Slide panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: isRight ? '100%' : '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: isRight ? '100%' : '-100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className={`absolute top-0 bottom-0 bg-[#0e0e0e]/98 backdrop-blur-md overflow-y-auto z-20 overscroll-contain
              ${isRight ? 'right-0 border-l border-white/8' : 'left-0 border-r border-white/8'}`}
            style={{ width }}
            // 터치 이벤트 격리: 사이드 메뉴 내 터치가 하위 TouchPad로 전파되지 않도록
            onTouchStart={e => e.stopPropagation()}
            onTouchMove={e => e.stopPropagation()}
            onTouchEnd={e => e.stopPropagation()}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
