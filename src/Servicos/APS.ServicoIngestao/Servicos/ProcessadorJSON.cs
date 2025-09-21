using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using APS.Infraestrutura.Dados.Contextos;
using APS.ServicoIngestao.Interfaces;
using APS.Compartilhado.Modelos.Entidades;
using APS.Compartilhado.Modelos.DTOs;
using System.Diagnostics;
using System.Text.Json.Nodes;

namespace APS.ServicoIngestao.Servicos;

/// <summary>
/// Processador para arquivos JSON contendo dados de hospitais, médicos e pacientes
/// Suporta formatos JSON estruturados para interoperabilidade em saúde
/// </summary>
public class ProcessadorJSON : IProcessadorJSON
{
    private readonly APSDbContext _context;
    private readonly ILogger<ProcessadorJSON> _logger;

    public string TipoSuportado => "JSON";

    public ProcessadorJSON(APSDbContext context, ILogger<ProcessadorJSON> logger)
    {
        _context = context;
        _logger = logger;
    }

    public bool PodeProcessar(string nomeArquivo, string tipoMime)
    {
        var extensoes = new[] { ".json" };
        var tipos = new[] { "application/json", "text/json" };
        
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
            _logger.LogInformation("Iniciando processamento do arquivo JSON: {NomeArquivo}", nomeArquivo);
            
            using var reader = new StreamReader(arquivo);
            var jsonContent = await reader.ReadToEndAsync();
            
            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                AllowTrailingCommas = true
            };

            var jsonNode = JsonNode.Parse(jsonContent);
            if (jsonNode == null)
            {
                resultado.Erros.Add("Arquivo JSON vazio ou inválido");
                return resultado;
            }

            await ProcessarJSONSaude(jsonNode, resultado);
            
            await _context.SaveChangesAsync();
            resultado.Sucesso = resultado.RegistrosProcessados > 0;
            
            stopwatch.Stop();
            resultado.TempoProcessamento = stopwatch.Elapsed;
            
            _logger.LogInformation("Processamento JSON concluído. Registros processados: {RegistrosProcessados}, Erros: {Erros}", 
                                 resultado.RegistrosProcessados, resultado.RegistrosComErro);
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Erro de formato JSON no arquivo: {NomeArquivo}", nomeArquivo);
            resultado.Erros.Add($"Formato JSON inválido: {ex.Message}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar arquivo JSON: {NomeArquivo}", nomeArquivo);
            resultado.Erros.Add($"Erro geral: {ex.Message}");
        }

        return resultado;
    }

    public async Task<ResultadoProcessamentoDto> ProcessarJSONSaude(Stream arquivo)
    {
        return await ProcessarAsync(arquivo, "arquivo_json");
    }

    private async Task ProcessarJSONSaude(JsonNode jsonNode, ResultadoProcessamentoDto resultado)
    {
        _logger.LogInformation("Processando JSON de dados de saúde");

        // Detectar estrutura do JSON
        if (jsonNode is JsonObject jsonObject)
        {
            // Verificar se é um objeto único ou múltiplos tipos
            if (jsonObject.ContainsKey("hospitais") || jsonObject.ContainsKey("estabelecimentos"))
            {
                await ProcessarHospitaisJSON(jsonObject, resultado);
            }
            else if (jsonObject.ContainsKey("medicos") || jsonObject.ContainsKey("profissionais"))
            {
                await ProcessarMedicosJSON(jsonObject, resultado);
            }
            else if (jsonObject.ContainsKey("pacientes") || jsonObject.ContainsKey("usuarios"))
            {
                await ProcessarPacientesJSON(jsonObject, resultado);
            }
            else if (jsonObject.ContainsKey("dados_saude") || jsonObject.ContainsKey("sistema_saude"))
            {
                // JSON integrado com múltiplos tipos
                await ProcessarJSONIntegrado(jsonObject, resultado);
            }
            else if (jsonObject.ContainsKey("cnes") || jsonObject.ContainsKey("nome"))
            {
                // Objeto hospital individual
                await ProcessarHospitalUnico(jsonObject, resultado);
            }
            else if (jsonObject.ContainsKey("crm") || jsonObject.ContainsKey("especialidade"))
            {
                // Objeto médico individual
                await ProcessarMedicoUnico(jsonObject, resultado);
            }
            else if (jsonObject.ContainsKey("cpf"))
            {
                // Objeto paciente individual
                await ProcessarPacienteUnico(jsonObject, resultado);
            }
            else
            {
                resultado.Erros.Add("Estrutura JSON não reconhecida");
            }
        }
        else if (jsonNode is JsonArray jsonArray)
        {
            // Array de objetos - tentar detectar tipo pelo primeiro elemento
            if (jsonArray.Count > 0 && jsonArray[0] is JsonObject primeiroItem)
            {
                if (primeiroItem.ContainsKey("cnes"))
                {
                    await ProcessarArrayHospitais(jsonArray, resultado);
                }
                else if (primeiroItem.ContainsKey("crm"))
                {
                    await ProcessarArrayMedicos(jsonArray, resultado);
                }
                else if (primeiroItem.ContainsKey("cpf"))
                {
                    await ProcessarArrayPacientes(jsonArray, resultado);
                }
                else
                {
                    resultado.Erros.Add("Tipo de array JSON não reconhecido");
                }
            }
        }
    }

    private async Task ProcessarHospitaisJSON(JsonObject jsonObject, ResultadoProcessamentoDto resultado)
    {
        var hospitaisNode = jsonObject["hospitais"] ?? jsonObject["estabelecimentos"];
        if (hospitaisNode is JsonArray hospitaisArray)
        {
            await ProcessarArrayHospitais(hospitaisArray, resultado);
        }
    }

    private async Task ProcessarMedicosJSON(JsonObject jsonObject, ResultadoProcessamentoDto resultado)
    {
        var medicosNode = jsonObject["medicos"] ?? jsonObject["profissionais"];
        if (medicosNode is JsonArray medicosArray)
        {
            await ProcessarArrayMedicos(medicosArray, resultado);
        }
    }

    private async Task ProcessarPacientesJSON(JsonObject jsonObject, ResultadoProcessamentoDto resultado)
    {
        var pacientesNode = jsonObject["pacientes"] ?? jsonObject["usuarios"];
        if (pacientesNode is JsonArray pacientesArray)
        {
            await ProcessarArrayPacientes(pacientesArray, resultado);
        }
    }

    private async Task ProcessarJSONIntegrado(JsonObject jsonObject, ResultadoProcessamentoDto resultado)
    {
        var dadosNode = jsonObject["dados_saude"] ?? jsonObject["sistema_saude"];
        if (dadosNode is JsonObject dadosObject)
        {
            if (dadosObject.ContainsKey("hospitais"))
            {
                await ProcessarHospitaisJSON(dadosObject, resultado);
            }
            if (dadosObject.ContainsKey("medicos"))
            {
                await ProcessarMedicosJSON(dadosObject, resultado);
            }
            if (dadosObject.ContainsKey("pacientes"))
            {
                await ProcessarPacientesJSON(dadosObject, resultado);
            }
        }
    }

    private async Task ProcessarArrayHospitais(JsonArray hospitaisArray, ResultadoProcessamentoDto resultado)
    {
        foreach (var hospitalNode in hospitaisArray)
        {
            if (hospitalNode is JsonObject hospitalObj)
            {
                try
                {
                    var hospital = CriarHospitalDoJSON(hospitalObj);
                    if (hospital != null)
                    {
                        resultado.TotalRegistros++;
                        
                        var hospitalExistente = await _context.Hospitais
                            .FirstOrDefaultAsync(h => h.CNES == hospital.CNES);

                        if (hospitalExistente == null)
                        {
                            _context.Hospitais.Add(hospital);
                            resultado.RegistrosProcessados++;
                            _logger.LogDebug("Hospital adicionado: {Nome} - CNES: {CNES}", 
                                           hospital.Nome, hospital.CNES);
                        }
                        else
                        {
                            AtualizarHospitalExistente(hospitalExistente, hospital);
                            resultado.RegistrosAtualizados++;
                            resultado.Avisos.Add($"Hospital {hospital.CNES} atualizado");
                            _logger.LogDebug("Hospital atualizado: {Nome} - CNES: {CNES}", 
                                           hospital.Nome, hospital.CNES);
                        }
                    }
                }
                catch (Exception ex)
                {
                    resultado.RegistrosComErro++;
                    resultado.Erros.Add($"Erro ao processar hospital: {ex.Message}");
                    _logger.LogWarning(ex, "Erro ao processar hospital do JSON");
                }
            }
        }
    }

    private async Task ProcessarArrayMedicos(JsonArray medicosArray, ResultadoProcessamentoDto resultado)
    {
        foreach (var medicoNode in medicosArray)
        {
            if (medicoNode is JsonObject medicoObj)
            {
                try
                {
                    var medico = CriarMedicoDoJSON(medicoObj);
                    if (medico != null)
                    {
                        resultado.TotalRegistros++;
                        
                        var medicoExistente = await _context.Medicos
                            .FirstOrDefaultAsync(m => m.CRM == medico.CRM && m.EstadoCRM == medico.EstadoCRM);

                        if (medicoExistente == null)
                        {
                            _context.Medicos.Add(medico);
                            resultado.RegistrosProcessados++;
                            _logger.LogDebug("Médico adicionado: {Nome} - CRM: {CRM}", 
                                           medico.Nome, medico.CRM);
                        }
                        else
                        {
                            AtualizarMedicoExistente(medicoExistente, medico);
                            resultado.RegistrosAtualizados++;
                            resultado.Avisos.Add($"Médico {medico.CRM}/{medico.EstadoCRM} atualizado");
                            _logger.LogDebug("Médico atualizado: {Nome} - CRM: {CRM}", 
                                           medico.Nome, medico.CRM);
                        }
                    }
                }
                catch (Exception ex)
                {
                    resultado.RegistrosComErro++;
                    resultado.Erros.Add($"Erro ao processar médico: {ex.Message}");
                    _logger.LogWarning(ex, "Erro ao processar médico do JSON");
                }
            }
        }
    }

    private async Task ProcessarArrayPacientes(JsonArray pacientesArray, ResultadoProcessamentoDto resultado)
    {
        foreach (var pacienteNode in pacientesArray)
        {
            if (pacienteNode is JsonObject pacienteObj)
            {
                try
                {
                    var paciente = CriarPacienteDoJSON(pacienteObj);
                    if (paciente != null)
                    {
                        resultado.TotalRegistros++;
                        
                        var pacienteExistente = await _context.Pacientes
                            .FirstOrDefaultAsync(p => p.CPF == paciente.CPF);

                        if (pacienteExistente == null)
                        {
                            _context.Pacientes.Add(paciente);
                            resultado.RegistrosProcessados++;
                            _logger.LogDebug("Paciente adicionado: {Nome} - CPF: {CPF}", 
                                           paciente.Nome, paciente.CPF.Substring(0, 3) + "***");
                        }
                        else
                        {
                            AtualizarPacienteExistente(pacienteExistente, paciente);
                            resultado.RegistrosAtualizados++;
                            resultado.Avisos.Add($"Paciente CPF {paciente.CPF.Substring(0, 3)}*** atualizado");
                            _logger.LogDebug("Paciente atualizado: {Nome}", paciente.Nome);
                        }
                    }
                }
                catch (Exception ex)
                {
                    resultado.RegistrosComErro++;
                    resultado.Erros.Add($"Erro ao processar paciente: {ex.Message}");
                    _logger.LogWarning(ex, "Erro ao processar paciente do JSON");
                }
            }
        }
    }

    private async Task ProcessarHospitalUnico(JsonObject hospitalObj, ResultadoProcessamentoDto resultado)
    {
        var array = new JsonArray { hospitalObj };
        await ProcessarArrayHospitais(array, resultado);
    }

    private async Task ProcessarMedicoUnico(JsonObject medicoObj, ResultadoProcessamentoDto resultado)
    {
        var array = new JsonArray { medicoObj };
        await ProcessarArrayMedicos(array, resultado);
    }

    private async Task ProcessarPacienteUnico(JsonObject pacienteObj, ResultadoProcessamentoDto resultado)
    {
        var array = new JsonArray { pacienteObj };
        await ProcessarArrayPacientes(array, resultado);
    }

    private Hospital? CriarHospitalDoJSON(JsonObject hospitalObj)
    {
        try
        {
            var cnes = ObterValorString(hospitalObj, "cnes", "codigo_cnes", "id");
            var nome = ObterValorString(hospitalObj, "nome", "razao_social", "denominacao");

            if (string.IsNullOrWhiteSpace(cnes) || string.IsNullOrWhiteSpace(nome))
            {
                _logger.LogWarning("Hospital JSON com dados obrigatórios faltando");
                return null;
            }

            var hospital = new Hospital
            {
                CNES = cnes,
                Nome = nome,
                TipoEstabelecimento = ObterValorString(hospitalObj, "tipo", "tipo_estabelecimento") ?? "Hospital Geral",
                Natureza = ObterValorString(hospitalObj, "natureza", "tipo_natureza") ?? "Público",
                Endereco = ObterValorString(hospitalObj, "endereco", "logradouro") ?? "",
                Telefone = ObterValorString(hospitalObj, "telefone", "fone"),
                Email = ObterValorString(hospitalObj, "email", "e_mail"),
                CapacidadeLeitos = ObterValorInteiro(hospitalObj, "leitos", "capacidade_leitos") ?? 0,
                Ativo = ObterValorBoolean(hospitalObj, "ativo", "status") ?? true,
                DataCriacao = DateTime.UtcNow,
                MunicipioId = 1 // Default - pode ser melhorado com lookup por código IBGE
            };

            // Processar coordenadas se disponíveis
            var latitude = ObterValorDecimal(hospitalObj, "latitude", "lat");
            var longitude = ObterValorDecimal(hospitalObj, "longitude", "lng", "lon");
            if (latitude.HasValue && longitude.HasValue)
            {
                hospital.Latitude = latitude;
                hospital.Longitude = longitude;
            }

            return hospital;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criar hospital do JSON");
            return null;
        }
    }

    private Medico? CriarMedicoDoJSON(JsonObject medicoObj)
    {
        try
        {
            var crm = ObterValorString(medicoObj, "crm", "numero_crm");
            var estadoCRM = ObterValorString(medicoObj, "estado_crm", "uf_crm", "crm_uf");
            var nome = ObterValorString(medicoObj, "nome", "nome_completo");

            if (string.IsNullOrWhiteSpace(crm) || string.IsNullOrWhiteSpace(estadoCRM) || 
                string.IsNullOrWhiteSpace(nome))
            {
                _logger.LogWarning("Médico JSON com dados obrigatórios faltando");
                return null;
            }

            var medico = new Medico
            {
                CRM = crm,
                EstadoCRM = estadoCRM.ToUpperInvariant(),
                Nome = nome,
                CPF = ObterValorString(medicoObj, "cpf") ?? "",
                Especialidade = ObterValorString(medicoObj, "especialidade", "especialidade_principal") ?? "Clínica Médica",
                Telefone = ObterValorString(medicoObj, "telefone", "fone"),
                Email = ObterValorString(medicoObj, "email", "e_mail"),
                Ativo = ObterValorBoolean(medicoObj, "ativo", "status") ?? true,
                DataCriacao = DateTime.UtcNow
            };

            // Processar data de formatura
            var dataFormatura = ObterValorDateTime(medicoObj, "data_formatura", "formatura");
            medico.DataFormatura = dataFormatura ?? DateTime.UtcNow.AddYears(-10);

            // Processar anos de experiência
            var anosExperiencia = ObterValorInteiro(medicoObj, "anos_experiencia", "experiencia");
            medico.AnosExperiencia = anosExperiencia ?? 5;

            return medico;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criar médico do JSON");
            return null;
        }
    }

    private Paciente? CriarPacienteDoJSON(JsonObject pacienteObj)
    {
        try
        {
            var cpf = ObterValorString(pacienteObj, "cpf", "documento");
            var nome = ObterValorString(pacienteObj, "nome", "nome_completo");

            if (string.IsNullOrWhiteSpace(cpf) || string.IsNullOrWhiteSpace(nome))
            {
                _logger.LogWarning("Paciente JSON com dados obrigatórios faltando");
                return null;
            }

            var paciente = new Paciente
            {
                CPF = cpf,
                Nome = nome,
                Telefone = ObterValorString(pacienteObj, "telefone", "fone"),
                Email = ObterValorString(pacienteObj, "email", "e_mail"),
                Endereco = ObterValorString(pacienteObj, "endereco", "logradouro") ?? "",
                CartaoSUS = ObterValorString(pacienteObj, "cartao_sus", "sus"),
                DataCriacao = DateTime.UtcNow
            };

            // Processar data de nascimento
            var dataNascimento = ObterValorDateTime(pacienteObj, "data_nascimento", "nascimento");
            if (dataNascimento.HasValue)
            {
                paciente.DataNascimento = dataNascimento.Value;
            }

            // Processar sexo
            var sexo = ObterValorString(pacienteObj, "sexo", "genero");
            if (!string.IsNullOrWhiteSpace(sexo))
            {
                paciente.Sexo = sexo.ToUpperInvariant().StartsWith("M") ? "M" : "F";
            }

            return paciente;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criar paciente do JSON");
            return null;
        }
    }

    private string? ObterValorString(JsonObject obj, params string[] chaves)
    {
        foreach (var chave in chaves)
        {
            if (obj.ContainsKey(chave) && obj[chave] != null)
            {
                var valor = obj[chave]?.ToString();
                if (!string.IsNullOrWhiteSpace(valor))
                    return valor.Trim();
            }
        }
        return null;
    }

    private int? ObterValorInteiro(JsonObject obj, params string[] chaves)
    {
        var valor = ObterValorString(obj, chaves);
        if (int.TryParse(valor, out var resultado))
            return resultado;
        return null;
    }

    private decimal? ObterValorDecimal(JsonObject obj, params string[] chaves)
    {
        var valor = ObterValorString(obj, chaves);
        if (decimal.TryParse(valor, out var resultado))
            return resultado;
        return null;
    }

    private bool? ObterValorBoolean(JsonObject obj, params string[] chaves)
    {
        var valor = ObterValorString(obj, chaves);
        if (string.IsNullOrWhiteSpace(valor)) return null;

        var valorLower = valor.ToLowerInvariant();
        if (valorLower == "true" || valorLower == "1" || valorLower == "sim" || valorLower == "ativo")
            return true;
        if (valorLower == "false" || valorLower == "0" || valorLower == "não" || valorLower == "inativo")
            return false;

        return null;
    }

    private DateTime? ObterValorDateTime(JsonObject obj, params string[] chaves)
    {
        var valor = ObterValorString(obj, chaves);
        if (DateTime.TryParse(valor, out var resultado))
            return resultado;
        return null;
    }

    private void AtualizarHospitalExistente(Hospital existente, Hospital novo)
    {
        existente.Nome = novo.Nome;
        existente.TipoEstabelecimento = novo.TipoEstabelecimento;
        existente.Natureza = novo.Natureza;
        existente.Endereco = novo.Endereco;
        existente.Telefone = novo.Telefone ?? existente.Telefone;
        existente.Email = novo.Email ?? existente.Email;
        existente.CapacidadeLeitos = novo.CapacidadeLeitos;
        existente.Ativo = novo.Ativo;
        existente.DataAtualizacao = DateTime.UtcNow;
    }

    private void AtualizarMedicoExistente(Medico existente, Medico novo)
    {
        existente.Nome = novo.Nome;
        existente.Especialidade = novo.Especialidade;
        existente.Telefone = novo.Telefone ?? existente.Telefone;
        existente.Email = novo.Email ?? existente.Email;
        existente.Ativo = novo.Ativo;
        existente.AnosExperiencia = novo.AnosExperiencia;
        existente.DataAtualizacao = DateTime.UtcNow;
    }

    private void AtualizarPacienteExistente(Paciente existente, Paciente novo)
    {
        existente.Nome = novo.Nome;
        existente.Telefone = novo.Telefone ?? existente.Telefone;
        existente.Email = novo.Email ?? existente.Email;
        existente.Endereco = novo.Endereco;
        existente.CartaoSUS = novo.CartaoSUS ?? existente.CartaoSUS;
        existente.DataAtualizacao = DateTime.UtcNow;
    }
}