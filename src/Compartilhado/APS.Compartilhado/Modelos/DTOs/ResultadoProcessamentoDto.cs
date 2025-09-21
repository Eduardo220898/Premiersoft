namespace APS.Compartilhado.Modelos.DTOs;

/// <summary>
/// DTO para resultado de processamento de dados
/// </summary>
public class ResultadoProcessamentoDto
{
    public string TipoArquivo { get; set; } = string.Empty;
    public bool Sucesso { get; set; }
    public int TotalRegistros { get; set; }
    public int RegistrosProcessados { get; set; }
    public int RegistrosAtualizados { get; set; }
    public int RegistrosComErro { get; set; }
    public List<string> Erros { get; set; } = new();
    public List<string> Avisos { get; set; } = new();
    public TimeSpan TempoProcessamento { get; set; }
    public DateTime DataProcessamento { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// Detalhes adicionais do processamento
    /// </summary>
    public Dictionary<string, object> Detalhes { get; set; } = new();
    
    /// <summary>
    /// Estatísticas adicionais do processamento
    /// </summary>
    public Dictionary<string, object> Estatisticas { get; set; } = new();
}