import { useRef, useCallback, useEffect } from 'react';

/**
 * RAF(requestAnimationFrame) 기반 스로틀 훅.
 *
 * setInterval/setTimeout 대신 RAF를 사용하는 이유:
 * - 디스플레이 주사율에 동기화 → 불필요한 중간 호출 방지
 * - 브라우저 탭이 비활성화되면 자동 정지 → 배터리 절약
 * - 게임 입력 루프의 표준 패턴
 *
 * @param callback  스로틀할 콜백
 * @param intervalMs  최소 호출 간격 (ms). 기본 100ms → 초당 최대 10회
 * @returns [throttledFn, cancel]
 *   - throttledFn: 스로틀된 콜백
 *   - cancel: pending RAF를 즉시 취소 (조이스틱 onRelease 등에서 호출)
 */
export function useThrottle<T extends (...args: unknown[]) => void>(
  callback: T,
  intervalMs = 100,
): [T, () => void] {
  const lastCallRef = useRef(0);
  const callbackRef = useRef(callback);
  const rafIdRef = useRef(0);

  // 매 렌더마다 최신 콜백을 참조하되 identity는 고정 (stale closure 방지)
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // 언마운트 시 pending RAF 정리
  useEffect(() => () => cancelAnimationFrame(rafIdRef.current), []);

  const cancel = useCallback(() => {
    cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = 0;
  }, []);

  const throttled = useCallback((...args: unknown[]) => {
    const now = performance.now();
    const elapsed = now - lastCallRef.current;

    if (elapsed >= intervalMs) {
      lastCallRef.current = now;
      callbackRef.current(...args);
    } else {
      // 아직 간격이 안 됐으면 다음 프레임에 재시도
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        lastCallRef.current = performance.now();
        callbackRef.current(...args);
      });
    }
  }, [intervalMs]) as T;

  return [throttled, cancel];
}
