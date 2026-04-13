import React from 'react';
import { TransportProvider } from './core';
import { ExhibitionPanel } from './panels/exhibition';

const STORAGE_KEY = 'exhibition_server_url';
const DEFAULT_URL = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://localhost:5225';

function getServerUrl(): string {
  try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_URL; }
  catch { return DEFAULT_URL; }
}

/**
 * App 최상위:
 * - TransportProvider가 ITransport를 전체 트리에 주입
 * - 게임이 바뀌면 ExhibitionPanel을 다른 패널로 교체하기만 하면 됨
 */
export default function App() {
  return (
    <TransportProvider baseUrl={getServerUrl()}>
      <ExhibitionPanel />
    </TransportProvider>
  );
}
