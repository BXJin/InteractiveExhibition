import { useRef, useState, useCallback, useMemo } from 'react';

// ─────────────────────────────────────
// Types
// ─────────────────────────────────────

export interface JoystickConfig {
  /** 조이스틱 반경 (px). 기본 50 */
  radius?: number;
  /** 데드존 비율 (0~1). 이 범위 안의 입력은 0으로 처리. 기본 0.1 */
  deadzone?: number;
  /** 터치 시 햅틱 진동 (ms). 0이면 비활성화. 기본 0 */
  hapticMs?: number;
}

export interface JoystickOutput {
  /** 정규화된 x 값 (-1 ~ 1), 데드존 적용 후 */
  x: number;
  /** 정규화된 y 값 (-1 ~ 1), 데드존 적용 후 */
  y: number;
}

export interface JoystickVisual {
  /** 노브의 현재 px 오프셋 (애니메이션용) */
  offsetX: number;
  offsetY: number;
  /** 현재 터치 중인지 */
  active: boolean;
}

export interface UseJoystickReturn {
  /** 조이스틱 베이스 element에 부착할 ref */
  baseRef: React.RefObject<HTMLDivElement | null>;
  /** 터치 이벤트 핸들러들 — 베이스 element에 바인딩 */
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove:  (e: React.TouchEvent) => void;
    onTouchEnd:   (e: React.TouchEvent) => void;
  };
  /** 데드존 적용된 정규화 출력 */
  output: JoystickOutput;
  /** 시각적 렌더링용 데이터 */
  visual: JoystickVisual;
}

// ─────────────────────────────────────
// Math helpers
// ─────────────────────────────────────

function clampToCircle(dx: number, dy: number, maxR: number) {
  const dist = Math.hypot(dx, dy);
  if (dist <= maxR) return { x: dx, y: dy };
  return { x: (dx / dist) * maxR, y: (dy / dist) * maxR };
}

function applyDeadzone(value: number, deadzone: number): number {
  const abs = Math.abs(value);
  if (abs < deadzone) return 0;
  // 데드존 밖의 범위를 0~1로 재매핑 → 데드존 경계에서 점프 없음
  return Math.sign(value) * ((abs - deadzone) / (1 - deadzone));
}

function tryHaptic(ms: number) {
  if (ms > 0 && navigator.vibrate) {
    navigator.vibrate(ms);
  }
}

// ─────────────────────────────────────
// Hook
// ─────────────────────────────────────

/**
 * 범용 가상 조이스틱 훅.
 *
 * 컴포넌트와 독립적으로 터치 수학/상태만 관리.
 * 시각적 렌더링은 반환된 `visual`을 사용해 자유롭게 구현.
 *
 * @example
 * ```tsx
 * const { baseRef, handlers, output, visual } = useJoystick({ radius: 50 });
 *
 * return (
 *   <div ref={baseRef} {...handlers} className="joystick-base">
 *     <div style={{ transform: `translate(${visual.offsetX}px, ${visual.offsetY}px)` }} />
 *   </div>
 * );
 * ```
 */
export function useJoystick(config: JoystickConfig = {}): UseJoystickReturn {
  const { radius = 50, deadzone = 0.1, hapticMs = 0 } = config;

  const baseRef    = useRef<HTMLDivElement | null>(null);
  const touchIdRef = useRef<number | null>(null);

  const [visual, setVisual] = useState<JoystickVisual>({ offsetX: 0, offsetY: 0, active: false });
  const [output, setOutput] = useState<JoystickOutput>({ x: 0, y: 0 });

  const updateFromTouch = useCallback((clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const cx   = rect.left + rect.width / 2;
    const cy   = rect.top + rect.height / 2;
    const raw  = clampToCircle(clientX - cx, clientY - cy, radius);

    setVisual({ offsetX: raw.x, offsetY: raw.y, active: true });

    const nx = raw.x / radius;
    const ny = raw.y / radius;
    setOutput({
      x: applyDeadzone(nx, deadzone),
      y: applyDeadzone(ny, deadzone),
    });
  }, [radius, deadzone]);

  const reset = useCallback(() => {
    touchIdRef.current = null;
    setVisual({ offsetX: 0, offsetY: 0, active: false });
    setOutput({ x: 0, y: 0 });
  }, []);

  const handlers = useMemo(() => ({
    onTouchStart(e: React.TouchEvent) {
      e.stopPropagation();
      if (touchIdRef.current !== null) return; // 이미 활성 터치 있음
      const touch = e.changedTouches[0];
      touchIdRef.current = touch.identifier;
      tryHaptic(hapticMs);
      updateFromTouch(touch.clientX, touch.clientY);
    },

    onTouchMove(e: React.TouchEvent) {
      e.stopPropagation();
      if (touchIdRef.current === null) return;
      const touch = Array.from(e.touches).find(t => t.identifier === touchIdRef.current);
      if (!touch) return;
      updateFromTouch(touch.clientX, touch.clientY);
    },

    onTouchEnd(e: React.TouchEvent) {
      e.stopPropagation();
      const lifted = Array.from(e.changedTouches).some(t => t.identifier === touchIdRef.current);
      if (lifted) reset();
    },
  }), [hapticMs, updateFromTouch, reset]);

  return { baseRef, handlers, output, visual };
}
