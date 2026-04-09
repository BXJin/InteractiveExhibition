using Exhibition.Shared.Commands;

namespace ExhibitionServer.Application.Abstractions;

/// <summary>
/// 수신된 ExhibitionCommand를 검증하고 실행 레이어(Unreal)로 전달하는 인터페이스.
/// 컨트롤러는 이 인터페이스에만 의존하며 인프라 구현에는 의존하지 않습니다. (DIP)
/// </summary>
public interface ICommandDispatcher
{
    Task<DispatchResult> DispatchAsync(ExhibitionCommand command, CancellationToken cancellationToken = default);
}

/// <summary>디스패치 결과 - 컨트롤러가 HTTP 응답을 구성하는 데 사용합니다.</summary>
public sealed record DispatchResult(
    Guid            CommandId,
    DateTimeOffset  CreatedAt,
    int             UnrealConnections,
    int             BroadcastAttempted,
    int             BroadcastSent
);
