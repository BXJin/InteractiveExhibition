using Exhibition.Shared.Commands;

namespace ExhibitionServer.Realtime.Abstractions;

/// <summary>
/// Unreal Engine WebSocket 연결들에 명령을 브로드캐스트하는 인터페이스.
/// </summary>
public interface IUnrealBroadcaster
{
    /// <summary>현재 연결된 Unreal 인스턴스 수</summary>
    int ConnectionCount { get; }

    /// <summary>연결된 모든 Unreal 인스턴스에 명령을 전송합니다.</summary>
    Task<BroadcastResult> BroadcastAsync(ExhibitionCommand command, CancellationToken cancellationToken = default);
}

/// <summary>브로드캐스트 결과</summary>
public sealed record BroadcastResult(
    int ConnectionCount,
    int Attempted,
    int Sent
);
