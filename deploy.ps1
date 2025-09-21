# APS Healthcare Platform - Quick Deploy Script for Windows
Write-Host "APS Healthcare Platform - Quick Deploy" -ForegroundColor Green

# Check if Docker is installed
try {
    docker --version | Out-Null
    Write-Host "Docker is available" -ForegroundColor Green
} catch {
    Write-Host "Docker is not installed. Please install Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "Creating .env file from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "Please edit .env file with your configuration before running again!" -ForegroundColor Red
    exit 1
}

# Determine which compose file to use
$composeFile = "docker-compose.yml"
if ($args[0] -eq "prod") {
    $composeFile = "docker-compose.prod.yml"
    Write-Host "Using production configuration" -ForegroundColor Cyan
} else {
    Write-Host "Using development configuration" -ForegroundColor Cyan
}

# Stop any running containers
Write-Host "Stopping existing containers..." -ForegroundColor Yellow
docker-compose -f $composeFile down

# Build and start containers
Write-Host "Building and starting containers..." -ForegroundColor Yellow
docker-compose -f $composeFile up -d --build

Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "Access URLs:" -ForegroundColor Cyan
Write-Host "Dashboard: http://localhost:3000/dashboard" -ForegroundColor White
Write-Host "RabbitMQ Management: http://localhost:15672" -ForegroundColor White
Write-Host ""
Write-Host "Resource Usage:" -ForegroundColor Cyan
Write-Host "Run 'docker stats' to view real-time resource usage" -ForegroundColor White