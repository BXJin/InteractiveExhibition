import {
  HubConnectionBuilder,
  HubConnection,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import type {
  ITransport,
  SendResult,
  ConnectionState,
  ConnectionStateListener,
} from './types';

/**
 * SignalR 기반 Transport 구현체.
 *
 * HTTP POST 대비 장점:
 * - 연결 유지: 매 요청마다 TCP/TLS 핸드셰이크 없음
 * - 양방향: 서버→클라이언트 푸시 가능 (향후 상태 동기화)
 * - 고빈도 입력에 적합: WebSocket 위에서 동작
 * - MessagePack: binary 직렬화로 페이로드 감소
 *
 * 나중에 WebRTC DataChannel로 교체 시 이 클래스만 교체하면 됨.
 * ITransport 인터페이스는 그대로 유지.
 */
export class SignalRTransport implements ITransport {
  private readonly _connection: HubConnection;
  private readonly _listeners = new Set<ConnectionStateListener>();
  private _state: ConnectionState = 'disconnected';
  private _isDisposed = false;

  constructor(baseUrl: string, hubPath = '/hub/exhibition') {
    const url = `${baseUrl.replace(/\/+$/, '')}${hubPath}`;

    this._connection = new HubConnectionBuilder()
      .withUrl(url)
      .withAutomaticReconnect({
        // 재연결 간격: 즉시 → 1초 → 3초 → 5초 → 이후 5초 반복
        nextRetryDelayInMilliseconds: (ctx) => {
          const delays = [0, 1000, 3000, 5000];
          return delays[Math.min(ctx.previousRetryCount, delays.length - 1)];
        },
      })
      .configureLogging(LogLevel.Warning)
      .build();

    // 연결 상태 이벤트 바인딩
    this._connection.onreconnecting(() => this._setState('connecting'));
    this._connection.onreconnected(() => this._setState('connected'));
    this._connection.onclose(() => this._setState('disconnected'));
  }

  get state(): ConnectionState {
    return this._state;
  }

  /** 연결 시작 (TransportProvider에서 호출) */
  async start(): Promise<void> {
    if (this._isDisposed) return;
    if (this._connection.state !== HubConnectionState.Disconnected) return;

    this._setState('connecting');

    try {
      await this._connection.start();
      // dispose가 start() 진행 중 호출됐을 수 있으므로 재확인
      if (this._isDisposed) {
        this._connection.stop().catch(() => {});
        return;
      }
      this._setState('connected');
    } catch {
      this._setState('disconnected');
    }
  }

  async send(payload: Record<string, unknown>): Promise<SendResult> {
    if (this._connection.state !== HubConnectionState.Connected) {
      return { ok: false, error: 'Not connected' };
    }

    try {
      const result = await this._connection.invoke<{
        ok: boolean;
        commandId: string;
        unrealConnections: number;
        broadcastSent: number;
        error: string | null;
      }>('SendCommand', payload);

      if (result.ok) {
        return {
          ok: true,
          data: {
            commandId: result.commandId,
            unrealConnections: result.unrealConnections,
            broadcastSent: result.broadcastSent,
          },
        };
      }

      return { ok: false, error: result.error ?? 'Unknown error' };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  sendRaw(payload: Record<string, unknown>): void {
    if (this._connection.state !== HubConnectionState.Connected) return;

    // fire-and-forget: send()는 Promise를 반환하지만 await하지 않음
    this._connection.send('SendRaw', payload).catch(() => {});
  }

  onStateChange(listener: ConnectionStateListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  dispose(): void {
    if (this._isDisposed) return;
    this._isDisposed = true;
    // Notify listeners before clearing so any still-active observer
    // (e.g. a hot-reload or out-of-band dispose) sees the final state.
    this._setState('disconnected');
    this._listeners.clear();
    this._connection.stop().catch(() => {});
  }

  private _setState(state: ConnectionState): void {
    if (this._state === state) return;
    this._state = state;
    this._listeners.forEach((fn) => fn(state));
  }
}
