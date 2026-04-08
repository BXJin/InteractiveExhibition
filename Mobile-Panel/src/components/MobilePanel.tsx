import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { StageCommand } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Smile, Frown, Zap, Ghost, 
  MessageSquare, Sun, Moon, Flame, 
  RotateCcw, Send, Smartphone,
  ChevronUp, ChevronDown, Eye, EyeOff,
  Compass
} from 'lucide-react';

export const MobilePanel = () => {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [showButtons, setShowButtons] = useState(true);
  const [gyroEnabled, setGyroEnabled] = useState(false);

  // Joystick State
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const joystickRef = useRef<HTMLDivElement>(null);

  // Rotation State
  const lastTouchX = useRef<number | null>(null);

  useEffect(() => {
    socketRef.current = io();
    socketRef.current.on('connect', () => setConnected(true));
    socketRef.current.on('disconnect', () => setConnected(false));

    // Gyroscope Handler
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (!gyroEnabled) return;
      socketRef.current?.emit('send-command', {
        characterId: 'Character_01',
        type: 'GYRO',
        value: {
          alpha: event.alpha || 0,
          beta: event.beta || 0,
          gamma: event.gamma || 0
        }
      });
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      socketRef.current?.disconnect();
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [gyroEnabled]);

  const sendCommand = (type: StageCommand['type'], value: any) => {
    socketRef.current?.emit('send-command', {
      characterId: 'Character_01',
      type,
      value
    });
  };

  // Joystick Logic
  const handleJoystickMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!joystickRef.current) return;
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = 40;

    const limitedX = distance > maxRadius ? (dx / distance) * maxRadius : dx;
    const limitedY = distance > maxRadius ? (dy / distance) * maxRadius : dy;

    setJoystickPos({ x: limitedX, y: limitedY });
    sendCommand('MOVE', { x: limitedX / maxRadius, y: limitedY / maxRadius });
  };

  const resetJoystick = () => {
    setJoystickPos({ x: 0, y: 0 });
    sendCommand('MOVE', { x: 0, y: 0 });
  };

  // Rotation Logic (Drag on Screen)
  const handleTouchStart = (e: React.TouchEvent) => {
    lastTouchX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (lastTouchX.current === null) return;
    const deltaX = e.touches[0].clientX - lastTouchX.current;
    sendCommand('ROTATE', deltaX);
    lastTouchX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    lastTouchX.current = null;
  };

  const ControlButton = ({ icon: Icon, label, onClick, color = "bg-zinc-800" }: any) => (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`${color} p-4 rounded-2xl flex flex-col items-center justify-center gap-2 border border-white/5 shadow-xl hover:bg-zinc-700 transition-colors`}
    >
      <Icon size={24} className="text-white" />
      <span className="text-[10px] text-white/60 font-mono uppercase tracking-widest">{label}</span>
    </motion.button>
  );

  return (
    <div 
      className="w-full h-full bg-[#0a0a0a] text-white flex flex-col font-sans overflow-hidden select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="p-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
            <Smartphone size={20} className="text-emerald-500" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">VIRTUAL PAD</h1>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="text-[9px] text-white/40 uppercase tracking-tighter">
                {connected ? 'Sync Active' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setGyroEnabled(!gyroEnabled)}
            className={`p-2 rounded-lg transition-colors ${gyroEnabled ? 'bg-emerald-500 text-black' : 'text-white/20'}`}
          >
            <Compass size={18} />
          </button>
          <button 
            onClick={() => setShowButtons(!showButtons)}
            className="p-2 text-white/20 hover:text-white transition-colors"
          >
            {showButtons ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
          <button onClick={() => sendCommand('RESET', 'ALL')} className="p-2 text-white/20 hover:text-white transition-colors">
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {/* Main Interaction Area */}
      <div className="flex-1 relative">
        {/* Rotation Hint */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-10 text-center">
          <div className="text-[8px] uppercase tracking-[0.5em] mb-2">Drag to Rotate Camera</div>
          <div className="w-32 h-[1px] bg-white mx-auto" />
        </div>

        {/* Joystick */}
        <div className="absolute bottom-12 left-12 z-30">
          <div 
            ref={joystickRef}
            className="w-32 h-32 bg-white/5 rounded-full border border-white/10 flex items-center justify-center backdrop-blur-sm"
            onTouchMove={handleJoystickMove}
            onTouchEnd={resetJoystick}
          >
            <motion.div 
              animate={{ x: joystickPos.x, y: joystickPos.y }}
              className="w-12 h-12 bg-white rounded-full shadow-2xl flex items-center justify-center"
            >
              <div className="w-8 h-8 rounded-full border-2 border-black/10" />
            </motion.div>
          </div>
        </div>

        {/* Toggleable Buttons */}
        <AnimatePresence>
          {showButtons && (
            <motion.div 
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              className="absolute right-6 top-0 bottom-0 flex flex-col justify-center gap-4 z-30"
            >
              <div className="bg-black/40 backdrop-blur-md p-4 rounded-3xl border border-white/10 space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
                <section>
                  <h2 className="text-[8px] text-white/30 font-mono mb-3 uppercase tracking-widest">Emotions</h2>
                  <div className="grid grid-cols-2 gap-2">
                    <ControlButton icon={Smile} label="Happy" onClick={() => sendCommand('EMOTION', 'HAPPY')} />
                    <ControlButton icon={Frown} label="Sad" onClick={() => sendCommand('EMOTION', 'SAD')} />
                    <ControlButton icon={Zap} label="Angry" onClick={() => sendCommand('EMOTION', 'ANGRY')} />
                    <ControlButton icon={Ghost} label="Surprise" onClick={() => sendCommand('EMOTION', 'SURPRISE')} />
                  </div>
                </section>
                
                <section>
                  <h2 className="text-[8px] text-white/30 font-mono mb-3 uppercase tracking-widest">Stage</h2>
                  <div className="flex flex-col gap-2">
                    <ControlButton icon={Sun} label="Default" onClick={() => sendCommand('ATMOSPHERE', 'DEFAULT')} />
                    <ControlButton icon={Moon} label="Cyber" onClick={() => sendCommand('ATMOSPHERE', 'CYBERPUNK')} color="bg-indigo-900/40" />
                    <ControlButton icon={Flame} label="Dramatic" onClick={() => sendCommand('ATMOSPHERE', 'DRAMATIC')} color="bg-red-900/40" />
                  </div>
                </section>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="p-4 text-[8px] text-white/10 font-mono text-center uppercase tracking-widest">
        Character_01 // Advanced Controller v2.0
      </div>
    </div>
  );
};
