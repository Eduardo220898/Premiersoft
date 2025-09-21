namespace APS.Compartilhado.Modelos.Mensagens;

/// <summary>
/// Mensagens para comunicação entre microserviços via RabbitMQ
/// </summary>

/// <summary>
/// Mensagem para notificar processamento de arquivo
/// </summary>
public class ArquivoProcessadoMensagem
{
    public int Id { get; set; }
    public string NomeArquivo { get; set; } = string.Empty;
    public string TipoArquivo { get; set; } = string.Empty; // Excel, XML, JSON, HL7, FHIR
    public string Status { get; set; } = string.Empty; // Processando, Concluido, Erro
    public int TotalRegistros { get; set; }
    public int RegistrosProcessados { get; set; }
    public int RegistrosComErro { get; set; }
    public DateTime DataProcessamento { get; set; }
    public TimeSpan TempoProcessamento { get; set; }
    public List<string> Erros { get; set; } = new();
    public string? CaminhoArquivo { get; set; }
    public long TamanhoArquivo { get; set; }
}

/// <summary>
/// Mensagem para executar alocação de médicos
/// </summary>
public class ExecutarAlocacaoMedicosMensagem
{
    public int Id { get; set; }
    public DateTime DataSolicitacao { get; set; } = DateTime.UtcNow;
    public string? FiltroEspecialidade { get; set; }
    public string? FiltroEstado { get; set; }
    public string? FiltroMunicipio { get; set; }
    public bool ForcarRealocacao { get; set; } = false;
    public string UsuarioSolicitante { get; set; } = string.Empty;
}

/// <summary>
/// Mensagem para executar alocação de pacientes
/// </summary>
public class ExecutarAlocacaoPacientesMensagem
{
    public int Id { get; set; }
    public DateTime DataSolicitacao { get; set; } = DateTime.UtcNow;
    public string? FiltroPrioridade { get; set; }
    public string? FiltroEstado { get; set; }
    public string? FiltroMunicipio { get; set; }
    public List<string> FiltroEspecialidades { get; set; } = new();
    public bool ForcarRealocacao { get; set; } = false;
    public string UsuarioSolicitante { get; set; } = string.Empty;
}

/// <summary>
/// Mensagem de resultado de alocação
/// </summary>
public class ResultadoAlocacaoMensagem
{
    public int Id { get; set; }
    public string TipoAlocacao { get; set; } = string.Empty; // Medicos, Pacientes
    public DateTime DataExecucao { get; set; }
    public string Status { get; set; } = string.Empty; // Executando, Concluido, Erro
    public int TotalProcessados { get; set; }
    public int TotalAlocados { get; set; }
    public int TotalErros { get; set; }
    public TimeSpan TempoExecucao { get; set; }
    public List<string> Mensagens { get; set; } = new();
    public List<string> Erros { get; set; } = new();
    public string UsuarioSolicitante { get; set; } = string.Empty;
}

/// <summary>
/// Mensagem para notificação geral do sistema
/// </summary>
public class NotificacaoSistemaMensagem
{
    public int Id { get; set; }
    public string Titulo { get; set; } = string.Empty;
    public string Mensagem { get; set; } = string.Empty;
    public string Tipo { get; set; } = "Info"; // Info, Warning, Error, Success
    public DateTime DataCriacao { get; set; } = DateTime.UtcNow;
    public string? UsuarioDestino { get; set; } // null = todos os usuários
    public string? Modulo { get; set; } // Ingestao, Processamento, Dashboard, etc.
    public Dictionary<string, object> DadosAdicionais { get; set; } = new();
}

/// <summary>
/// Mensagem para monitoramento de saúde dos serviços
/// </summary>
public class HealthCheckMensagem
{
    public string NomeServico { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty; // Healthy, Degraded, Unhealthy
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public TimeSpan TempoResposta { get; set; }
    public string? Descricao { get; set; }
    public Dictionary<string, object> Detalhes { get; set; } = new();
}

/// <summary>
/// Mensagem para log de auditoria
/// </summary>
public class AuditoriaMensagem
{
    public int Id { get; set; }
    public string Usuario { get; set; } = string.Empty;
    public string Acao { get; set; } = string.Empty;
    public string Recurso { get; set; } = string.Empty;
    public DateTime DataAcao { get; set; } = DateTime.UtcNow;
    public string? DadosAnteriores { get; set; }
    public string? DadosNovos { get; set; }
    public string EnderecoIP { get; set; } = string.Empty;
    public string UserAgent { get; set; } = string.Empty;
    public bool Sucesso { get; set; } = true;
    public string? MensagemErro { get; set; }
}
