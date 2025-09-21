namespace APS.Compartilhado.Modelos.DTOs;

/// <summary>
/// DTO para estatísticas gerais do sistema
/// </summary>
public class EstatisticasDto
{
    public EstatisticasGeraisDto Gerais { get; set; } = new();
    public EstatisticasGeograficasDto Geograficas { get; set; } = new();
    public EstatisticasAtendimentoDto Atendimento { get; set; } = new();
    public EstatisticasAlocacaoDto Alocacao { get; set; } = new();
    public List<EstatisticasEstadoDto> Estados { get; set; } = new();
    public List<EstatisticasEspecialidadeDto> Especialidades { get; set; } = new();
}

/// <summary>
/// Estatísticas gerais
/// </summary>
public class EstatisticasGeraisDto
{
    public int TotalEstados { get; set; }
    public int TotalMunicipios { get; set; }
    public int TotalHospitais { get; set; }
    public int TotalMedicos { get; set; }
    public int TotalPacientes { get; set; }
    public int TotalClassificacoesCID10 { get; set; }
    public DateTime UltimaAtualizacao { get; set; }
}

/// <summary>
/// Estatísticas geográficas
/// </summary>
public class EstatisticasGeograficasDto
{
    public decimal MediaMedicosPorHospital { get; set; }
    public decimal MediaPacientesPorHospital { get; set; }
    public decimal MediaDistanciaMedicoHospital { get; set; }
    public string EstadoMaisMedicos { get; set; } = string.Empty;
    public string EstadoMaisPacientes { get; set; } = string.Empty;
    public string MunicipioMaisHospitais { get; set; } = string.Empty;
}

/// <summary>
/// Estatísticas de atendimento
/// </summary>
public class EstatisticasAtendimentoDto
{
    public int PacientesAguardando { get; set; }
    public int PacientesEmAtendimento { get; set; }
    public int PacientesAlta { get; set; }
    public int PacientesTransferidos { get; set; }
    public int AtendimentosEmergencia { get; set; }
    public int AtendimentosUrgente { get; set; }
    public int AtendimentosNormal { get; set; }
    public decimal MediaTempoAtendimento { get; set; }
    public decimal PercentualOcupacaoGeral { get; set; }
}

/// <summary>
/// Estatísticas de alocação
/// </summary>
public class EstatisticasAlocacaoDto
{
    public int MedicosAlocados { get; set; }
    public int MedicosSemAlocacao { get; set; }
    public int PacientesAlocados { get; set; }
    public int PacientesSemAlocacao { get; set; }
    public decimal MediaMedicosPorHospital { get; set; }
    public decimal PercentualMedicosCapacidadeMaxima { get; set; } // Médicos com 3 hospitais
    public DateTime? UltimaAlocacao { get; set; }
    public int TotalAlocacoesRealizadas { get; set; }
}

/// <summary>
/// Estatísticas por estado
/// </summary>
public class EstatisticasEstadoDto
{
    public string Estado { get; set; } = string.Empty;
    public string Sigla { get; set; } = string.Empty;
    public int TotalMunicipios { get; set; }
    public int TotalHospitais { get; set; }
    public int TotalMedicos { get; set; }
    public int TotalPacientes { get; set; }
    public decimal PercentualOcupacao { get; set; }
    public string EspecialidadeMaisComum { get; set; } = string.Empty;
}

/// <summary>
/// Estatísticas por especialidade
/// </summary>
public class EstatisticasEspecialidadeDto
{
    public string Especialidade { get; set; } = string.Empty;
    public int TotalMedicos { get; set; }
    public int TotalHospitaisComEspecialidade { get; set; }
    public int TotalPacientesNecessitando { get; set; }
    public decimal MediaSalariosEspecialidade { get; set; }
    public decimal PercentualCobertura { get; set; } // % de hospitais que têm a especialidade
}

/// <summary>
/// DTO para resultado de alocação
/// </summary>
public class ResultadoAlocacaoDto
{
    public int Id { get; set; }
    public string TipoAlocacao { get; set; } = string.Empty; // Medicos, Pacientes
    public DateTime DataExecucao { get; set; }
    public int TotalProcessados { get; set; }
    public int TotalAlocados { get; set; }
    public int TotalErros { get; set; }
    public string Status { get; set; } = string.Empty; // Executando, Concluido, Erro
    public TimeSpan TempoExecucao { get; set; }
    public List<string> Mensagens { get; set; } = new();
    public List<string> Erros { get; set; } = new();
}
