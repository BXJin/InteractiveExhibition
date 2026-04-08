import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Character } from './Character';
import { EmotionType, StageCommand, ExecutionLog } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Cpu, Activity, Compass, Move } from 'lucide-react';

export const ExhibitionScreen = () => {
  const [emotion, setEmotion] = useState<EmotionType>('IDLE');
  const [atmosphere, setAtmosphere] = useState('DEFAULT');
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  
  // Movement & Rotation State
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [gyro, setGyro] = useState({ alpha: 0, beta: 0, gamma: 0 });

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    socketRef.current = io();

    socketRef.current.on('execution-command', (data: ExecutionLog) => {
      setLogs(prev => [data, ...prev].slice(0, 10));
      
      const { command } = data;
      
      switch (command.type) {
        case 'EMOTION':
          setEmotion(command.value as EmotionType);
          break;
        case 'ATMOSPHERE':
          setAtmosphere(command.value);
          break;
        case 'GREETING':
          setLastMessage(command.value);
          setTimeout(() => setLastMessage(null), 3000);
          break;
        case 'MOVE':
          // command.value is { x, y } from joystick
          setPosition(prev => ({
            x: prev.x + (command.value.x * 5),
            y: prev.y + (command.value.y * 5)
          }));
          break;
        case 'ROTATE':
          // command.value is deltaX
          setRotation(prev => prev + (command.value * 0.5));
          break;
        case 'GYRO':
          setGyro(command.value);
          break;
        case 'RESET':
          setEmotion('IDLE');
          setAtmosphere('DEFAULT');
          setLastMessage(null);
          setPosition({ x: 0, y: 0 });
          setRotation(0);
          setGyro({ alpha: 0, beta: 0, gamma: 0 });
          break;
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const getBgColor = () => {
    switch (atmosphere) {
      case 'CYBERPUNK': return 'bg-slate-950';
      case 'NATURE': return 'bg-emerald-950';
      case 'DRAMATIC': return 'bg-red-950';
      default: return 'bg-zinc-900';
    }
  };

  return (
    <div className={`relative w-full h-full overflow-hidden transition-colors duration-1000 ${getBgColor()}`}>
      {/* Grid Pattern Background - Moves with position */}
      <motion.div 
        animate={{ 
          backgroundPosition: `${-position.x}px ${-position.y}px`,
          rotate: rotation * 0.1 // Subtle parallax rotation
        }}
        className="absolute inset-0 opacity-10 pointer-events-none" 
        style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} 
      />

      {/* Unreal Engine style Debug HUD */}
      <div className="absolute top-6 left-6 z-20 font-mono text-[10px] text-emerald-400/80 space-y-1 pointer-events-none uppercase tracking-wider">
        <div className="flex items-center gap-2 text-emerald-400">
          <Activity size={12} />
          <span>UNREAL ENGINE 5.4.2 - PROTOTYPE_BUILD</span>
        </div>
        <div>Frame: 60.00 FPS (16.67ms)</div>
        <div className="pt-4 text-white/40">Transform Data:</div>
        <div className="flex items-center gap-2">
          <Move size={10} />
          <span>Pos: X({position.x.toFixed(1)}) Y({position.y.toFixed(1)})</span>
        </div>
        <div className="flex items-center gap-2">
          <Compass size={10} />
          <span>Rot: {rotation.toFixed(1)}°</span>
        </div>
        <div className="pt-2 text-white/40">Gyro Input:</div>
        <div className="grid grid-cols-3 gap-2">
          <span>α:{gyro.alpha.toFixed(0)}</span>
          <span>β:{gyro.beta.toFixed(0)}</span>
          <span>γ:{gyro.gamma.toFixed(0)}</span>
        </div>
      </div>

      {/* Execution Logs */}
      <div className="absolute bottom-6 left-6 z-20 w-64 max-h-48 overflow-hidden pointer-events-none">
        <div className="flex items-center gap-2 text-white/40 text-[10px] mb-2 font-mono">
          <Terminal size={12} />
          <span>REAL-TIME COMMAND LOG</span>
        </div>
        <div className="space-y-1">
          <AnimatePresence initial={false}>
            {logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                className="font-mono text-[9px] text-emerald-500/60"
              >
                [{new Date(log.timestamp).toLocaleTimeString()}] {log.command.type}::{typeof log.command.value === 'object' ? 'DATA' : log.command.value}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Stage */}
      <div className="w-full h-full flex flex-col items-center justify-center relative">
        <motion.div
          animate={{
            x: position.x,
            y: position.y,
            rotateY: rotation,
            // Gyro tilt effect
            rotateX: gyro.beta * 0.2,
            rotateZ: gyro.gamma * 0.2
          }}
          transition={{ type: 'spring', damping: 20, stiffness: 100 }}
        >
          <Character emotion={emotion} />
        </motion.div>
        
        {/* Dialogue UI */}
        <AnimatePresence>
          {lastMessage && (
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0.9 }}
              className="absolute bottom-1/4 px-8 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white font-light text-xl tracking-tight"
            >
              {lastMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Atmospheric Effects Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {atmosphere === 'CYBERPUNK' && (
          <div className="w-full h-full bg-gradient-to-t from-fuchsia-500/10 via-transparent to-cyan-500/10" />
        )}
        {atmosphere === 'DRAMATIC' && (
          <div className="w-full h-full bg-gradient-to-r from-red-500/20 via-transparent to-black/40" />
        )}
      </div>
    </div>
  );
};
