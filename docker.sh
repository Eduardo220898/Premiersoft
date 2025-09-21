#!/bin/bash
# ===== APS Healthcare Platform - Docker Management Script =====

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para exibir ajuda
show_help() {
    echo -e "${BLUE}APS Healthcare Platform - Docker Management${NC}"
    echo ""
    echo "Uso: $0 [COMANDO]"
    echo ""
    echo "Comandos disponíveis:"
    echo "  build       - Construir a imagem Docker"
    echo "  start       - Iniciar aplicação web"
    echo "  stop        - Parar aplicação web"
    echo "  restart     - Reiniciar aplicação web"
    echo "  logs        - Ver logs da aplicação"
    echo "  status      - Ver status dos containers"
    echo "  dev         - Iniciar em modo desenvolvimento"
    echo "  prod        - Iniciar em modo produção"
    echo "  clean       - Limpar containers e volumes"
    echo "  help        - Exibir esta ajuda"
    echo ""
    echo "Exemplos:"
    echo "  $0 dev      # Inicia apenas a aplicação web"
    echo "  $0 prod     # Inicia toda a stack"
    echo "  $0 clean    # Remove containers e volumes"
}

# Função para construir imagem
build_image() {
    echo -e "${YELLOW}Construindo imagem Docker...${NC}"
    docker build -t aps-healthcare-web .
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Imagem construída com sucesso!${NC}"
    else
        echo -e "${RED}✗ Erro ao construir imagem${NC}"
        exit 1
    fi
}

# Função para iniciar em modo desenvolvimento
start_dev() {
    echo -e "${YELLOW}Iniciando aplicação web em modo desenvolvimento...${NC}"
    docker-compose -f docker-compose.dev.yml up aps-web -d
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Aplicação web iniciada com sucesso!${NC}"
        echo -e "${BLUE}🌐 Landing Page: http://localhost:8080${NC}"
        echo -e "${BLUE}🔐 Login: http://localhost:8080/login${NC}"
        echo -e "${BLUE}📊 Dashboard: http://localhost:8080/dashboard${NC}"
    else
        echo -e "${RED}✗ Erro ao iniciar aplicação web${NC}"
        exit 1
    fi
}

# Função para iniciar em modo produção
start_prod() {
    echo -e "${YELLOW}Iniciando stack completa em modo produção...${NC}"
    docker-compose up aps-web -d
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Stack iniciada com sucesso!${NC}"
        echo -e "${BLUE}🌐 Web Application: http://localhost:80${NC}"
        echo -e "${BLUE}🔐 Login: http://localhost:80/login${NC}"
        echo -e "${BLUE}📊 Dashboard: http://localhost:80/dashboard${NC}"
    else
        echo -e "${RED}✗ Erro ao iniciar stack${NC}"
        exit 1
    fi
}

# Função para parar serviços
stop_services() {
    echo -e "${YELLOW}Parando serviços...${NC}"
    docker-compose -f docker-compose.dev.yml down
    docker-compose down
    echo -e "${GREEN}✓ Serviços parados!${NC}"
}

# Função para ver logs
show_logs() {
    echo -e "${YELLOW}Exibindo logs da aplicação web...${NC}"
    docker-compose -f docker-compose.dev.yml logs -f aps-web
}

# Função para ver status
show_status() {
    echo -e "${YELLOW}Status dos containers:${NC}"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

# Função para limpeza
clean_all() {
    echo -e "${YELLOW}Removendo containers e volumes...${NC}"
    docker-compose -f docker-compose.dev.yml down -v
    docker-compose down -v
    docker system prune -f
    echo -e "${GREEN}✓ Limpeza concluída!${NC}"
}

# Processar argumentos
case "${1:-help}" in
    build)
        build_image
        ;;
    start)
        start_dev
        ;;
    dev)
        start_dev
        ;;
    prod)
        start_prod
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        start_dev
        ;;
    logs)
        show_logs
        ;;
    status)
        show_status
        ;;
    clean)
        clean_all
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Comando inválido: $1${NC}"
        show_help
        exit 1
        ;;
esac