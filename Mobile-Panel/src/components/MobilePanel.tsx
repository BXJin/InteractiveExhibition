import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Smile, Frown, Zap, Ghost,
  Sun, Moon, Flame, Sparkles,
  Settings, X, Smartphone,
  RotateCcw, Play, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { ExhibitionCommand, CommandResult, EmotionKey } from '../types';

// ─────────────────────────────────────
// Constants
// ─────────────────────────────────────

const CHARACTER_ID = 'Character_01';
const STORAGE_KEY = 'exhibition_server_url';
const DEFAULT_URL = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://localhost:5225';
const JOYSTICK_RADIUS = 38;
const INPUT_THROTTLE_MS = 100;

function getStoredUrl(): string {
  try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_URL; }
  catch { return DEFAULT_URL; }
}

// ─────────────────────────────────────
// Types
// ─────────────────────────────────────

type SendStatus = 'idle' | 'sending' | 'ok' | 'error';

interface LastResult {
  label: string;
  status: 'ok' | 'error';
  unrealConnections?: number;
  errorMsg?: string;
}

// ─────────────────────────────────────
// Sub-components
// ─────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/25 px-0.5">{title}</div>
      {children}
    </div>
  );
}

interface EmotionBtnProps {
  icon: React.ReactNode;
  label: string;
  accent: string;
  textAccent: string;
  active: boolean;
  onClick: () => void;
}

function EmotionBtn({ icon, label, accent, textAccent, active, onClick }: EmotionBtnProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl py-4 border transition-all duration-150
        ${active ? `${accent} border-white/20` : 'bg-white/4 border-white/6 active:bg-white/10'}`}
    >
      <span className={`transition-colors ${active ? 'text-white' : textAccent}`}>{icon}</span>
      <span className={`text-[10px] font-semibold uppercase tracking-wider transition-colors ${active ? 'text-white' : 'text-white/40'}`}>
        {label}
      </span>
    </motion.button>
  );
}

interface IconBtnProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function IconBtn({ icon, label, active, onClick }: IconBtnProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 rounded-xl py-3 border transition-all duration-150
        ${active ? 'bg-white/12 border-white/20' : 'bg-white/4 border-white/6 active:bg-white/10'}`}
    >
      <span className={`transition-colors ${active ? 'text-white' : 'text-white/40'}`}>{icon}</span>
      <span className={`text-[9px] font-mono uppercase tracking-wider transition-colors ${active ? 'text-white/80' : 'text-white/30'}`}>
        {label}
      </span>
    </motion.button>
  );
}

// ─────────────────────────────────────
// Main Component
// ─────────────────────────────────────

export const MobilePanel: React.FC = () => {
  const [serverUrl, setServerUrl]     = useState(getStoredUrl);
  const [urlDraft, setUrlDraft]       = useState(serverUrl);
  const [showSettings, setShowSettings] = useState(false);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [sendStatus, setSendStatus]   = useState<SendStatus>('idle');
  const [lastResult, setLastResult]   = useState<LastResult | null>(null);
  const [activeButton, setActiveButton] = useState<string | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Joystick
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const joystickBaseRef   = useRef<HTMLDivElement>(null);
  const joystickTouchId   = useRef<number | null>(null);
  const joystickThrottle  = useRef<number>(0);

  // Rotation
  const rotateTouchRef   = useRef<{ x: number; y: number; id: number } | null>(null);
  const rotateThrottle   = useRef<number>(0);

  useEffect(() => () => { if (statusTimerRef.current) clearTimeout(statusTimerRef.current); }, []);

  // ── Fire-and-forget for continuous inputs (joystick, rotation) ──
  const sendRaw = useCallback((command: ExhibitionCommand) => {
    fetch(`${serverUrl}/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    }).catch(() => { /* fire and forget */ });
  }, [serverUrl]);

  // ── Full command with UI feedback for button presses ──
  const sendCommand = useCallback(async (
    command: ExhibitionCommand,
    label: string,
    buttonKey: string,
  ) => {
    if (sendStatus === 'sending') return;
    setActiveButton(buttonKey);
    setSendStatus('sending');
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);

    try {
      const res = await fetch(`${serverUrl}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(text || `HTTP ${res.status}`);
      }
      const result: CommandResult = await res.json();
      setSendStatus('ok');
      setLastResult({ label, status: 'ok', unrealConnections: result.unrealConnections });
    } catch (e) {
      setSendStatus('error');
      setLastResult({ label, status: 'error', errorMsg: e instanceof Error ? e.message : String(e) });
    } finally {
      statusTimerRef.current = setTimeout(() => {
        setSendStatus('idle');
        setActiveButton(null);
      }, 1500);
    }
  }, [serverUrl, sendStatus]);

  const saveUrl = () => {
    const trimmed = urlDraft.trim().replace(/\/$/, '');
    setServerUrl(trimmed);
    try { localStorage.setItem(STORAGE_KEY, trimmed); } catch { /* no-op */ }
    setShowSettings(false);
  };

  const emotion = (key: EmotionKey, label: string) =>
    sendCommand({ type: 'setEmotion', characterId: CHARACTER_ID, emotionKey: key }, label, `emotion_${key}`);
  const animate = (animationKey: string, label: string) =>
    sendCommand({ type: 'playAnimation', characterId: CHARACTER_ID, animationKey }, label, `anim_${animationKey}`);
  const stage = (stageEventKey: string, label: string) =>
    sendCommand({ type: 'triggerStageEvent', characterId: CHARACTER_ID, stageEventKey }, label, `stage_${stageEventKey}`);

  // ── Joystick handlers ──
  const onJoystickTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (joystickTouchId.current !== null) return;
    joystickTouchId.current = e.changedTouches[0].identifier;
  };

  const onJoystickTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!joystickBaseRef.current || joystickTouchId.current === null) return;
    const touch = Array.from(e.touches).find(t => t.identifier === joystickTouchId.current);
    if (!touch) return;

    const rect = joystickBaseRef.current.getBoundingClientRect();
    const dx = touch.clientX - (rect.left + rect.width / 2);
    const dy = touch.clientY - (rect.top + rect.height / 2);
    const dist = Math.hypot(dx, dy);
    const lx = dist > JOYSTICK_RADIUS ? (dx / dist) * JOYSTICK_RADIUS : dx;
    const ly = dist > JOYSTICK_RADIUS ? (dy / dist) * JOYSTICK_RADIUS : dy;

    setJoystickPos({ x: lx, y: ly });

    const now = Date.now();
    if (now - joystickThrottle.current < INPUT_THROTTLE_MS) return;
    joystickThrottle.current = now;

    sendRaw({
      type: 'moveDirection',
      characterId: CHARACTER_ID,
      // y축 반전: 화면 위쪽 = 앞으로 이동
      direction: { x: lx / JOYSTICK_RADIUS, y: -(ly / JOYSTICK_RADIUS), z: 0 },
    });
  };

  const onJoystickTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    const lifted = Array.from(e.changedTouches).some(t => t.identifier === joystickTouchId.current);
    if (!lifted) return;
    joystickTouchId.current = null;
    setJoystickPos({ x: 0, y: 0 });
    sendRaw({ type: 'moveDirection', characterId: CHARACTER_ID, direction: { x: 0, y: 0, z: 0 } });
  };

  // ── Rotation handlers (main area drag) ──
  const onMainTouchStart = (e: React.TouchEvent) => {
    if (rotateTouchRef.current !== null) return;
    const t = e.changedTouches[0];
    rotateTouchRef.current = { x: t.clientX, y: t.clientY, id: t.identifier };
  };

  const onMainTouchMove = (e: React.TouchEvent) => {
    if (!rotateTouchRef.current) return;
    const touch = Array.from(e.touches).find(t => t.identifier === rotateTouchRef.current!.id);
    if (!touch) return;

    const now = Date.now();
    if (now - rotateThrottle.current < INPUT_THROTTLE_MS) return;

    const dx = touch.clientX - rotateTouchRef.current.x;
    const dy = touch.clientY - rotateTouchRef.current.y;
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;

    rotateThrottle.current = now;
    rotateTouchRef.current = { x: touch.clientX, y: touch.clientY, id: touch.identifier };

    sendRaw({
      type: 'rotate',
      characterId: CHARACTER_ID,
      rotation: { pitch: -dy * 0.3, yaw: dx * 0.3, roll: 0 },
    });
  };

  const onMainTouchEnd = (e: React.TouchEvent) => {
    const lifted = Array.from(e.changedTouches).some(t => t.identifier === rotateTouchRef.current?.id);
    if (lifted) rotateTouchRef.current = null;
  };

  // ─────────────────────────────────────
  // Render
  // ─────────────────────────────────────

  return (
    <div className="w-screen h-dvh bg-[#080808] text-white flex flex-col overflow-hidden select-none touch-none">

      {/* ── Header ── */}
      <div className="shrink-0 bg-[#080808]/95 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center justify-between z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <Smartphone size={14} className="text-emerald-400" />
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-widest uppercase text-white/90 leading-none mb-0.5">
              Exhibition
            </div>
            <div className="text-[8px] text-white/25 font-mono leading-none truncate max-w-[140px]">
              {serverUrl}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status pill */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-mono uppercase tracking-wider transition-colors
            ${sendStatus === 'ok'      ? 'bg-emerald-500/15 text-emerald-400' :
              sendStatus === 'error'   ? 'bg-red-500/15 text-red-400' :
              sendStatus === 'sending' ? 'bg-amber-500/15 text-amber-400' :
                                         'bg-white/5 text-white/20'}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full
              ${sendStatus === 'ok'      ? 'bg-emerald-400' :
                sendStatus === 'error'   ? 'bg-red-400' :
                sendStatus === 'sending' ? 'bg-amber-400 animate-pulse' :
                                           'bg-white/15'}`}
            />
            {sendStatus === 'sending' ? 'Sending' :
             sendStatus === 'ok'      ? 'OK' :
             sendStatus === 'error'   ? 'Error' : 'Ready'}
          </div>

          <button
            onClick={() => { setShowSettings(v => !v); setUrlDraft(serverUrl); }}
            className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-white/10 text-white' : 'text-white/25 active:text-white/60'}`}
          >
            {showSettings ? <X size={15} /> : <Settings size={15} />}
          </button>
        </div>
      </div>

      {/* ── Settings Dropdown ── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="shrink-0 overflow-hidden border-b border-white/5 bg-[#0d0d0d] z-40"
          >
            <div className="px-4 py-4 space-y-3">
              <div className="text-[9px] text-white/25 uppercase tracking-widest font-mono">ASP.NET Server URL</div>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlDraft}
                  onChange={e => setUrlDraft(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveUrl()}
                  placeholder="http://192.168.x.x:5225"
                  className="flex-1 bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-[12px] font-mono text-white/80 outline-none focus:border-emerald-500/40 transition-colors"
                />
                <button
                  onClick={saveUrl}
                  className="px-4 py-2.5 bg-emerald-600 active:bg-emerald-700 rounded-xl text-[11px] font-bold"
                >
                  Save
                </button>
              </div>
              <p className="text-[9px] text-white/20 font-mono leading-relaxed">
                모바일 테스트 시 PC의 로컬 IP로 변경<br />
                예: http://192.168.0.10:5225
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Interaction Area ── */}
      <div
        className="flex-1 relative overflow-hidden"
        onTouchStart={onMainTouchStart}
        onTouchMove={onMainTouchMove}
        onTouchEnd={onMainTouchEnd}
      >
        {/* Rotation hint */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-[8px] text-white/8 uppercase tracking-[0.5em] text-center">
            Drag to Rotate
          </p>
        </div>

        {/* ── Joystick ── */}
        <div
          className="absolute bottom-10 left-8 z-20 touch-none"
          onTouchStart={onJoystickTouchStart}
          onTouchMove={onJoystickTouchMove}
          onTouchEnd={onJoystickTouchEnd}
        >
          <div
            ref={joystickBaseRef}
            className="w-28 h-28 rounded-full bg-white/5 border border-white/10 flex items-center justify-center"
          >
            <motion.div
              animate={{ x: joystickPos.x, y: joystickPos.y }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              className="w-11 h-11 rounded-full bg-white/60 shadow-xl"
            />
          </div>
          <p className="text-center text-[8px] font-mono text-white/15 uppercase tracking-widest mt-2">Move</p>
        </div>

        {/* ── Side Menu Toggle Button ── */}
        <button
          className="absolute right-0 top-1/2 -translate-y-1/2 z-30 h-14 w-7 bg-white/5 border border-r-0 border-white/10 rounded-l-xl flex items-center justify-center active:bg-white/10 transition-colors"
          onClick={() => setSideMenuOpen(v => !v)}
        >
          {sideMenuOpen
            ? <ChevronRight size={14} className="text-white/40" />
            : <ChevronLeft  size={14} className="text-white/40" />}
        </button>

        {/* ── Side Menu Panel ── */}
        <AnimatePresence>
          {sideMenuOpen && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              className="absolute right-0 top-0 bottom-0 w-[230px] bg-[#0e0e0e]/98 backdrop-blur-md border-l border-white/8 overflow-y-auto z-20 overscroll-contain"
              // Prevent side panel touches from bubbling to rotation handler
              onTouchStart={e => e.stopPropagation()}
              onTouchMove={e => e.stopPropagation()}
              onTouchEnd={e => e.stopPropagation()}
            >
              <div className="p-4 space-y-5">

                {/* Emotion */}
                <Section title="Emotion">
                  <div className="grid grid-cols-2 gap-2">
                    <EmotionBtn icon={<Smile size={20} />} label="Happy"    accent="bg-amber-500/25"  textAccent="text-amber-400"  active={activeButton === 'emotion_happy'}    onClick={() => emotion('happy',    'Happy')}    />
                    <EmotionBtn icon={<Frown size={20} />} label="Sad"      accent="bg-blue-500/25"   textAccent="text-blue-400"   active={activeButton === 'emotion_sad'}      onClick={() => emotion('sad',      'Sad')}      />
                    <EmotionBtn icon={<Zap   size={20} />} label="Angry"    accent="bg-red-500/25"    textAccent="text-red-400"    active={activeButton === 'emotion_angry'}    onClick={() => emotion('angry',    'Angry')}    />
                    <EmotionBtn icon={<Ghost size={20} />} label="Surprise" accent="bg-purple-500/25" textAccent="text-purple-400" active={activeButton === 'emotion_surprise'} onClick={() => emotion('surprise', 'Surprise')} />
                  </div>
                </Section>

                {/* Stage */}
                <Section title="Stage">
                  <div className="grid grid-cols-3 gap-1.5">
                    <IconBtn icon={<Sun      size={15} />} label="Day"     active={activeButton === 'stage_stage.day'}      onClick={() => stage('stage.day',      'Day')}      />
                    <IconBtn icon={<Moon     size={15} />} label="Night"   active={activeButton === 'stage_stage.night'}    onClick={() => stage('stage.night',    'Night')}    />
                    <IconBtn icon={<Flame    size={15} />} label="Drama"   active={activeButton === 'stage_stage.dramatic'} onClick={() => stage('stage.dramatic', 'Dramatic')} />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <IconBtn icon={<Sparkles size={15} />} label="Spot On"  active={activeButton === 'stage_light.spotOn'}  onClick={() => stage('light.spotOn',  'Spot On')}  />
                    <IconBtn icon={<Moon     size={15} />} label="Spot Off" active={activeButton === 'stage_light.spotOff'} onClick={() => stage('light.spotOff', 'Spot Off')} />
                  </div>
                </Section>

                {/* Animation */}
                <Section title="Animation">
                  <div className="grid grid-cols-3 gap-1.5">
                    <IconBtn icon={<Play size={13} />} label="Wave" active={activeButton === 'anim_wave'} onClick={() => animate('wave', 'Wave')} />
                    <IconBtn icon={<Play size={13} />} label="Bow"  active={activeButton === 'anim_bow'}  onClick={() => animate('bow',  'Bow')}  />
                    <IconBtn icon={<Play size={13} />} label="Clap" active={activeButton === 'anim_clap'} onClick={() => animate('clap', 'Clap')} />
                  </div>
                </Section>

                {/* Reset */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => sendCommand(
                    { type: 'triggerStageEvent', characterId: CHARACTER_ID, stageEventKey: 'scene.reset' },
                    'Reset', 'reset',
                  )}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/6 bg-white/3 active:bg-white/8 text-white/30 text-[10px] font-mono uppercase tracking-widest transition-colors"
                >
                  <RotateCcw size={12} />
                  Reset Scene
                </motion.button>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Last Result Banner (bottom) ── */}
        <AnimatePresence>
          {lastResult && (
            <motion.div
              key={lastResult.label + lastResult.status}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`absolute bottom-4 left-4 right-10 px-4 py-2 rounded-xl text-[10px] font-mono flex items-center justify-between gap-2 pointer-events-none
                ${lastResult.status === 'ok'
                  ? 'bg-emerald-500/10 border border-emerald-500/15 text-emerald-400'
                  : 'bg-red-500/10 border border-red-500/15 text-red-400'}`}
            >
              <span className="truncate">
                {lastResult.status === 'ok'
                  ? `✓ ${lastResult.label}`
                  : `✗ ${lastResult.label} — ${lastResult.errorMsg}`}
              </span>
              {lastResult.status === 'ok' && lastResult.unrealConnections !== undefined && (
                <span className="shrink-0 text-white/20">
                  UE {lastResult.unrealConnections > 0 ? lastResult.unrealConnections : '—'}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer ── */}
      <div className="shrink-0 px-4 py-2.5 border-t border-white/5 text-[7px] font-mono text-white/10 uppercase tracking-widest text-center">
        {CHARACTER_ID} · Exhibition Controller
      </div>

    </div>
  );
};
