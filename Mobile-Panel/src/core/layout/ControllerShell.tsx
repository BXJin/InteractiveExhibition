import React from 'react';

// ─────────────────────────────────────
// Types
// ─────────────────────────────────────

export interface ControllerShellProps {
  /** 상단 StatusBar */
  header: React.ReactNode;
  /** 메인 인터랙션 영역 (조이스틱 + 터치패드 + 사이드메뉴) */
  children: React.ReactNode;
  /** 하단 footer 텍스트 */
  footer?: React.ReactNode;
}

// ─────────────────────────────────────
// Component
// ─────────────────────────────────────

/**
 * 모바일 컨트롤러 전체 프레임.
 *
 * 레이아웃 구조:
 * ┌──────────────────────┐
 * │      StatusBar       │ ← sticky header
 * ├──────────────────────┤
 * │                      │
 * │    Main Area         │ ← flex-1, 조이스틱/터치패드/사이드메뉴
 * │                      │
 * ├──────────────────────┤
 * │      Footer          │ ← 고정 하단
 * └──────────────────────┘
 *
 * 화면 전체를 덮으며 스크롤 방지 + 터치 기본 동작 차단.
 */
export const ControllerShell: React.FC<ControllerShellProps> = ({
  header,
  children,
  footer,
}) => (
  <div className="w-screen h-dvh bg-[#080808] text-white flex flex-col overflow-hidden select-none touch-none">
    {/* Header */}
    {header}

    {/* Main interaction area */}
    <div className="flex-1 relative overflow-hidden">
      {children}
    </div>

    {/* Footer */}
    {footer && (
      <div className="shrink-0 px-4 py-2.5 border-t border-white/5 text-[7px] font-mono text-white/10 uppercase tracking-widest text-center">
        {footer}
      </div>
    )}
  </div>
);
