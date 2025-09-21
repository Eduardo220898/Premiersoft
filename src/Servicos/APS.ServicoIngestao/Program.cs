using Serilog;
using Microsoft.EntityFrameworkCore;
using MassTransit;
using APS.Infraestrutura.Dados.Contextos;
using APS.ServicoIngestao.Interfaces;
using APS.ServicoIngestao.Servicos;
using FluentValidation;
using AutoMapper;

// Configuração do Serilog
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("logs/servico-ingestao-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);

// Configurar Serilog
builder.Host.UseSerilog();

// Adicionar serviços ao container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { 
        Title = "APS - Serviço de Ingestão de Dados", 
        Version = "v1",
        Description = "API para ingestão e processamento de arquivos de dados de saúde em múltiplos formatos"
    });
});

// Configuração do Entity Framework
builder.Services.AddDbContext<APSDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
    options.UseNpgsql(connectionString);
    options.EnableSensitiveDataLogging(builder.Environment.IsDevelopment());
});

// Configuração do Redis Cache
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
    options.InstanceName = "APS_ServicoIngestao";
});

// Configuração do MassTransit (RabbitMQ)
builder.Services.AddMassTransit(x =>
{
    x.UsingRabbitMq((context, cfg) =>
    {
        cfg.Host(builder.Configuration["RabbitMQ:HostName"], "/", h =>
        {
            h.Username(builder.Configuration["RabbitMQ:UserName"] ?? "guest");
            h.Password(builder.Configuration["RabbitMQ:Password"] ?? "guest");
        });
        
        cfg.ConfigureEndpoints(context);
    });
});

// Configuração do AutoMapper
builder.Services.AddAutoMapper(typeof(Program));

// Configuração do FluentValidation
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

// Registrar serviços de processamento
builder.Services.AddScoped<IProcessadorExcel, ProcessadorExcel>();
builder.Services.AddScoped<IProcessadorXML, ProcessadorXML>();
builder.Services.AddScoped<IProcessadorJSON, ProcessadorJSON>();
builder.Services.AddScoped<IProcessadorHL7, ProcessadorHL7>();
builder.Services.AddScoped<IProcessadorFHIR, ProcessadorFHIR>();
builder.Services.AddScoped<IGerenciadorIngestao, GerenciadorIngestao>();

// Configuração CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("ApsPolicy", policy =>
    {
        policy.WithOrigins("http://localhost:5000", "http://localhost:5001")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Health Checks
builder.Services.AddHealthChecks()
    .AddNpgSql(builder.Configuration.GetConnectionString("DefaultConnection") ?? "")
    .AddRedis(builder.Configuration.GetConnectionString("Redis") ?? "localhost:6379");

var app = builder.Build();

// Configurar pipeline de requisições HTTP
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "APS Serviço Ingestão v1");
        c.RoutePrefix = string.Empty;
    });
}

app.UseCors("ApsPolicy");
app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health");

// Aplicar migrações automaticamente em desenvolvimento
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<APSDbContext>();
    try
    {
        await context.Database.MigrateAsync();
        Log.Information("Migrações aplicadas com sucesso");
    }
    catch (Exception ex)
    {
        Log.Error(ex, "Erro ao aplicar migrações");
    }
}

Log.Information("Iniciando APS - Serviço de Ingestão de Dados");

try
{
    await app.RunAsync();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Aplicação terminou inesperadamente");
}
finally
{
    Log.CloseAndFlush();
}