using Exhibition.Shared.Commands;
using ExhibitionServer.Application.Abstractions;
using ExhibitionServer.Realtime.Abstractions;

namespace ExhibitionServer.Application;

/// <summary>
/// 커맨드 디스패처 구현체.
/// 책임: 커맨드 유효성 검증 → IUnrealBroadcaster를 통한 전달.
/// 비즈니스 규칙(쿨다운, 우선순위 등)이 추가될 때 이 클래스에서 확장합니다. (OCP)
/// </summary>
public sealed class CommandDispatcher : ICommandDispatcher
{
    private readonly IUnrealBroadcaster _broadcaster;
    private readonly ILogger<CommandDispatcher> _logger;

    public CommandDispatcher(IUnrealBroadcaster broadcaster, ILogger<CommandDispatcher> logger)
    {
        _broadcaster = broadcaster;
        _logger      = logger;
    }

    /// <inheritdoc />
    public async Task<DispatchResult> DispatchAsync(ExhibitionCommand command, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation(
            "Dispatching command. Type={Type}, CharacterId={CharacterId}, CommandId={CommandId}",
            command.GetType().Name, command.CharacterId, command.CommandId);

        Validate(command);

        var broadcast = await _broadcaster.BroadcastAsync(command, cancellationToken);

        return new DispatchResult(
            command.CommandId,
            command.CreatedAt,
            broadcast.ConnectionCount,
            broadcast.Attempted,
            broadcast.Sent);
    }

    // ─────────────────────────────────────
    // 커맨드 유효성 검증
    // 새 커맨드 타입을 추가할 때 case만 추가하면 됩니다. (OCP)
    // ─────────────────────────────────────

    private static void Validate(ExhibitionCommand command)
    {
        var error = command switch
        {
            SetEmotionCommand c when string.IsNullOrWhiteSpace(c.EmotionKey)
                => "EmotionKey는 필수입니다.",

            PlayAnimationCommand c when string.IsNullOrWhiteSpace(c.AnimationKey)
                => "AnimationKey는 필수입니다.",

            TriggerStageEventCommand c when string.IsNullOrWhiteSpace(c.StageEventKey)
                => "StageEventKey는 필수입니다.",

            MoveDirectionCommand c when c.Direction is null
                => "Direction은 필수입니다.",

            RotateCommand c when c.Rotation is null
                => "Rotation은 필수입니다.",

            _ => null
        };

        if (error is not null)
            throw new ArgumentException(error, nameof(command));
    }
}
