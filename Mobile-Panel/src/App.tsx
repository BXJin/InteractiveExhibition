import React, { useEffect, useState } from 'react';
import { ExhibitionScreen } from './components/ExhibitionScreen';
import { MobilePanel } from './components/MobilePanel';

export default function App() {
  const [view, setView] = useState<'AUTO' | 'SCREEN' | 'PANEL'>('AUTO');

  useEffect(() => {
    // Basic routing logic based on URL search params or path
    const path = window.location.pathname;
    if (path === '/panel') {
      setView('PANEL');
    } else if (path === '/screen') {
      setView('SCREEN');
    }
  }, []);

  // If AUTO, we show a split view for desktop prototype purposes
  if (view === 'AUTO') {
    return (
      <div className="w-full h-screen flex flex-col md:flex-row bg-black overflow-hidden">
        {/* Left Side: Simulation Screen */}
        <div className="flex-[2] relative border-b md:border-b-0 md:border-r border-white/10">
          <ExhibitionScreen />
          <div className="absolute top-4 right-4 z-50">
            <a href="/screen" className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-white/40 uppercase font-mono">Full Screen</a>
          </div>
        </div>

        {/* Right Side: Mobile Panel Simulation */}
        <div className="flex-1 min-w-[320px] max-w-[450px] bg-zinc-900 relative">
          <MobilePanel />
          <div className="absolute top-4 right-4 z-50">
            <a href="/panel" className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-white/40 uppercase font-mono">Mobile View</a>
          </div>
        </div>

        {/* Prototype Instructions Overlay (Temporary) */}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 bg-emerald-500 text-black font-bold text-[10px] rounded-full shadow-2xl pointer-events-none uppercase tracking-widest">
          Prototype Mode: Open /panel on your phone to control real-time
        </div>
      </div>
    );
  }

  if (view === 'PANEL') return <MobilePanel />;
  return <ExhibitionScreen />;
}
