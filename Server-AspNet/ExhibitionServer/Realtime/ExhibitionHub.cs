using Exhibition.Shared.Commands;
using ExhibitionServer.Application.Abstractions;
using Microsoft.AspNetCore.SignalR;

namespace ExhibitionServer.Realtime;

/// <summary>
/// 모바일 패널 ↔ 서버 실시간 통신 허브.
///
/// 두 가지 채널로 분리:
/// - SendCommand: 저빈도 입력 (감정, 스테이지, 애니메이션) → 검증 후 Unreal 전달 + 결과 반환
/// - SendRaw:     고빈도 입력 (조이스틱, 터치패드 회전)   → 검증 최소화, fire-and-forget
///
/// SignalR은 내부적으로 WebSocket을 사용하므로 HTTP POST 대비 연결 오버헤드 제거.
/// 나중에 WebRTC DataChannel로 교체 시 이 Hub 자체를 교체하면 되고,
/// ICommandDispatcher / IUnrealBroadcaster 레이어는 그대로 유지.
/// </summary>
public sealed class ExhibitionHub : Hub
{
    private readonly ICommandDispatcher _dispatcher;
    private readonly ILogger<ExhibitionHub> _logger;

    public ExhibitionHub(ICommandDispatcher dispatcher, ILogger<ExhibitionHub> logger)
    {
        _dispatcher = dispatcher;
        _logger     = logger;
    }

    public override Task OnConnectedAsync()
    {
        _logger.LogInformation(
            "Panel connected. ConnectionId={ConnectionId}",
            Context.ConnectionId);

        return base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation(
            "Panel disconnected. ConnectionId={ConnectionId}, Error={Error}",
            Context.ConnectionId,
            exception?.Message);

        return base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// 저빈도 커맨드 전송. 결과를 클라이언트에 반환합니다.
    /// 감정 변경, 스테이지 이벤트, 애니메이션 재생 등.
    /// </summary>
    public async Task<CommandResult> SendCommand(ExhibitionCommand command)
    {
        try
        {
            var result = await _dispatcher.DispatchAsync(command, Context.ConnectionAborted);

            return new CommandResult(
                true,
                result.CommandId,
                result.UnrealConnections,
                result.BroadcastSent,
                null);
        }
        catch (ArgumentException ex)
        {
            return new CommandResult(false, command.CommandId, 0, 0, ex.Message);
        }
    }

    /// <summary>
    /// 고빈도 커맨드 전송. Fire-and-forget — 결과를 반환하지 않습니다.
    /// 조이스틱 이동, 터치패드 회전 등 초당 12~15회 전송되는 입력.
    ///
    /// 검증 실패 시에도 예외를 던지지 않고 로그만 남깁니다.
    /// 고빈도 입력에서 예외는 연결 안정성을 해칩니다.
    /// </summary>
    public async Task SendRaw(ExhibitionCommand command)
    {
        try
        {
            await _dispatcher.DispatchAsync(command, Context.ConnectionAborted);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(
                ex,
                "SendRaw failed. Type={Type}, ConnectionId={ConnectionId}",
                command.GetType().Name,
                Context.ConnectionId);
        }
    }
}

/// <summary>Hub → 클라이언트 반환 DTO</summary>
public sealed record CommandResult(
    bool   Ok,
    Guid   CommandId,
    int    UnrealConnections,
    int    BroadcastSent,
    string? Error
);
