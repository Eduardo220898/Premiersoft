using OfficeOpenXml;
using Microsoft.EntityFrameworkCore;
using APS.Infraestrutura.Dados.Contextos;
using APS.ServicoIngestao.Interfaces;
using APS.Compartilhado.Modelos.Entidades;
using APS.Compartilhado.Modelos.DTOs;
using System.Diagnostics;

namespace APS.ServicoIngestao.Servicos;

/// <summary>
/// Processador para arquivos Excel contendo dados de hospitais, médicos e pacientes
/// </summary>
public class ProcessadorExcel : IProcessadorExcel
{
    private readonly APSDbContext _context;
    private readonly ILogger<ProcessadorExcel> _logger;

    public string TipoSuportado => "Excel";

    public ProcessadorExcel(APSDbContext context, ILogger<ProcessadorExcel> logger)
    {
        _context = context;
        _logger = logger;
        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
    }

    public bool PodeProcessar(string nomeArquivo, string tipoMime)
    {
        var extensoes = new[] { ".xlsx", ".xls" };
        var tipos = new[] { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
                           "application/vnd.ms-excel" };
        
        var extensao = Path.GetExtension(nomeArquivo).ToLowerInvariant();
        return extensoes.Contains(extensao) || tipos.Contains(tipoMime);
    }

    public async Task<ResultadoProcessamentoDto> ProcessarAsync(Stream arquivo, string nomeArquivo)
    {
        var stopwatch = Stopwatch.StartNew();
        var resultado = new ResultadoProcessamentoDto
        {
            TipoArquivo = TipoSuportado,
            Sucesso = false
        };

        try
        {
            using var package = new ExcelPackage(arquivo);
            
            _logger.LogInformation("Iniciando processamento do arquivo Excel: {NomeArquivo}", nomeArquivo);
            
            // Detectar automaticamente o tipo de dados baseado nos nomes das planilhas
            foreach (var worksheet in package.Workbook.Worksheets)
            {
                var nomeWorksheet = worksheet.Name.ToLowerInvariant();
                
                if (nomeWorksheet.Contains("hospital") || nomeWorksheet.Contains("hospitais"))
                {
                    var resultadoHospitais = await ProcessarPlanilhaHospitais(worksheet);
                    CombinarResultados(resultado, resultadoHospitais);
                }
                else if (nomeWorksheet.Contains("medico") || nomeWorksheet.Contains("médico") || 
                         nomeWorksheet.Contains("medicos") || nomeWorksheet.Contains("médicos"))
                {
                    var resultadoMedicos = await ProcessarPlanilhaMedicos(worksheet);
                    CombinarResultados(resultado, resultadoMedicos);
                }
                else if (nomeWorksheet.Contains("paciente") || nomeWorksheet.Contains("pacientes"))
                {
                    var resultadoPacientes = await ProcessarPlanilhaPacientes(worksheet);
                    CombinarResultados(resultado, resultadoPacientes);
                }
                else if (nomeWorksheet.Contains("cid") || nomeWorksheet.Contains("classificacao"))
                {
                    var resultadoCID = await ProcessarPlanilhaCID10(worksheet);
                    CombinarResultados(resultado, resultadoCID);
                }
                else
                {
                    _logger.LogWarning("Planilha não reconhecida: {NomePlanilha}", worksheet.Name);
                }
            }

            await _context.SaveChangesAsync();
            resultado.Sucesso = resultado.RegistrosProcessados > 0;
            
            stopwatch.Stop();
            resultado.TempoProcessamento = stopwatch.Elapsed;
            
            _logger.LogInformation("Processamento concluído. Registros processados: {RegistrosProcessados}, Erros: {Erros}", 
                                 resultado.RegistrosProcessados, resultado.RegistrosComErro);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar arquivo Excel: {NomeArquivo}", nomeArquivo);
            resultado.Erros.Add($"Erro geral: {ex.Message}");
        }

        return resultado;
    }

    public async Task<ResultadoProcessamentoDto> ProcessarHospitaisAsync(Stream arquivo)
    {
        using var package = new ExcelPackage(arquivo);
        var worksheet = package.Workbook.Worksheets.FirstOrDefault();
        
        if (worksheet == null)
        {
            return new ResultadoProcessamentoDto
            {
                TipoArquivo = TipoSuportado,
                Sucesso = false,
                Erros = { "Nenhuma planilha encontrada no arquivo" }
            };
        }

        return await ProcessarPlanilhaHospitais(worksheet);
    }

    public async Task<ResultadoProcessamentoDto> ProcessarMedicosAsync(Stream arquivo)
    {
        using var package = new ExcelPackage(arquivo);
        var worksheet = package.Workbook.Worksheets.FirstOrDefault();
        
        if (worksheet == null)
        {
            return new ResultadoProcessamentoDto
            {
                TipoArquivo = TipoSuportado,
                Sucesso = false,
                Erros = { "Nenhuma planilha encontrada no arquivo" }
            };
        }

        return await ProcessarPlanilhaMedicos(worksheet);
    }

    public async Task<ResultadoProcessamentoDto> ProcessarPacientesAsync(Stream arquivo)
    {
        using var package = new ExcelPackage(arquivo);
        var worksheet = package.Workbook.Worksheets.FirstOrDefault();
        
        if (worksheet == null)
        {
            return new ResultadoProcessamentoDto
            {
                TipoArquivo = TipoSuportado,
                Sucesso = false,
                Erros = { "Nenhuma planilha encontrada no arquivo" }
            };
        }

        return await ProcessarPlanilhaPacientes(worksheet);
    }

    private async Task<ResultadoProcessamentoDto> ProcessarPlanilhaHospitais(ExcelWorksheet worksheet)
    {
        var resultado = new ResultadoProcessamentoDto { TipoArquivo = "Excel-Hospitais" };
        var linhaInicial = 2; // Assumindo que a linha 1 contém cabeçalhos

        try
        {
            // Verificar se temos dados
            if (worksheet.Dimension == null || worksheet.Dimension.Rows < linhaInicial)
            {
                resultado.Avisos.Add("Planilha de hospitais está vazia");
                return resultado;
            }

            var municipios = await _context.Municipios.Include(m => m.Estado).ToDictionaryAsync(m => m.Nome.ToUpper());

            for (int linha = linhaInicial; linha <= worksheet.Dimension.Rows; linha++)
            {
                try
                {
                    resultado.TotalRegistros++;

                    var nome = worksheet.Cells[linha, 1].Text?.Trim();
                    var cnes = worksheet.Cells[linha, 2].Text?.Trim();
                    var cnpj = worksheet.Cells[linha, 3].Text?.Trim();
                    var endereco = worksheet.Cells[linha, 4].Text?.Trim();
                    var municipioNome = worksheet.Cells[linha, 5].Text?.Trim();
                    var tipoEstabelecimento = worksheet.Cells[linha, 6].Text?.Trim();
                    var natureza = worksheet.Cells[linha, 7].Text?.Trim();
                    
                    // Validações básicas
                    if (string.IsNullOrEmpty(nome) || string.IsNullOrEmpty(cnes))
                    {
                        resultado.Erros.Add($"Linha {linha}: Nome e CNES são obrigatórios");
                        resultado.RegistrosComErro++;
                        continue;
                    }

                    // Buscar município
                    if (!municipios.TryGetValue(municipioNome?.ToUpper() ?? "", out var municipio))
                    {
                        resultado.Erros.Add($"Linha {linha}: Município '{municipioNome}' não encontrado");
                        resultado.RegistrosComErro++;
                        continue;
                    }

                    // Verificar se hospital já existe
                    var hospitalExistente = await _context.Hospitais.FirstOrDefaultAsync(h => h.CNES == cnes);
                    if (hospitalExistente != null)
                    {
                        resultado.Avisos.Add($"Linha {linha}: Hospital com CNES {cnes} já existe, ignorando");
                        continue;
                    }

                    var hospital = new Hospital
                    {
                        Nome = nome,
                        CNES = cnes,
                        CNPJ = string.IsNullOrEmpty(cnpj) ? null : cnpj,
                        Endereco = endereco ?? "",
                        MunicipioId = municipio.Id,
                        TipoEstabelecimento = tipoEstabelecimento ?? "Não informado",
                        Natureza = natureza ?? "Não informado",
                        CapacidadeLeitos = TentarConverterInt(worksheet.Cells[linha, 8].Text) ?? 0,
                        LeitosDisponiveis = TentarConverterInt(worksheet.Cells[linha, 9].Text) ?? 0,
                        Telefone = worksheet.Cells[linha, 10].Text?.Trim(),
                        Email = worksheet.Cells[linha, 11].Text?.Trim(),
                        DataCriacao = DateTime.UtcNow,
                        Ativo = true
                    };

                    // Tentar obter coordenadas se fornecidas
                    var latitude = TentarConverterDecimal(worksheet.Cells[linha, 12].Text);
                    var longitude = TentarConverterDecimal(worksheet.Cells[linha, 13].Text);
                    
                    if (latitude.HasValue && longitude.HasValue)
                    {
                        hospital.Latitude = latitude.Value;
                        hospital.Longitude = longitude.Value;
                    }

                    _context.Hospitais.Add(hospital);
                    resultado.RegistrosProcessados++;
                }
                catch (Exception ex)
                {
                    resultado.Erros.Add($"Linha {linha}: Erro ao processar - {ex.Message}");
                    resultado.RegistrosComErro++;
                }
            }

            resultado.Sucesso = resultado.RegistrosProcessados > 0;
        }
        catch (Exception ex)
        {
            resultado.Erros.Add($"Erro geral ao processar hospitais: {ex.Message}");
        }

        return resultado;
    }

    private async Task<ResultadoProcessamentoDto> ProcessarPlanilhaMedicos(ExcelWorksheet worksheet)
    {
        var resultado = new ResultadoProcessamentoDto { TipoArquivo = "Excel-Medicos" };
        var linhaInicial = 2;

        try
        {
            if (worksheet.Dimension == null || worksheet.Dimension.Rows < linhaInicial)
            {
                resultado.Avisos.Add("Planilha de médicos está vazia");
                return resultado;
            }

            var municipios = await _context.Municipios.ToDictionaryAsync(m => m.Nome.ToUpper());

            for (int linha = linhaInicial; linha <= worksheet.Dimension.Rows; linha++)
            {
                try
                {
                    resultado.TotalRegistros++;

                    var nome = worksheet.Cells[linha, 1].Text?.Trim();
                    var crm = worksheet.Cells[linha, 2].Text?.Trim();
                    var estadoCrm = worksheet.Cells[linha, 3].Text?.Trim();
                    var cpf = worksheet.Cells[linha, 4].Text?.Trim();
                    var especialidade = worksheet.Cells[linha, 5].Text?.Trim();

                    // Validações básicas
                    if (string.IsNullOrEmpty(nome) || string.IsNullOrEmpty(crm) || string.IsNullOrEmpty(cpf))
                    {
                        resultado.Erros.Add($"Linha {linha}: Nome, CRM e CPF são obrigatórios");
                        resultado.RegistrosComErro++;
                        continue;
                    }

                    // Verificar se médico já existe
                    var medicoExistente = await _context.Medicos
                        .FirstOrDefaultAsync(m => m.CRM == crm && m.EstadoCRM == estadoCrm);
                    
                    if (medicoExistente != null)
                    {
                        resultado.Avisos.Add($"Linha {linha}: Médico com CRM {crm}/{estadoCrm} já existe, ignorando");
                        continue;
                    }

                    var municipioNome = worksheet.Cells[linha, 9].Text?.Trim();
                    Municipio? municipioResidencia = null;
                    
                    if (!string.IsNullOrEmpty(municipioNome) && 
                        municipios.TryGetValue(municipioNome.ToUpper(), out municipioResidencia))
                    {
                        // Município encontrado
                    }

                    var medico = new Medico
                    {
                        Nome = nome,
                        CRM = crm,
                        EstadoCRM = estadoCrm ?? "SP",
                        CPF = cpf,
                        Email = worksheet.Cells[linha, 6].Text?.Trim(),
                        Telefone = worksheet.Cells[linha, 7].Text?.Trim(),
                        Especialidade = especialidade ?? "Clínica Médica",
                        SubEspecialidade = worksheet.Cells[linha, 8].Text?.Trim(),
                        EnderecoResidencial = worksheet.Cells[linha, 10].Text?.Trim(),
                        MunicipioResidenciaId = municipioResidencia?.Id,
                        DataFormatura = TentarConverterData(worksheet.Cells[linha, 11].Text) ?? DateTime.Now.AddYears(-10),
                        AnosExperiencia = TentarConverterInt(worksheet.Cells[linha, 12].Text) ?? 5,
                        SalarioBase = TentarConverterDecimal(worksheet.Cells[linha, 13].Text),
                        DataCriacao = DateTime.UtcNow,
                        Ativo = true
                    };

                    // Coordenadas de residência
                    var latitude = TentarConverterDecimal(worksheet.Cells[linha, 14].Text);
                    var longitude = TentarConverterDecimal(worksheet.Cells[linha, 15].Text);
                    
                    if (latitude.HasValue && longitude.HasValue)
                    {
                        medico.LatitudeResidencia = latitude.Value;
                        medico.LongitudeResidencia = longitude.Value;
                    }

                    _context.Medicos.Add(medico);
                    resultado.RegistrosProcessados++;
                }
                catch (Exception ex)
                {
                    resultado.Erros.Add($"Linha {linha}: Erro ao processar - {ex.Message}");
                    resultado.RegistrosComErro++;
                }
            }

            resultado.Sucesso = resultado.RegistrosProcessados > 0;
        }
        catch (Exception ex)
        {
            resultado.Erros.Add($"Erro geral ao processar médicos: {ex.Message}");
        }

        return resultado;
    }

    private async Task<ResultadoProcessamentoDto> ProcessarPlanilhaPacientes(ExcelWorksheet worksheet)
    {
        var resultado = new ResultadoProcessamentoDto { TipoArquivo = "Excel-Pacientes" };
        var linhaInicial = 2;

        try
        {
            if (worksheet.Dimension == null || worksheet.Dimension.Rows < linhaInicial)
            {
                resultado.Avisos.Add("Planilha de pacientes está vazia");
                return resultado;
            }

            var municipios = await _context.Municipios.ToDictionaryAsync(m => m.Nome.ToUpper());
            var classificacoesCID = await _context.ClassificacoesCID10.ToDictionaryAsync(c => c.Codigo.ToUpper());

            for (int linha = linhaInicial; linha <= worksheet.Dimension.Rows; linha++)
            {
                try
                {
                    resultado.TotalRegistros++;

                    var nome = worksheet.Cells[linha, 1].Text?.Trim();
                    var cpf = worksheet.Cells[linha, 2].Text?.Trim();
                    var dataNascimento = TentarConverterData(worksheet.Cells[linha, 3].Text);
                    var sexo = worksheet.Cells[linha, 4].Text?.Trim()?.ToUpper();
                    var municipioNome = worksheet.Cells[linha, 8].Text?.Trim();

                    // Validações básicas
                    if (string.IsNullOrEmpty(nome) || string.IsNullOrEmpty(cpf) || 
                        !dataNascimento.HasValue || string.IsNullOrEmpty(sexo))
                    {
                        resultado.Erros.Add($"Linha {linha}: Nome, CPF, data de nascimento e sexo são obrigatórios");
                        resultado.RegistrosComErro++;
                        continue;
                    }

                    // Verificar se paciente já existe
                    var pacienteExistente = await _context.Pacientes.FirstOrDefaultAsync(p => p.CPF == cpf);
                    if (pacienteExistente != null)
                    {
                        resultado.Avisos.Add($"Linha {linha}: Paciente com CPF {cpf} já existe, ignorando");
                        continue;
                    }

                    // Buscar município
                    if (!municipios.TryGetValue(municipioNome?.ToUpper() ?? "", out var municipio))
                    {
                        resultado.Erros.Add($"Linha {linha}: Município '{municipioNome}' não encontrado");
                        resultado.RegistrosComErro++;
                        continue;
                    }

                    var paciente = new Paciente
                    {
                        Nome = nome,
                        CPF = cpf,
                        RG = worksheet.Cells[linha, 5].Text?.Trim(),
                        CartaoSUS = worksheet.Cells[linha, 6].Text?.Trim(),
                        DataNascimento = dataNascimento.Value,
                        Sexo = sexo,
                        Email = worksheet.Cells[linha, 7].Text?.Trim(),
                        Endereco = worksheet.Cells[linha, 9].Text?.Trim() ?? "",
                        CEP = worksheet.Cells[linha, 10].Text?.Trim(),
                        Telefone = worksheet.Cells[linha, 11].Text?.Trim(),
                        TipoSanguineo = worksheet.Cells[linha, 12].Text?.Trim(),
                        EstadoCivil = worksheet.Cells[linha, 13].Text?.Trim() ?? "Não Informado",
                        Profissao = worksheet.Cells[linha, 14].Text?.Trim(),
                        PrioridadeAtendimento = worksheet.Cells[linha, 15].Text?.Trim() ?? "Normal",
                        MunicipioId = municipio.Id,
                        DataCriacao = DateTime.UtcNow,
                        Ativo = true
                    };

                    // Coordenadas
                    var latitude = TentarConverterDecimal(worksheet.Cells[linha, 16].Text);
                    var longitude = TentarConverterDecimal(worksheet.Cells[linha, 17].Text);
                    
                    if (latitude.HasValue && longitude.HasValue)
                    {
                        paciente.Latitude = latitude.Value;
                        paciente.Longitude = longitude.Value;
                    }

                    _context.Pacientes.Add(paciente);
                    await _context.SaveChangesAsync(); // Salvar para obter o ID

                    // Processar diagnósticos se fornecidos
                    var codigoCID = worksheet.Cells[linha, 18].Text?.Trim()?.ToUpper();
                    if (!string.IsNullOrEmpty(codigoCID) && 
                        classificacoesCID.TryGetValue(codigoCID, out var classificacao))
                    {
                        var diagnostico = new DiagnosticoPaciente
                        {
                            PacienteId = paciente.Id,
                            ClassificacaoCID10Id = classificacao.Id,
                            DataDiagnostico = DateTime.UtcNow,
                            TipoDiagnostico = "Principal",
                            StatusDiagnostico = "Ativo",
                            Observacoes = worksheet.Cells[linha, 19].Text?.Trim()
                        };

                        _context.DiagnosticosPacientes.Add(diagnostico);
                    }

                    resultado.RegistrosProcessados++;
                }
                catch (Exception ex)
                {
                    resultado.Erros.Add($"Linha {linha}: Erro ao processar - {ex.Message}");
                    resultado.RegistrosComErro++;
                }
            }

            resultado.Sucesso = resultado.RegistrosProcessados > 0;
        }
        catch (Exception ex)
        {
            resultado.Erros.Add($"Erro geral ao processar pacientes: {ex.Message}");
        }

        return resultado;
    }

    private async Task<ResultadoProcessamentoDto> ProcessarPlanilhaCID10(ExcelWorksheet worksheet)
    {
        var resultado = new ResultadoProcessamentoDto { TipoArquivo = "Excel-CID10" };
        var linhaInicial = 2;

        try
        {
            if (worksheet.Dimension == null || worksheet.Dimension.Rows < linhaInicial)
            {
                resultado.Avisos.Add("Planilha de CID-10 está vazia");
                return resultado;
            }

            for (int linha = linhaInicial; linha <= worksheet.Dimension.Rows; linha++)
            {
                try
                {
                    resultado.TotalRegistros++;

                    var codigo = worksheet.Cells[linha, 1].Text?.Trim()?.ToUpper();
                    var descricao = worksheet.Cells[linha, 2].Text?.Trim();

                    if (string.IsNullOrEmpty(codigo) || string.IsNullOrEmpty(descricao))
                    {
                        resultado.Erros.Add($"Linha {linha}: Código e descrição são obrigatórios");
                        resultado.RegistrosComErro++;
                        continue;
                    }

                    // Verificar se já existe
                    var existente = await _context.ClassificacoesCID10.FirstOrDefaultAsync(c => c.Codigo == codigo);
                    if (existente != null)
                    {
                        resultado.Avisos.Add($"Linha {linha}: CID-10 {codigo} já existe, ignorando");
                        continue;
                    }

                    var classificacao = new ClassificacaoCID10
                    {
                        Codigo = codigo,
                        Descricao = descricao,
                        Categoria = worksheet.Cells[linha, 3].Text?.Trim(),
                        Subcategoria = worksheet.Cells[linha, 4].Text?.Trim(),
                        EspecialidadeRecomendada = worksheet.Cells[linha, 5].Text?.Trim(),
                        GrauSeveridade = worksheet.Cells[linha, 6].Text?.Trim() ?? "Normal",
                        Sexo = worksheet.Cells[linha, 7].Text?.Trim(),
                        FaixaEtaria = worksheet.Cells[linha, 8].Text?.Trim(),
                        DataCriacao = DateTime.UtcNow,
                        Ativo = true
                    };

                    _context.ClassificacoesCID10.Add(classificacao);
                    resultado.RegistrosProcessados++;
                }
                catch (Exception ex)
                {
                    resultado.Erros.Add($"Linha {linha}: Erro ao processar - {ex.Message}");
                    resultado.RegistrosComErro++;
                }
            }

            resultado.Sucesso = resultado.RegistrosProcessados > 0;
        }
        catch (Exception ex)
        {
            resultado.Erros.Add($"Erro geral ao processar CID-10: {ex.Message}");
        }

        return resultado;
    }

    private static void CombinarResultados(ResultadoProcessamentoDto principal, ResultadoProcessamentoDto adicional)
    {
        principal.TotalRegistros += adicional.TotalRegistros;
        principal.RegistrosProcessados += adicional.RegistrosProcessados;
        principal.RegistrosComErro += adicional.RegistrosComErro;
        principal.Erros.AddRange(adicional.Erros);
        principal.Avisos.AddRange(adicional.Avisos);
        
        foreach (var estatistica in adicional.Estatisticas)
        {
            principal.Estatisticas[estatistica.Key] = estatistica.Value;
        }
    }

    private static int? TentarConverterInt(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor)) return null;
        return int.TryParse(valor, out var resultado) ? resultado : null;
    }

    private static decimal? TentarConverterDecimal(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor)) return null;
        return decimal.TryParse(valor, out var resultado) ? resultado : null;
    }

    private static DateTime? TentarConverterData(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor)) return null;
        return DateTime.TryParse(valor, out var resultado) ? resultado : null;
    }
}