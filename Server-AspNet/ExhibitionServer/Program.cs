using ExhibitionServer.Realtime;

var builder = WebApplication.CreateBuilder(args);

// Services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS: 모바일 패널 (React/Vite) 접근 허용
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader());
});

// WebSocket connection manager (Unreal connections)
builder.Services.AddSingleton<UnrealConnectionManager>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();

app.UseAuthorization();

// Enable WebSockets
app.UseWebSockets();

// Unreal connects here: ws(s)://<host>/ws/unreal
app.Map("/ws/unreal", async context =>
{
    if (!context.WebSockets.IsWebSocketRequest)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        return;
    }

    var manager = context.RequestServices.GetRequiredService<UnrealConnectionManager>();

    using var socket = await context.WebSockets.AcceptWebSocketAsync();
    var connectionId = manager.Add(socket);

    await manager.RunReceiveLoopAsync(connectionId, context.RequestAborted);
});

app.MapControllers();
app.Run();
