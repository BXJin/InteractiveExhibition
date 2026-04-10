import React from 'react';
import { motion } from 'motion/react';

// ─────────────────────────────────────
// Types
// ─────────────────────────────────────

export interface ActionButtonProps {
  /** 아이콘 (ReactNode) */
  icon: React.ReactNode;
  /** 버튼 레이블 */
  label: string;
  /** 클릭 핸들러 */
  onClick: () => void;
  /** 현재 활성 상태 (하이라이트) */
  active?: boolean;
  /** 비활성화 */
  disabled?: boolean;
  /** 활성 시 배경색 tailwind class */
  activeColor?: string;
  /** 비활성 시 아이콘 색상 tailwind class */
  iconColor?: string;
  /** 버튼 사이즈 프리셋 */
  size?: 'sm' | 'md' | 'lg';
  /** 추가 CSS 클래스 */
  className?: string;
}

// ─────────────────────────────────────
// Size presets
// ─────────────────────────────────────

const SIZE_CLASSES = {
  sm: 'py-2.5 gap-1 rounded-lg',
  md: 'py-3.5 gap-1.5 rounded-xl',
  lg: 'py-5 gap-2 rounded-2xl',
} as const;

const LABEL_CLASSES = {
  sm: 'text-[8px]',
  md: 'text-[9px]',
  lg: 'text-[10px]',
} as const;

// ─────────────────────────────────────
// Component
// ─────────────────────────────────────

/**
 * 범용 액션 버튼 — 아이콘 + 레이블, 활성 상태 시각화.
 *
 * 어떤 게임 패널에서든 재사용 가능한 기본 버튼 단위.
 * Emotion, Stage, Animation 등 목적과 무관하게 동일한 인터페이스.
 */
export const ActionButton: React.FC<ActionButtonProps> = ({
  icon,
  label,
  onClick,
  active = false,
  disabled = false,
  activeColor = 'bg-white/12',
  iconColor = 'text-white/40',
  size = 'md',
  className = '',
}) => (
  <motion.button
    whileTap={disabled ? undefined : { scale: 0.93 }}
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    className={`flex flex-col items-center justify-center border transition-all duration-150
      ${SIZE_CLASSES[size]}
      ${active
        ? `${activeColor} border-white/20`
        : 'bg-white/4 border-white/6 active:bg-white/10'}
      ${disabled ? 'opacity-30 pointer-events-none' : ''}
      ${className}`}
  >
    <span className={`transition-colors ${active ? 'text-white' : iconColor}`}>
      {icon}
    </span>
    <span className={`font-semibold uppercase tracking-wider transition-colors
      ${LABEL_CLASSES[size]}
      ${active ? 'text-white' : 'text-white/40'}`}
    >
      {label}
    </span>
  </motion.button>
);
