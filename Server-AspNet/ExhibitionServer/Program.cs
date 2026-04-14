using ExhibitionServer.Configuration;

// ─────────────────────────────────────
// Builder
// ─────────────────────────────────────

var builder = WebApplication.CreateBuilder(args);

builder.ConfigureKestrel();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddExhibitionCors();
builder.Services.AddExhibitionSignalR();
builder.Services.AddExhibitionServices();

// ─────────────────────────────────────
// App
// ─────────────────────────────────────

var app = builder.Build();

app.UseExhibitionPipeline();
app.MapExhibitionEndpoints();

app.Run();
