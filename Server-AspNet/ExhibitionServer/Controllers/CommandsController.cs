using Exhibition.Shared.Commands;
using ExhibitionServer.Realtime;
using Microsoft.AspNetCore.Mvc;

namespace ExhibitionServer.Controllers
{
    [ApiController]
    [Route("commands")]
    public sealed class CommandsController : ControllerBase
    {
        private readonly ILogger<CommandsController> _logger;
        private readonly UnrealConnectionManager _unrealConnectionManager;

        public CommandsController(
            ILogger<CommandsController> logger,
            UnrealConnectionManager unrealConnectionManager)
        {
            _logger = logger;
            _unrealConnectionManager = unrealConnectionManager;
        }

        [HttpPost]
        public async Task<IActionResult> Post([FromBody] ExhibitionCommand command, CancellationToken cancellationToken)
        {
            _logger.LogInformation(
                "Command received. Type={CommandType}, CommandId={CommandId}, CharacterId={CharacterId}, TargetId={TargetId}",
                command.GetType().Name,
                command.CommandId,
                command.CharacterId,
                command.TargetId);

            await _unrealConnectionManager.BroadcastAsync(command, cancellationToken);

            return Accepted(new
            {
                command.CommandId,
                command.CreatedAt
            });
        }
    }
}