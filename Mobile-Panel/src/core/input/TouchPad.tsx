import React from 'react';
import { useTouchPad, TouchPadConfig, TouchPadDelta } from '../hooks';

// ─────────────────────────────────────
// Types
// ─────────────────────────────────────

export interface TouchPadProps extends TouchPadConfig {
  /** 터치 이동마다 호출 */
  onDelta: (delta: TouchPadDelta) => void;
  /** 추가 CSS 클래스 */
  className?: string;
  /** 자식 요소 (힌트 텍스트 등) */
  children?: React.ReactNode;
}

// ─────────────────────────────────────
// Component
// ─────────────────────────────────────

/**
 * 범용 터치패드 — 투명한 드래그 표면.
 *
 * 사용 예시:
 * - 카메라 회전 표면 (dx → yaw, dy → pitch)
 * - 레이싱 핸들 (dx만 사용)
 * - 스와이프 제스처 인식 영역
 *
 * children으로 힌트 UI를 넣을 수 있음.
 */
export const TouchPad: React.FC<TouchPadProps> = ({
  onDelta,
  sensitivity,
  threshold,
  className = '',
  children,
}) => {
  const { handlers } = useTouchPad(onDelta, { sensitivity, threshold });

  return (
    <div
      {...handlers}
      className={`touch-none ${className}`}
    >
      {children}
    </div>
  );
};
