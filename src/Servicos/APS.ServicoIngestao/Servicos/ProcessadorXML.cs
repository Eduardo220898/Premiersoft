using System.Xml;
using System.Xml.Linq;
using Microsoft.EntityFrameworkCore;
using APS.Infraestrutura.Dados.Contextos;
using APS.ServicoIngestao.Interfaces;
using APS.Compartilhado.Modelos.Entidades;
using APS.Compartilhado.Modelos.DTOs;
using System.Diagnostics;
using System.Globalization;

namespace APS.ServicoIngestao.Servicos;

/// <summary>
/// Processador para arquivos XML contendo dados de hospitais, médicos e pacientes
/// Suporta formatos padrão de interoperabilidade em saúde no Brasil
/// </summary>
public class ProcessadorXML : IProcessadorXML
{
    private readonly APSDbContext _context;
    private readonly ILogger<ProcessadorXML> _logger;

    public string TipoSuportado => "XML";

    public ProcessadorXML(APSDbContext context, ILogger<ProcessadorXML> logger)
    {
        _context = context;
        _logger = logger;
    }

    public bool PodeProcessar(string nomeArquivo, string tipoMime)
    {
        var extensoes = new[] { ".xml" };
        var tipos = new[] { "application/xml", "text/xml" };
        
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
            _logger.LogInformation("Iniciando processamento do arquivo XML: {NomeArquivo}", nomeArquivo);
            
            // Carregar XML de forma segura
            var settings = new XmlReaderSettings
            {
                DtdProcessing = DtdProcessing.Prohibit,
                XmlResolver = null
            };

            using var reader = XmlReader.Create(arquivo, settings);
            var documento = await XDocument.LoadAsync(reader, LoadOptions.None, CancellationToken.None);
            
            await ProcessarXMLSaude(documento, resultado);
            
            await _context.SaveChangesAsync();
            resultado.Sucesso = resultado.RegistrosProcessados > 0;
            
            stopwatch.Stop();
            resultado.TempoProcessamento = stopwatch.Elapsed;
            
            _logger.LogInformation("Processamento XML concluído. Registros processados: {RegistrosProcessados}, Erros: {Erros}", 
                                 resultado.RegistrosProcessados, resultado.RegistrosComErro);
        }
        catch (XmlException ex)
        {
            _logger.LogError(ex, "Erro de formato XML no arquivo: {NomeArquivo}", nomeArquivo);
            resultado.Erros.Add($"Formato XML inválido: {ex.Message}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar arquivo XML: {NomeArquivo}", nomeArquivo);
            resultado.Erros.Add($"Erro geral: {ex.Message}");
        }

        return resultado;
    }

    public async Task<ResultadoProcessamentoDto> ProcessarXMLSaude(Stream arquivo)
    {
        return await ProcessarAsync(arquivo, "arquivo_xml");
    }

    private async Task ProcessarXMLSaude(XDocument documento, ResultadoProcessamentoDto resultado)
    {
        var elementoRaiz = documento.Root;
        if (elementoRaiz == null)
        {
            resultado.Erros.Add("Documento XML não possui elemento raiz");
            return;
        }

        _logger.LogInformation("Processando XML com elemento raiz: {ElementoRaiz}", elementoRaiz.Name.LocalName);

        // Detectar tipo de dados baseado na estrutura do XML
        switch (elementoRaiz.Name.LocalName.ToLowerInvariant())
        {
            case "hospitais":
            case "estabelecimentos":
            case "unidades_saude":
                await ProcessarHospitaisXML(elementoRaiz, resultado);
                break;
                
            case "medicos":
            case "profissionais":
            case "equipe_medica":
                await ProcessarMedicosXML(elementoRaiz, resultado);
                break;
                
            case "pacientes":
            case "usuarios":
            case "beneficiarios":
                await ProcessarPacientesXML(elementoRaiz, resultado);
                break;
                
            case "dados_saude":
            case "sistema_saude":
            case "aps_dados":
                // XML integrado com múltiplos tipos de dados
                await ProcessarXMLIntegrado(elementoRaiz, resultado);
                break;
                
            default:
                resultado.Erros.Add($"Tipo de dados XML não reconhecido: {elementoRaiz.Name.LocalName}");
                break;
        }
    }

    private async Task ProcessarHospitaisXML(XElement elementoRaiz, ResultadoProcessamentoDto resultado)
    {
        var hospitais = elementoRaiz.Elements()
            .Where(e => e.Name.LocalName.ToLowerInvariant().Contains("hospital") || 
                       e.Name.LocalName.ToLowerInvariant().Contains("estabelecimento") ||
                       e.Name.LocalName.ToLowerInvariant().Contains("unidade"));

        foreach (var hospitalXml in hospitais)
        {
            try
            {
                var hospital = await CriarHospitalDoXML(hospitalXml);
                if (hospital != null)
                {
                    // Verificar se já existe baseado no CNES
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
                        // Atualizar dados existentes
                        AtualizarHospitalExistente(hospitalExistente, hospital);
                        resultado.RegistrosAtualizados++;
                        _logger.LogDebug("Hospital atualizado: {Nome} - CNES: {CNES}", 
                                       hospital.Nome, hospital.CNES);
                    }
                }
            }
            catch (Exception ex)
            {
                resultado.RegistrosComErro++;
                resultado.Erros.Add($"Erro ao processar hospital: {ex.Message}");
                _logger.LogWarning(ex, "Erro ao processar hospital do XML");
            }
        }
    }

    private async Task ProcessarMedicosXML(XElement elementoRaiz, ResultadoProcessamentoDto resultado)
    {
        var medicos = elementoRaiz.Elements()
            .Where(e => e.Name.LocalName.ToLowerInvariant().Contains("medico") || 
                       e.Name.LocalName.ToLowerInvariant().Contains("profissional"));

        foreach (var medicoXml in medicos)
        {
            try
            {
                var medico = await CriarMedicoDoXML(medicoXml);
                if (medico != null)
                {
                    // Verificar se já existe baseado no CRM
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
                        _logger.LogDebug("Médico atualizado: {Nome} - CRM: {CRM}", 
                                       medico.Nome, medico.CRM);
                    }
                }
            }
            catch (Exception ex)
            {
                resultado.RegistrosComErro++;
                resultado.Erros.Add($"Erro ao processar médico: {ex.Message}");
                _logger.LogWarning(ex, "Erro ao processar médico do XML");
            }
        }
    }

    private async Task ProcessarPacientesXML(XElement elementoRaiz, ResultadoProcessamentoDto resultado)
    {
        var pacientes = elementoRaiz.Elements()
            .Where(e => e.Name.LocalName.ToLowerInvariant().Contains("paciente") || 
                       e.Name.LocalName.ToLowerInvariant().Contains("usuario") ||
                       e.Name.LocalName.ToLowerInvariant().Contains("beneficiario"));

        foreach (var pacienteXml in pacientes)
        {
            try
            {
                var paciente = await CriarPacienteDoXML(pacienteXml);
                if (paciente != null)
                {
                    // Verificar se já existe baseado no CPF
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
                        _logger.LogDebug("Paciente atualizado: {Nome}", paciente.Nome);
                    }
                }
            }
            catch (Exception ex)
            {
                resultado.RegistrosComErro++;
                resultado.Erros.Add($"Erro ao processar paciente: {ex.Message}");
                _logger.LogWarning(ex, "Erro ao processar paciente do XML");
            }
        }
    }

    private async Task ProcessarXMLIntegrado(XElement elementoRaiz, ResultadoProcessamentoDto resultado)
    {
        // Processar cada seção do XML integrado
        var secaoHospitais = elementoRaiz.Element("hospitais") ?? elementoRaiz.Element("estabelecimentos");
        if (secaoHospitais != null)
        {
            await ProcessarHospitaisXML(secaoHospitais, resultado);
        }

        var secaoMedicos = elementoRaiz.Element("medicos") ?? elementoRaiz.Element("profissionais");
        if (secaoMedicos != null)
        {
            await ProcessarMedicosXML(secaoMedicos, resultado);
        }

        var secaoPacientes = elementoRaiz.Element("pacientes") ?? elementoRaiz.Element("usuarios");
        if (secaoPacientes != null)
        {
            await ProcessarPacientesXML(secaoPacientes, resultado);
        }
    }

    private async Task<Hospital?> CriarHospitalDoXML(XElement hospitalXml)
    {
        try
        {
            var codigoCNES = ObterValorElemento(hospitalXml, "cnes", "codigo_cnes", "id");
            var nome = ObterValorElemento(hospitalXml, "nome", "razao_social", "denominacao");

            if (string.IsNullOrWhiteSpace(codigoCNES) || string.IsNullOrWhiteSpace(nome))
            {
                _logger.LogWarning("Hospital XML com dados obrigatórios faltando");
                return null;
            }

            // Buscar município
            var codigoIBGE = ObterValorElemento(hospitalXml, "codigo_ibge", "municipio_codigo", "ibge");
            Municipio? municipio = null;
            if (!string.IsNullOrWhiteSpace(codigoIBGE))
            {
                municipio = await _context.Municipios
                    .FirstOrDefaultAsync(m => m.CodigoIBGE == codigoIBGE);
            }

            var hospital = new Hospital
            {
                CNES = codigoCNES,
                Nome = nome,
                TipoEstabelecimento = ObterValorElemento(hospitalXml, "tipo", "tipo_estabelecimento") ?? "Hospital Geral",
                Natureza = ObterValorElemento(hospitalXml, "natureza", "tipo_natureza") ?? "Público",
                Endereco = ObterValorElemento(hospitalXml, "endereco", "logradouro") ?? "",
                Telefone = ObterValorElemento(hospitalXml, "telefone", "fone"),
                Email = ObterValorElemento(hospitalXml, "email", "e_mail"),
                CapacidadeLeitos = ObterValorInteiroElemento(hospitalXml, "leitos", "capacidade_leitos") ?? 0,
                Ativo = ObterValorBooleanElemento(hospitalXml, "ativo", "status") ?? true,
                DataCriacao = DateTime.UtcNow,
                MunicipioId = municipio?.Id ?? 1 // Default para primeiro município se não encontrado
            };

            return hospital;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criar hospital do XML");
            return null;
        }
    }

    private Task<Medico?> CriarMedicoDoXML(XElement medicoXml)
    {
        try
        {
            var crm = ObterValorElemento(medicoXml, "crm", "numero_crm");
            var estadoCRM = ObterValorElemento(medicoXml, "estado_crm", "uf_crm", "crm_uf");
            var nome = ObterValorElemento(medicoXml, "nome", "nome_completo");

            if (string.IsNullOrWhiteSpace(crm) || string.IsNullOrWhiteSpace(estadoCRM) || 
                string.IsNullOrWhiteSpace(nome))
            {
                _logger.LogWarning("Médico XML com dados obrigatórios faltando");
                return Task.FromResult<Medico?>(null);
            }

            var medico = new Medico
            {
                CRM = crm,
                EstadoCRM = estadoCRM.ToUpperInvariant(),
                Nome = nome,
                CPF = ObterValorElemento(medicoXml, "cpf") ?? "",
                Especialidade = ObterValorElemento(medicoXml, "especialidade", "especialidade_principal") ?? "Clínica Médica",
                Telefone = ObterValorElemento(medicoXml, "telefone", "fone"),
                Email = ObterValorElemento(medicoXml, "email", "e_mail"),
                Ativo = ObterValorBooleanElemento(medicoXml, "ativo", "status") ?? true,
                DataCriacao = DateTime.UtcNow
            };

            // Data de nascimento não está disponível na entidade Medico atual
            // Processar data de formatura se disponível
            var dataFormatura = ObterValorElemento(medicoXml, "data_formatura", "formatura");
            if (!string.IsNullOrWhiteSpace(dataFormatura) && 
                DateTime.TryParse(dataFormatura, out var dataForm))
            {
                medico.DataFormatura = dataForm;
            }
            else
            {
                medico.DataFormatura = DateTime.UtcNow.AddYears(-10); // Default 10 anos atrás
            }

            return Task.FromResult<Medico?>(medico);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criar médico do XML");
            return Task.FromResult<Medico?>(null);
        }
    }

    private Task<Paciente?> CriarPacienteDoXML(XElement pacienteXml)
    {
        try
        {
            var cpf = ObterValorElemento(pacienteXml, "cpf", "documento");
            var nome = ObterValorElemento(pacienteXml, "nome", "nome_completo");

            if (string.IsNullOrWhiteSpace(cpf) || string.IsNullOrWhiteSpace(nome))
            {
                _logger.LogWarning("Paciente XML com dados obrigatórios faltando");
                return Task.FromResult<Paciente?>(null);
            }

            var paciente = new Paciente
            {
                CPF = cpf,
                Nome = nome,
                Telefone = ObterValorElemento(pacienteXml, "telefone", "fone"),
                Email = ObterValorElemento(pacienteXml, "email", "e_mail"),
                Endereco = ObterValorElemento(pacienteXml, "endereco", "logradouro") ?? "",
                CartaoSUS = ObterValorElemento(pacienteXml, "cartao_sus", "sus"),
                DataCriacao = DateTime.UtcNow
            };

            // Processar data de nascimento
            var dataNascimento = ObterValorElemento(pacienteXml, "data_nascimento", "nascimento");
            if (!string.IsNullOrWhiteSpace(dataNascimento) && 
                DateTime.TryParse(dataNascimento, out var dataNasc))
            {
                paciente.DataNascimento = dataNasc;
            }

            // Processar sexo
            var sexo = ObterValorElemento(pacienteXml, "sexo", "genero");
            if (!string.IsNullOrWhiteSpace(sexo))
            {
                paciente.Sexo = sexo.ToUpperInvariant().StartsWith("M") ? "M" : "F";
            }

            return Task.FromResult<Paciente?>(paciente);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criar paciente do XML");
            return Task.FromResult<Paciente?>(null);
        }
    }

    private string? ObterValorElemento(XElement elemento, params string[] nomesElementos)
    {
        foreach (var nome in nomesElementos)
        {
            var subElemento = elemento.Element(nome) ?? elemento.Element(nome.ToLowerInvariant()) ?? 
                             elemento.Element(nome.ToUpperInvariant());
            if (subElemento != null && !string.IsNullOrWhiteSpace(subElemento.Value))
            {
                return subElemento.Value.Trim();
            }

            // Verificar atributos também
            var atributo = elemento.Attribute(nome) ?? elemento.Attribute(nome.ToLowerInvariant()) ?? 
                          elemento.Attribute(nome.ToUpperInvariant());
            if (atributo != null && !string.IsNullOrWhiteSpace(atributo.Value))
            {
                return atributo.Value.Trim();
            }
        }
        return null;
    }

    private int? ObterValorInteiroElemento(XElement elemento, params string[] nomesElementos)
    {
        var valor = ObterValorElemento(elemento, nomesElementos);
        if (int.TryParse(valor, out var resultado))
        {
            return resultado;
        }
        return null;
    }

    private bool? ObterValorBooleanElemento(XElement elemento, params string[] nomesElementos)
    {
        var valor = ObterValorElemento(elemento, nomesElementos);
        if (string.IsNullOrWhiteSpace(valor)) return null;

        var valorLower = valor.ToLowerInvariant();
        if (valorLower == "true" || valorLower == "1" || valorLower == "sim" || valorLower == "ativo")
            return true;
        if (valorLower == "false" || valorLower == "0" || valorLower == "não" || valorLower == "inativo")
            return false;

        return null;
    }

    private void AtualizarHospitalExistente(Hospital existente, Hospital novo)
    {
        existente.Nome = novo.Nome;
        existente.TipoEstabelecimento = novo.TipoEstabelecimento;
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