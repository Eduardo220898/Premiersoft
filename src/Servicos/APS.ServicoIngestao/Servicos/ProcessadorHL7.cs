using NHapi.Base.Parser;
using NHapi.Base.Model;
using NHapi.Model.V251.Message;
using NHapi.Model.V251.Segment;
using Microsoft.EntityFrameworkCore;
using APS.Infraestrutura.Dados.Contextos;
using APS.ServicoIngestao.Interfaces;
using APS.Compartilhado.Modelos.Entidades;
using APS.Compartilhado.Modelos.DTOs;
using System.Diagnostics;
using System.Text;

namespace APS.ServicoIngestao.Servicos;

/// <summary>
/// Processador para mensagens HL7 v2.5.1 contendo dados de pacientes e movimentações hospitalares
/// Suporta mensagens ADT (Admissão, Transferência, Alta) e ORM (Ordens Médicas)
/// </summary>
public class ProcessadorHL7 : IProcessadorHL7
{
    private readonly APSDbContext _context;
    private readonly ILogger<ProcessadorHL7> _logger;
    private readonly PipeParser _parser;

    public string TipoSuportado => "HL7";

    public ProcessadorHL7(APSDbContext context, ILogger<ProcessadorHL7> logger)
    {
        _context = context;
        _logger = logger;
        _parser = new PipeParser();
    }

    public bool PodeProcessar(string nomeArquivo, string tipoMime)
    {
        var extensoes = new[] { ".hl7", ".txt" };
        var tipos = new[] { "text/plain", "application/x-hl7" };
        
        var extensao = Path.GetExtension(nomeArquivo).ToLowerInvariant();
        return extensoes.Contains(extensao) || tipos.Contains(tipoMime) || 
               nomeArquivo.ToLowerInvariant().Contains("hl7");
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
            _logger.LogInformation("Iniciando processamento do arquivo HL7: {NomeArquivo}", nomeArquivo);
            
            using var reader = new StreamReader(arquivo, Encoding.UTF8);
            var conteudo = await reader.ReadToEndAsync();
            
            await ProcessarMensagemHL7(conteudo, resultado);
            
            await _context.SaveChangesAsync();
            resultado.Sucesso = resultado.RegistrosProcessados > 0;
            
            stopwatch.Stop();
            resultado.TempoProcessamento = stopwatch.Elapsed;
            
            _logger.LogInformation("Processamento HL7 concluído. Registros processados: {RegistrosProcessados}, Erros: {Erros}", 
                                 resultado.RegistrosProcessados, resultado.RegistrosComErro);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar arquivo HL7: {NomeArquivo}", nomeArquivo);
            resultado.Erros.Add($"Erro geral: {ex.Message}");
        }

        return resultado;
    }

    public async Task<ResultadoProcessamentoDto> ProcessarMensagemHL7(Stream arquivo)
    {
        return await ProcessarAsync(arquivo, "mensagem_hl7");
    }

    private async Task ProcessarMensagemHL7(string conteudoHL7, ResultadoProcessamentoDto resultado)
    {
        // Dividir o conteúdo em mensagens individuais (separadas por linha ou marcadores)
        var mensagens = DividirMensagensHL7(conteudoHL7);
        
        foreach (var mensagem in mensagens)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(mensagem)) continue;
                
                resultado.TotalRegistros++;
                
                var mensagemParsed = _parser.Parse(mensagem);
                
                switch (mensagemParsed)
                {
                    case ADT_A01 adtA01: // Admissão
                    case ADT_A02 adtA02: // Transferência
                    case ADT_A03 adtA03: // Alta
                        await ProcessarMensagemADT(mensagemParsed, resultado);
                        break;
                        
                    case ORM_O01 ormO01: // Ordem médica
                        await ProcessarMensagemORM(mensagemParsed, resultado);
                        break;
                        
                    default:
                        _logger.LogWarning("Tipo de mensagem HL7 não suportado: {TipoMensagem}", 
                                         mensagemParsed.GetType().Name);
                        resultado.Avisos.Add($"Tipo de mensagem não suportado: {mensagemParsed.GetType().Name}");
                        break;
                }
            }
            catch (Exception ex)
            {
                resultado.RegistrosComErro++;
                resultado.Erros.Add($"Erro ao processar mensagem HL7: {ex.Message}");
                _logger.LogWarning(ex, "Erro ao processar mensagem HL7 individual");
            }
        }
    }

    public async Task<ResultadoProcessamentoDto> ProcessarADT(string mensagemHL7)
    {
        var resultado = new ResultadoProcessamentoDto { TipoArquivo = "HL7-ADT" };
        
        try
        {
            var mensagemParsed = _parser.Parse(mensagemHL7);
            await ProcessarMensagemADT(mensagemParsed, resultado);
            await _context.SaveChangesAsync();
            resultado.Sucesso = resultado.RegistrosProcessados > 0;
        }
        catch (Exception ex)
        {
            resultado.Erros.Add($"Erro ao processar ADT: {ex.Message}");
            _logger.LogError(ex, "Erro ao processar mensagem ADT");
        }
        
        return resultado;
    }

    public async Task<ResultadoProcessamentoDto> ProcessarORM(string mensagemHL7)
    {
        var resultado = new ResultadoProcessamentoDto { TipoArquivo = "HL7-ORM" };
        
        try
        {
            var mensagemParsed = _parser.Parse(mensagemHL7);
            await ProcessarMensagemORM(mensagemParsed, resultado);
            await _context.SaveChangesAsync();
            resultado.Sucesso = resultado.RegistrosProcessados > 0;
        }
        catch (Exception ex)
        {
            resultado.Erros.Add($"Erro ao processar ORM: {ex.Message}");
            _logger.LogError(ex, "Erro ao processar mensagem ORM");
        }
        
        return resultado;
    }

    private async Task ProcessarMensagemADT(IMessage mensagem, ResultadoProcessamentoDto resultado)
    {
        try
        {
            // Extrair segmento PID (Patient Identification)
            var pid = ObterSegmentoPID(mensagem);
            if (pid == null)
            {
                resultado.Erros.Add("Mensagem ADT sem segmento PID válido");
                return;
            }

            // Criar ou atualizar paciente
            var paciente = await CriarPacienteDoHL7(pid);
            if (paciente != null)
            {
                var pacienteExistente = await _context.Pacientes
                    .FirstOrDefaultAsync(p => p.CPF == paciente.CPF);

                if (pacienteExistente == null)
                {
                    _context.Pacientes.Add(paciente);
                    resultado.RegistrosProcessados++;
                    _logger.LogDebug("Paciente HL7 adicionado: {Nome}", paciente.Nome);
                }
                else
                {
                    AtualizarPacienteExistente(pacienteExistente, paciente);
                    resultado.RegistrosAtualizados++;
                    _logger.LogDebug("Paciente HL7 atualizado: {Nome}", paciente.Nome);
                }
            }

            // Extrair informações do hospital se disponível
            var pv1 = ObterSegmentoPV1(mensagem);
            if (pv1 != null)
            {
                await ProcessarInformacoesHospital(pv1, resultado);
            }
        }
        catch (Exception ex)
        {
            resultado.RegistrosComErro++;
            resultado.Erros.Add($"Erro ao processar mensagem ADT: {ex.Message}");
            _logger.LogWarning(ex, "Erro ao processar mensagem ADT");
        }
    }

    private async Task ProcessarMensagemORM(IMessage mensagem, ResultadoProcessamentoDto resultado)
    {
        try
        {
            // Processar ordem médica (para futura implementação de prescrições/procedimentos)
            var pid = ObterSegmentoPID(mensagem);
            if (pid != null)
            {
                var paciente = await CriarPacienteDoHL7(pid);
                if (paciente != null)
                {
                    // Lógica similar ao ADT para o paciente
                    var pacienteExistente = await _context.Pacientes
                        .FirstOrDefaultAsync(p => p.CPF == paciente.CPF);

                    if (pacienteExistente == null)
                    {
                        _context.Pacientes.Add(paciente);
                        resultado.RegistrosProcessados++;
                    }
                    else
                    {
                        AtualizarPacienteExistente(pacienteExistente, paciente);
                        resultado.RegistrosAtualizados++;
                    }
                }
            }

            // Processar informações do médico responsável se disponível
            var orc = ObterSegmentoORC(mensagem);
            if (orc != null)
            {
                await ProcessarMedicoResponsavel(orc, resultado);
            }
        }
        catch (Exception ex)
        {
            resultado.RegistrosComErro++;
            resultado.Erros.Add($"Erro ao processar mensagem ORM: {ex.Message}");
            _logger.LogWarning(ex, "Erro ao processar mensagem ORM");
        }
    }

    private async Task<Paciente?> CriarPacienteDoHL7(PID pid)
    {
        try
        {
            // Extrair dados do paciente do segmento PID
            var nome = ExtrairNomePaciente(pid);
            var cpf = ExtrairCPFPaciente(pid);
            
            if (string.IsNullOrWhiteSpace(nome) || string.IsNullOrWhiteSpace(cpf))
            {
                _logger.LogWarning("Paciente HL7 com dados obrigatórios faltando");
                return null;
            }

            var paciente = new Paciente
            {
                Nome = nome,
                CPF = cpf,
                DataCriacao = DateTime.UtcNow
            };

            // Data de nascimento
            var dataNascimento = ExtrairDataNascimento(pid);
            if (dataNascimento.HasValue)
            {
                paciente.DataNascimento = dataNascimento.Value;
            }

            // Sexo
            var sexo = ExtrairSexo(pid);
            if (!string.IsNullOrWhiteSpace(sexo))
            {
                paciente.Sexo = sexo;
            }

            // Endereço
            var endereco = ExtrairEndereco(pid);
            if (!string.IsNullOrWhiteSpace(endereco))
            {
                paciente.Endereco = endereco;
            }

            // Telefone
            var telefone = ExtrairTelefone(pid);
            if (!string.IsNullOrWhiteSpace(telefone))
            {
                paciente.Telefone = telefone;
            }

            return paciente;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criar paciente do HL7");
            return null;
        }
    }

    private async Task ProcessarInformacoesHospital(PV1 pv1, ResultadoProcessamentoDto resultado)
    {
        try
        {
            // Extrair informações do hospital/estabelecimento
            var codigoHospital = ExtrairCodigoHospital(pv1);
            var nomeHospital = ExtrairNomeHospital(pv1);

            if (!string.IsNullOrWhiteSpace(codigoHospital) && !string.IsNullOrWhiteSpace(nomeHospital))
            {
                var hospitalExistente = await _context.Hospitais
                    .FirstOrDefaultAsync(h => h.CNES == codigoHospital);

                if (hospitalExistente == null)
                {
                    var hospital = new Hospital
                    {
                        CNES = codigoHospital,
                        Nome = nomeHospital,
                        TipoEstabelecimento = "Hospital",
                        Natureza = "Público",
                        Endereco = "",
                        CapacidadeLeitos = 0,
                        Ativo = true,
                        DataCriacao = DateTime.UtcNow,
                        MunicipioId = 1 // Default
                    };

                    _context.Hospitais.Add(hospital);
                    resultado.RegistrosProcessados++;
                    _logger.LogDebug("Hospital HL7 adicionado: {Nome} - CNES: {CNES}", 
                                   hospital.Nome, hospital.CNES);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao processar informações do hospital HL7");
        }
    }

    private async Task ProcessarMedicoResponsavel(ORC orc, ResultadoProcessamentoDto resultado)
    {
        try
        {
            // Extrair informações do médico responsável pela ordem
            var crmMedico = ExtrairCRMMedico(orc);
            var nomeMedico = ExtrairNomeMedico(orc);

            if (!string.IsNullOrWhiteSpace(crmMedico) && !string.IsNullOrWhiteSpace(nomeMedico))
            {
                var medicoExistente = await _context.Medicos
                    .FirstOrDefaultAsync(m => m.CRM == crmMedico);

                if (medicoExistente == null)
                {
                    var medico = new Medico
                    {
                        CRM = crmMedico,
                        EstadoCRM = "SP", // Default - pode ser extraído de outros campos
                        Nome = nomeMedico,
                        CPF = "",
                        Especialidade = "Clínica Médica",
                        DataFormatura = DateTime.UtcNow.AddYears(-10),
                        AnosExperiencia = 5,
                        Ativo = true,
                        DataCriacao = DateTime.UtcNow
                    };

                    _context.Medicos.Add(medico);
                    resultado.RegistrosProcessados++;
                    _logger.LogDebug("Médico HL7 adicionado: {Nome} - CRM: {CRM}", 
                                   medico.Nome, medico.CRM);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao processar médico responsável HL7");
        }
    }

    #region Métodos de Extração de Dados HL7

    private List<string> DividirMensagensHL7(string conteudo)
    {
        // Dividir por MSH (início de mensagem HL7)
        var mensagens = new List<string>();
        var linhas = conteudo.Split('\n', '\r');
        var mensagemAtual = new StringBuilder();

        foreach (var linha in linhas)
        {
            if (linha.StartsWith("MSH") && mensagemAtual.Length > 0)
            {
                mensagens.Add(mensagemAtual.ToString());
                mensagemAtual.Clear();
            }
            
            if (!string.IsNullOrWhiteSpace(linha))
            {
                mensagemAtual.AppendLine(linha);
            }
        }

        if (mensagemAtual.Length > 0)
        {
            mensagens.Add(mensagemAtual.ToString());
        }

        return mensagens;
    }

    private PID? ObterSegmentoPID(IMessage mensagem)
    {
        try
        {
            return mensagem.GetStructure("PID") as PID;
        }
        catch
        {
            return null;
        }
    }

    private PV1? ObterSegmentoPV1(IMessage mensagem)
    {
        try
        {
            return mensagem.GetStructure("PV1") as PV1;
        }
        catch
        {
            return null;
        }
    }

    private ORC? ObterSegmentoORC(IMessage mensagem)
    {
        try
        {
            return mensagem.GetStructure("ORC") as ORC;
        }
        catch
        {
            return null;
        }
    }

    private string ExtrairNomePaciente(PID pid)
    {
        try
        {
            var nomes = pid.GetPatientName();
            if (nomes != null && nomes.Length > 0)
            {
                var primeiroNome = nomes[0];
                var nomeCompleto = $"{primeiroNome.GivenName?.Value} {primeiroNome.FamilyName?.Surname?.Value}".Trim();
                return string.IsNullOrWhiteSpace(nomeCompleto) ? "" : nomeCompleto;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao extrair nome do paciente HL7");
        }
        return "";
    }

    private string ExtrairCPFPaciente(PID pid)
    {
        try
        {
            var identificadores = pid.GetPatientIdentifierList();
            if (identificadores != null)
            {
                foreach (var id in identificadores)
                {
                    // Buscar por CPF (pode estar em diferentes formatos)
                    if (id.IdentifierTypeCode?.Value == "CPF" || 
                        id.IDNumber?.Value?.Length == 11)
                    {
                        return id.IDNumber?.Value ?? "";
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao extrair CPF do paciente HL7");
        }
        return "";
    }

    private DateTime? ExtrairDataNascimento(PID pid)
    {
        try
        {
            var dataNasc = pid.DateTimeOfBirth?.Time?.Value;
            if (!string.IsNullOrWhiteSpace(dataNasc) && dataNasc.Length >= 8)
            {
                // Formato HL7: YYYYMMDD[HHMM[SS]]
                var ano = int.Parse(dataNasc.Substring(0, 4));
                var mes = int.Parse(dataNasc.Substring(4, 2));
                var dia = int.Parse(dataNasc.Substring(6, 2));
                return new DateTime(ano, mes, dia);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao extrair data de nascimento HL7");
        }
        return null;
    }

    private string ExtrairSexo(PID pid)
    {
        try
        {
            var sexo = pid.AdministrativeSex?.Value;
            return sexo switch
            {
                "M" => "M",
                "F" => "F",
                _ => ""
            };
        }
        catch
        {
            return "";
        }
    }

    private string ExtrairEndereco(PID pid)
    {
        try
        {
            var enderecos = pid.GetPatientAddress();
            if (enderecos != null && enderecos.Length > 0)
            {
                var endereco = enderecos[0];
                var enderecoCompleto = $"{endereco.StreetAddress?.StreetOrMailingAddress?.Value} {endereco.City?.Value}".Trim();
                return enderecoCompleto;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao extrair endereço HL7");
        }
        return "";
    }

    private string ExtrairTelefone(PID pid)
    {
        try
        {
            var telefones = pid.GetPhoneNumberHome();
            if (telefones != null && telefones.Length > 0)
            {
                return telefones[0].TelephoneNumber?.Value ?? "";
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao extrair telefone HL7");
        }
        return "";
    }

    private string ExtrairCodigoHospital(PV1 pv1)
    {
        try
        {
            return pv1.AssignedPatientLocation?.Facility?.NamespaceID?.Value ?? "";
        }
        catch
        {
            return "";
        }
    }

    private string ExtrairNomeHospital(PV1 pv1)
    {
        try
        {
            return pv1.AssignedPatientLocation?.Facility?.UniversalID?.Value ?? "";
        }
        catch
        {
            return "";
        }
    }

    private string ExtrairCRMMedico(ORC orc)
    {
        try
        {
            return orc.GetOrderingProvider()?[0]?.IDNumber?.Value ?? "";
        }
        catch
        {
            return "";
        }
    }

    private string ExtrairNomeMedico(ORC orc)
    {
        try
        {
            var medico = orc.GetOrderingProvider()?[0];
            if (medico != null)
            {
                return $"{medico.GivenName?.Value} {medico.FamilyName?.Surname?.Value}".Trim();
            }
        }
        catch
        {
            // Ignore
        }
        return "";
    }

    #endregion

    private void AtualizarPacienteExistente(Paciente existente, Paciente novo)
    {
        existente.Nome = novo.Nome;
        existente.Telefone = novo.Telefone ?? existente.Telefone;
        existente.Endereco = novo.Endereco;
        if (novo.DataNascimento != default)
        {
            existente.DataNascimento = novo.DataNascimento;
        }
        if (!string.IsNullOrWhiteSpace(novo.Sexo))
        {
            existente.Sexo = novo.Sexo;
        }
        existente.DataAtualizacao = DateTime.UtcNow;
    }
}