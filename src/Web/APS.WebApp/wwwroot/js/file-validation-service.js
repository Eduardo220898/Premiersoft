/**
 * APS Healthcare Platform - File Validation Service
 * Advanced validation and integrity checking for uploaded healthcare files
 */

class FileValidationService {
    constructor() {
        this.normalizer = new FileNormalizer();
        this.validationHistory = new Map();
        this.quarantineQueue = [];
        
        // Real healthcare data structures based on Tabelas directory
        this.healthcareValidators = {
            medicos: {
                requiredFields: ['codigo', 'nome_completo', 'especialidade', 'cidade'],
                optionalFields: [],
                validation: {
                    codigo: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
                    nome_completo: /^[A-Za-zÀ-ÿ\s]+$/,
                    especialidade: /^[A-Za-zÀ-ÿ\s]+$/,
                    cidade: /^\d+$/
                }
            },
            hospitais: {
                requiredFields: ['codigo', 'nome', 'cidade', 'bairro', 'leitos_totais'],
                optionalFields: ['especialidades'],
                validation: {
                    codigo: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
                    nome: /^[A-Za-zÀ-ÿ\s]+$/,
                    cidade: /^\d+$/,
                    bairro: /^[A-Za-zÀ-ÿ\s]+$/,
                    leitos_totais: /^\d+$/,
                    especialidades: /^[A-Za-zÀ-ÿ\s;]+$/
                }
            },
            municipios: {
                requiredFields: ['codigo_ibge', 'nome', 'latitude', 'longitude', 'codigo_uf', 'populacao'],
                optionalFields: ['capital', 'siafi_id', 'ddd', 'fuso_horario'],
                validation: {
                    codigo_ibge: /^\d+$/,
                    nome: /^[A-Za-zÀ-ÿ\s\-\']+$/,
                    latitude: /^-?\d+\.?\d*$/,
                    longitude: /^-?\d+\.?\d*$/,
                    codigo_uf: /^\d+$/,
                    populacao: /^\d+$/
                }
            },
            estados: {
                requiredFields: ['codigo_uf', 'uf', 'nome', 'latitude', 'longitude', 'regiao'],
                optionalFields: [],
                validation: {
                    codigo_uf: /^\d+$/,
                    uf: /^[A-Z]{2}$/,
                    nome: /^[A-Za-zÀ-ÿ\s]+$/,
                    latitude: /^-?\d+\.?\d*$/,
                    longitude: /^-?\d+\.?\d*$/,
                    regiao: /^[A-Za-z]+$/
                }
            },
            pacientes: {
                requiredFields: ['id', 'nome', 'cpf'],
                optionalFields: ['email', 'telefone', 'endereco', 'nascimento', 'sexo'],
                validation: {
                    id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
                    nome: /^[A-Za-zÀ-ÿ\s]+$/,
                    cpf: /^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/,
                    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    telefone: /^\(\d{2}\)\s\d{4,5}-\d{4}$|^\d{10,11}$/
                }
            }
        };

        this.securityChecks = {
            maliciousPatterns: [
                /(<script|<\/script>)/gi,
                /(javascript:|vbscript:|data:)/gi,
                /(eval\s*\(|setTimeout\s*\(|setInterval\s*\()/gi,
                /(document\.|window\.|location\.)/gi,
                /(onload|onerror|onclick|onmouseover)/gi
            ],
            sqlInjectionPatterns: [
                /(union\s+select|drop\s+table|delete\s+from)/gi,
                /(insert\s+into|update\s+set|alter\s+table)/gi,
                /(\'\s*or\s*\'|\'\s*and\s*\'|--|\#)/gi,
                /(exec\s*\(|sp_|xp_)/gi
            ],
            fileInclusionPatterns: [
                /(\.\.\/|\.\.\\)/g,
                /(\/etc\/passwd|\/windows\/system32)/gi,
                /(file:\/\/|ftp:\/\/)/gi
            ]
        };
    }

    /**
     * Main validation function with comprehensive checks
     * @param {File} file - The file to validate
     * @param {Object} options - Validation options
     * @returns {Promise<Object>} Detailed validation results
     */
    async validateFile(file, options = {}) {
        const validationId = this.generateValidationId();
        const startTime = Date.now();

        try {
            // Initialize validation context
            const context = {
                validationId,
                file: {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    lastModified: file.lastModified
                },
                options: {
                    strictMode: options.strictMode || false,
                    allowQuarantine: options.allowQuarantine !== false,
                    dataType: options.dataType || 'auto-detect',
                    performDeepScan: options.performDeepScan || false,
                    ...options
                },
                startTime,
                steps: []
            };

            // Step 1: Pre-validation security scan
            await this.logStep(context, 'security-prescan', 'Executando varredura de segurança inicial...');
            const preSecurityScan = await this.performSecurityPrescan(file);
            if (!preSecurityScan.passed && context.options.strictMode) {
                throw new Error(`Falha na varredura de segurança: ${preSecurityScan.issues.join(', ')}`);
            }

            // Step 2: File normalization
            await this.logStep(context, 'normalization', 'Normalizando arquivo...');
            const normalizationResult = await this.normalizer.normalizeFile(file, (progress) => {
                this.updateProgress(context, 'normalization', progress);
            });

            if (!normalizationResult.success) {
                throw new Error(`Falha na normalização: ${normalizationResult.error}`);
            }

            // Step 3: Content integrity check
            await this.logStep(context, 'integrity', 'Verificando integridade do conteúdo...');
            const integrityCheck = await this.checkContentIntegrity(normalizationResult);

            // Step 4: Healthcare data validation
            await this.logStep(context, 'healthcare-validation', 'Validando dados de saúde...');
            const healthcareValidation = await this.validateHealthcareData(
                normalizationResult.normalized.content,
                normalizationResult.normalized.detectedType,
                context.options.dataType
            );

            // Step 5: Deep content analysis (if requested)
            let deepAnalysis = null;
            if (context.options.performDeepScan) {
                await this.logStep(context, 'deep-analysis', 'Executando análise profunda...');
                deepAnalysis = await this.performDeepAnalysis(normalizationResult);
            }

            // Step 6: Security post-scan
            await this.logStep(context, 'security-postscan', 'Varredura de segurança final...');
            const postSecurityScan = await this.performSecurityPostscan(normalizationResult);

            // Step 7: Generate final report
            await this.logStep(context, 'report-generation', 'Gerando relatório final...');
            const validationReport = await this.generateValidationReport({
                context,
                normalizationResult,
                preSecurityScan,
                postSecurityScan,
                integrityCheck,
                healthcareValidation,
                deepAnalysis
            });

            // Store validation history
            this.validationHistory.set(validationId, validationReport);

            return validationReport;

        } catch (error) {
            const errorReport = {
                validationId,
                success: false,
                error: {
                    message: error.message,
                    timestamp: new Date().toISOString(),
                    processingTime: Date.now() - startTime
                },
                file: {
                    name: file.name,
                    size: file.size,
                    type: file.type
                }
            };

            this.validationHistory.set(validationId, errorReport);
            return errorReport;
        }
    }

    /**
     * Perform initial security scan before processing
     */
    async performSecurityPrescan(file) {
        const issues = [];
        const warnings = [];

        // Check file size limits
        if (file.size > 100 * 1024 * 1024) { // 100MB
            issues.push('Arquivo excede o limite de tamanho permitido');
        }

        // Check file type against whitelist
        const allowedTypes = [
            'text/csv', 'text/plain', 'application/json',
            'text/xml', 'application/xml', 'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];

        if (!allowedTypes.includes(file.type) && file.type !== '') {
            warnings.push(`Tipo de arquivo não reconhecido: ${file.type}`);
        }

        // Check filename for suspicious patterns
        const suspiciousPatterns = [
            /\.exe$/i, /\.bat$/i, /\.cmd$/i, /\.scr$/i,
            /\.php$/i, /\.asp$/i, /\.jsp$/i,
            /[<>:"|?*]/
        ];

        suspiciousPatterns.forEach(pattern => {
            if (pattern.test(file.name)) {
                issues.push(`Nome do arquivo contém padrão suspeito: ${pattern}`);
            }
        });

        return {
            passed: issues.length === 0,
            issues,
            warnings,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Check content integrity after normalization
     */
    async checkContentIntegrity(normalizationResult) {
        const issues = [];
        const warnings = [];
        const stats = {
            originalSize: normalizationResult.originalFile.size,
            normalizedSize: normalizationResult.normalized.size,
            checksumMatch: false,
            corruptionIndicators: []
        };

        // Check for significant size changes
        const sizeChangePct = Math.abs(stats.originalSize - stats.normalizedSize) / stats.originalSize * 100;
        if (sizeChangePct > 50) {
            warnings.push(`Mudança significativa no tamanho do arquivo: ${sizeChangePct.toFixed(1)}%`);
        }

        // Check for corruption indicators
        const content = normalizationResult.normalized.content;
        
        // Look for truncation indicators
        if (content.includes('...') || content.includes('[TRUNCATED]')) {
            stats.corruptionIndicators.push('Possível truncamento detectado');
        }

        // Look for encoding corruption
        if (content.includes('�') || content.includes('????')) {
            stats.corruptionIndicators.push('Possível corrupção de encoding');
        }

        // Look for incomplete data structures
        const fileType = normalizationResult.normalized.detectedType;
        if (fileType === 'json') {
            try {
                JSON.parse(content);
            } catch (e) {
                stats.corruptionIndicators.push('Estrutura JSON incompleta ou corrompida');
            }
        } else if (fileType === 'xml') {
            const openTags = (content.match(/<[^\/][^>]*>/g) || []).length;
            const closeTags = (content.match(/<\/[^>]*>/g) || []).length;
            if (Math.abs(openTags - closeTags) > 5) {
                stats.corruptionIndicators.push('Tags XML possivelmente não balanceadas');
            }
        }

        return {
            passed: issues.length === 0,
            issues,
            warnings,
            stats,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Validate healthcare-specific data
     */
    async validateHealthcareData(content, fileType, expectedDataType = 'auto-detect') {
        const issues = [];
        const warnings = [];
        const stats = {
            recordsFound: 0,
            validRecords: 0,
            invalidRecords: 0,
            missingFields: [],
            dataQualityScore: 0
        };

        let dataType = expectedDataType; // Declare dataType at function scope

        try {
            let records = [];

            // Parse content based on file type
            switch (fileType) {
                case 'csv':
                    records = this.parseCSVRecords(content);
                    break;
                case 'json':
                case 'fhir':
                    records = this.parseJSONRecords(content);
                    break;
                case 'xml':
                    records = this.parseXMLRecords(content);
                    break;
                default:
                    warnings.push('Tipo de arquivo não suportado para validação de dados de saúde');
                    return { 
                        passed: true, 
                        issues, 
                        warnings, 
                        stats,
                        detectedDataType: dataType,
                        timestamp: new Date().toISOString()
                    };
            }

            stats.recordsFound = records.length;

            // Auto-detect data type if not specified
            if (dataType === 'auto-detect') {
                dataType = this.detectHealthcareDataType(records);
            }

            // Validate records based on detected/specified type
            if (this.healthcareValidators[dataType]) {
                const validator = this.healthcareValidators[dataType];
                
                records.forEach((record, index) => {
                    const recordValidation = this.validateHealthcareRecord(record, validator, index);
                    
                    if (recordValidation.isValid) {
                        stats.validRecords++;
                    } else {
                        stats.invalidRecords++;
                        issues.push(...recordValidation.errors);
                        warnings.push(...recordValidation.warnings);
                    }

                    stats.missingFields.push(...recordValidation.missingFields);
                });

                // Calculate data quality score
                stats.dataQualityScore = stats.recordsFound > 0 ? 
                    (stats.validRecords / stats.recordsFound) * 100 : 0;

                // Generate summary warnings
                if (stats.dataQualityScore < 70) {
                    warnings.push(`Baixa qualidade dos dados: ${stats.dataQualityScore.toFixed(1)}% dos registros são válidos`);
                }

                if (stats.missingFields.length > 0) {
                    const fieldCounts = {};
                    stats.missingFields.forEach(field => {
                        fieldCounts[field] = (fieldCounts[field] || 0) + 1;
                    });
                    
                    const topMissingFields = Object.entries(fieldCounts)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 5);
                    
                    warnings.push(`Campos frequentemente ausentes: ${topMissingFields.map(([field, count]) => `${field} (${count}x)`).join(', ')}`);
                }
            }

        } catch (error) {
            issues.push(`Erro na validação de dados de saúde: ${error.message}`);
        }

        return {
            passed: issues.length === 0,
            issues,
            warnings,
            stats,
            detectedDataType: dataType,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Perform deep content analysis
     */
    async performDeepAnalysis(normalizationResult) {
        const analysis = {
            patterns: {},
            anomalies: [],
            recommendations: [],
            riskAssessment: 'low'
        };

        const content = normalizationResult.normalized.content;

        // Analyze content patterns
        analysis.patterns.avgLineLength = this.calculateAverageLineLength(content);
        analysis.patterns.characterDistribution = this.analyzeCharacterDistribution(content);
        analysis.patterns.repeatingPatterns = this.detectRepeatingPatterns(content);

        // Detect anomalies
        if (analysis.patterns.avgLineLength > 10000) {
            analysis.anomalies.push('Linhas excepcionalmente longas detectadas');
            analysis.riskAssessment = 'medium';
        }

        if (analysis.patterns.repeatingPatterns.length > 100) {
            analysis.anomalies.push('Alto número de padrões repetitivos');
            analysis.recommendations.push('Verificar possível duplicação de dados');
        }

        // Check for unusual character patterns
        const nonAsciiRatio = analysis.patterns.characterDistribution.nonAscii / content.length;
        if (nonAsciiRatio > 0.1) {
            analysis.anomalies.push('Alta proporção de caracteres não-ASCII');
            analysis.recommendations.push('Verificar encoding e origem dos dados');
        }

        return analysis;
    }

    /**
     * Perform security scan after normalization
     */
    async performSecurityPostscan(normalizationResult) {
        const issues = [];
        const warnings = [];
        const threats = [];

        const content = normalizationResult.normalized.content;

        // Check for malicious patterns
        this.securityChecks.maliciousPatterns.forEach((pattern, index) => {
            const matches = content.match(pattern);
            if (matches) {
                threats.push({
                    type: 'malicious_code',
                    pattern: pattern.toString(),
                    matches: matches.length,
                    severity: 'high'
                });
            }
        });

        // Check for SQL injection patterns
        this.securityChecks.sqlInjectionPatterns.forEach((pattern, index) => {
            const matches = content.match(pattern);
            if (matches) {
                threats.push({
                    type: 'sql_injection',
                    pattern: pattern.toString(),
                    matches: matches.length,
                    severity: 'high'
                });
            }
        });

        // Check for file inclusion attempts
        this.securityChecks.fileInclusionPatterns.forEach((pattern, index) => {
            const matches = content.match(pattern);
            if (matches) {
                threats.push({
                    type: 'file_inclusion',
                    pattern: pattern.toString(),
                    matches: matches.length,
                    severity: 'medium'
                });
            }
        });

        // Evaluate threat level
        const highSeverityThreats = threats.filter(t => t.severity === 'high').length;
        const mediumSeverityThreats = threats.filter(t => t.severity === 'medium').length;

        if (highSeverityThreats > 0) {
            issues.push(`${highSeverityThreats} ameaças de alta severidade detectadas`);
        }

        if (mediumSeverityThreats > 0) {
            warnings.push(`${mediumSeverityThreats} ameaças de média severidade detectadas`);
        }

        return {
            passed: issues.length === 0,
            issues,
            warnings,
            threats,
            riskLevel: highSeverityThreats > 0 ? 'high' : mediumSeverityThreats > 0 ? 'medium' : 'low',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Generate comprehensive validation report
     */
    async generateValidationReport(validationData) {
        const {
            context,
            normalizationResult,
            preSecurityScan,
            postSecurityScan,
            integrityCheck,
            healthcareValidation,
            deepAnalysis
        } = validationData;

        const report = {
            validationId: context.validationId,
            success: true,
            timestamp: new Date().toISOString(),
            processingTime: Date.now() - context.startTime,
            
            file: {
                original: normalizationResult.originalFile,
                normalized: normalizationResult.normalized,
                transformations: normalizationResult.validation.corrections
            },

            security: {
                prescan: preSecurityScan,
                postscan: postSecurityScan,
                overallRisk: this.calculateOverallRisk(preSecurityScan, postSecurityScan)
            },

            integrity: integrityCheck,
            
            healthcare: healthcareValidation,

            normalization: {
                success: normalizationResult.success,
                issuesFound: normalizationResult.validation.issuesFound,
                corrections: normalizationResult.validation.corrections
            },

            deepAnalysis: deepAnalysis,

            summary: {
                status: this.determineOverallStatus(preSecurityScan, postSecurityScan, integrityCheck, healthcareValidation),
                recommendations: this.generateRecommendations(validationData),
                nextSteps: this.generateNextSteps(validationData)
            },

            processingSteps: context.steps
        };

        // Determine if file should be quarantined
        if (report.security.overallRisk === 'high' || !integrityCheck.passed) {
            report.quarantine = {
                required: true,
                reason: 'Alto risco de segurança ou falha na integridade',
                timestamp: new Date().toISOString()
            };

            if (context.options.allowQuarantine) {
                this.quarantineQueue.push({
                    validationId: context.validationId,
                    file: normalizationResult.originalFile,
                    reason: report.quarantine.reason,
                    timestamp: report.quarantine.timestamp
                });
            }
        }

        return report;
    }

    /**
     * Helper methods
     */
    generateValidationId() {
        return 'val_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async logStep(context, stepType, message) {
        context.steps.push({
            type: stepType,
            message,
            timestamp: new Date().toISOString(),
            elapsed: Date.now() - context.startTime
        });
    }

    updateProgress(context, stage, progress) {
        // This could emit events or update UI
        console.log(`[${context.validationId}] ${stage}: ${progress.message || progress.progress}%`);
    }

    parseCSVRecords(content) {
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const records = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            const record = {};
            headers.forEach((header, index) => {
                record[header] = values[index] || '';
            });
            records.push(record);
        }

        return records;
    }

    parseJSONRecords(content) {
        try {
            const parsed = JSON.parse(content);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch (error) {
            return [];
        }
    }

    parseXMLRecords(content) {
        // Simplified XML parsing - in a real implementation, use a proper XML parser
        const records = [];
        const recordPattern = /<(\w+)>(.*?)<\/\1>/gs;
        let match;

        while ((match = recordPattern.exec(content)) !== null) {
            // This is a very basic implementation
            records.push({ type: match[1], content: match[2] });
        }

        return records;
    }

    detectHealthcareDataType(records) {
        if (records.length === 0) return 'unknown';

        const firstRecord = records[0];
        const fields = Object.keys(firstRecord);
        const fieldsStr = fields.join(' ').toLowerCase();

        // Healthcare data type detection based on Tabelas directory structure
        
        // Check for medicos data
        if (fields.some(f => ['codigo', 'nome_completo', 'especialidade'].includes(f.toLowerCase())) ||
            /nome_completo.*especialidade/.test(fieldsStr)) {
            return 'medicos';
        }

        // Check for hospitais data
        if (fields.some(f => ['leitos_totais', 'especialidades'].includes(f.toLowerCase())) ||
            /leitos.*especialidades/.test(fieldsStr)) {
            return 'hospitais';
        }

        // Check for municipios data
        if (fields.some(f => ['codigo_ibge', 'populacao', 'siafi_id'].includes(f.toLowerCase())) ||
            /codigo_ibge.*populacao/.test(fieldsStr)) {
            return 'municipios';
        }

        // Check for estados data
        if (fields.some(f => ['codigo_uf', 'uf', 'regiao'].includes(f.toLowerCase())) ||
            /codigo_uf.*regiao/.test(fieldsStr)) {
            return 'estados';
        }

        // Check for pacientes data
        if (fields.some(f => ['cpf', 'paciente', 'nascimento'].includes(f.toLowerCase())) ||
            /cpf.*email|telefone.*endereco/.test(fieldsStr)) {
            return 'pacientes';
        }

        return 'unknown';
    }

    validateHealthcareRecord(record, validator, recordIndex) {
        const errors = [];
        const warnings = [];
        const missingFields = [];

        // Check required fields
        validator.requiredFields.forEach(field => {
            if (!record[field] || record[field].toString().trim() === '') {
                missingFields.push(field);
                errors.push(`Registro ${recordIndex + 1}: Campo obrigatório '${field}' ausente`);
            }
        });

        // Validate field formats
        Object.entries(validator.validation || {}).forEach(([field, pattern]) => {
            if (record[field] && !pattern.test(record[field])) {
                warnings.push(`Registro ${recordIndex + 1}: Formato inválido para '${field}': ${record[field]}`);
            }
        });

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            missingFields
        };
    }

    calculateAverageLineLength(content) {
        const lines = content.split('\n');
        const totalLength = lines.reduce((sum, line) => sum + line.length, 0);
        return lines.length > 0 ? totalLength / lines.length : 0;
    }

    analyzeCharacterDistribution(content) {
        let ascii = 0;
        let nonAscii = 0;
        let digits = 0;
        let letters = 0;
        let special = 0;

        for (let char of content) {
            const code = char.charCodeAt(0);
            if (code < 128) ascii++;
            else nonAscii++;

            if (/\d/.test(char)) digits++;
            else if (/[a-zA-Z]/.test(char)) letters++;
            else special++;
        }

        return { ascii, nonAscii, digits, letters, special };
    }

    detectRepeatingPatterns(content) {
        const patterns = new Map();
        const minPatternLength = 10;
        const maxPatternLength = 100;

        for (let length = minPatternLength; length <= maxPatternLength; length++) {
            for (let i = 0; i <= content.length - length; i++) {
                const pattern = content.substring(i, i + length);
                patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
            }
        }

        return Array.from(patterns.entries())
            .filter(([pattern, count]) => count > 3)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);
    }

    calculateOverallRisk(preSecurityScan, postSecurityScan) {
        if (!preSecurityScan.passed || postSecurityScan.riskLevel === 'high') {
            return 'high';
        }
        if (postSecurityScan.riskLevel === 'medium' || preSecurityScan.warnings.length > 0) {
            return 'medium';
        }
        return 'low';
    }

    determineOverallStatus(preSecurityScan, postSecurityScan, integrityCheck, healthcareValidation) {
        if (!preSecurityScan.passed || !integrityCheck.passed || !healthcareValidation.passed) {
            return 'failed';
        }
        if (postSecurityScan.warnings.length > 0 || healthcareValidation.stats.dataQualityScore < 80) {
            return 'warning';
        }
        return 'passed';
    }

    generateRecommendations(validationData) {
        const recommendations = [];
        const { healthcareValidation, security, integrity } = validationData;

        if (healthcareValidation.stats.dataQualityScore < 70) {
            recommendations.push('Revisar qualidade dos dados antes da importação');
        }

        if (security.overallRisk === 'medium') {
            recommendations.push('Executar varredura adicional de segurança');
        }

        if (integrity.stats.corruptionIndicators.length > 0) {
            recommendations.push('Verificar integridade da fonte dos dados');
        }

        return recommendations;
    }

    generateNextSteps(validationData) {
        const steps = [];
        const { summary } = validationData;

        if (summary.status === 'passed') {
            steps.push('Arquivo aprovado para importação');
            steps.push('Prosseguir com processamento do banco de dados');
        } else if (summary.status === 'warning') {
            steps.push('Revisar avisos antes de continuar');
            steps.push('Confirmar se deseja prosseguir com importação');
        } else {
            steps.push('Arquivo rejeitado - não prosseguir com importação');
            steps.push('Corrigir problemas identificados e reenviar');
        }

        return steps;
    }

    /**
     * Get validation history
     */
    getValidationHistory(limit = 10) {
        const entries = Array.from(this.validationHistory.entries())
            .sort(([,a], [,b]) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);

        return entries.map(([id, report]) => ({
            validationId: id,
            filename: report.file.original.name,
            status: report.summary?.status || 'error',
            timestamp: report.timestamp,
            processingTime: report.processingTime
        }));
    }

    /**
     * Get quarantine queue
     */
    getQuarantineQueue() {
        return [...this.quarantineQueue];
    }

    /**
     * Clear quarantine queue
     */
    clearQuarantineQueue() {
        this.quarantineQueue.length = 0;
    }
}

// Export for use in other modules
window.FileValidationService = FileValidationService;