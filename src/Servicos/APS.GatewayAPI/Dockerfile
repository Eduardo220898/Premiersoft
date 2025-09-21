# Dockerfile para APS.GatewayAPI
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copiar arquivos de projeto e restaurar dependências
COPY ["src/Servicos/APS.GatewayAPI/APS.GatewayAPI.csproj", "src/Servicos/APS.GatewayAPI/"]
COPY ["src/Compartilhado/APS.Compartilhado/APS.Compartilhado.csproj", "src/Compartilhado/APS.Compartilhado/"]
COPY ["src/Infraestrutura/APS.Infraestrutura.Dados/APS.Infraestrutura.Dados.csproj", "src/Infraestrutura/APS.Infraestrutura.Dados/"]

RUN dotnet restore "src/Servicos/APS.GatewayAPI/APS.GatewayAPI.csproj"

# Copiar código fonte e compilar
COPY . .
WORKDIR "/src/src/Servicos/APS.GatewayAPI"
RUN dotnet build "APS.GatewayAPI.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "APS.GatewayAPI.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app

# Criar diretórios necessários
RUN mkdir -p /app/logs

# Copiar aplicação publicada
COPY --from=publish /app/publish .

# Configurar usuário não-root para segurança
RUN groupadd -r apsuser && useradd -r -g apsuser apsuser
RUN chown -R apsuser:apsuser /app
USER apsuser

ENTRYPOINT ["dotnet", "APS.GatewayAPI.dll"]