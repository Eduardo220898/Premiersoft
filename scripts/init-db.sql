-- Script de inicialização do banco de dados APS
-- Criação de extensões necessárias

-- Extensão para cálculos geográficos (distância entre coordenadas)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para busca de texto
CREATE EXTENSION IF NOT EXISTS "unaccent"; -- Para busca sem acentos

-- Função para calcular distância entre dois pontos geográficos (Haversine)
CREATE OR REPLACE FUNCTION calcular_distancia_km(
    lat1 DECIMAL(10,7), 
    lon1 DECIMAL(10,7), 
    lat2 DECIMAL(10,7), 
    lon2 DECIMAL(10,7)
) 
RETURNS DECIMAL(8,2) AS $$
DECLARE
    r DECIMAL := 6371; -- Raio da Terra em km
    dLat DECIMAL;
    dLon DECIMAL;
    a DECIMAL;
    c DECIMAL;
BEGIN
    -- Converter graus para radianos
    dLat := RADIANS(lat2 - lat1);
    dLon := RADIANS(lon2 - lon1);
    
    -- Fórmula de Haversine
    a := SIN(dLat/2) * SIN(dLat/2) + COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * SIN(dLon/2) * SIN(dLon/2);
    c := 2 * ASIN(SQRT(a));
    
    RETURN r * c;
END;
$$ LANGUAGE plpgsql;

-- Função para normalizar texto (remover acentos e converter para minúsculas)
CREATE OR REPLACE FUNCTION normalizar_texto(texto TEXT) 
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(UNACCENT(TRIM(texto)));
END;
$$ LANGUAGE plpgsql;

-- Função para validar CPF
CREATE OR REPLACE FUNCTION validar_cpf(cpf_input TEXT) 
RETURNS BOOLEAN AS $$
DECLARE
    cpf TEXT;
    i INTEGER;
    soma INTEGER := 0;
    resto INTEGER;
    digito1 INTEGER;
    digito2 INTEGER;
BEGIN
    -- Remove caracteres não numéricos
    cpf := REGEXP_REPLACE(cpf_input, '[^0-9]', '', 'g');
    
    -- Verifica se tem 11 dígitos
    IF LENGTH(cpf) != 11 THEN
        RETURN FALSE;
    END IF;
    
    -- Verifica sequências inválidas
    IF cpf IN ('00000000000', '11111111111', '22222222222', '33333333333', 
               '44444444444', '55555555555', '66666666666', '77777777777',
               '88888888888', '99999999999') THEN
        RETURN FALSE;
    END IF;
    
    -- Calcula primeiro dígito verificador
    FOR i IN 1..9 LOOP
        soma := soma + (SUBSTRING(cpf, i, 1)::INTEGER * (11 - i));
    END LOOP;
    
    resto := soma % 11;
    IF resto < 2 THEN
        digito1 := 0;
    ELSE
        digito1 := 11 - resto;
    END IF;
    
    -- Verifica primeiro dígito
    IF SUBSTRING(cpf, 10, 1)::INTEGER != digito1 THEN
        RETURN FALSE;
    END IF;
    
    -- Calcula segundo dígito verificador
    soma := 0;
    FOR i IN 1..10 LOOP
        soma := soma + (SUBSTRING(cpf, i, 1)::INTEGER * (12 - i));
    END LOOP;
    
    resto := soma % 11;
    IF resto < 2 THEN
        digito2 := 0;
    ELSE
        digito2 := 11 - resto;
    END IF;
    
    -- Verifica segundo dígito
    RETURN SUBSTRING(cpf, 11, 1)::INTEGER = digito2;
END;
$$ LANGUAGE plpgsql;

-- Inserção de dados básicos

-- Estados brasileiros
INSERT INTO "Estados" ("Sigla", "Nome", "Regiao", "DataCriacao") VALUES
('AC', 'Acre', 'Norte', NOW()),
('AL', 'Alagoas', 'Nordeste', NOW()),
('AP', 'Amapá', 'Norte', NOW()),
('AM', 'Amazonas', 'Norte', NOW()),
('BA', 'Bahia', 'Nordeste', NOW()),
('CE', 'Ceará', 'Nordeste', NOW()),
('DF', 'Distrito Federal', 'Centro-Oeste', NOW()),
('ES', 'Espírito Santo', 'Sudeste', NOW()),
('GO', 'Goiás', 'Centro-Oeste', NOW()),
('MA', 'Maranhão', 'Nordeste', NOW()),
('MT', 'Mato Grosso', 'Centro-Oeste', NOW()),
('MS', 'Mato Grosso do Sul', 'Centro-Oeste', NOW()),
('MG', 'Minas Gerais', 'Sudeste', NOW()),
('PA', 'Pará', 'Norte', NOW()),
('PB', 'Paraíba', 'Nordeste', NOW()),
('PR', 'Paraná', 'Sul', NOW()),
('PE', 'Pernambuco', 'Nordeste', NOW()),
('PI', 'Piauí', 'Nordeste', NOW()),
('RJ', 'Rio de Janeiro', 'Sudeste', NOW()),
('RN', 'Rio Grande do Norte', 'Nordeste', NOW()),
('RS', 'Rio Grande do Sul', 'Sul', NOW()),
('RO', 'Rondônia', 'Norte', NOW()),
('RR', 'Roraima', 'Norte', NOW()),
('SC', 'Santa Catarina', 'Sul', NOW()),
('SP', 'São Paulo', 'Sudeste', NOW()),
('SE', 'Sergipe', 'Nordeste', NOW()),
('TO', 'Tocantins', 'Norte', NOW())
ON CONFLICT DO NOTHING;

-- Alguns municípios de exemplo (capitais)
INSERT INTO "Municipios" ("Nome", "CodigoIBGE", "Latitude", "Longitude", "Populacao", "EstadoId", "DataCriacao")
SELECT 
    m.nome,
    m.codigo_ibge,
    m.latitude,
    m.longitude,
    m.populacao,
    e."Id",
    NOW()
FROM (VALUES
    ('São Paulo', '3550308', -23.5505, -46.6333, 12325232, 'SP'),
    ('Rio de Janeiro', '3304557', -22.9068, -43.1729, 6747815, 'RJ'),
    ('Brasília', '5300108', -15.7942, -47.8822, 3055149, 'DF'),
    ('Salvador', '2927408', -12.9714, -38.5014, 2886698, 'BA'),
    ('Fortaleza', '2304400', -3.7319, -38.5267, 2686612, 'CE'),
    ('Belo Horizonte', '3106200', -19.9167, -43.9345, 2521564, 'MG'),
    ('Manaus', '1302603', -3.1190, -60.0217, 2219580, 'AM'),
    ('Curitiba', '4106902', -25.4284, -49.2733, 1963726, 'PR'),
    ('Recife', '2611606', -8.0476, -34.8770, 1653461, 'PE'),
    ('Goiânia', '5208707', -16.6799, -49.2550, 1536097, 'GO')
) AS m(nome, codigo_ibge, latitude, longitude, populacao, estado_sigla)
JOIN "Estados" e ON e."Sigla" = m.estado_sigla
ON CONFLICT DO NOTHING;

-- Classificações CID-10 básicas
INSERT INTO "ClassificacoesCID10" ("Codigo", "Descricao", "Categoria", "EspecialidadeRecomendada", "GrauSeveridade", "DataCriacao") VALUES
('A00', 'Cólera', 'Doenças infecciosas e parasitárias', 'Infectologia', 'Grave', NOW()),
('B15', 'Hepatite A aguda', 'Doenças infecciosas e parasitárias', 'Gastroenterologia', 'Moderado', NOW()),
('C50', 'Neoplasia maligna da mama', 'Neoplasias', 'Oncologia', 'Grave', NOW()),
('E10', 'Diabetes mellitus tipo 1', 'Doenças endócrinas', 'Endocrinologia', 'Moderado', NOW()),
('E11', 'Diabetes mellitus tipo 2', 'Doenças endócrinas', 'Endocrinologia', 'Moderado', NOW()),
('F32', 'Episódios depressivos', 'Transtornos mentais', 'Psiquiatria', 'Moderado', NOW()),
('G40', 'Epilepsia', 'Doenças do sistema nervoso', 'Neurologia', 'Moderado', NOW()),
('I10', 'Hipertensão essencial', 'Doenças do aparelho circulatório', 'Cardiologia', 'Leve', NOW()),
('I21', 'Infarto agudo do miocárdio', 'Doenças do aparelho circulatório', 'Cardiologia', 'Crítico', NOW()),
('J44', 'Doença pulmonar obstrutiva crônica', 'Doenças do aparelho respiratório', 'Pneumologia', 'Moderado', NOW()),
('K25', 'Úlcera gástrica', 'Doenças do aparelho digestivo', 'Gastroenterologia', 'Moderado', NOW()),
('M79', 'Outros transtornos dos tecidos moles', 'Doenças do sistema osteomuscular', 'Ortopedia', 'Leve', NOW()),
('N18', 'Doença renal crônica', 'Doenças do aparelho geniturinário', 'Nefrologia', 'Grave', NOW()),
('O80', 'Parto único espontâneo', 'Gravidez, parto e puerpério', 'Ginecologia e Obstetrícia', 'Normal', NOW()),
('S72', 'Fratura do fêmur', 'Lesões e envenenamentos', 'Ortopedia', 'Grave', NOW()),
('Z00', 'Exame médico geral', 'Fatores que influenciam o estado de saúde', 'Clínica Médica', 'Normal', NOW())
ON CONFLICT DO NOTHING;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_municipios_estado ON "Municipios"("EstadoId");
CREATE INDEX IF NOT EXISTS idx_hospitais_municipio ON "Hospitais"("MunicipioId");
CREATE INDEX IF NOT EXISTS idx_medicos_especialidade ON "Medicos"("Especialidade");
CREATE INDEX IF NOT EXISTS idx_pacientes_municipio ON "Pacientes"("MunicipioId");
CREATE INDEX IF NOT EXISTS idx_diagnosticos_paciente ON "DiagnosticosPacientes"("PacienteId");
CREATE INDEX IF NOT EXISTS idx_diagnosticos_cid10 ON "DiagnosticosPacientes"("ClassificacaoCID10Id");
CREATE INDEX IF NOT EXISTS idx_medico_hospital ON "MedicosHospitais"("MedicoId", "HospitalId");

-- Índices para busca de texto
CREATE INDEX IF NOT EXISTS idx_hospitais_nome_gin ON "Hospitais" USING GIN (to_tsvector('portuguese', "Nome"));
CREATE INDEX IF NOT EXISTS idx_medicos_nome_gin ON "Medicos" USING GIN (to_tsvector('portuguese', "Nome"));
CREATE INDEX IF NOT EXISTS idx_pacientes_nome_gin ON "Pacientes" USING GIN (to_tsvector('portuguese', "Nome"));

-- Criar usuário para aplicação (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'aps_app') THEN
        CREATE ROLE aps_app WITH LOGIN PASSWORD 'aps_app_123';
    END IF;
END
$$;

-- Garantir permissões
GRANT CONNECT ON DATABASE aps_saude TO aps_app;
GRANT USAGE ON SCHEMA public TO aps_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aps_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO aps_app;

-- Definir permissões padrão para tabelas futuras
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aps_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO aps_app;
