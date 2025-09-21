using APS.Compartilhado.Modelos.DTOs;

namespace APS.ServicoIngestao.Interfaces;

/// <summary>
/// Interface base para processadores de dados
/// </summary>
public interface IProcessadorBase
{
    Task<ResultadoProcessamentoDto> ProcessarAsync(Stream arquivo, string nomeArquivo);
    bool PodeProcessar(string nomeArquivo, string tipoMime);
    string TipoSuportado { get; }
}

/// <summary>
/// Interface para processamento de arquivos Excel
/// </summary>
public interface IProcessadorExcel : IProcessadorBase
{
    Task<ResultadoProcessamentoDto> ProcessarHospitaisAsync(Stream arquivo);
    Task<ResultadoProcessamentoDto> ProcessarMedicosAsync(Stream arquivo);
    Task<ResultadoProcessamentoDto> ProcessarPacientesAsync(Stream arquivo);
}

/// <summary>
/// Interface para processamento de arquivos XML
/// </summary>
public interface IProcessadorXML : IProcessadorBase
{
    Task<ResultadoProcessamentoDto> ProcessarXMLSaude(Stream arquivo);
}

/// <summary>
/// Interface para processamento de arquivos JSON
/// </summary>
public interface IProcessadorJSON : IProcessadorBase
{
    Task<ResultadoProcessamentoDto> ProcessarJSONSaude(Stream arquivo);
}

/// <summary>
/// Interface para processamento de mensagens HL7
/// </summary>
public interface IProcessadorHL7 : IProcessadorBase
{
    Task<ResultadoProcessamentoDto> ProcessarMensagemHL7(Stream arquivo);
    Task<ResultadoProcessamentoDto> ProcessarADT(string mensagemHL7); // Admissão, Transferência, Alta
    Task<ResultadoProcessamentoDto> ProcessarORM(string mensagemHL7); // Ordem médica
}

/// <summary>
/// Interface para processamento de recursos FHIR
/// </summary>
public interface IProcessadorFHIR : IProcessadorBase
{
    System.Threading.Tasks.Task<ResultadoProcessamentoDto> ProcessarFHIRSaude(Stream arquivo);
}

/// <summary>
/// Interface para gerenciamento centralizado de ingestão
/// </summary>
public interface IGerenciadorIngestao
{
    Task<ResultadoProcessamentoDto> ProcessarArquivoAsync(Stream arquivo, string nomeArquivo, string tipoMime);
    Task<List<string>> ObterTiposSuportados();
    Task<EstatisticasProcessamentoDto> ObterEstatisticasProcessamento();
}

/// <summary>
/// DTO para estatísticas de processamento
/// </summary>
public class EstatisticasProcessamentoDto
{
    public int TotalArquivosProcessados { get; set; }
    public int ArquivosComSucesso { get; set; }
    public int ArquivosComErro { get; set; }
    public Dictionary<string, int> ProcessamentosPorTipo { get; set; } = new();
    public TimeSpan TempoMedioProcessamento { get; set; }
    public DateTime UltimoProcessamento { get; set; }
}