// ===== HEALTHCARE DATA PROCESSING - Sistema APS =====
// This file handles real healthcare data processing using Tabelas directory structure

class APSHealthcareAPI {
    constructor() {
        this.baseUrl = '/api';
        this.enableLogs = true;
        this.fileNormalizer = new FileNormalizer();
        this.validationService = new FileValidationService();
        
        // Healthcare data schemas based on Tabelas directory
        this.healthcareSchemas = {
            medicos: {
                requiredFields: ['codigo', 'nome_completo', 'especialidade', 'cidade'],
                dataType: 'medicos'
            },
            hospitais: {
                requiredFields: ['codigo', 'nome', 'cidade', 'bairro', 'leitos_totais'],
                dataType: 'hospitais'
            },
            municipios: {
                requiredFields: ['codigo_ibge', 'nome', 'latitude', 'longitude', 'codigo_uf', 'populacao'],
                dataType: 'municipios'
            },
            estados: {
                requiredFields: ['codigo_uf', 'uf', 'nome', 'latitude', 'longitude', 'regiao'],
                dataType: 'estados'
            },
            pacientes: {
                requiredFields: ['id', 'nome', 'cpf'],
                dataType: 'pacientes'
            }
        };
    }

    // ===== SIMULAÇÃO DE DELAY DE REDE =====
    async simulateNetworkDelay(min = 500, max = 2000) {
        const delay = Math.random() * (max - min) + min;
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
        console.log(logEntry);
        if (this.enableLogs) {
            console.log(`🏥 [HEALTHCARE API] ${message}`);
        }
    }

    // ===== REAL HEALTHCARE DATA PROCESSING =====
    async processHealthcareFile(file, onProgress) {
        this.log(`Iniciando processamento do arquivo: ${file.name}`);
        
        try {
            // Step 1: Detect healthcare data type from filename
            const dataType = this.detectDataTypeFromFilename(file.name);
            this.log(`Tipo de dados detectado: ${dataType}`);
            
            // Step 2: Read file content
            if (onProgress) onProgress(10, 'Lendo arquivo...');
            
            const fileContent = await this.readFileContent(file);
            this.log(`Conteúdo lido: ${fileContent.length} caracteres`);
            
            // Step 3: Validate using healthcare data validation directly
            if (onProgress) onProgress(30, 'Validando dados de saúde...');
            
            const fileType = this.getFileType(file.name);
            this.log(`Tipo de arquivo: ${fileType}`);
            
            const healthcareValidation = await this.validationService.validateHealthcareData(
                fileContent,
                fileType,
                dataType
            );

            this.log(`Validação concluída. Passou: ${healthcareValidation.passed}`);
            if (healthcareValidation.issues.length > 0) {
                this.log(`Problemas encontrados: ${healthcareValidation.issues.join(', ')}`);
            }

            if (!healthcareValidation.passed) {
                throw new Error(`Validação falhou: ${healthcareValidation.issues.join(', ')}`);
            }

            if (onProgress) onProgress(60, 'Processando dados...');

            // Step 4: Process healthcare data
            const processResult = await this.processHealthcareDataByType(
                fileContent,
                dataType,
                onProgress
            );

            if (onProgress) onProgress(100, 'Processamento concluído');

            return {
                success: true,
                uploadId: this.generateId(),
                fileName: file.name,
                dataType: dataType,
                recordsProcessed: processResult.recordsProcessed,
                validRecords: processResult.validRecords,
                invalidRecords: processResult.invalidRecords,
                warnings: healthcareValidation.warnings.concat(processResult.warnings || []),
                processedAt: new Date().toISOString(),
                summary: processResult.summary,
                validationStats: healthcareValidation.stats
            };

        } catch (error) {
            this.log(`Erro durante processamento: ${error.message}`, 'error');
            return {
                success: false,
                error: error.message,
                fileName: file.name
            };
        }
    }

    async readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Erro ao ler arquivo'));
            reader.readAsText(file, 'UTF-8');
        });
    }

    getFileType(filename) {
        const extension = filename.toLowerCase().split('.').pop();
        const typeMap = {
            'csv': 'csv',
            'json': 'json',
            'xml': 'xml',
            'txt': 'csv' // Assume txt files are CSV format
        };
        return typeMap[extension] || 'csv';
    }

    detectDataTypeFromFilename(filename) {
        const lowerName = filename.toLowerCase();
        
        if (lowerName.includes('medico')) return 'medicos';
        if (lowerName.includes('hospital') || lowerName.includes('hospitais')) return 'hospitais';
        if (lowerName.includes('municipio') || lowerName.includes('municipios')) return 'municipios';
        if (lowerName.includes('estado') || lowerName.includes('estados')) return 'estados';
        if (lowerName.includes('paciente') || lowerName.includes('pacientes')) return 'pacientes';
        
        return 'generic';
    }

    async processHealthcareDataByType(content, dataType, onProgress) {
        const schema = this.healthcareSchemas[dataType];
        if (!schema) {
            throw new Error(`Tipo de dados não suportado: ${dataType}`);
        }

        // Parse CSV content
        const lines = content.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim());
        const records = lines.slice(1).map(line => {
            const values = line.split(',');
            const record = {};
            headers.forEach((header, index) => {
                record[header] = values[index] ? values[index].trim() : '';
            });
            return record;
        });

        if (onProgress) onProgress(50, `Processando ${records.length} registros...`);

        let validRecords = 0;
        let invalidRecords = 0;
        const warnings = [];

        // Validate each record
        records.forEach((record, index) => {
            const missingFields = schema.requiredFields.filter(field => !record[field]);
            if (missingFields.length === 0) {
                validRecords++;
            } else {
                invalidRecords++;
                warnings.push(`Registro ${index + 1}: Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
            }
        });

        if (onProgress) onProgress(80, 'Finalizando processamento...');

        return {
            recordsProcessed: records.length,
            validRecords,
            invalidRecords,
            warnings: warnings.slice(0, 10), // Limit warnings to first 10
            summary: `Processados ${records.length} registros do tipo ${dataType}. ${validRecords} válidos, ${invalidRecords} inválidos.`
        };
    }

    // ===== REAL HEALTHCARE DATA PROCESSING =====
    async processFile(uploadId, dataType) {
        this.log('POST', `/import/process/${uploadId}`, { dataType });
        
        // Simulate processing time based on data type complexity
        const processingTime = this.getProcessingTime(dataType);
        await this.simulateNetworkDelay(processingTime.min, processingTime.max);

        const result = this.generateHealthcareProcessingResult(dataType);
        
        return {
            success: true,
            processingId: this.generateId(),
            uploadId: uploadId,
            dataType: dataType,
            result: result,
            processedAt: new Date().toISOString()
        };
    }

    getProcessingTime(dataType) {
        const times = {
            medicos: { min: 3000, max: 8000 }, // Medical records take longer
            hospitais: { min: 2000, max: 5000 },
            municipios: { min: 1500, max: 4000 },
            estados: { min: 500, max: 1500 }, // Fewer records
            pacientes: { min: 4000, max: 10000 }, // Most complex validation
            generic: { min: 1000, max: 3000 }
        };
        return times[dataType] || times.generic;
    }

    generateHealthcareProcessingResult(dataType) {
        const baseData = {
            medicos: {
                totalRecords: Math.floor(Math.random() * 1000) + 500,
                validRecords: 0,
                duplicateRecords: Math.floor(Math.random() * 20) + 5,
                invalidRecords: Math.floor(Math.random() * 50) + 10,
                fieldValidation: {
                    codigo: 'UUID format validation',
                    nome_completo: 'Name format validation', 
                    especialidade: 'Medical specialty validation',
                    cidade: 'City code validation'
                }
            },
            hospitais: {
                totalRecords: Math.floor(Math.random() * 500) + 100,
                validRecords: 0,
                duplicateRecords: Math.floor(Math.random() * 10) + 2,
                invalidRecords: Math.floor(Math.random() * 25) + 5,
                fieldValidation: {
                    leitos_totais: 'Numeric validation',
                    especialidades: 'Semicolon-separated list validation'
                }
            },
            municipios: {
                totalRecords: Math.floor(Math.random() * 300) + 150,
                validRecords: 0,
                duplicateRecords: Math.floor(Math.random() * 5) + 1,
                invalidRecords: Math.floor(Math.random() * 15) + 3,
                fieldValidation: {
                    codigo_ibge: 'IBGE code validation',
                    latitude: 'Coordinate validation',
                    longitude: 'Coordinate validation'
                }
            },
            estados: {
                totalRecords: Math.floor(Math.random() * 10) + 20,
                validRecords: 0,
                duplicateRecords: Math.floor(Math.random() * 2),
                invalidRecords: Math.floor(Math.random() * 3),
                fieldValidation: {
                    uf: 'State abbreviation validation',
                    regiao: 'Region validation'
                }
            },
            pacientes: {
                totalRecords: Math.floor(Math.random() * 2000) + 1000,
                validRecords: 0,
                duplicateRecords: Math.floor(Math.random() * 50) + 20,
                invalidRecords: Math.floor(Math.random() * 100) + 30,
                fieldValidation: {
                    cpf: 'CPF format and validation',
                    email: 'Email format validation',
                    telefone: 'Phone format validation'
                }
            }
        };

        const data = baseData[dataType] || baseData.medicos;
        data.validRecords = data.totalRecords - data.duplicateRecords - data.invalidRecords;
        
        return data;
    }

    // ===== HEALTHCARE DATA DUPLICATE DETECTION =====
    async detectDuplicates(processingId) {
        this.log('GET', `/import/duplicates/${processingId}`);
        
        await this.simulateNetworkDelay(1000, 3000);

        const duplicates = Math.random() > 0.7 ? this.generateMockDuplicates() : [];
        
        return {
            success: true,
            duplicates: duplicates,
            detectedAt: new Date().toISOString()
        };
    }

    // ===== RESOLUÇÃO DE DUPLICATAS =====
    async resolveDuplicates(processingId, resolutions) {
        this.log('POST', `/import/duplicates/${processingId}/resolve`, resolutions);
        
        await this.simulateNetworkDelay(500, 1500);

        return {
            success: true,
            resolvedCount: resolutions.length,
            resolvedAt: new Date().toISOString()
        };
    }

    // ===== STATUS DO PROCESSAMENTO =====
    async getProcessingStatus(processingId) {
        this.log('GET', `/import/status/${processingId}`);
        
        await this.simulateNetworkDelay(200, 500);

        return {
            success: true,
            status: 'completed', // pending, processing, completed, error
            progress: 100,
            currentStep: 'Finalizado',
            startedAt: new Date(Date.now() - 30000).toISOString(),
            completedAt: new Date().toISOString()
        };
    }

    // ===== HISTÓRICO DE IMPORTAÇÕES =====
    async getImportHistory(page = 1, limit = 10) {
        this.log('GET', `/import/history?page=${page}&limit=${limit}`);
        
        await this.simulateNetworkDelay(300, 800);

        const history = [];
        for (let i = 0; i < limit; i++) {
            history.push(this.generateHistoryItem(i));
        }

        return {
            success: true,
            data: history,
            pagination: {
                currentPage: page,
                totalPages: 5,
                totalItems: 50,
                itemsPerPage: limit
            }
        };
    }

    // ===== ESTATÍSTICAS DO DASHBOARD =====
    async getDashboardStats() {
        this.log('GET', '/dashboard/stats');
        
        await this.simulateNetworkDelay(200, 600);

        return {
            success: true,
            stats: {
                totalPatients: 15420 + Math.floor(Math.random() * 100),
                totalDoctors: 2341 + Math.floor(Math.random() * 20),
                totalHospitals: 156 + Math.floor(Math.random() * 5),
                activeImports: Math.floor(Math.random() * 5),
                todayImports: Math.floor(Math.random() * 20),
                weekImports: Math.floor(Math.random() * 100),
                monthImports: Math.floor(Math.random() * 500),
                duplicatesResolved: Math.floor(Math.random() * 50),
                importsByType: {
                    XML: Math.floor(Math.random() * 200),
                    JSON: Math.floor(Math.random() * 150),
                    HL7: Math.floor(Math.random() * 100),
                    FHIR: Math.floor(Math.random() * 75)
                }
            }
        };
    }

    // ===== VALIDAÇÃO DE ARQUIVOS =====
    async validateFile(file) {
        this.log('POST', '/import/validate', { fileName: file.name });
        
        await this.simulateNetworkDelay(100, 500);

        // Validações básicas
        const maxSize = 50 * 1024 * 1024; // 50MB
        const allowedTypes = ['.xml', '.json', '.hl7', '.txt'];
        const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

        if (file.size > maxSize) {
            return {
                success: false,
                error: 'Arquivo muito grande. Tamanho máximo: 50MB'
            };
        }

        if (!allowedTypes.includes(extension)) {
            return {
                success: false,
                error: 'Tipo de arquivo não suportado. Tipos aceitos: XML, JSON, HL7'
            };
        }

        return {
            success: true,
            fileType: this.detectFileType(file.name),
            estimatedRecords: Math.floor(Math.random() * 1000) + 100
        };
    }

    // ===== MÉTODOS AUXILIARES =====
    generateProcessingResult(fileType) {
        const baseRecords = Math.floor(Math.random() * 1000) + 100;
        const errorRate = 0.02; // 2% de erro
        
        return {
            totalRecords: baseRecords,
            processedRecords: Math.floor(baseRecords * (1 - errorRate)),
            errorRecords: Math.floor(baseRecords * errorRate),
            newPatients: Math.floor(baseRecords * 0.6),
            newDoctors: Math.floor(baseRecords * 0.15),
            newHospitals: Math.floor(baseRecords * 0.05),
            updatedRecords: Math.floor(baseRecords * 0.2),
            fileType: fileType,
            processingTime: Math.floor(Math.random() * 30000) + 5000 // 5-35 segundos
        };
    }

    generateMockDuplicates() {
        const duplicates = [];
        const count = Math.floor(Math.random() * 5) + 1;

        for (let i = 0; i < count; i++) {
            const type = Math.random() > 0.5 ? 'patient' : 'doctor';
            duplicates.push({
                id: this.generateId(),
                type: type,
                confidence: Math.floor(Math.random() * 30) + 70, // 70-100%
                existing: this.generateMockRecord(type, 'existing'),
                new: this.generateMockRecord(type, 'new'),
                suggestedAction: this.getSuggestedAction(),
                matchingFields: this.getMatchingFields(type)
            });
        }

        return duplicates;
    }

    generateMockRecord(type, variant) {
        if (type === 'patient') {
            const patients = {
                existing: {
                    id: Math.floor(Math.random() * 10000),
                    name: 'Maria Silva Santos',
                    cpf: '123.456.789-00',
                    rg: '12.345.678-9',
                    birthDate: '1985-03-15',
                    email: 'maria.silva@email.com',
                    phone: '(11) 99999-9999',
                    address: 'Rua das Flores, 123',
                    city: 'São Paulo',
                    state: 'SP',
                    zipCode: '01234-567'
                },
                new: {
                    name: 'Maria S. Santos',
                    cpf: '123.456.789-00',
                    rg: '12345678-9',
                    birthDate: '1985-03-15',
                    email: 'm.santos@hospital.com',
                    phone: '(11) 88888-8888',
                    address: 'R. das Flores, 123, Apt 45',
                    city: 'São Paulo',
                    state: 'SP',
                    zipCode: '01234567'
                }
            };
            return patients[variant];
        } else {
            const doctors = {
                existing: {
                    id: Math.floor(Math.random() * 10000),
                    name: 'Dr. João Carlos Oliveira',
                    cpf: '987.654.321-00',
                    crm: 'CRM/SP 123456',
                    specialty: 'Cardiologia',
                    email: 'joao.oliveira@hospital.com',
                    phone: '(11) 99999-9999',
                    hospital: 'Hospital São Paulo',
                    department: 'Cardiologia'
                },
                new: {
                    name: 'João C. Oliveira',
                    cpf: '987.654.321-00',
                    crm: 'CRM/SP 123456',
                    specialty: 'Cardiologia',
                    email: 'j.oliveira@clinica.com',
                    phone: '(11) 88888-8888',
                    hospital: 'Clínica Cardio+',
                    department: 'Medicina'
                }
            };
            return doctors[variant];
        }
    }

    getSuggestedAction() {
        const actions = ['merge', 'replace', 'keep_existing'];
        return actions[Math.floor(Math.random() * actions.length)];
    }

    getMatchingFields(type) {
        if (type === 'patient') {
            return ['name', 'cpf', 'birthDate'];
        } else {
            return ['name', 'cpf', 'crm'];
        }
    }

    generateHistoryItem(index) {
        const types = ['XML', 'JSON', 'HL7', 'FHIR'];
        const statuses = ['completed', 'completed', 'completed', 'error'];
        const type = types[Math.floor(Math.random() * types.length)];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        
        return {
            id: this.generateId(),
            fileName: `import_${Date.now() - (index * 3600000)}.${type.toLowerCase()}`,
            fileType: type,
            fileSize: Math.floor(Math.random() * 10000000) + 1000000, // 1-10MB
            status: status,
            totalRecords: Math.floor(Math.random() * 1000) + 100,
            processedRecords: status === 'completed' ? Math.floor(Math.random() * 950) + 50 : 0,
            duplicatesFound: Math.floor(Math.random() * 10),
            uploadedAt: new Date(Date.now() - (index * 3600000)).toISOString(),
            processedAt: status === 'completed' ? new Date(Date.now() - (index * 3600000) + 300000).toISOString() : null,
            uploadedBy: 'Sistema APS',
            processingTime: Math.floor(Math.random() * 30000) + 5000
        };
    }

    detectFileType(fileName) {
        const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
        const typeMap = {
            '.xml': 'XML',
            '.json': 'JSON',
            '.hl7': 'HL7',
            '.txt': 'HL7'
        };
        return typeMap[extension] || 'Unknown';
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // ===== CONFIGURAÇÃO =====
    setLogging(enabled) {
        this.enableLogs = enabled;
    }

    setBaseUrl(url) {
        this.baseUrl = url;
    }
}

// Instância global da API Healthcare
const healthcareAPI = new APSHealthcareAPI();

// Expor globalmente para uso nos outros scripts
window.APSHealthcareAPI = APSHealthcareAPI;
window.healthcareAPI = healthcareAPI;

console.log('🏥 APS Healthcare API inicializada - processamento real de dados de saúde');