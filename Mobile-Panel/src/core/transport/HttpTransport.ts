import type { ITransport, SendResult } from './types';

/**
 * HTTP(REST) 기반 Transport 구현체.
 *
 * POST JSON → 서버 엔드포인트.
 * ASP.NET Core, Express, FastAPI 등 어떤 REST 서버든 동일하게 사용 가능.
 */
export class HttpTransport implements ITransport {
  private readonly _baseUrl: string;
  private readonly _path: string;

  /**
   * @param baseUrl  서버 기본 URL (예: http://192.168.0.10:5225)
   * @param path     엔드포인트 경로 (예: /commands)
   */
  constructor(baseUrl: string, path = '/commands') {
    // 끝 슬래시 제거
    this._baseUrl = baseUrl.replace(/\/+$/, '');
    this._path    = path.startsWith('/') ? path : `/${path}`;
  }

  get url(): string {
    return `${this._baseUrl}${this._path}`;
  }

  async send(payload: Record<string, unknown>): Promise<SendResult> {
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => `HTTP ${res.status}`);
        return { ok: false, error: text || `HTTP ${res.status}` };
      }

      const data = await res.json().catch(() => ({}));
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  sendRaw(payload: Record<string, unknown>): void {
    // fire-and-forget: 응답/에러 무시
    fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }
}
