# Plataforma APS - Consolidação de Dados de Saúde

## Visão Geral

Sistema de dados de saúde desenvolvido para a Agência Premiersoft de Saúde (APS). A plataforma processa dados de alta volumetria de múltiplos hospitais brasileiros em diferentes formatos (Excel, XML, JSON, HL7, FHIR) e cria um dashboard unificado para gestores de saúde.

## 🚀 Quick Start - Deploy com Docker

### Deploy Automático (Recomendado)

**Windows:**
```powershell
# Clone o repositório (se necessário)
git clone https://github.com/iPedrax/premieresoft.git
cd premieresoft

# Execute o deploy automático
.\deploy.ps1
```

**Linux/Mac:**
```bash
# Clone o repositório (se necessário) 
git clone https://github.com/iPedrax/premieresoft.git
cd premieresoft

# Torne o script executável e execute
chmod +x deploy.sh
./deploy.sh
```

### Deploy Manual com Docker Compose

```bash
# Desenvolvimento
docker-compose up -d --build

# Produção
docker-compose -f docker-compose.prod.yml up -d --build
```

### Acessar o Sistema

- **Dashboard**: http://localhost:3000/dashboard
- **Login**: http://localhost:3000/login  
- **RabbitMQ Management**: http://localhost:15672

**Credenciais padrão:**
- Dashboard: `admin` / `admin123`
- RabbitMQ: `aps` / `aps123`

## ⚙️ Configuração Personalizada

1. **Copie o arquivo de configuração:**
   ```bash
   cp .env.example .env
   ```

2. **Edite as variáveis de ambiente:**
   ```bash
   nano .env  # Linux/Mac
   notepad .env  # Windows
   ```

3. **Execute o deploy:**
   ```bash
   ./deploy.sh prod  # Produção
   ./deploy.ps1 prod  # Windows Produção
   ```

## Arquitetura do Sistema

### Componentes Principais

- **Gateway API**: Ponto de entrada central usando YARP
- **Serviço de Ingestão**: Processamento de múltiplos formatos de dados
- **Engine de Processamento**: Algoritmos de alocação de médicos e pacientes
- **Serviço de Notificação**: Mensageria assíncrona com RabbitMQ
- **Dashboard**: Interface web para gestores de saúde
- **Infraestrutura**: PostgreSQL, Redis, RabbitMQ

### Stack Tecnológica

- **.NET 8**: Framework principal
- **PostgreSQL**: Banco de dados principal
- **Redis**: Cache distribuído
- **RabbitMQ**: Message broker
- **Docker & Docker Compose**: Containerização
- **Entity Framework Core**: ORM
- **Blazor Server**: Frontend do dashboard

## Funcionalidades Principais

### Processamento de Dados
- Importação de datasets contendo estados, municípios, hospitais, médicos, pacientes
- Classificações CID-10
- Suporte a formatos: Excel, XML, JSON, HL7, FHIR
- Tratamento de erros, duplicatas e inconsistências

### Alocação de Médicos
- Máximo 3 hospitais por médico
- Correspondência entre especialidade do médico e necessidades do hospital
- Preferência por médicos na mesma cidade (raio máximo 30km)

### Alocação de Pacientes
- Baseada em sintomas do paciente (códigos CID-10)
- Especialidades disponíveis no hospital
- Preferência de proximidade

## Pré-requisitos

- Docker Desktop
- .NET 8 SDK (opcional, para desenvolvimento)
- Visual Studio 2022 ou VS Code (opcional, para desenvolvimento)

## Instalação e Execução

### Execução Rápida com Docker

```bash
# Clone o repositório
git clone https://github.com/iPedrax/plataforma-aps-saude.git
cd plataforma-aps-saude

# Execute a aplicação
docker-compose up -d

# Verifique se todos os serviços estão rodando
docker-compose ps
```

### URLs dos Serviços

Após a execução, os serviços estarão disponíveis em:

- **Dashboard**: http://localhost:5000
- **API Gateway**: http://localhost:5001
- **Documentação da API**: http://localhost:5001/swagger
- **RabbitMQ Management**: http://localhost:15672 (guest/guest)
- **PostgreSQL**: localhost:5432 (usuario: aps, senha: aps123)
- **Redis**: localhost:6379

### Desenvolvimento Local

```bash
# Restaurar dependências
dotnet restore PlataformaDadosSaude.sln

# Executar infraestrutura (apenas bancos e message broker)
docker-compose -f docker-compose.infra.yml up -d

# Executar serviços individualmente
cd src/Servicos/APS.GatewayAPI
dotnet run

cd src/Frontend/APS.Dashboard
dotnet run
```

## Estrutura do Projeto

```
src/
├── Compartilhado/              # Modelos e utilitários compartilhados
│   └── APS.Compartilhado/
├── Servicos/                   # Microserviços
│   ├── APS.ServicoIngestao/   # Processamento de arquivos
│   ├── APS.ServicoProcessamento/ # Algoritmos de alocação
│   ├── APS.GatewayAPI/        # Gateway de APIs
│   └── APS.ServicoNotificacao/ # Mensageria
├── Frontend/                   # Interface do usuário
│   └── APS.Dashboard/
└── Infraestrutura/            # Configurações de dados
    └── APS.Infraestrutura.Dados/
```

## Dados de Exemplo

A aplicação vem com dados de exemplo pré-carregados:

- Estados e municípios brasileiros
- Hospitais de exemplo
- Médicos com especialidades
- Pacientes com diagnósticos
- Classificações CID-10 básicas

### Importação de Dados

Para importar novos dados, use os endpoints da API:

```bash
# Upload de arquivo Excel
curl -X POST "http://localhost:5001/api/ingestao/upload" \
     -H "Content-Type: multipart/form-data" \
     -F "arquivo=@dados_hospitais.xlsx" \
     -F "tipo=excel"

# Upload de arquivo FHIR JSON
curl -X POST "http://localhost:5001/api/ingestao/upload" \
     -H "Content-Type: multipart/form-data" \
     -F "arquivo=@pacientes_fhir.json" \
     -F "tipo=fhir"
```

## Monitoramento e Logs

### Logs da Aplicação

Os logs são estruturados usando Serilog e enviados para:
- Console (desenvolvimento)
- Arquivos (produção)
- Seq (monitoramento centralizado)

### Métricas de Performance

- Tempo de processamento de arquivos
- Taxa de sucesso/erro na ingestão
- Estatísticas de alocação
- Uso de recursos do sistema

### Saúde dos Serviços

Verifique a saúde dos serviços:

```bash
curl http://localhost:5001/health
```

## API Documentation

### Endpoints Principais

#### Ingestão de Dados
- `POST /api/ingestao/upload` - Upload de arquivos
- `GET /api/ingestao/status/{id}` - Status do processamento
- `GET /api/ingestao/historico` - Histórico de uploads

#### Dados Consolidados
- `GET /api/hospitais` - Lista de hospitais
- `GET /api/medicos` - Lista de médicos
- `GET /api/pacientes` - Lista de pacientes
- `GET /api/estatisticas` - Estatísticas do sistema

#### Alocações
- `POST /api/alocacao/medicos` - Executar alocação de médicos
- `POST /api/alocacao/pacientes` - Executar alocação de pacientes
- `GET /api/alocacao/resultado/{id}` - Resultado da alocação

### Autenticação

A API usa autenticação JWT. Para obter um token:

```bash
curl -X POST "http://localhost:5001/api/auth/login" \
     -H "Content-Type: application/json" \
     -d '{"usuario":"admin","senha":"admin123"}'
```

## Configuração

### Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|---------|
| `ConnectionStrings__DefaultConnection` | String de conexão PostgreSQL | Ver docker-compose.yml |
| `ConnectionStrings__Redis` | String de conexão Redis | localhost:6379 |
| `RabbitMQ__HostName` | Host do RabbitMQ | localhost |
| `RabbitMQ__UserName` | Usuário do RabbitMQ | guest |
| `RabbitMQ__Password` | Senha do RabbitMQ | guest |
| `JWT__SecretKey` | Chave secreta JWT | (gerada automaticamente) |
| `Serilog__MinimumLevel` | Nível mínimo de log | Information |

### Configuração de Produção

Para ambiente de produção, ajuste:

1. **Segurança**: Altere senhas padrão
2. **Performance**: Configure connection pools
3. **Monitoramento**: Configure Seq ou similar
4. **Backup**: Configure backup automático do PostgreSQL

## Troubleshooting

### Problemas Comuns

1. **Serviços não iniciam**
   ```bash
   # Verifique logs
   docker-compose logs -f
   
   # Recrie os containers
   docker-compose down -v
   docker-compose up -d
   ```

2. **Erro de conexão com banco**
   ```bash
   # Verifique se PostgreSQL está rodando
   docker-compose ps postgresql
   
   # Teste conexão
   docker-compose exec postgresql psql -U aps -d aps_saude
   ```

3. **Upload de arquivo falha**
   - Verifique tamanho do arquivo (máximo 100MB)
   - Confirme formato suportado
   - Verifique logs do serviço de ingestão

### Logs Detalhados

```bash
# Logs de todos os serviços
docker-compose logs -f

# Logs de um serviço específico
docker-compose logs -f aps-gateway

# Logs das últimas 100 linhas
docker-compose logs --tail=100 -f
```

## Contribuição

### Desenvolvimento

1. Fork o repositório
2. Crie uma branch para sua feature
3. Implemente os testes
4. Envie um pull request

### Testes

```bash
# Executar todos os testes
dotnet test

# Executar testes com cobertura
dotnet test --collect:"XPlat Code Coverage"
```

## Performance

### Otimizações Implementadas

- **Cache distribuído**: Redis para consultas frequentes
- **Processamento assíncrono**: RabbitMQ para operações pesadas
- **Connection pooling**: Configuração otimizada do Entity Framework
- **Índices de banco**: Otimização de consultas PostgreSQL

### Métricas de Performance Esperadas

- **Ingestão**: 1000 registros/segundo (Excel)
- **Alocação**: 10000 médicos processados em <30 segundos
- **Dashboard**: Carregamento inicial <2 segundos
- **API**: Latência média <100ms

## Segurança

### Medidas Implementadas

- Autenticação JWT
- Validação de entrada de dados
- Rate limiting
- Sanitização de uploads
- Headers de segurança HTTP
- Logs de auditoria

## Licença

MIT License - veja [LICENSE](LICENSE) para detalhes.

## Suporte

Para suporte e dúvidas:
- **Issues**: https://github.com/iPedrax/plataforma-aps-saude/issues
- **Email**: suporte@premiersoft.com.br
- **Documentação**: Wiki do repositório

## Roadmap

### Próximas Funcionalidades

- [ ] Integração com sistemas HL7 FHIR em tempo real
- [ ] Machine Learning para predição de demanda
- [ ] Relatórios automáticos em PDF
- [ ] API pública para terceiros
- [ ] Aplicativo móvel para gestores
- [ ] Integração com sistemas do SUS
