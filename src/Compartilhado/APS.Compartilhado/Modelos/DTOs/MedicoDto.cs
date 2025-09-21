namespace APS.Compartilhado.Modelos.DTOs;

/// <summary>
/// DTO para transferência de dados de Médico
/// </summary>
public class MedicoDto
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string CRM { get; set; } = string.Empty;
    public string EstadoCRM { get; set; } = string.Empty;
    public string CPF { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Telefone { get; set; }
    public string Especialidade { get; set; } = string.Empty;
    public string? SubEspecialidade { get; set; }
    public DateTime DataFormatura { get; set; }
    public int AnosExperiencia { get; set; }
    public decimal? SalarioBase { get; set; }
    public bool Ativo { get; set; }
    
    // Endereço
    public string? EnderecoResidencial { get; set; }
    public string? MunicipioResidencia { get; set; }
    public string? EstadoResidencia { get; set; }
    
    // Hospitais onde trabalha
    public List<HospitalVinculoDto> Hospitais { get; set; } = new();
    
    // Estatísticas
    public int TotalHospitais { get; set; }
    public decimal? MediaDistanciaHospitais { get; set; }
}

/// <summary>
/// DTO para criação/atualização de Médico
/// </summary>
public class MedicoCreateUpdateDto
{
    public string Nome { get; set; } = string.Empty;
    public string CRM { get; set; } = string.Empty;
    public string EstadoCRM { get; set; } = string.Empty;
    public string CPF { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Telefone { get; set; }
    public string Especialidade { get; set; } = string.Empty;
    public string? SubEspecialidade { get; set; }
    public DateTime DataFormatura { get; set; }
    public decimal? SalarioBase { get; set; }
    public string? EnderecoResidencial { get; set; }
    public decimal? LatitudeResidencia { get; set; }
    public decimal? LongitudeResidencia { get; set; }
    public int? MunicipioResidenciaId { get; set; }
}

/// <summary>
/// DTO para vínculo do médico com hospital
/// </summary>
public class HospitalVinculoDto
{
    public int HospitalId { get; set; }
    public string NomeHospital { get; set; } = string.Empty;
    public string MunicipioHospital { get; set; } = string.Empty;
    public DateTime DataInicio { get; set; }
    public DateTime? DataTermino { get; set; }
    public string TipoVinculo { get; set; } = string.Empty;
    public decimal CargaHorariaSemanal { get; set; }
    public decimal? Salario { get; set; }
    public decimal? DistanciaKm { get; set; }
    public bool Ativo { get; set; }
}
