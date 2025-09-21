# Dockerfile para APS.ServicoIngestao
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

# Instalar dependências do sistema para processamento de arquivos
RUN apt-get update && apt-get install -y \
    libgdiplus \
    libc6-dev \
    && rm -rf /var/lib/apt/lists/*

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copiar arquivos de projeto e restaurar dependências
COPY ["src/Servicos/APS.ServicoIngestao/APS.ServicoIngestao.csproj", "src/Servicos/APS.ServicoIngestao/"]
COPY ["src/Compartilhado/APS.Compartilhado/APS.Compartilhado.csproj", "src/Compartilhado/APS.Compartilhado/"]
COPY ["src/Infraestrutura/APS.Infraestrutura.Dados/APS.Infraestrutura.Dados.csproj", "src/Infraestrutura/APS.Infraestrutura.Dados/"]

RUN dotnet restore "src/Servicos/APS.ServicoIngestao/APS.ServicoIngestao.csproj"

# Copiar código fonte e compilar
COPY . .
WORKDIR "/src/src/Servicos/APS.ServicoIngestao"
RUN dotnet build "APS.ServicoIngestao.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "APS.ServicoIngestao.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app

# Criar diretórios necessários
RUN mkdir -p /app/uploads /app/logs

# Copiar aplicação publicada
COPY --from=publish /app/publish .

# Configurar usuário não-root para segurança
RUN groupadd -r apsuser && useradd -r -g apsuser apsuser
RUN chown -R apsuser:apsuser /app
USER apsuser

ENTRYPOINT ["dotnet", "APS.ServicoIngestao.dll"]