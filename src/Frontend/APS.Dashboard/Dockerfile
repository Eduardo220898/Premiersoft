# Dockerfile para APS.Dashboard
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copiar arquivos de projeto e restaurar dependências
COPY ["src/Frontend/APS.Dashboard/APS.Dashboard.csproj", "src/Frontend/APS.Dashboard/"]
COPY ["src/Compartilhado/APS.Compartilhado/APS.Compartilhado.csproj", "src/Compartilhado/APS.Compartilhado/"]

RUN dotnet restore "src/Frontend/APS.Dashboard/APS.Dashboard.csproj"

# Copiar código fonte e compilar
COPY . .
WORKDIR "/src/src/Frontend/APS.Dashboard"
RUN dotnet build "APS.Dashboard.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "APS.Dashboard.csproj" -c Release -o /app/publish /p:UseAppHost=false

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

ENTRYPOINT ["dotnet", "APS.Dashboard.dll"]