using ExhibitionServer.Application;
using ExhibitionServer.Application.Abstractions;
using ExhibitionServer.Realtime;
using ExhibitionServer.Realtime.Abstractions;

var builder = WebApplication.CreateBuilder(args);

// ─────────────────────────────────────
// Services
// ─────────────────────────────────────

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS: 모바일 패널(React/Vite) 접근 허용
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader()));

// Infrastructure - Realtime
// UnrealConnectionManager를 싱글톤으로 등록하고 IUnrealBroadcaster로도 해석되도록 매핑
builder.Services.AddSingleton<UnrealConnectionManager>();
builder.Services.AddSingleton<IUnrealBroadcaster>(sp =>
    sp.GetRequiredService<UnrealConnectionManager>());

// Application
builder.Services.AddScoped<ICommandDispatcher, CommandDispatcher>();

// ─────────────────────────────────────
// Middleware Pipeline
// ─────────────────────────────────────

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseAuthorization();
app.UseWebSockets();

// ─────────────────────────────────────
// WebSocket Endpoint (Unreal 연결)
// ─────────────────────────────────────

// Unreal에서 ws(s)://<host>/ws/unreal 로 연결
app.Map("/ws/unreal", async context =>
{
    if (!context.WebSockets.IsWebSocketRequest)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        return;
    }

    var manager = context.RequestServices.GetRequiredService<UnrealConnectionManager>();

    using var socket     = await context.WebSockets.AcceptWebSocketAsync();
    var       connectionId = manager.Add(socket);

    await manager.RunReceiveLoopAsync(connectionId, context.RequestAborted);
});

// ─────────────────────────────────────
// REST Endpoints
// ─────────────────────────────────────

app.MapControllers();
app.Run();
