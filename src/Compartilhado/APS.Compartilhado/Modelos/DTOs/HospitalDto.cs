namespace APS.Compartilhado.Modelos.DTOs;

/// <summary>
/// DTO para transferência de dados de Hospital
/// </summary>
public class HospitalDto
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string CNES { get; set; } = string.Empty;
    public string? CNPJ { get; set; }
    public string Endereco { get; set; } = string.Empty;
    public string? CEP { get; set; }
    public string? Telefone { get; set; }
    public string? Email { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string TipoEstabelecimento { get; set; } = string.Empty;
    public string Natureza { get; set; } = string.Empty;
    public int CapacidadeLeitos { get; set; }
    public int LeitosDisponiveis { get; set; }
    public bool Ativo { get; set; }
    
    // Dados do município
    public string Municipio { get; set; } = string.Empty;
    public string Estado { get; set; } = string.Empty;
    public string EstadoSigla { get; set; } = string.Empty;
    
    // Estatísticas
    public int TotalMedicos { get; set; }
    public int TotalPacientes { get; set; }
    public int TotalEspecialidades { get; set; }
    public decimal PercentualOcupacao { get; set; }
    
    // Especialidades disponíveis
    public List<string> Especialidades { get; set; } = new();
}

/// <summary>
/// DTO para criação/atualização de Hospital
/// </summary>
public class HospitalCreateUpdateDto
{
    public string Nome { get; set; } = string.Empty;
    public string CNES { get; set; } = string.Empty;
    public string? CNPJ { get; set; }
    public string Endereco { get; set; } = string.Empty;
    public string? CEP { get; set; }
    public string? Telefone { get; set; }
    public string? Email { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string TipoEstabelecimento { get; set; } = string.Empty;
    public string Natureza { get; set; } = string.Empty;
    public int CapacidadeLeitos { get; set; }
    public int LeitosDisponiveis { get; set; }
    public int MunicipioId { get; set; }
    public List<string> Especialidades { get; set; } = new();
}
