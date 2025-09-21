#!/bin/bash

# APS Healthcare Platform - Quick Deploy Script
# This script helps you deploy the platform quickly

set -e

echo "🚀 APS Healthcare Platform - Quick Deploy"
echo "========================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop first."
    echo "   Visit: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose."
    exit 1
fi

echo "✅ Docker and Docker Compose are available"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration before running again!"
    echo "   nano .env"
    exit 1
fi

echo "✅ Environment file found"

# Determine which compose file to use
COMPOSE_FILE="docker-compose.yml"
if [ "$1" = "prod" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
    echo "🏭 Using production configuration"
else
    echo "🛠️  Using development configuration"
fi

# Stop any running containers
echo "🛑 Stopping existing containers..."
docker-compose -f $COMPOSE_FILE down

# Pull latest images (for production)
if [ "$1" = "prod" ]; then
    echo "📦 Pulling latest images..."
    docker-compose -f $COMPOSE_FILE pull
fi

# Build and start containers
echo "🏗️  Building and starting containers..."
docker-compose -f $COMPOSE_FILE up -d --build

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Check if services are healthy
echo "🏥 Checking service health..."
if docker-compose -f $COMPOSE_FILE ps | grep -q "unhealthy"; then
    echo "⚠️  Some services appear unhealthy. Check logs:"
    echo "   docker-compose -f $COMPOSE_FILE logs"
else
    echo "✅ All services appear healthy"
fi

# Show running services
echo ""
echo "📊 Running Services:"
docker-compose -f $COMPOSE_FILE ps

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📱 Access URLs:"
echo "   Dashboard: http://localhost:3000/dashboard"
echo "   Login: http://localhost:3000/login"
echo "   RabbitMQ Management: http://localhost:15672"
echo ""
echo "📝 Default credentials:"
echo "   Dashboard: admin / admin123"
echo "   RabbitMQ: aps / aps123"
echo ""
echo "📋 Useful commands:"
echo "   View logs: docker-compose -f $COMPOSE_FILE logs -f"
echo "   Stop: docker-compose -f $COMPOSE_FILE down"
echo "   Restart: docker-compose -f $COMPOSE_FILE restart"

# Show resource usage
echo ""
echo "💻 Resource Usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"