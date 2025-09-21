# ===== APS Healthcare Platform - Dockerfile =====
# Imagem base otimizada do nginx
FROM nginx:alpine

# Definir variáveis de ambiente
ENV NGINX_HOST=0.0.0.0
ENV NGINX_PORT=80

# Instalar dependências para otimização
RUN apk add --no-cache \
    gzip \
    brotli

# Remover configuração padrão do nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copiar configuração customizada do nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Copiar arquivos estáticos da aplicação web
# src/Web/APS.WebApp/wwwroot será servido como raiz
COPY src/Web/APS.WebApp/wwwroot /usr/share/nginx/html

# Criar diretório para logs
RUN mkdir -p /var/log/nginx

# Definir permissões corretas
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/log/nginx && \
    chmod -R 755 /usr/share/nginx/html

# Expor porta 80
EXPOSE 80

# Labels para metadados
LABEL maintainer="APS Healthcare Team"
LABEL description="APS Healthcare Platform - Frontend Web Application"
LABEL version="1.0.0"

# Comando de inicialização
CMD ["nginx", "-g", "daemon off;"]

# Health check para monitoramento
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1