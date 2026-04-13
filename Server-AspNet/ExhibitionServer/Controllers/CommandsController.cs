using Exhibition.Shared.Commands;
using ExhibitionServer.Application.Abstractions;
using Microsoft.AspNetCore.Mvc;

namespace ExhibitionServer.Controllers;

/// <summary>
/// 모바일 패널로부터 ExhibitionCommand를 수신하는 HTTP 엔드포인트.
/// 책임: HTTP 요청/응답 처리만 담당. 비즈니스 로직은 ICommandDispatcher에 위임. (SRP)
/// </summary>
[ApiController]
[Route("commands")]
public sealed class CommandsController : ControllerBase
{
    private readonly ICommandDispatcher _dispatcher;

    public CommandsController(ICommandDispatcher dispatcher)
    {
        _dispatcher = dispatcher;
    }

    /// <summary>
    /// POST /commands
    /// 커맨드를 수신하여 Unreal Engine으로 전달합니다.
    /// </summary>
    /// <remarks>
    /// type 필드로 커맨드 종류를 구분합니다:
    /// - setEmotion, playAnimation, triggerStageEvent, moveDirection, rotate
    /// </remarks>
    [HttpPost]
    public async Task<IActionResult> Post([FromBody] ExhibitionCommand command, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _dispatcher.DispatchAsync(command, cancellationToken);

            return Accepted(new
            {
                commandId          = result.CommandId,
                createdAt          = result.CreatedAt,
                unrealConnections  = result.UnrealConnections,
                broadcastAttempted = result.BroadcastAttempted,
                broadcastSent      = result.BroadcastSent,
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
