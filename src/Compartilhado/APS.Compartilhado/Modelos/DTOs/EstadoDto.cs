namespace APS.Compartilhado.Modelos.DTOs;

/// <summary>
/// DTO para transferência de dados de Estado
/// </summary>
public class EstadoDto
{
    public int Id { get; set; }
    public string Sigla { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public string Regiao { get; set; } = string.Empty;
    public int TotalMunicipios { get; set; }
    public int TotalHospitais { get; set; }
    public int TotalMedicos { get; set; }
    public int TotalPacientes { get; set; }
}

/// <summary>
/// DTO para transferência de dados de Município
/// </summary>
public class MunicipioDto
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string CodigoIBGE { get; set; } = string.Empty;
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public int Populacao { get; set; }
    public string Estado { get; set; } = string.Empty;
    public string EstadoSigla { get; set; } = string.Empty;
    public int TotalHospitais { get; set; }
    public int TotalMedicos { get; set; }
    public int TotalPacientes { get; set; }
}
