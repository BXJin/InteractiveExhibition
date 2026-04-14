using ExhibitionServer.Application;
using ExhibitionServer.Application.Abstractions;
using ExhibitionServer.Realtime;
using ExhibitionServer.Realtime.Abstractions;

namespace ExhibitionServer.Configuration;

/// <summary>
/// DI 컨테이너 서비스 등록을 한곳에서 관리합니다.
/// Program.cs는 이 메서드만 호출하면 되므로 서비스 변경 시 Program.cs를 건드리지 않아도 됩니다.
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>Exhibition 도메인 서비스 등록</summary>
    public static IServiceCollection AddExhibitionServices(this IServiceCollection services)
    {
        // Realtime — Unreal WebSocket 연결 관리
        services.AddSingleton<UnrealConnectionManager>();
        services.AddSingleton<IUnrealBroadcaster>(sp =>
            sp.GetRequiredService<UnrealConnectionManager>());

        // Application — 커맨드 디스패처
        services.AddScoped<ICommandDispatcher, CommandDispatcher>();

        return services;
    }

    /// <summary>SignalR 허브 서비스 등록 (MessagePack 프로토콜 포함)</summary>
    public static IServiceCollection AddExhibitionSignalR(this IServiceCollection services)
    {
        services.AddSignalR(options =>
        {
            // 고빈도 입력 시 유실 방지
            options.MaximumReceiveMessageSize = 32 * 1024;

            // 클라이언트 타임아웃 (기본 30초 → 15초: 끊긴 연결 빠르게 감지)
            options.ClientTimeoutInterval = TimeSpan.FromSeconds(15);

            // Keep-alive 주기 (기본 15초 → 5초: 연결 생존 빠르게 확인)
            options.KeepAliveInterval = TimeSpan.FromSeconds(5);

            // 스트리밍 버퍼 크기
            options.StreamBufferCapacity = 10;
        })
        .AddMessagePackProtocol(); // binary 직렬화: JSON 대비 ~40% 작은 페이로드, 파싱 비용 절감

        return services;
    }

    /// <summary>CORS 정책 등록 — 모바일 패널(React/Vite)에서 접근 허용</summary>
    public static IServiceCollection AddExhibitionCors(this IServiceCollection services)
    {
        services.AddCors(options =>
            options.AddDefaultPolicy(policy =>
                policy.AllowAnyMethod()
                      .AllowAnyHeader()
                      // SignalR은 AllowCredentials 필요 (쿠키/인증 헤더 전달)
                      // AllowAnyOrigin + AllowCredentials는 동시 사용 불가하므로 SetIsOriginAllowed 사용
                      .SetIsOriginAllowed(_ => true)
                      .AllowCredentials()));

        return services;
    }
}
