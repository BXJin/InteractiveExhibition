using System.Buffers;
using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text.Json;
using Exhibition.Shared.Commands;
using ExhibitionServer.Realtime.Abstractions;

namespace ExhibitionServer.Realtime;

/// <summary>
/// Unreal Engine WebSocket 연결을 관리하고 명령을 브로드캐스트합니다.
/// 단일 책임: 연결 생명주기 관리 + 브로드캐스트 실행.
///
/// 메모리 최적화:
/// - ArrayPool&lt;byte&gt;로 직렬화 버퍼 재활용 (GC 압력 감소)
/// - Utf8JsonWriter로 직렬화하여 string→byte[] 변환 할당 제거
/// - 수신 버퍼도 ArrayPool에서 임대
/// </summary>
public sealed class UnrealConnectionManager : IUnrealBroadcaster
{
    private readonly ConcurrentDictionary<string, UnrealConnection> _connections = new();
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);
    private readonly ILogger<UnrealConnectionManager> _logger;

    private const int SendBufferSize    = 4 * 1024;
    private const int ReceiveBufferSize = 4 * 1024;

    public UnrealConnectionManager(ILogger<UnrealConnectionManager> logger)
    {
        _logger = logger;
    }

    /// <inheritdoc />
    public int ConnectionCount => _connections.Count;

    // ─────────────────────────────────────
    // 연결 관리
    // ─────────────────────────────────────

    /// <summary>새 WebSocket 연결을 등록하고 connectionId를 반환합니다.</summary>
    public string Add(WebSocket socket)
    {
        var connectionId = Guid.NewGuid().ToString("n");
        _connections[connectionId] = new UnrealConnection(socket);

        _logger.LogInformation(
            "Unreal connected. ConnectionId={ConnectionId}, Total={Count}",
            connectionId, ConnectionCount);

        return connectionId;
    }

    /// <summary>연결을 제거하고 WebSocket을 정상 종료합니다.</summary>
    public async Task RemoveAsync(string connectionId, CancellationToken cancellationToken)
    {
        if (!_connections.TryRemove(connectionId, out var connection))
            return;

        try
        {
            if (connection.Socket.State is WebSocketState.Open or WebSocketState.CloseReceived)
            {
                await connection.Socket.CloseAsync(
                    WebSocketCloseStatus.NormalClosure,
                    "Closing",
                    cancellationToken);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error while closing WebSocket. ConnectionId={ConnectionId}", connectionId);
        }
        finally
        {
            connection.SendLock.Dispose();
            connection.Socket.Dispose();

            _logger.LogInformation(
                "Unreal disconnected. ConnectionId={ConnectionId}, Total={Count}",
                connectionId, ConnectionCount);
        }
    }

    /// <summary>
    /// Unreal로부터 오는 메시지를 수신하는 루프.
    /// 연결이 끊어지거나 취소될 때까지 대기합니다.
    /// </summary>
    public async Task RunReceiveLoopAsync(string connectionId, CancellationToken cancellationToken)
    {
        if (!_connections.TryGetValue(connectionId, out var connection))
            return;

        var buffer = ArrayPool<byte>.Shared.Rent(ReceiveBufferSize);

        try
        {
            while (!cancellationToken.IsCancellationRequested &&
                   connection.Socket.State == WebSocketState.Open)
            {
                var result = await connection.Socket.ReceiveAsync(
                    new ArraySegment<byte>(buffer), cancellationToken);

                if (result.MessageType == WebSocketMessageType.Close)
                    break;

                // TODO Phase 2: Unreal → Server 메시지 처리 (상태 동기화, ACK 등)
            }
        }
        catch (OperationCanceledException) { /* 정상 종료 */ }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Receive loop error. ConnectionId={ConnectionId}", connectionId);
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer);
            await RemoveAsync(connectionId, cancellationToken);
        }
    }

    // ─────────────────────────────────────
    // 브로드캐스트 (IUnrealBroadcaster)
    // ─────────────────────────────────────

    /// <inheritdoc />
    public async Task<BroadcastResult> BroadcastAsync(ExhibitionCommand command, CancellationToken cancellationToken = default)
    {
        // ArrayPool 기반 직렬화: string 중간 할당 없이 바로 byte[]로 직렬화
        var buffer = ArrayPool<byte>.Shared.Rent(SendBufferSize);
        int written;

        try
        {
            using var stream = new MemoryStream(buffer);
            using var writer = new Utf8JsonWriter(stream);

            // 다형성 직렬화: "type" discriminator가 JSON에 포함되어야 Unreal이 파싱 가능
            JsonSerializer.Serialize(writer, command, typeof(ExhibitionCommand), _jsonOptions);
            written = (int)stream.Position;
        }
        catch
        {
            ArrayPool<byte>.Shared.Return(buffer);
            throw;
        }

        var payload = new ArraySegment<byte>(buffer, 0, written);

        var attempted = 0;
        var sent      = 0;

        try
        {
            foreach (var (connectionId, connection) in _connections.ToArray())
            {
                attempted++;

                if (connection.Socket.State != WebSocketState.Open)
                {
                    await RemoveAsync(connectionId, cancellationToken);
                    continue;
                }

                try
                {
                    await connection.SendLock.WaitAsync(cancellationToken);

                    await connection.Socket.SendAsync(
                        payload,
                        WebSocketMessageType.Text,
                        endOfMessage: true,
                        cancellationToken);

                    sent++;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Broadcast send failed. ConnectionId={ConnectionId}", connectionId);
                    await RemoveAsync(connectionId, cancellationToken);
                }
                finally
                {
                    if (connection.SendLock.CurrentCount == 0)
                        connection.SendLock.Release();
                }
            }
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer);
        }

        _logger.LogInformation(
            "Broadcast complete. CommandId={CommandId}, Attempted={Attempted}, Sent={Sent}",
            command.CommandId, attempted, sent);

        return new BroadcastResult(ConnectionCount, attempted, sent);
    }

    // ─────────────────────────────────────
    // 내부 타입
    // ─────────────────────────────────────

    private sealed class UnrealConnection
    {
        public UnrealConnection(WebSocket socket)
        {
            Socket   = socket;
            SendLock = new SemaphoreSlim(1, 1);
        }

        public WebSocket     Socket   { get; }
        public SemaphoreSlim SendLock { get; }
    }
}
