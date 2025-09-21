# ===== APS Healthcare Platform - Docker Management Script (PowerShell) =====

param(
    [Parameter(Position=0)]
    [string]$Command = "help"
)

# Função para exibir ajuda
function Show-Help {
    Write-Host "APS Healthcare Platform - Docker Management" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Uso: .\docker.ps1 [COMANDO]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Comandos disponíveis:" -ForegroundColor Green
    Write-Host "  build       - Construir a imagem Docker"
    Write-Host "  start       - Iniciar aplicação web"
    Write-Host "  stop        - Parar aplicação web"
    Write-Host "  restart     - Reiniciar aplicação web"
    Write-Host "  logs        - Ver logs da aplicação"
    Write-Host "  status      - Ver status dos containers"
    Write-Host "  dev         - Iniciar em modo desenvolvimento"
    Write-Host "  prod        - Iniciar em modo produção"
    Write-Host "  clean       - Limpar containers e volumes"
    Write-Host "  help        - Exibir esta ajuda"
    Write-Host ""
    Write-Host "Exemplos:" -ForegroundColor Cyan
    Write-Host "  .\docker.ps1 dev      # Inicia apenas a aplicação web"
    Write-Host "  .\docker.ps1 prod     # Inicia toda a stack"
    Write-Host "  .\docker.ps1 clean    # Remove containers e volumes"
}

# Função para construir imagem
function Build-Image {
    Write-Host "Construindo imagem Docker..." -ForegroundColor Yellow
    docker build -t aps-healthcare-web .
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Imagem construída com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "✗ Erro ao construir imagem" -ForegroundColor Red
        exit 1
    }
}

# Função para iniciar em modo desenvolvimento
function Start-Dev {
    Write-Host "Iniciando aplicação web em modo desenvolvimento..." -ForegroundColor Yellow
    docker-compose -f docker-compose.dev.yml up aps-web -d
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Aplicação web iniciada com sucesso!" -ForegroundColor Green
        Write-Host "🌐 Landing Page: http://localhost:8080" -ForegroundColor Blue
        Write-Host "🔐 Login: http://localhost:8080/login" -ForegroundColor Blue
        Write-Host "📊 Dashboard: http://localhost:8080/dashboard" -ForegroundColor Blue
    } else {
        Write-Host "✗ Erro ao iniciar aplicação web" -ForegroundColor Red
        exit 1
    }
}

# Função para iniciar em modo produção
function Start-Prod {
    Write-Host "Iniciando stack completa em modo produção..." -ForegroundColor Yellow
    docker-compose up aps-web -d
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Stack iniciada com sucesso!" -ForegroundColor Green
        Write-Host "🌐 Web Application: http://localhost:80" -ForegroundColor Blue
        Write-Host "🔐 Login: http://localhost:80/login" -ForegroundColor Blue
        Write-Host "📊 Dashboard: http://localhost:80/dashboard" -ForegroundColor Blue
    } else {
        Write-Host "✗ Erro ao iniciar stack" -ForegroundColor Red
        exit 1
    }
}

# Função para parar serviços
function Stop-Services {
    Write-Host "Parando serviços..." -ForegroundColor Yellow
    docker-compose -f docker-compose.dev.yml down
    docker-compose down
    Write-Host "✓ Serviços parados!" -ForegroundColor Green
}

# Função para ver logs
function Show-Logs {
    Write-Host "Exibindo logs da aplicação web..." -ForegroundColor Yellow
    docker-compose -f docker-compose.dev.yml logs -f aps-web
}

# Função para ver status
function Show-Status {
    Write-Host "Status dos containers:" -ForegroundColor Yellow
    docker ps --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}"
}

# Função para limpeza
function Clean-All {
    Write-Host "Removendo containers e volumes..." -ForegroundColor Yellow
    docker-compose -f docker-compose.dev.yml down -v
    docker-compose down -v
    docker system prune -f
    Write-Host "✓ Limpeza concluída!" -ForegroundColor Green
}

# Processar comandos
switch ($Command.ToLower()) {
    "build" { Build-Image }
    "start" { Start-Dev }
    "dev" { Start-Dev }
    "prod" { Start-Prod }
    "stop" { Stop-Services }
    "restart" { 
        Stop-Services
        Start-Dev
    }
    "logs" { Show-Logs }
    "status" { Show-Status }
    "clean" { Clean-All }
    "help" { Show-Help }
    default {
        Write-Host "Comando inválido: $Command" -ForegroundColor Red
        Show-Help
        exit 1
    }
}