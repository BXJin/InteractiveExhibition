using Microsoft.AspNetCore.Server.Kestrel.Core;

namespace ExhibitionServer.Configuration;

/// <summary>
/// Kestrel 서버 저지연 튜닝.
///
/// 이 프로젝트의 특성:
/// - 모바일 패널에서 초당 12~15회 고빈도 입력 전송
/// - 서버→Unreal 브로드캐스트 지연이 UX에 직접 영향
/// - 동시 접속 수는 적음 (전시 환경: 1~5 클라이언트)
///
/// 따라서 throughput보다 latency 최적화에 집중합니다.
/// </summary>
public static class KestrelConfiguration
{
    public static WebApplicationBuilder ConfigureKestrel(this WebApplicationBuilder builder)
    {
        // Nagle 알고리즘 비활성화: 작은 패킷을 즉시 전송
        // 기본값은 true (버퍼링) → false로 바꾸면 ~40ms 지연 제거
        builder.WebHost.UseSockets(socketOptions =>
        {
            socketOptions.NoDelay = true;
        });

        builder.WebHost.ConfigureKestrel(options =>
        {
            // ── HTTP 레벨 ──

            options.Limits.MaxConcurrentConnections         = 100;
            options.Limits.MaxConcurrentUpgradedConnections = 50; // WebSocket 업그레이드 연결

            // Keep-alive: 연결 재사용으로 핸드셰이크 오버헤드 제거
            options.Limits.KeepAliveTimeout = TimeSpan.FromMinutes(5);

            // 요청 헤더 타임아웃: 느린 클라이언트 빠르게 정리
            options.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(10);

            // 요청 바디 최대 크기 (커맨드 JSON은 작으므로 제한)
            options.Limits.MaxRequestBodySize = 64 * 1024; // 64KB

            // ── 응답 버퍼 ──

            // 최소 응답 데이터 전송률: 매우 느린 연결 빠르게 끊기
            options.Limits.MinResponseDataRate = new MinDataRate(
                bytesPerSecond: 240,
                gracePeriod: TimeSpan.FromSeconds(5));
        });

        return builder;
    }
}
