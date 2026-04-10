import React from 'react';

// ─────────────────────────────────────
// Types
// ─────────────────────────────────────

export type ConnectionStatus = 'ready' | 'sending' | 'ok' | 'error';

export interface StatusBarProps {
  /** 앱 타이틀 */
  title: string;
  /** 서버 URL 표시 */
  subtitle?: string;
  /** 현재 상태 */
  status: ConnectionStatus;
  /** 왼쪽 아이콘 */
  icon?: React.ReactNode;
  /** 오른쪽 액션 영역 */
  actions?: React.ReactNode;
}

// ─────────────────────────────────────
// Status config
// ─────────────────────────────────────

const STATUS_CONFIG: Record<ConnectionStatus, { label: string; pill: string; dot: string }> = {
  ready:   { label: 'Ready',   pill: 'bg-white/5 text-white/20',          dot: 'bg-white/15' },
  sending: { label: 'Sending', pill: 'bg-amber-500/15 text-amber-400',    dot: 'bg-amber-400 animate-pulse' },
  ok:      { label: 'OK',      pill: 'bg-emerald-500/15 text-emerald-400', dot: 'bg-emerald-400' },
  error:   { label: 'Error',   pill: 'bg-red-500/15 text-red-400',        dot: 'bg-red-400' },
};

// ─────────────────────────────────────
// Component
// ─────────────────────────────────────

/**
 * 상단 상태 바 — 타이틀, 연결 상태, 액션 버튼 표시.
 * 게임 종류에 무관하게 재사용 가능.
 */
export const StatusBar: React.FC<StatusBarProps> = ({
  title,
  subtitle,
  status,
  icon,
  actions,
}) => {
  const cfg = STATUS_CONFIG[status];

  return (
    <div className="shrink-0 bg-[#080808]/95 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center justify-between z-50">
      {/* Left: icon + title */}
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && (
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-[11px] font-bold tracking-widest uppercase text-white/90 leading-none mb-0.5 truncate">
            {title}
          </div>
          {subtitle && (
            <div className="text-[8px] text-white/25 font-mono leading-none truncate">
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {/* Right: status pill + actions */}
      <div className="flex items-center gap-2 shrink-0">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-mono uppercase tracking-wider ${cfg.pill}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </div>
        {actions}
      </div>
    </div>
  );
};
