using APS.ServicoIngestao.Interfaces;
using APS.Compartilhado.Modelos.DTOs;

namespace APS.ServicoIngestao.Servicos;

/// <summary>
/// Gerenciador centralizado para ingestão de dados de saúde
/// Coordena os diferentes processadores baseado no tipo de arquivo
/// </summary>
public class GerenciadorIngestao : IGerenciadorIngestao
{
    private readonly ILogger<GerenciadorIngestao> _logger;
    private readonly IProcessadorExcel _processadorExcel;
    private readonly IProcessadorXML _processadorXML;
    private readonly IProcessadorJSON _processadorJSON;
    private readonly IProcessadorHL7 _processadorHL7;
    private readonly IProcessadorFHIR _processadorFHIR;
    
    private readonly List<IProcessadorBase> _processadores;

    public GerenciadorIngestao(
        ILogger<GerenciadorIngestao> logger,
        IProcessadorExcel processadorExcel,
        IProcessadorXML processadorXML,
        IProcessadorJSON processadorJSON,
        IProcessadorHL7 processadorHL7,
        IProcessadorFHIR processadorFHIR)
    {
        _logger = logger;
        _processadorExcel = processadorExcel;
        _processadorXML = processadorXML;
        _processadorJSON = processadorJSON;
        _processadorHL7 = processadorHL7;
        _processadorFHIR = processadorFHIR;
        
        _processadores = new List<IProcessadorBase>
        {
            _processadorExcel,
            _processadorXML,
            _processadorJSON,
            _processadorHL7,
            _processadorFHIR
        };
    }

    public async Task<ResultadoProcessamentoDto> ProcessarArquivoAsync(Stream arquivo, string nomeArquivo, string tipoMime)
    {
        _logger.LogInformation("Iniciando processamento de arquivo: {NomeArquivo} (Tipo: {TipoMime})", 
                             nomeArquivo, tipoMime);

        var resultado = new ResultadoProcessamentoDto
        {
            TipoArquivo = "Desconhecido",
            Sucesso = false
        };

        try
        {
            // Encontrar processador adequado
            var processador = _processadores.FirstOrDefault(p => p.PodeProcessar(nomeArquivo, tipoMime));
            
            if (processador == null)
            {
                resultado.Erros.Add($"Nenhum processador encontrado para o arquivo: {nomeArquivo} (Tipo: {tipoMime})");
                _logger.LogWarning("Nenhum processador encontrado para arquivo: {NomeArquivo} (Tipo: {TipoMime})", 
                                 nomeArquivo, tipoMime);
                return resultado;
            }

            _logger.LogInformation("Processador selecionado: {TipoProcessador} para arquivo: {NomeArquivo}", 
                                 processador.TipoSuportado, nomeArquivo);

            // Processar arquivo
            resultado = await processador.ProcessarAsync(arquivo, nomeArquivo);
            
            // Log do resultado
            if (resultado.Sucesso)
            {
                _logger.LogInformation("Arquivo processado com sucesso: {NomeArquivo}. " +
                                     "Registros processados: {RegistrosProcessados}, " +
                                     "Registros atualizados: {RegistrosAtualizados}, " +
                                     "Erros: {RegistrosComErro}, " +
                                     "Tempo: {TempoProcessamento}ms", 
                                     nomeArquivo, 
                                     resultado.RegistrosProcessados,
                                     resultado.RegistrosAtualizados,
                                     resultado.RegistrosComErro,
                                     resultado.TempoProcessamento.TotalMilliseconds);
            }
            else
            {
                _logger.LogWarning("Falha no processamento do arquivo: {NomeArquivo}. Erros: {Erros}", 
                                 nomeArquivo, string.Join("; ", resultado.Erros));
            }

            return resultado;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro inesperado no processamento do arquivo: {NomeArquivo}", nomeArquivo);
            resultado.Erros.Add($"Erro inesperado: {ex.Message}");
            return resultado;
        }
    }

    public async Task<List<string>> ObterTiposSuportados()
    {
        await Task.CompletedTask; // Para manter a assinatura async se necessário no futuro
        
        var tiposSuportados = new List<string>();
        
        foreach (var processador in _processadores)
        {
            tiposSuportados.Add(processador.TipoSuportado);
        }

        return tiposSuportados;
    }

    public async Task<EstatisticasProcessamentoDto> ObterEstatisticasProcessamento()
    {
        await Task.CompletedTask; // Placeholder para futuras implementações
        
        // Esta implementação é básica - em um cenário real, 
        // as estatísticas seriam armazenadas em banco ou cache
        var estatisticas = new EstatisticasProcessamentoDto
        {
            TotalArquivosProcessados = 0,
            ArquivosComSucesso = 0,
            ArquivosComErro = 0,
            ProcessamentosPorTipo = new Dictionary<string, int>(),
            TempoMedioProcessamento = TimeSpan.Zero,
            UltimoProcessamento = DateTime.UtcNow
        };

        foreach (var processador in _processadores)
        {
            estatisticas.ProcessamentosPorTipo[processador.TipoSuportado] = 0;
        }

        return estatisticas;
    }

    /// <summary>
    /// Detecta automaticamente o tipo de arquivo baseado no conteúdo
    /// </summary>
    public string DetectarTipoArquivo(Stream arquivo, string nomeArquivo)
    {
        try
        {
            arquivo.Position = 0;
            using var reader = new StreamReader(arquivo, leaveOpen: true);
            var primeirasLinhas = "";
            
            for (int i = 0; i < 10 && !reader.EndOfStream; i++)
            {
                primeirasLinhas += reader.ReadLine() + "\n";
            }
            
            arquivo.Position = 0; // Reset para processamento posterior

            // Detecção baseada no conteúdo
            if (primeirasLinhas.Contains("MSH|") || primeirasLinhas.Contains("PID|"))
            {
                return "HL7";
            }
            
            if (primeirasLinhas.TrimStart().StartsWith("{") || primeirasLinhas.TrimStart().StartsWith("["))
            {
                if (primeirasLinhas.Contains("\"resourceType\"") || primeirasLinhas.Contains("\"fhir\""))
                {
                    return "FHIR";
                }
                return "JSON";
            }
            
            if (primeirasLinhas.TrimStart().StartsWith("<"))
            {
                if (primeirasLinhas.Contains("<Bundle") || primeirasLinhas.Contains("<Patient") || 
                    primeirasLinhas.Contains("xmlns=\"http://hl7.org/fhir\""))
                {
                    return "FHIR";
                }
                return "XML";
            }

            // Detecção baseada na extensão
            var extensao = Path.GetExtension(nomeArquivo).ToLowerInvariant();
            return extensao switch
            {
                ".xlsx" or ".xls" => "Excel",
                ".xml" => "XML", 
                ".json" => "JSON",
                ".hl7" => "HL7",
                ".fhir" => "FHIR",
                _ => "Desconhecido"
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao detectar tipo de arquivo: {NomeArquivo}", nomeArquivo);
            return "Desconhecido";
        }
    }

    /// <summary>
    /// Valida se o arquivo pode ser processado
    /// </summary>
    public bool ValidarArquivo(Stream arquivo, string nomeArquivo, long tamanhoMaximo = 100 * 1024 * 1024) // 100MB default
    {
        try
        {
            // Validar tamanho
            if (arquivo.Length > tamanhoMaximo)
            {
                _logger.LogWarning("Arquivo muito grande: {NomeArquivo} ({Tamanho} bytes). Máximo permitido: {TamanhoMaximo} bytes", 
                                 nomeArquivo, arquivo.Length, tamanhoMaximo);
                return false;
            }

            // Validar se arquivo não está vazio
            if (arquivo.Length == 0)
            {
                _logger.LogWarning("Arquivo vazio: {NomeArquivo}", nomeArquivo);
                return false;
            }

            // Validar se stream é legível
            if (!arquivo.CanRead)
            {
                _logger.LogWarning("Stream não legível para arquivo: {NomeArquivo}", nomeArquivo);
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao validar arquivo: {NomeArquivo}", nomeArquivo);
            return false;
        }
    }
}