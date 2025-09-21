using Hl7.Fhir.Model;
using Hl7.Fhir.Serialization;
using Microsoft.EntityFrameworkCore;
using APS.Infraestrutura.Dados.Contextos;
using APS.ServicoIngestao.Interfaces;
using APS.Compartilhado.Modelos.Entidades;
using APS.Compartilhado.Modelos.DTOs;
using System.Diagnostics;

namespace APS.ServicoIngestao.Servicos;

/// <summary>
/// Processador para recursos FHIR R4 contendo dados de pacientes, organizações e profissionais
/// Suporta recursos Patient, Organization, Practitioner e relacionados
/// </summary>
public class ProcessadorFHIR : IProcessadorFHIR
{
    private readonly APSDbContext _context;
    private readonly ILogger<ProcessadorFHIR> _logger;
    private readonly FhirJsonParser _jsonParser;
    private readonly FhirXmlParser _xmlParser;

    public string TipoSuportado => "FHIR";

    public ProcessadorFHIR(APSDbContext context, ILogger<ProcessadorFHIR> logger)
    {
        _context = context;
        _logger = logger;
        _jsonParser = new FhirJsonParser();
        _xmlParser = new FhirXmlParser();
    }

    public bool PodeProcessar(string nomeArquivo, string tipoMime)
    {
        var extensoes = new[] { ".json", ".xml", ".fhir" };
        var tipos = new[] { "application/fhir+json", "application/fhir+xml", "application/json", "application/xml" };
        
        var extensao = Path.GetExtension(nomeArquivo).ToLowerInvariant();
        var contemFhir = nomeArquivo.ToLowerInvariant().Contains("fhir");
        
        return (extensoes.Contains(extensao) || tipos.Contains(tipoMime)) && 
               (contemFhir || tipos.Any(t => t.Contains("fhir")));
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
            _logger.LogInformation("Iniciando processamento do arquivo FHIR: {NomeArquivo}", nomeArquivo);
            
            using var reader = new StreamReader(arquivo);
            var conteudo = await reader.ReadToEndAsync();
            
            await ProcessarRecursoFHIR(conteudo, nomeArquivo, resultado);
            
            await _context.SaveChangesAsync();
            resultado.Sucesso = resultado.RegistrosProcessados > 0;
            
            stopwatch.Stop();
            resultado.TempoProcessamento = stopwatch.Elapsed;
            
            _logger.LogInformation("Processamento FHIR concluído. Registros processados: {RegistrosProcessados}, Erros: {Erros}", 
                                 resultado.RegistrosProcessados, resultado.RegistrosComErro);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar arquivo FHIR: {NomeArquivo}", nomeArquivo);
            resultado.Erros.Add($"Erro geral: {ex.Message}");
        }

        return resultado;
    }

    public async System.Threading.Tasks.Task<ResultadoProcessamentoDto> ProcessarFHIRSaude(Stream arquivo)
    {
        return await ProcessarAsync(arquivo, "recurso_fhir");
    }

    private async System.Threading.Tasks.Task ProcessarRecursoFHIR(string conteudo, string nomeArquivo, ResultadoProcessamentoDto resultado)
    {
        try
        {
            Resource? recurso = null;
            
            // Tentar fazer parse como JSON primeiro, depois XML
            try
            {
                recurso = _jsonParser.Parse<Resource>(conteudo);
            }
            catch
            {
                try
                {
                    recurso = _xmlParser.Parse<Resource>(conteudo);
                }
                catch (Exception ex)
                {
                    resultado.Erros.Add($"Erro ao fazer parse do FHIR: {ex.Message}");
                    return;
                }
            }

            if (recurso == null)
            {
                resultado.Erros.Add("Recurso FHIR vazio ou inválido");
                return;
            }

            await ProcessarRecursoFHIRTipado(recurso, resultado);
        }
        catch (Exception ex)
        {
            resultado.Erros.Add($"Erro ao processar recurso FHIR: {ex.Message}");
            _logger.LogError(ex, "Erro ao processar recurso FHIR");
        }
    }

    private async System.Threading.Tasks.Task ProcessarRecursoFHIRTipado(Resource recurso, ResultadoProcessamentoDto resultado)
    {
        resultado.TotalRegistros++;

        switch (recurso)
        {
            case Patient patient:
                await ProcessarPatient(patient, resultado);
                break;
                
            case Organization organization:
                await ProcessarOrganization(organization, resultado);
                break;
                
            case Practitioner practitioner:
                await ProcessarPractitioner(practitioner, resultado);
                break;
                
            case Bundle bundle:
                await ProcessarBundle(bundle, resultado);
                break;
                
            default:
                _logger.LogWarning("Tipo de recurso FHIR não suportado: {TipoRecurso}", recurso.GetType().Name);
                resultado.Avisos.Add($"Tipo de recurso não suportado: {recurso.GetType().Name}");
                break;
        }
    }

    private async System.Threading.Tasks.Task ProcessarPatient(Patient patient, ResultadoProcessamentoDto resultado)
    {
        try
        {
            var paciente = CriarPacienteDoFHIR(patient);
            if (paciente != null)
            {
                var pacienteExistente = await _context.Pacientes
                    .FirstOrDefaultAsync(p => p.CPF == paciente.CPF);

                if (pacienteExistente == null)
                {
                    _context.Pacientes.Add(paciente);
                    resultado.RegistrosProcessados++;
                    _logger.LogDebug("Paciente FHIR adicionado: {Nome}", paciente.Nome);
                }
                else
                {
                    AtualizarPacienteExistente(pacienteExistente, paciente);
                    resultado.RegistrosAtualizados++;
                    _logger.LogDebug("Paciente FHIR atualizado: {Nome}", paciente.Nome);
                }
            }
        }
        catch (Exception ex)
        {
            resultado.RegistrosComErro++;
            resultado.Erros.Add($"Erro ao processar Patient FHIR: {ex.Message}");
            _logger.LogWarning(ex, "Erro ao processar Patient FHIR");
        }
    }

    private async System.Threading.Tasks.Task ProcessarOrganization(Organization organization, ResultadoProcessamentoDto resultado)
    {
        try
        {
            var hospital = CriarHospitalDoFHIR(organization);
            if (hospital != null)
            {
                var hospitalExistente = await _context.Hospitais
                    .FirstOrDefaultAsync(h => h.CNES == hospital.CNES);

                if (hospitalExistente == null)
                {
                    _context.Hospitais.Add(hospital);
                    resultado.RegistrosProcessados++;
                    _logger.LogDebug("Hospital FHIR adicionado: {Nome} - CNES: {CNES}", 
                                   hospital.Nome, hospital.CNES);
                }
                else
                {
                    AtualizarHospitalExistente(hospitalExistente, hospital);
                    resultado.RegistrosAtualizados++;
                    _logger.LogDebug("Hospital FHIR atualizado: {Nome} - CNES: {CNES}", 
                                   hospital.Nome, hospital.CNES);
                }
            }
        }
        catch (Exception ex)
        {
            resultado.RegistrosComErro++;
            resultado.Erros.Add($"Erro ao processar Organization FHIR: {ex.Message}");
            _logger.LogWarning(ex, "Erro ao processar Organization FHIR");
        }
    }

    private async System.Threading.Tasks.Task ProcessarPractitioner(Practitioner practitioner, ResultadoProcessamentoDto resultado)
    {
        try
        {
            var medico = CriarMedicoDoFHIR(practitioner);
            if (medico != null)
            {
                var medicoExistente = await _context.Medicos
                    .FirstOrDefaultAsync(m => m.CRM == medico.CRM && m.EstadoCRM == medico.EstadoCRM);

                if (medicoExistente == null)
                {
                    _context.Medicos.Add(medico);
                    resultado.RegistrosProcessados++;
                    _logger.LogDebug("Médico FHIR adicionado: {Nome} - CRM: {CRM}", 
                                   medico.Nome, medico.CRM);
                }
                else
                {
                    AtualizarMedicoExistente(medicoExistente, medico);
                    resultado.RegistrosAtualizados++;
                    _logger.LogDebug("Médico FHIR atualizado: {Nome} - CRM: {CRM}", 
                                   medico.Nome, medico.CRM);
                }
            }
        }
        catch (Exception ex)
        {
            resultado.RegistrosComErro++;
            resultado.Erros.Add($"Erro ao processar Practitioner FHIR: {ex.Message}");
            _logger.LogWarning(ex, "Erro ao processar Practitioner FHIR");
        }
    }

    private async System.Threading.Tasks.Task ProcessarBundle(Bundle bundle, ResultadoProcessamentoDto resultado)
    {
        try
        {
            if (bundle.Entry != null)
            {
                foreach (var entry in bundle.Entry)
                {
                    if (entry.Resource != null)
                    {
                        await ProcessarRecursoFHIRTipado(entry.Resource, resultado);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            resultado.RegistrosComErro++;
            resultado.Erros.Add($"Erro ao processar Bundle FHIR: {ex.Message}");
            _logger.LogWarning(ex, "Erro ao processar Bundle FHIR");
        }
    }

    private Paciente? CriarPacienteDoFHIR(Patient patient)
    {
        try
        {
            var nome = ExtrairNomePacienteFHIR(patient);
            var cpf = ExtrairCPFPacienteFHIR(patient);

            if (string.IsNullOrWhiteSpace(nome) || string.IsNullOrWhiteSpace(cpf))
            {
                _logger.LogWarning("Patient FHIR com dados obrigatórios faltando");
                return null;
            }

            var paciente = new Paciente
            {
                Nome = nome,
                CPF = cpf,
                DataCriacao = DateTime.UtcNow
            };

            // Data de nascimento
            if (patient.BirthDate != null)
            {
                if (DateTime.TryParse(patient.BirthDate, out var dataNasc))
                {
                    paciente.DataNascimento = dataNasc;
                }
            }

            // Sexo
            if (patient.Gender.HasValue)
            {
                paciente.Sexo = patient.Gender.Value switch
                {
                    AdministrativeGender.Male => "M",
                    AdministrativeGender.Female => "F",
                    _ => ""
                };
            }

            // Endereço
            var endereco = ExtrairEnderecoFHIR(patient.Address);
            if (!string.IsNullOrWhiteSpace(endereco))
            {
                paciente.Endereco = endereco;
            }

            // Telefone
            var telefone = ExtrairTelefoneFHIR(patient.Telecom);
            if (!string.IsNullOrWhiteSpace(telefone))
            {
                paciente.Telefone = telefone;
            }

            // Email
            var email = ExtrairEmailFHIR(patient.Telecom);
            if (!string.IsNullOrWhiteSpace(email))
            {
                paciente.Email = email;
            }

            return paciente;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criar paciente do FHIR");
            return null;
        }
    }

    private Hospital? CriarHospitalDoFHIR(Organization organization)
    {
        try
        {
            var nome = organization.Name;
            var cnes = ExtrairCNESOrganizacaoFHIR(organization);

            if (string.IsNullOrWhiteSpace(nome) || string.IsNullOrWhiteSpace(cnes))
            {
                _logger.LogWarning("Organization FHIR com dados obrigatórios faltando");
                return null;
            }

            var hospital = new Hospital
            {
                CNES = cnes,
                Nome = nome,
                TipoEstabelecimento = ExtrairTipoEstabelecimentoFHIR(organization) ?? "Hospital Geral",
                Natureza = "Público", // Default
                Endereco = ExtrairEnderecoFHIR(organization.Address) ?? "",
                Telefone = ExtrairTelefoneFHIR(organization.Telecom),
                Email = ExtrairEmailFHIR(organization.Telecom),
                CapacidadeLeitos = 0, // Não disponível no FHIR Organization básico
                Ativo = organization.Active ?? true,
                DataCriacao = DateTime.UtcNow,
                MunicipioId = 1 // Default
            };

            return hospital;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criar hospital do FHIR");
            return null;
        }
    }

    private Medico? CriarMedicoDoFHIR(Practitioner practitioner)
    {
        try
        {
            var nome = ExtrairNomeProfissionalFHIR(practitioner);
            var crm = ExtrairCRMProfissionalFHIR(practitioner);

            if (string.IsNullOrWhiteSpace(nome) || string.IsNullOrWhiteSpace(crm))
            {
                _logger.LogWarning("Practitioner FHIR com dados obrigatórios faltando");
                return null;
            }

            var medico = new Medico
            {
                CRM = crm,
                EstadoCRM = "SP", // Default - pode ser extraído de outros campos
                Nome = nome,
                CPF = "", // Pode ser extraído de identifier se disponível
                Especialidade = ExtrairEspecialidadeFHIR(practitioner) ?? "Clínica Médica",
                Telefone = ExtrairTelefoneFHIR(practitioner.Telecom),
                Email = ExtrairEmailFHIR(practitioner.Telecom),
                Ativo = practitioner.Active ?? true,
                DataFormatura = DateTime.UtcNow.AddYears(-10), // Default
                AnosExperiencia = 5, // Default
                DataCriacao = DateTime.UtcNow
            };

            return medico;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criar médico do FHIR");
            return null;
        }
    }

    #region Métodos de Extração FHIR

    private string ExtrairNomePacienteFHIR(Patient patient)
    {
        if (patient.Name != null && patient.Name.Count > 0)
        {
            var nome = patient.Name.First();
            var nomeCompleto = "";
            
            if (nome.Given != null && nome.Given.Any())
            {
                nomeCompleto += string.Join(" ", nome.Given) + " ";
            }
            
            if (nome.Family != null)
            {
                nomeCompleto += nome.Family;
            }
            
            return nomeCompleto.Trim();
        }
        return "";
    }

    private string ExtrairCPFPacienteFHIR(Patient patient)
    {
        if (patient.Identifier != null)
        {
            foreach (var identifier in patient.Identifier)
            {
                if (identifier.System == "http://www.saude.gov.br/fhir/r4/NamingSystem/cpf" ||
                    identifier.Type?.Text == "CPF" ||
                    (identifier.Value != null && identifier.Value.Length == 11))
                {
                    return identifier.Value ?? "";
                }
            }
        }
        return "";
    }

    private string ExtrairCNESOrganizacaoFHIR(Organization organization)
    {
        if (organization.Identifier != null)
        {
            foreach (var identifier in organization.Identifier)
            {
                if (identifier.System == "http://www.saude.gov.br/fhir/r4/NamingSystem/cnes" ||
                    identifier.Type?.Text == "CNES")
                {
                    return identifier.Value ?? "";
                }
            }
        }
        return "";
    }

    private string? ExtrairTipoEstabelecimentoFHIR(Organization organization)
    {
        if (organization.Type != null && organization.Type.Count > 0)
        {
            var tipo = organization.Type.First();
            if (tipo.Text != null)
            {
                return tipo.Text;
            }
            if (tipo.Coding != null && tipo.Coding.Count > 0)
            {
                return tipo.Coding.First().Display;
            }
        }
        return null;
    }

    private string ExtrairNomeProfissionalFHIR(Practitioner practitioner)
    {
        if (practitioner.Name != null && practitioner.Name.Count > 0)
        {
            var nome = practitioner.Name.First();
            var nomeCompleto = "";
            
            if (nome.Given != null && nome.Given.Any())
            {
                nomeCompleto += string.Join(" ", nome.Given) + " ";
            }
            
            if (nome.Family != null)
            {
                nomeCompleto += nome.Family;
            }
            
            return nomeCompleto.Trim();
        }
        return "";
    }

    private string ExtrairCRMProfissionalFHIR(Practitioner practitioner)
    {
        if (practitioner.Identifier != null)
        {
            foreach (var identifier in practitioner.Identifier)
            {
                if (identifier.System == "http://www.saude.gov.br/fhir/r4/NamingSystem/crm" ||
                    identifier.Type?.Text == "CRM")
                {
                    return identifier.Value ?? "";
                }
            }
        }
        return "";
    }

    private string? ExtrairEspecialidadeFHIR(Practitioner practitioner)
    {
        if (practitioner.Qualification != null && practitioner.Qualification.Count > 0)
        {
            var qualificacao = practitioner.Qualification.First();
            if (qualificacao.Code?.Text != null)
            {
                return qualificacao.Code.Text;
            }
            if (qualificacao.Code?.Coding != null && qualificacao.Code.Coding.Count > 0)
            {
                return qualificacao.Code.Coding.First().Display;
            }
        }
        return null;
    }

    private string? ExtrairEnderecoFHIR(List<Address>? enderecos)
    {
        if (enderecos != null && enderecos.Count > 0)
        {
            var endereco = enderecos.First();
            var enderecoCompleto = "";
            
            if (endereco.Line != null && endereco.Line.Any())
            {
                enderecoCompleto += string.Join(" ", endereco.Line) + " ";
            }
            
            if (endereco.City != null)
            {
                enderecoCompleto += endereco.City + " ";
            }
            
            if (endereco.State != null)
            {
                enderecoCompleto += endereco.State + " ";
            }
            
            if (endereco.PostalCode != null)
            {
                enderecoCompleto += endereco.PostalCode;
            }
            
            return enderecoCompleto.Trim();
        }
        return null;
    }

    private string? ExtrairTelefoneFHIR(List<ContactPoint>? contatos)
    {
        if (contatos != null)
        {
            var telefone = contatos.FirstOrDefault(c => c.System == ContactPoint.ContactPointSystem.Phone);
            return telefone?.Value;
        }
        return null;
    }

    private string? ExtrairEmailFHIR(List<ContactPoint>? contatos)
    {
        if (contatos != null)
        {
            var email = contatos.FirstOrDefault(c => c.System == ContactPoint.ContactPointSystem.Email);
            return email?.Value;
        }
        return null;
    }

    #endregion

    private void AtualizarPacienteExistente(Paciente existente, Paciente novo)
    {
        existente.Nome = novo.Nome;
        existente.Telefone = novo.Telefone ?? existente.Telefone;
        existente.Email = novo.Email ?? existente.Email;
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

    private void AtualizarHospitalExistente(Hospital existente, Hospital novo)
    {
        existente.Nome = novo.Nome;
        existente.TipoEstabelecimento = novo.TipoEstabelecimento;
        existente.Endereco = novo.Endereco;
        existente.Telefone = novo.Telefone ?? existente.Telefone;
        existente.Email = novo.Email ?? existente.Email;
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
        existente.DataAtualizacao = DateTime.UtcNow;
    }
}