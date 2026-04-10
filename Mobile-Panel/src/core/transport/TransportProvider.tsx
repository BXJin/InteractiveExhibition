import React, { createContext, useContext, useMemo } from 'react';
import type { ITransport } from './types';
import { HttpTransport } from './HttpTransport';

// ─────────────────────────────────────
// Context
// ─────────────────────────────────────

const TransportContext = createContext<ITransport | null>(null);

/**
 * Transport를 하위 컴포넌트에 주입하는 Provider.
 *
 * App 최상위에서 한 번 감싸면,
 * 하위 어디서든 useTransport()로 접근 가능.
 *
 * @example
 * ```tsx
 * <TransportProvider baseUrl="http://localhost:5225">
 *   <MyPanel />
 * </TransportProvider>
 * ```
 */
export const TransportProvider: React.FC<{
  /** 서버 기본 URL */
  baseUrl: string;
  /** 커스텀 Transport (테스트/WebSocket 전환 시 사용) */
  transport?: ITransport;
  children: React.ReactNode;
}> = ({ baseUrl, transport, children }) => {
  const value = useMemo(
    () => transport ?? new HttpTransport(baseUrl),
    [baseUrl, transport],
  );

  return (
    <TransportContext.Provider value={value}>
      {children}
    </TransportContext.Provider>
  );
};

/**
 * 현재 Transport 인스턴스를 가져오는 훅.
 *
 * TransportProvider 바깥에서 호출하면 에러 발생.
 */
export function useTransport(): ITransport {
  const ctx = useContext(TransportContext);
  if (!ctx) {
    throw new Error('useTransport must be used within <TransportProvider>');
  }
  return ctx;
}
