/**
 * 게임 패널 → 서버 통신 추상화.
 *
 * 왜 인터페이스로 분리하는가:
 * - HTTP (REST), WebSocket, gRPC 등 전송 수단이 바뀔 수 있음
 * - 테스트 시 MockTransport로 교체 가능
 * - 패널 컴포넌트는 "어떻게 보내느냐"를 모름, "무엇을 보내느냐"만 앎
 */

/** 서버 전송 결과 */
export interface SendResult {
  ok: boolean;
  /** 서버 응답 데이터 (성공 시) */
  data?: Record<string, unknown>;
  /** 에러 메시지 (실패 시) */
  error?: string;
}

/** 연결 상태 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

/** 연결 상태 변경 콜백 */
export type ConnectionStateListener = (state: ConnectionState) => void;

/** 전송 수단 인터페이스 */
export interface ITransport {
  /**
   * 커맨드를 서버로 전송하고 결과를 반환합니다.
   * 버튼 입력처럼 피드백이 필요한 경우 사용.
   */
  send(payload: Record<string, unknown>): Promise<SendResult>;

  /**
   * Fire-and-forget 전송.
   * 조이스틱/터치패드처럼 고빈도 연속 입력에 사용.
   * 실패해도 무시하고 다음 입력을 보냄.
   */
  sendRaw(payload: Record<string, unknown>): void;

  /** 연결 상태 변경 리스너 등록. 해제 함수 반환. */
  onStateChange?(listener: ConnectionStateListener): () => void;

  /** 현재 연결 상태 */
  readonly state?: ConnectionState;

  /** 리소스 정리 (WebSocket/SignalR 연결 해제 등) */
  dispose?(): void;
}
