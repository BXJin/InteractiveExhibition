import { useRef, useCallback, useMemo } from 'react';

// ─────────────────────────────────────
// Types
// ─────────────────────────────────────

export interface TouchPadConfig {
  /** 감도 배수. 기본 1.0 */
  sensitivity?: number;
  /** 이 px 미만의 이동은 무시 (떨림 방지). 기본 2 */
  threshold?: number;
}

export interface TouchPadDelta {
  /** 이전 터치 위치 대비 이동량 (px × sensitivity) */
  dx: number;
  dy: number;
}

export interface UseTouchPadReturn {
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove:  (e: React.TouchEvent) => void;
    onTouchEnd:   (e: React.TouchEvent) => void;
  };
}

// ─────────────────────────────────────
// Hook
// ─────────────────────────────────────

/**
 * 범용 터치패드 훅 — 화면 드래그로 델타 값을 생산.
 *
 * 사용 예시:
 * - 카메라 회전 (dx → yaw, dy → pitch)
 * - 레이싱 핸들 (dx → steering)
 * - 스와이프 제스처
 *
 * 상태를 내부에 보관하지 않고, 매 이동마다 `onDelta` 콜백을 호출합니다.
 * → 호출 측에서 throttle 적용 여부를 결정할 수 있음.
 *
 * @param onDelta  터치 이동마다 호출되는 콜백
 * @param config   감도, 떨림 제거 임계값
 */
export function useTouchPad(
  onDelta: (delta: TouchPadDelta) => void,
  config: TouchPadConfig = {},
): UseTouchPadReturn {
  const { sensitivity = 1.0, threshold = 2 } = config;

  const touchRef    = useRef<{ id: number; x: number; y: number } | null>(null);
  const onDeltaRef  = useRef(onDelta);
  onDeltaRef.current = onDelta; // stale closure 방지

  const handlers = useMemo(() => ({
    onTouchStart(e: React.TouchEvent) {
      if (touchRef.current !== null) return; // 첫 번째 터치만
      const t = e.changedTouches[0];
      touchRef.current = { id: t.identifier, x: t.clientX, y: t.clientY };
    },

    onTouchMove(e: React.TouchEvent) {
      if (!touchRef.current) return;
      const touch = Array.from(e.touches).find(t => t.identifier === touchRef.current!.id);
      if (!touch) return;

      const rawDx = touch.clientX - touchRef.current.x;
      const rawDy = touch.clientY - touchRef.current.y;

      // 떨림 제거
      if (Math.abs(rawDx) < threshold && Math.abs(rawDy) < threshold) return;

      touchRef.current = { id: touchRef.current.id, x: touch.clientX, y: touch.clientY };
      onDeltaRef.current({ dx: rawDx * sensitivity, dy: rawDy * sensitivity });
    },

    onTouchEnd(e: React.TouchEvent) {
      if (!touchRef.current) return;
      const lifted = Array.from(e.changedTouches).some(t => t.identifier === touchRef.current!.id);
      if (lifted) touchRef.current = null;
    },
  }), [sensitivity, threshold]);

  return { handlers };
}
