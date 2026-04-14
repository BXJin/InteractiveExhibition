import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Smile, Frown, Zap, Ghost,
  Sun, Moon, Flame, Sparkles,
  Settings, X, Smartphone,
  RotateCcw, Play,
} from 'lucide-react';

import {
  Joystick,
  TouchPad,
  ActionButton,
  ControllerShell,
  StatusBar,
  SideMenu,
  useTransport,
  useConnectionState,
  useThrottle,
} from '../../core';
import type { ConnectionStatus } from '../../core';
import type { SendResult } from '../../core/transport/types';
import { ExhibitionCommands } from './commands';

// ─────────────────────────────────────
// Constants
// ─────────────────────────────────────

const STORAGE_KEY    = 'exhibition_server_url';
const DEFAULT_URL    = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://localhost:5225';
const THROTTLE_MS    = 80;  // 조이스틱/터치패드 전송 간격
const FEEDBACK_MS    = 1500; // 버튼 피드백 표시 시간

function getStoredUrl(): string {
  try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_URL; }
  catch { return DEFAULT_URL; }
}

// ─────────────────────────────────────
// Section helper
// ─────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/25 px-0.5">{title}</div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────
// Last result banner
// ─────────────────────────────────────

interface FeedbackBanner {
  label: string;
  ok: boolean;
  unrealConnections?: number;
  errorMsg?: string;
}

function ResultBanner({ banner }: { banner: FeedbackBanner | null }) {
  return (
    <AnimatePresence>
      {banner && (
        <motion.div
          key={banner.label + banner.ok}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={`absolute bottom-4 left-4 right-10 px-4 py-2 rounded-xl text-[10px] font-mono flex items-center justify-between gap-2 pointer-events-none
            ${banner.ok
              ? 'bg-emerald-500/10 border border-emerald-500/15 text-emerald-400'
              : 'bg-red-500/10 border border-red-500/15 text-red-400'}`}
        >
          <span className="truncate">
            {banner.ok ? `✓ ${banner.label}` : `✗ ${banner.label} — ${banner.errorMsg}`}
          </span>
          {banner.ok && banner.unrealConnections !== undefined && (
            <span className="shrink-0 text-white/20">
              UE {banner.unrealConnections > 0 ? banner.unrealConnections : '—'}
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────
// Exhibition Panel
// ─────────────────────────────────────

export const ExhibitionPanel: React.FC = () => {
  const transport = useTransport();
  const connState = useConnectionState();

  // UI state — 연결 상태를 ConnectionStatus로 매핑
  const [status, setStatus]     = useState<ConnectionStatus>('ready');
  const [banner, setBanner]     = useState<FeedbackBanner | null>(null);
  const [activeBtn, setActiveBtn] = useState<string | null>(null);
  const [sideOpen, setSideOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [serverUrl, setServerUrl] = useState(getStoredUrl);
  const [urlDraft, setUrlDraft] = useState(serverUrl);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // ── Settings ──
  const saveUrl = () => {
    const trimmed = urlDraft.trim().replace(/\/$/, '');
    setServerUrl(trimmed);
    try { localStorage.setItem(STORAGE_KEY, trimmed); } catch { /* no-op */ }
    setShowSettings(false);
    // URL이 바뀌면 App에서 TransportProvider를 리빌드해야 함
    // → window.location.reload()가 가장 단순. 더 우아한 방법은 App 레벨 state 사용.
    window.location.reload();
  };

  // ── Button command with feedback ──
  const sendButton = useCallback(async (
    payload: Record<string, unknown>,
    label: string,
    key: string,
  ) => {
    if (status === 'sending') return;
    setActiveBtn(key);
    setStatus('sending');
    if (timerRef.current) clearTimeout(timerRef.current);

    const result: SendResult = await transport.send(payload);

    if (result.ok) {
      setStatus('ok');
      setBanner({
        label,
        ok: true,
        unrealConnections: (result.data as Record<string, number> | undefined)?.unrealConnections,
      });
    } else {
      setStatus('error');
      setBanner({ label, ok: false, errorMsg: result.error });
    }

    timerRef.current = setTimeout(() => {
      setStatus('ready');
      setActiveBtn(null);
    }, FEEDBACK_MS);
  }, [transport, status]);

  // ── Throttled continuous inputs ──
  const throttledMove = useThrottle((x: number, y: number) => {
    transport.sendRaw(ExhibitionCommands.moveDirection(x, -y)); // y축 반전
  }, THROTTLE_MS);

  const throttledRotate = useThrottle((dx: number, dy: number) => {
    transport.sendRaw(ExhibitionCommands.rotate(-dy * 0.3, dx * 0.3));
  }, THROTTLE_MS);

  // ── Shorthand senders ──
  const emotion  = (key: string, label: string) => sendButton(ExhibitionCommands.setEmotion(key),              label, `emotion_${key}`);
  const animate  = (key: string, label: string) => sendButton(ExhibitionCommands.playAnimation(key),           label, `anim_${key}`);
  const stageEvt = (key: string, label: string) => sendButton(ExhibitionCommands.triggerStageEvent(key),        label, `stage_${key}`);

  // ─────────────────────────────────────
  // Render
  // ─────────────────────────────────────

  return (
    <ControllerShell
      header={
        <>
          <StatusBar
            title="Exhibition"
            subtitle={`${serverUrl} · ${connState}`}
            status={connState === 'disconnected' ? 'error' : connState === 'connecting' ? 'sending' : status}
            icon={<Smartphone size={14} className="text-emerald-400" />}
            actions={
              <button
                onClick={() => { setShowSettings(v => !v); setUrlDraft(serverUrl); }}
                className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-white/10 text-white' : 'text-white/25 active:text-white/60'}`}
              >
                {showSettings ? <X size={15} /> : <Settings size={15} />}
              </button>
            }
          />

          {/* Settings dropdown */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="shrink-0 overflow-hidden border-b border-white/5 bg-[#0d0d0d] z-40"
              >
                <div className="px-4 py-4 space-y-3">
                  <div className="text-[9px] text-white/25 uppercase tracking-widest font-mono">Server URL</div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={urlDraft}
                      onChange={e => setUrlDraft(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveUrl()}
                      placeholder="http://192.168.x.x:5225"
                      className="flex-1 bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-[12px] font-mono text-white/80 outline-none focus:border-emerald-500/40 transition-colors"
                    />
                    <button onClick={saveUrl} className="px-4 py-2.5 bg-emerald-600 active:bg-emerald-700 rounded-xl text-[11px] font-bold">
                      Save
                    </button>
                  </div>
                  <p className="text-[9px] text-white/20 font-mono leading-relaxed">
                    모바일 테스트 시 PC의 로컬 IP로 변경하세요
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      }
      footer={<>Character_01 · Exhibition Controller</>}
    >
      {/* TouchPad: 메인 영역 전체가 드래그 회전 표면 */}
      <TouchPad
        onDelta={d => throttledRotate(d.dx, d.dy)}
        sensitivity={1.0}
        className="absolute inset-0"
      >
        {/* Rotation hint */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-[8px] text-white/8 uppercase tracking-[0.5em]">Drag to Rotate</p>
        </div>
      </TouchPad>

      {/* Joystick: 왼쪽 하단 */}
      <div className="absolute bottom-10 left-8 z-20">
        <Joystick
          radius={38}
          deadzone={0.1}
          hapticMs={10}
          size={112}
          knobSize={44}
          label="Move"
          onChange={o => throttledMove(o.x, o.y)}
          onRelease={() => transport.sendRaw(ExhibitionCommands.moveDirection(0, 0))}
        />
      </div>

      {/* Side Menu */}
      <SideMenu open={sideOpen} onToggle={() => setSideOpen(v => !v)}>
        <div className="p-4 space-y-5">

          <Section title="Emotion">
            <div className="grid grid-cols-2 gap-2">
              <ActionButton icon={<Smile size={20} />} label="Happy"    activeColor="bg-amber-500/25"  iconColor="text-amber-400"  size="lg" active={activeBtn === 'emotion_happy'}    onClick={() => emotion('happy',    'Happy')} />
              <ActionButton icon={<Frown size={20} />} label="Sad"      activeColor="bg-blue-500/25"   iconColor="text-blue-400"   size="lg" active={activeBtn === 'emotion_sad'}      onClick={() => emotion('sad',      'Sad')} />
              <ActionButton icon={<Zap   size={20} />} label="Angry"    activeColor="bg-red-500/25"    iconColor="text-red-400"    size="lg" active={activeBtn === 'emotion_angry'}    onClick={() => emotion('angry',    'Angry')} />
              <ActionButton icon={<Ghost size={20} />} label="Surprise" activeColor="bg-purple-500/25" iconColor="text-purple-400" size="lg" active={activeBtn === 'emotion_surprise'} onClick={() => emotion('surprise', 'Surprise')} />
            </div>
          </Section>

          <Section title="Stage">
            <div className="grid grid-cols-3 gap-1.5">
              <ActionButton icon={<Sun   size={15} />} label="Day"   active={activeBtn === 'stage_stage.day'}      onClick={() => stageEvt('stage.day',      'Day')} />
              <ActionButton icon={<Moon  size={15} />} label="Night" active={activeBtn === 'stage_stage.night'}    onClick={() => stageEvt('stage.night',    'Night')} />
              <ActionButton icon={<Flame size={15} />} label="Drama" active={activeBtn === 'stage_stage.dramatic'} onClick={() => stageEvt('stage.dramatic', 'Dramatic')} />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <ActionButton icon={<Sparkles size={15} />} label="Spot On"  active={activeBtn === 'stage_light.spotOn'}  onClick={() => stageEvt('light.spotOn',  'Spot On')} />
              <ActionButton icon={<Moon     size={15} />} label="Spot Off" active={activeBtn === 'stage_light.spotOff'} onClick={() => stageEvt('light.spotOff', 'Spot Off')} />
            </div>
          </Section>

          <Section title="Animation">
            <div className="grid grid-cols-3 gap-1.5">
              <ActionButton icon={<Play size={13} />} label="Wave" active={activeBtn === 'anim_wave'} onClick={() => animate('wave', 'Wave')} />
              <ActionButton icon={<Play size={13} />} label="Bow"  active={activeBtn === 'anim_bow'}  onClick={() => animate('bow',  'Bow')} />
              <ActionButton icon={<Play size={13} />} label="Clap" active={activeBtn === 'anim_clap'} onClick={() => animate('clap', 'Clap')} />
            </div>
          </Section>

          <ActionButton
            icon={<RotateCcw size={12} />}
            label="Reset Scene"
            size="sm"
            active={activeBtn === 'reset'}
            onClick={() => sendButton(ExhibitionCommands.reset(), 'Reset', 'reset')}
            className="w-full"
          />

        </div>
      </SideMenu>

      {/* Feedback banner */}
      <ResultBanner banner={banner} />
    </ControllerShell>
  );
};
