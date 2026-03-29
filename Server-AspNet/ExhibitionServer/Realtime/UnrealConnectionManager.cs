using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Exhibition.Shared.Commands;
using Microsoft.Extensions.Logging;

namespace ExhibitionServer.Realtime
{
    public sealed class UnrealConnectionManager
    {
        private readonly ConcurrentDictionary<string, UnrealConnection> _connections = new();
        private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);
        private readonly ILogger<UnrealConnectionManager> _logger;

        public UnrealConnectionManager(ILogger<UnrealConnectionManager> logger)
        {
            _logger = logger;
        }

        public int ConnectionCount => _connections.Count;

        public string Add(WebSocket socket)
        {
            var connectionId = Guid.NewGuid().ToString("n");
            _connections[connectionId] = new UnrealConnection(socket);

            _logger.LogInformation("Unreal connected. ConnectionId={ConnectionId}, Count={Count}", connectionId, ConnectionCount);

            return connectionId;
        }

        public async Task RemoveAsync(string connectionId, CancellationToken cancellationToken)
        {
            if (!_connections.TryRemove(connectionId, out var connection))
            {
                return;
            }

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
            catch
            {
                // 연결 종료 중 예외는 무시(MVP)
            }
            finally
            {
                connection.SendLock.Dispose();
                connection.Socket.Dispose();

                _logger.LogInformation("Unreal disconnected. ConnectionId={ConnectionId}, Count={Count}", connectionId, ConnectionCount);
            }
        }

        public async Task RunReceiveLoopAsync(string connectionId, CancellationToken cancellationToken)
        {
            if (!_connections.TryGetValue(connectionId, out var connection))
            {
                return;
            }

            var buffer = new byte[4 * 1024];

            try
            {
                while (!cancellationToken.IsCancellationRequested &&
                       connection.Socket.State == WebSocketState.Open)
                {
                    var result = await connection.Socket.ReceiveAsync(buffer, cancellationToken);

                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        break;
                    }

                    // MVP: Unreal -> Server 메시지는 아직 사용하지 않으므로 폐기
                }
            }
            catch
            {
                // 끊김/에러는 아래 Remove에서 정리
            }
            finally
            {
                await RemoveAsync(connectionId, cancellationToken);
            }
        }

        public async Task<BroadcastResult> BroadcastAsync(ExhibitionCommand command, CancellationToken cancellationToken)
        {
            var json = JsonSerializer.Serialize(command, command.GetType(), _jsonOptions);
            var payload = Encoding.UTF8.GetBytes(json);

            var attempted = 0;
            var sent = 0;

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
                catch
                {
                    await RemoveAsync(connectionId, cancellationToken);
                }
                finally
                {
                    if (connection.SendLock.CurrentCount == 0)
                    {
                        connection.SendLock.Release();
                    }
                }
            }

            _logger.LogInformation(
                "Broadcast done. CommandId={CommandId}, Attempted={Attempted}, Sent={Sent}, Connections={Connections}",
                command.CommandId,
                attempted,
                sent,
                ConnectionCount);

            return new BroadcastResult(attempted, sent);
        }

        public sealed record BroadcastResult(int Attempted, int Sent);

        private sealed class UnrealConnection
        {
            public UnrealConnection(WebSocket socket)
            {
                Socket = socket;
                SendLock = new SemaphoreSlim(1, 1);
            }

            public WebSocket Socket { get; }

            public SemaphoreSlim SendLock { get; }
        }
    }
}