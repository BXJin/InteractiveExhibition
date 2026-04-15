import React, { createContext, useContext, useEffect, useRef, useMemo, useState } from 'react';
import type { ITransport, ConnectionState } from './types';
import { SignalRTransport } from './SignalRTransport';
import { HttpTransport } from './HttpTransport';

// ─────────────────────────────────────
// Context
// ─────────────────────────────────────

interface TransportContextValue {
  transport: ITransport;
  connectionState: ConnectionState;
}

const TransportContext = createContext<TransportContextValue | null>(null);

/** Transport 모드 */
export type TransportMode = 'signalr' | 'http';

/**
 * Transport를 하위 컴포넌트에 주입하는 Provider.
 *
 * 기본값은 SignalR (저지연 실시간 통신).
 * mode="http"로 전환하면 기존 HTTP POST 방식으로 폴백.
 *
 * @example
 * ```tsx
 * <TransportProvider baseUrl="http://localhost:5225">
 *   <MyPanel />
 * </TransportProvider>
 *
 * // HTTP 폴백
 * <TransportProvider baseUrl="http://localhost:5225" mode="http">
 *   <MyPanel />
 * </TransportProvider>
 * ```
 */
export const TransportProvider: React.FC<{
  baseUrl: string;
  mode?: TransportMode;
  /** 커스텀 Transport (테스트/WebRTC 전환 시 사용) */
  transport?: ITransport;
  children: React.ReactNode;
}> = ({ baseUrl, mode = 'signalr', transport: customTransport, children }) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');

  // ── Why useRef instead of useMemo ───────────────────────────────────────────
  // React StrictMode runs useEffect twice (mount → cleanup → mount).
  // With useMemo the same transport instance is shared across both runs:
  //   1. Effect 1  : start() begins (async)
  //   2. Cleanup 1 : startPromise.finally(dispose) scheduled  ← async!
  //   3. Effect 2  : listener registered, start() returns early (_connection != Disconnected)
  //   4. startPromise resolves → setState('connected') via Effect-2's listener → UI shows "connected"
  //   5. finally() fires → dispose() → _listeners.clear()  ← kills Effect-2's listener!
  //   6. onclose fires → setState('disconnected') → no listeners → UI stuck at "connected"
  //   7. emotion click → send() → connection.state !== Connected → "Not connected"
  //
  // Fix: create a fresh instance per effect run and dispose synchronously.
  // SignalRTransport.start() already has an _isDisposed guard for the start/dispose race.
  // ────────────────────────────────────────────────────────────────────────────
  const transportRef = useRef<ITransport | null>(null);

  // Placeholder for the first render so consumers always receive a non-null transport.
  // This instance is never started; the effect below replaces it immediately.
  if (transportRef.current === null) {
    transportRef.current = customTransport ?? (
      mode === 'signalr' ? new SignalRTransport(baseUrl) : new HttpTransport(baseUrl)
    );
  }

  // revision bumps whenever the effect replaces the transport,
  // causing context consumers to re-render with the fresh instance.
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    // Always create a fresh transport for this mount.
    // StrictMode: two runs → two fresh instances; the first is disposed in its cleanup.
    const t: ITransport = customTransport ?? (
      mode === 'signalr' ? new SignalRTransport(baseUrl) : new HttpTransport(baseUrl)
    );

    // Dispose the previous placeholder / stale instance before replacing.
    const prev = transportRef.current;
    if (prev !== null && prev !== t) {
      (prev as Partial<Pick<SignalRTransport, 'dispose'>>).dispose?.();
    }

    transportRef.current = t;
    setRevision((r) => r + 1);

    if (!(t instanceof SignalRTransport)) {
      // HTTP transport has no connection concept — always connected.
      setConnectionState('connected');
      return () => {
        (t as Partial<Pick<SignalRTransport, 'dispose'>>).dispose?.();
      };
    }

    let isMounted = true;

    const unsubscribe = t.onStateChange((state) => {
      if (isMounted) setConnectionState(state);
    });

    t.start();

    return () => {
      isMounted = false;
      unsubscribe();
      // Synchronous dispose — start() handles the in-flight race via _isDisposed check.
      t.dispose();
    };
  }, [baseUrl, mode, customTransport]);

  const value = useMemo(
    () => ({ transport: transportRef.current!, connectionState }),
    // revision tracks transport replacement; connectionState tracks live state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revision, connectionState],
  );

  return (
    <TransportContext.Provider value={value}>
      {children}
    </TransportContext.Provider>
  );
};

/** 현재 Transport 인스턴스를 가져오는 훅 */
export function useTransport(): ITransport {
  const ctx = useContext(TransportContext);
  if (!ctx) {
    throw new Error('useTransport must be used within <TransportProvider>');
  }
  return ctx.transport;
}

/** 현재 연결 상태를 가져오는 훅 */
export function useConnectionState(): ConnectionState {
  const ctx = useContext(TransportContext);
  if (!ctx) {
    throw new Error('useConnectionState must be used within <TransportProvider>');
  }
  return ctx.connectionState;
}
