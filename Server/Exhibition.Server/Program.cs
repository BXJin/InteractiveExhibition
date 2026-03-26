using Exhibition.Shared.Commands;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

app.MapPost("/commands", (ExhibitionCommand command, ILogger<Program> logger) =>
{
    logger.LogInformation(
        "Command received. Type={CommandType}, CommandId={CommandId}, CharacterId={CharacterId}, TargetId={TargetId}",
        command.GetType().Name,
        command.CommandId,
        command.CharacterId,
        command.TargetId);

    return Results.Accepted($"/commands/{command.CommandId}", command);
});

app.Run();