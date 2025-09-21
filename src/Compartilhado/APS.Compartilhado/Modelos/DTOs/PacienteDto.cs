namespace APS.Compartilhado.Modelos.DTOs;

/// <summary>
/// DTO para transferência de dados de Paciente
/// </summary>
public class PacienteDto
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string CPF { get; set; } = string.Empty;
    public string? RG { get; set; }
    public string? CartaoSUS { get; set; }
    public DateTime DataNascimento { get; set; }
    public int Idade { get; set; }
    public string Sexo { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Telefone { get; set; }
    public string Endereco { get; set; } = string.Empty;
    public string? CEP { get; set; }
    public string? TipoSanguineo { get; set; }
    public string EstadoCivil { get; set; } = string.Empty;
    public string? Profissao { get; set; }
    public bool Ativo { get; set; }
    
    // Localização
    public string Municipio { get; set; } = string.Empty;
    public string Estado { get; set; } = string.Empty;
    
    // Atendimento
    public DateTime? DataInternacao { get; set; }
    public DateTime? DataAlta { get; set; }
    public string StatusAtendimento { get; set; } = string.Empty;
    public string PrioridadeAtendimento { get; set; } = string.Empty;
    public string? HospitalAtual { get; set; }
    
    // Diagnósticos
    public List<DiagnosticoPacienteDto> Diagnosticos { get; set; } = new();
    
    // Estatísticas
    public int TotalDiagnosticos { get; set; }
    public string? DiagnosticoPrincipal { get; set; }
    public string? EspecialidadeRecomendada { get; set; }
}

/// <summary>
/// DTO para criação/atualização de Paciente
/// </summary>
public class PacienteCreateUpdateDto
{
    public string Nome { get; set; } = string.Empty;
    public string CPF { get; set; } = string.Empty;
    public string? RG { get; set; }
    public string? CartaoSUS { get; set; }
    public DateTime DataNascimento { get; set; }
    public string Sexo { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Telefone { get; set; }
    public string Endereco { get; set; } = string.Empty;
    public string? CEP { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string? TipoSanguineo { get; set; }
    public string EstadoCivil { get; set; } = string.Empty;
    public string? Profissao { get; set; }
    public int MunicipioId { get; set; }
    public string PrioridadeAtendimento { get; set; } = "Normal";
    public List<DiagnosticoPacienteCreateDto> Diagnosticos { get; set; } = new();
}

/// <summary>
/// DTO para diagnóstico do paciente
/// </summary>
public class DiagnosticoPacienteDto
{
    public int Id { get; set; }
    public string CodigoCID10 { get; set; } = string.Empty;
    public string DescricaoCID10 { get; set; } = string.Empty;
    public string Categoria { get; set; } = string.Empty;
    public DateTime DataDiagnostico { get; set; }
    public string TipoDiagnostico { get; set; } = string.Empty;
    public string? Observacoes { get; set; }
    public string? MedicoResponsavel { get; set; }
    public string StatusDiagnostico { get; set; } = string.Empty;
    public string? EspecialidadeRecomendada { get; set; }
    public string GrauSeveridade { get; set; } = string.Empty;
}

/// <summary>
/// DTO para criação de diagnóstico
/// </summary>
public class DiagnosticoPacienteCreateDto
{
    public int ClassificacaoCID10Id { get; set; }
    public string TipoDiagnostico { get; set; } = "Principal";
    public string? Observacoes { get; set; }
    public string? MedicoResponsavel { get; set; }
}
