import React from 'react';
import { TransportProvider } from './core';
import { ExhibitionPanel } from './panels/exhibition';

// 패널을 열고 있는 호스트(PC)의 5225 포트로 직접 연결
// PC에서 접속 시: http://localhost:5225
// 모바일에서 접속 시: http://192.168.x.x:5225 (자동으로 맞춰짐)
const SERVER_URL = `${window.location.protocol}//${window.location.hostname}:5225`;

export default function App() {
  return (
    <TransportProvider baseUrl={SERVER_URL}>
      <ExhibitionPanel />
    </TransportProvider>
  );
}
