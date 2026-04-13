import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { useJoystick, JoystickConfig, JoystickOutput } from '../hooks';

// ─────────────────────────────────────
// Types
// ─────────────────────────────────────

export interface JoystickProps extends JoystickConfig {
  /** 조이스틱 값이 변할 때마다 호출 (throttle은 호출 측에서 적용) */
  onChange?: (output: JoystickOutput) => void;
  /** 터치를 놓았을 때 호출 */
  onRelease?: () => void;
  /** 베이스 지름 (px). 기본 112 */
  size?: number;
  /** 노브 지름 (px). 기본 44 */
  knobSize?: number;
  /** 추가 CSS 클래스 */
  className?: string;
  /** 하단 레이블 */
  label?: string;
}

// ─────────────────────────────────────
// Component
// ─────────────────────────────────────

/**
 * 범용 가상 조이스틱 컴포넌트.
 *
 * useJoystick 훅 위에 시각적 렌더링을 얹은 것.
 * 어떤 게임이든 가져다 size/radius/deadzone만 조정하면 됨.
 */
export const Joystick: React.FC<JoystickProps> = ({
  radius,
  deadzone,
  hapticMs,
  onChange,
  onRelease,
  size = 112,
  knobSize = 44,
  className = '',
  label,
}) => {
  const { baseRef, handlers, output, visual } = useJoystick({ radius: radius ?? size / 2 - knobSize / 2, deadzone, hapticMs });

  // output이 변할 때 콜백 호출
  const prevRef = useRef(output);
  useEffect(() => {
    if (output.x !== prevRef.current.x || output.y !== prevRef.current.y) {
      prevRef.current = output;
      if (visual.active) {
        onChange?.(output);
      } else {
        onRelease?.();
      }
    }
  }, [output, visual.active, onChange, onRelease]);

  return (
    <div className={`flex flex-col items-center gap-2 touch-none ${className}`}>
      <div
        ref={baseRef}
        {...handlers}
        className="rounded-full bg-white/5 border border-white/10 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <motion.div
          animate={{ x: visual.offsetX, y: visual.offsetY }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          className={`rounded-full shadow-lg transition-colors duration-100
            ${visual.active ? 'bg-white/80' : 'bg-white/50'}`}
          style={{ width: knobSize, height: knobSize }}
        />
      </div>
      {label && (
        <span className="text-[8px] font-mono text-white/15 uppercase tracking-widest">{label}</span>
      )}
    </div>
  );
};
