namespace ExhibitionServer.Realtime;

/// <summary>
/// Unreal Engine WebSocket 연결을 처리하는 미들웨어.
/// /ws/unreal 경로로 들어오는 WebSocket 요청을 UnrealConnectionManager에 위임합니다.
///
/// Program.cs에 인라인 람다 대신 클래스로 분리하여:
/// - 테스트 가능성 확보
/// - 로깅/인증 등 cross-cutting concern 추가 용이
/// - Program.cs는 조립만 담당
/// </summary>
public sealed class UnrealWebSocketMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<UnrealWebSocketMiddleware> _logger;

    public UnrealWebSocketMiddleware(RequestDelegate next, ILogger<UnrealWebSocketMiddleware> logger)
    {
        _next   = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Path != "/ws/unreal")
        {
            await _next(context);
            return;
        }

        if (!context.WebSockets.IsWebSocketRequest)
        {
            _logger.LogWarning("Non-WebSocket request to /ws/unreal from {RemoteIp}",
                context.Connection.RemoteIpAddress);

            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            return;
        }

        var manager = context.RequestServices.GetRequiredService<UnrealConnectionManager>();

        using var socket = await context.WebSockets.AcceptWebSocketAsync();
        var connectionId = manager.Add(socket);

        await manager.RunReceiveLoopAsync(connectionId, context.RequestAborted);
    }
}

/// <summary>미들웨어 등록 확장 메서드</summary>
public static class UnrealWebSocketMiddlewareExtensions
{
    public static IApplicationBuilder UseUnrealWebSocket(this IApplicationBuilder app)
    {
        return app.UseMiddleware<UnrealWebSocketMiddleware>();
    }
}
