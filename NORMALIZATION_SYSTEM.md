# Sistema de Normalização e Validação de Arquivos APS

## Visão Geral

O Sistema de Normalização e Validação de Arquivos do APS é um sistema abrangente projetado para detectar, corrigir e prevenir problemas de corrupção em arquivos de dados de saúde antes que sejam processados no banco de dados. Este sistema garante a integridade, segurança e qualidade dos dados importados.

## Componentes Principais

### 1. FileNormalizer (`file-normalizer.js`)

O núcleo do sistema de normalização que processa arquivos através de várias etapas:

#### Funcionalidades Principais:
- **Detecção Automática de Encoding**: Identifica e corrige problemas de codificação
- **Validação de Estrutura**: Verifica integridade de XML, JSON, CSV, HL7 e FHIR
- **Sanitização de Conteúdo**: Remove padrões maliciosos e caracteres problemáticos
- **Normalização de Dados**: Padroniza formatos de data, telefone, CPF/CNPJ
- **Verificação de Integridade**: Calcula checksums e detecta corrupção

#### Tipos de Arquivo Suportados:
- **CSV**: Detecção automática de delimitadores, validação de colunas
- **XML**: Verificação de tags balanceadas, remoção de caracteres inválidos
- **JSON/FHIR**: Parsing e correção de sintaxe, sanitização de objetos
- **HL7**: Validação de segmentos, verificação de formato de mensagem

#### Correções Automáticas:
- Encoding UTF-8, ISO-8859-1, Windows-1252
- Caracteres invisíveis e zero-width
- Problemas comuns de JSON (vírgulas finais, aspas)
- Normalização de quebras de linha
- Correção de caracteres especiais portugueses

### 2. FileValidationService (`file-validation-service.js`)

Serviço avançado de validação que executa verificações de segurança e qualidade:

#### Validações de Segurança:
- **Padrões Maliciosos**: Detecção de scripts, JavaScript, VBScript
- **Injeção SQL**: Identificação de padrões de injeção SQL
- **Inclusão de Arquivos**: Prevenção de ataques de path traversal
- **XSS**: Detecção de padrões de Cross-Site Scripting

#### Validações de Dados de Saúde:
- **Pacientes**: CPF, email, telefone, campos obrigatórios
- **Médicos**: CRM, especialidade, dados de contato
- **Procedimentos**: Códigos, descrições, valores

#### Análise Profunda (Opcional):
- Distribuição de caracteres
- Padrões repetitivos
- Anomalias de tamanho
- Métricas de qualidade

### 3. AdvancedUploadHandler (`advanced-upload-handler.js`)

Gerenciador avançado de upload que integra validação e normalização:

#### Funcionalidades:
- **Upload Assíncrono**: Processamento de múltiplos arquivos simultâneos
- **Sistema de Quarentena**: Isolamento de arquivos problemáticos
- **Progresso em Tempo Real**: Atualizações visuais do processamento
- **Retry Automático**: Tentativas automáticas em caso de falha
- **Interface Drag & Drop**: Upload por arrastar e soltar

#### Fluxo de Processamento:
1. **Pré-validação**: Verificação básica de tamanho e tipo
2. **Validação Completa**: Execução do FileValidationService
3. **Quarentena**: Isolamento de arquivos de alto risco
4. **Normalização**: Aplicação de correções automáticas
5. **Upload**: Envio do arquivo normalizado para o servidor
6. **Processamento**: Integração com o banco de dados

### 4. FileProcessingAPIMock (`file-processing-api-mock.js`)

Simulador de API backend para desenvolvimento e demonstração:

#### Endpoints Simulados:
- `POST /api/files/upload`: Recebimento de arquivos normalizados
- `POST /api/files/process`: Processamento no banco de dados
- `GET /api/files/status`: Status de processamento
- `POST /api/files/validate`: Validação adicional

#### Simulações Realistas:
- Tempo de processamento variável
- Detecção de duplicatas
- Geração de relatórios de qualidade
- Simulação de erros e avisos

## Configuração e Uso

### Configuração Básica

```javascript
// Inicialização automática no dashboard
const uploadHandler = new AdvancedUploadHandler();

// Configuração de endpoints
uploadHandler.config.endpoints = {
    upload: '/api/files/upload',
    validate: '/api/files/validate', 
    process: '/api/files/process',
    status: '/api/files/status'
};
```

### Opções de Validação

```javascript
// Configurações disponíveis na interface
{
    strictMode: true,        // Modo rigoroso de validação
    performDeepScan: true,   // Análise profunda de conteúdo
    allowQuarantine: true,   // Permitir quarentena de arquivos
    autoNormalize: true      // Normalização automática
}
```

### Uso Programático

```javascript
// Validação manual de arquivo
const validator = new FileValidationService();
const result = await validator.validateFile(file, {
    strictMode: false,
    performDeepScan: true
});

// Normalização manual
const normalizer = new FileNormalizer();
const normalized = await normalizer.normalizeFile(file);
```

## Padrões de Segurança

### Ameaças Detectadas

1. **Scripts Maliciosos**
   - `<script>`, `javascript:`, `vbscript:`
   - Eventos JavaScript (`onclick`, `onload`, etc.)
   - Expressões eval, setTimeout, setInterval

2. **Injeção SQL**
   - UNION SELECT, DROP TABLE, DELETE FROM
   - Comentários SQL (`--`, `#`)
   - Procedimentos armazenados (`sp_`, `xp_`)

3. **Inclusão de Arquivos**
   - Path traversal (`../`, `..\\`)
   - Arquivos do sistema (`/etc/passwd`, `/windows/system32`)
   - Protocolos perigosos (`file://`, `ftp://`)

### Níveis de Risco

- **Baixo**: Arquivos que passam em todas as validações
- **Médio**: Arquivos com avisos mas processáveis
- **Alto**: Arquivos com ameaças detectadas (quarentena automática)

## Qualidade de Dados

### Métricas Calculadas

1. **Score de Qualidade**: Porcentagem de registros válidos
2. **Campos Faltantes**: Contagem de campos obrigatórios ausentes
3. **Formatos Corrigidos**: Número de correções aplicadas
4. **Encoding Corrigido**: Problemas de codificação resolvidos

### Validações Específicas por Tipo

#### Pacientes
```javascript
{
    requiredFields: ['id', 'nome', 'cpf'],
    optionalFields: ['email', 'telefone', 'endereco', 'nascimento'],
    validation: {
        cpf: /^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/,
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        telefone: /^\(\d{2}\)\s\d{4,5}-\d{4}$|^\d{10,11}$/
    }
}
```

#### Médicos
```javascript
{
    requiredFields: ['id', 'nome', 'crm', 'especialidade'],
    optionalFields: ['telefone', 'email', 'endereco'],
    validation: {
        crm: /^[A-Z]{2}\s?\d{4,6}$/,
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    }
}
```

## Interface de Usuário

### Componentes Visuais

1. **Área de Upload**
   - Drag & drop visual
   - Indicação de formatos suportados
   - Feedback visual de status

2. **Fila de Processamento**
   - Progress bars animados
   - Status em tempo real
   - Métricas de validação

3. **Estatísticas de Resultados**
   - Resumo de segurança
   - Qualidade dos dados
   - Correções aplicadas

4. **Sistema de Quarentena**
   - Lista de arquivos isolados
   - Razões da quarentena
   - Opções de ação

### Estados Visuais

- **Queued** (Na fila): Aguardando processamento
- **Validating** (Validando): Em processo de validação
- **Uploading** (Enviando): Upload em progresso
- **Processing** (Processando): Processamento no servidor
- **Completed** (Concluído): Processamento bem-sucedido
- **Failed** (Falhou): Erro no processamento
- **Quarantined** (Quarentena): Isolado por segurança

## Relatórios e Logs

### Relatório de Validação

```javascript
{
    validationId: "val_123456789_abc",
    success: true,
    timestamp: "2024-01-15T10:30:00Z",
    processingTime: 2341,
    file: {
        original: { name, size, type },
        normalized: { content, encoding, detectedType, size }
    },
    security: {
        overallRisk: "low",
        threats: []
    },
    healthcare: {
        stats: {
            recordsFound: 150,
            validRecords: 145,
            dataQualityScore: 96.7
        }
    },
    summary: {
        status: "passed",
        recommendations: [],
        nextSteps: []
    }
}
```

### Histórico de Validação

O sistema mantém histórico completo de todas as validações:
- ID único de validação
- Nome do arquivo original
- Status final (passed/warning/failed)
- Tempo de processamento
- Timestamp

## Extensibilidade

### Adicionar Novos Tipos de Arquivo

```javascript
// No FileNormalizer
this.validationRules.newType = {
    maxFileSize: 50 * 1024 * 1024,
    requiredElements: ['header'],
    encoding: ['utf-8']
};

// Adicionar método de validação
validateNewTypeStructure(content) {
    // Implementar lógica específica
    return { isValid: true, errors: [], warnings: [] };
}
```

### Adicionar Novas Validações de Saúde

```javascript
// No FileValidationService
this.healthcareValidators.newDataType = {
    requiredFields: ['id', 'nome'],
    optionalFields: ['descricao'],
    validation: {
        id: /^\d+$/,
        nome: /^[A-Za-z\s]+$/
    }
};
```

## Considerações de Performance

### Otimizações Implementadas

1. **Processamento Assíncrono**: Não bloqueia a interface
2. **Chunks de Upload**: Arquivos grandes enviados em partes
3. **Debounce de Validação**: Evita validações desnecessárias
4. **Cache de Resultados**: Reutilização de validações anteriores
5. **Lazy Loading**: Carregamento sob demanda de componentes

### Limites Recomendados

- **Tamanho máximo por arquivo**: 100MB
- **Uploads simultâneos**: 3 arquivos
- **Timeout de processamento**: 5 minutos
- **Retenção de histórico**: 100 validações

## Segurança e Compliance

### Medidas de Segurança

1. **Sanitização Completa**: Remoção de todo conteúdo malicioso
2. **Validação Rigorosa**: Verificação de todos os padrões perigosos
3. **Isolamento**: Sistema de quarentena para arquivos suspeitos
4. **Auditoria**: Log completo de todas as operações

### Compliance LGPD/HIPAA

- Não armazenamento permanente de arquivos originais
- Anonimização de dados sensíveis nos logs
- Criptografia de dados em trânsito
- Audit trail completo de processamento

## Troubleshooting

### Problemas Comuns

1. **Arquivo rejeitado imediatamente**
   - Verificar tamanho (< 100MB)
   - Confirmar tipo de arquivo suportado
   - Validar nome do arquivo (sem caracteres especiais)

2. **Arquivo em quarentena**
   - Revisar relatório de segurança
   - Verificar padrões maliciosos detectados
   - Considerar limpeza manual do arquivo

3. **Processamento lento**
   - Verificar tamanho do arquivo
   - Validar se análise profunda está habilitada
   - Considerar dividir arquivos grandes

4. **Erro de encoding**
   - Tentar diferentes codificações
   - Verificar caracteres especiais
   - Considerar conversão prévia para UTF-8

### Logs de Debug

Para habilitar logs detalhados:

```javascript
// No console do navegador
uploadHandler.config.debug = true;
localStorage.setItem('aps-debug', 'true');
```

## Roadmap

### Funcionalidades Futuras

1. **Machine Learning**: Detecção inteligente de anomalias
2. **Validação em Tempo Real**: Verificação durante o upload
3. **OCR Integration**: Processamento de documentos escaneados
4. **Blockchain**: Auditoria imutável de processamento
5. **API REST**: Integração com sistemas externos

### Melhorias Planejadas

1. **Performance**: Otimização para arquivos > 100MB
2. **UI/UX**: Interface mais intuitiva e responsiva
3. **Relatórios**: Dashboards avançados de qualidade
4. **Integração**: Conectores para sistemas de ERP hospitalar
5. **Mobilidade**: Aplicativo móvel para upload

---

## Contato e Suporte

Para questões técnicas, sugestões ou relatórios de problemas:

- **Documentação**: Este arquivo e comentários no código
- **Logs**: Console do navegador e ferramentas de desenvolvedor
- **API Mock**: Endpoints simulados para teste e desenvolvimento

**Versão**: 1.0.0  
**Última Atualização**: Janeiro 2024  
**Compatibilidade**: Navegadores modernos (Chrome 90+, Firefox 88+, Safari 14+)