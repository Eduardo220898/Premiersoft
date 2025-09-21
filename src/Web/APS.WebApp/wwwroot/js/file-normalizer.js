/**
 * APS Healthcare Platform - File Normalization System
 * Detects and fixes potential file corruption issues before database processing
 */

class FileNormalizer {
    constructor() {
        this.validationRules = {
            csv: {
                maxFileSize: 50 * 1024 * 1024, // 50MB
                encoding: ['utf-8', 'iso-8859-1', 'windows-1252']
            },
            xml: {
                maxFileSize: 100 * 1024 * 1024, // 100MB
                encoding: ['utf-8', 'iso-8859-1']
            },  
            json: {
                maxFileSize: 50 * 1024 * 1024, // 50MB
                encoding: ['utf-8']
            },
            hl7: {
                maxFileSize: 10 * 1024 * 1024, // 10MB
                requiredSegments: ['MSH'],
                encoding: ['utf-8', 'ascii']
            },
            fhir: {
                maxFileSize: 50 * 1024 * 1024, // 50MB
                requiredFields: ['resourceType'],
                encoding: ['utf-8']
            }
        };

        // Real healthcare data structures from Tabelas directory
        this.healthcareSchemas = {
            medicos: {
                requiredFields: ['codigo', 'nome_completo', 'especialidade', 'cidade'],
                dataTypes: {
                    codigo: 'uuid',
                    nome_completo: 'string',
                    especialidade: 'string',
                    cidade: 'numeric_code'
                }
            },
            hospitais: {
                requiredFields: ['codigo', 'nome', 'cidade', 'bairro', 'leitos_totais'],
                optionalFields: ['especialidades'],
                dataTypes: {
                    codigo: 'uuid',
                    nome: 'string',
                    cidade: 'numeric_code',
                    bairro: 'string',
                    especialidades: 'semicolon_separated',
                    leitos_totais: 'integer'
                }
            },
            municipios: {
                requiredFields: ['codigo_ibge', 'nome', 'latitude', 'longitude', 'codigo_uf', 'populacao'],
                optionalFields: ['capital', 'siafi_id', 'ddd', 'fuso_horario'],
                dataTypes: {
                    codigo_ibge: 'integer',
                    nome: 'string',
                    latitude: 'decimal',
                    longitude: 'decimal',
                    capital: 'boolean',
                    codigo_uf: 'integer',
                    populacao: 'integer'
                }
            },
            estados: {
                requiredFields: ['codigo_uf', 'uf', 'nome', 'latitude', 'longitude', 'regiao'],
                dataTypes: {
                    codigo_uf: 'integer',
                    uf: 'string',
                    nome: 'string',
                    latitude: 'decimal',
                    longitude: 'decimal',
                    regiao: 'string'
                }
            },
            pacientes: {
                requiredFields: ['id', 'nome', 'cpf'],
                optionalFields: ['email', 'telefone', 'endereco', 'nascimento', 'sexo'],
                dataTypes: {
                    id: 'uuid',
                    nome: 'string',
                    cpf: 'cpf',
                    email: 'email',
                    telefone: 'phone',
                    nascimento: 'date'
                }
            }
        };

        this.commonIssues = {
            encoding: /[^\x00-\x7F\u00C0-\u017F\u0100-\u024F]/g, // Non-latin characters
            invisibleChars: /[\u200B-\u200D\uFEFF]/g, // Zero-width characters
            invalidXmlChars: /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, // Invalid XML characters
            sqlInjection: /(drop|delete|update|insert|select|union|script|javascript|vbscript)/gi,
            xssPatterns: /(<script|<iframe|<object|<embed|javascript:|vbscript:|on\w+\s*=)/gi
        };
    }

    /**
     * Main normalization function
     * @param {File} file - The uploaded file
     * @param {Function} progressCallback - Progress update callback
     * @returns {Promise<Object>} Normalized file data and validation results
     */
    async normalizeFile(file, progressCallback = () => {}) {
        try {
            progressCallback({ stage: 'validation', progress: 0, message: 'Iniciando validação...' });

            // Step 1: Basic file validation
            const basicValidation = await this.validateBasicProperties(file);
            if (!basicValidation.isValid) {
                throw new Error(`Validação básica falhou: ${basicValidation.errors.join(', ')}`);
            }
            progressCallback({ stage: 'validation', progress: 20, message: 'Validação básica concluída' });

            // Step 2: Read and detect encoding
            const fileContent = await this.readFileWithEncoding(file);
            progressCallback({ stage: 'encoding', progress: 40, message: 'Encoding detectado e corrigido' });

            // Step 3: Detect file type and healthcare data type
            const fileType = this.detectFileType(file, fileContent.content);
            const healthcareDataType = this.detectHealthcareDataType(file, fileContent.content);
            const structureValidation = await this.validateFileStructure(fileContent.content, fileType, healthcareDataType);
            if (!structureValidation.isValid) {
                console.warn('Problemas de estrutura detectados:', structureValidation.warnings);
            }
            progressCallback({ stage: 'structure', progress: 60, message: 'Estrutura validada' });

            // Step 4: Sanitize content
            const sanitizedContent = await this.sanitizeContent(fileContent.content, fileType);
            progressCallback({ stage: 'sanitization', progress: 80, message: 'Conteúdo sanitizado' });

            // Step 5: Normalize data format
            const normalizedData = await this.normalizeDataFormat(sanitizedContent, fileType);
            progressCallback({ stage: 'normalization', progress: 100, message: 'Normalização concluída' });

            return {
                success: true,
                originalFile: {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    lastModified: file.lastModified
                },
                normalized: {
                    content: normalizedData,
                    encoding: fileContent.encoding,
                    detectedType: fileType,
                    size: new Blob([normalizedData]).size
                },
                validation: {
                    basic: basicValidation,
                    structure: structureValidation,
                    issuesFound: this.getIssuesFound(fileContent.content, sanitizedContent),
                    corrections: this.getCorrections(fileContent.content, sanitizedContent)
                },
                metadata: {
                    processedAt: new Date().toISOString(),
                    processingTime: Date.now(),
                    checksums: {
                        original: await this.calculateChecksum(fileContent.content),
                        normalized: await this.calculateChecksum(normalizedData)
                    }
                }
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                originalFile: {
                    name: file.name,
                    size: file.size,
                    type: file.type
                }
            };
        }
    }

    /**
     * Validate basic file properties
     */
    async validateBasicProperties(file) {
        const errors = [];
        const warnings = [];

        // Check file size
        if (file.size === 0) {
            errors.push('Arquivo está vazio');
        }

        if (file.size > 100 * 1024 * 1024) { // 100MB
            errors.push('Arquivo muito grande (máximo 100MB)');
        }

        // Check file name
        if (!file.name || file.name.trim() === '') {
            errors.push('Nome do arquivo inválido');
        }

        // Check for dangerous file extensions
        const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.com', '.pif'];
        const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        if (dangerousExtensions.includes(fileExtension)) {
            errors.push('Tipo de arquivo não permitido');
        }

        // Check for suspicious file names
        const suspiciousPatterns = /[<>:"|?*]/;
        if (suspiciousPatterns.test(file.name)) {
            warnings.push('Nome do arquivo contém caracteres suspeitos');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Read file with proper encoding detection
     */
    async readFileWithEncoding(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    let content = e.target.result;
                    let encoding = 'utf-8';

                    // Try to detect encoding issues
                    if (this.hasEncodingIssues(content)) {
                        // Try different encodings
                        const encodings = ['utf-8', 'iso-8859-1', 'windows-1252'];
                        for (const enc of encodings) {
                            try {
                                const testReader = new FileReader();
                                const blob = new Blob([file], { type: 'text/plain;charset=' + enc });
                                const testContent = await this.readAsText(blob, enc);
                                
                                if (!this.hasEncodingIssues(testContent)) {
                                    content = testContent;
                                    encoding = enc;
                                    break;
                                }
                            } catch (err) {
                                console.warn(`Encoding ${enc} failed:`, err);
                            }
                        }
                    }

                    resolve({
                        content: this.fixEncodingIssues(content),
                        encoding: encoding,
                        originalSize: file.size
                    });
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('Erro ao ler o arquivo'));
            reader.readAsText(file, 'utf-8');
        });
    }

    /**
     * Helper function to read file as text with specific encoding
     */
    readAsText(blob, encoding) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Erro na leitura'));
            reader.readAsText(blob, encoding);
        });
    }

    /**
     * Detect if content has encoding issues
     */
    hasEncodingIssues(content) {
        // Check for common encoding issue indicators
        const issues = [
            /�/, // Replacement character
            /Ã[^a-zA-Z]/, // Common UTF-8 in ISO-8859-1 issue
            /[^\x00-\x7F][\x80-\xFF]/, // Mixed encoding patterns
        ];

        return issues.some(pattern => pattern.test(content));
    }

    /**
     * Fix common encoding issues
     */
    fixEncodingIssues(content) {
        // Remove or replace problematic characters
        content = content.replace(this.commonIssues.invisibleChars, '');
        content = content.replace(/\r\n/g, '\n'); // Normalize line endings
        content = content.replace(/\r/g, '\n');
        
        // Fix common UTF-8 encoding issues
        const encodingFixes = {
            'Ã¡': 'á', 'Ã ': 'à', 'Ã£': 'ã', 'Ã¢': 'â',
            'Ã©': 'é', 'Ã¨': 'è', 'Ãª': 'ê',
            'Ã­': 'í', 'Ã¬': 'ì', 'Ã®': 'î',
            'Ã³': 'ó', 'Ã²': 'ò', 'Ãµ': 'õ', 'Ã´': 'ô',
            'Ãº': 'ú', 'Ã¹': 'ù', 'Ã»': 'û',
            'Ã§': 'ç', 'Ã±': 'ñ'
        };

        for (const [wrong, correct] of Object.entries(encodingFixes)) {
            content = content.replace(new RegExp(wrong, 'g'), correct);
        }

        return content;
    }

    /**
     * Detect file type and healthcare data type based on content and structure
     */
    detectFileType(file, content) {
        const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.') + 1);
        const fileName = file.name.toLowerCase();
        
        // Check by extension first
        if (['csv', 'txt'].includes(extension)) {
            // Detect if it's actually CSV by checking for delimiters
            if (content.includes(',') || content.includes(';') || content.includes('\t')) {
                return 'csv';
            }
        }

        if (extension === 'xml' || content.trim().startsWith('<?xml')) {
            return 'xml';
        }

        if (extension === 'json' || (content.trim().startsWith('{') || content.trim().startsWith('['))) {
            return 'json';
        }

        if (extension === 'hl7' || content.includes('MSH|')) {
            return 'hl7';
        }

        // Check for FHIR (JSON-based)
        if (content.includes('"resourceType"') || content.includes('fhir')) {
            return 'fhir';
        }

        // Default fallback
        if (content.includes(',') || content.includes(';')) {
            return 'csv';
        }

        return 'unknown';
    }

    /**
     * Detect healthcare data type based on file name and structure
     */
    detectHealthcareDataType(file, content) {
        const fileName = file.name.toLowerCase();
        
        // Check filename patterns
        if (fileName.includes('medico') || fileName.includes('doctor')) {
            return 'medicos';
        }
        if (fileName.includes('hospital') || fileName.includes('clinic')) {
            return 'hospitais';
        }
        if (fileName.includes('municipio') || fileName.includes('cidade')) {
            return 'municipios';
        }
        if (fileName.includes('estado') || fileName.includes('uf')) {
            return 'estados';
        }
        if (fileName.includes('paciente') || fileName.includes('patient')) {
            return 'pacientes';
        }
        
        // Check content structure for CSV files
        if (content.includes(',')) {
            const firstLine = content.split('\n')[0].toLowerCase();
            
            if (firstLine.includes('codigo') && firstLine.includes('nome_completo') && firstLine.includes('especialidade')) {
                return 'medicos';
            }
            if (firstLine.includes('codigo') && firstLine.includes('nome') && firstLine.includes('leitos_totais')) {
                return 'hospitais';
            }
            if (firstLine.includes('codigo_ibge') && firstLine.includes('latitude') && firstLine.includes('longitude')) {
                return 'municipios';
            }
            if (firstLine.includes('codigo_uf') && firstLine.includes('uf') && firstLine.includes('regiao')) {
                return 'estados';
            }
            if (firstLine.includes('cpf') || firstLine.includes('paciente')) {
                return 'pacientes';
            }
        }
        
        return 'unknown';
    }

    /**
     * Validate file structure based on type and healthcare data type
     */
    async validateFileStructure(content, fileType, healthcareDataType = 'unknown') {
        const warnings = [];
        let isValid = true;

        try {
            switch (fileType) {
                case 'csv':
                    const csvValidation = this.validateCSVStructure(content, healthcareDataType);
                    return csvValidation;

                case 'xml':
                    const xmlValidation = this.validateXMLStructure(content);
                    return xmlValidation;

                case 'json':
                case 'fhir':
                    const jsonValidation = this.validateJSONStructure(content);
                    return jsonValidation;

                case 'hl7':
                    const hl7Validation = this.validateHL7Structure(content);
                    return hl7Validation;

                default:
                    warnings.push('Tipo de arquivo não reconhecido, validação limitada');
                    return { isValid: true, warnings, healthcareDataType };
            }
        } catch (error) {
            return {
                isValid: false,
                errors: [error.message],
                warnings,
                healthcareDataType
            };
        }
    }

    /**
     * Validate CSV structure with healthcare data validation
     */
    validateCSVStructure(content, healthcareDataType = 'unknown') {
        const lines = content.split('\n').filter(line => line.trim() !== '');
        const warnings = [];
        const errors = [];

        if (lines.length === 0) {
            errors.push('Arquivo CSV vazio');
            return { isValid: false, errors, warnings, healthcareDataType };
        }

        // Check header line
        const headerLine = lines[0];
        const delimiter = this.detectCSVDelimiter(headerLine);
        const headers = headerLine.split(delimiter).map(h => h.trim().toLowerCase());

        if (headers.length < 2) {
            warnings.push('CSV parece ter apenas uma coluna');
        }

        // Validate healthcare-specific schema
        if (healthcareDataType !== 'unknown' && this.healthcareSchemas[healthcareDataType]) {
            const schema = this.healthcareSchemas[healthcareDataType];
            const missingRequiredFields = [];
            
            // Check required fields
            schema.requiredFields.forEach(field => {
                if (!headers.includes(field.toLowerCase())) {
                    missingRequiredFields.push(field);
                }
            });

            if (missingRequiredFields.length > 0) {
                errors.push(`Campos obrigatórios ausentes para ${healthcareDataType}: ${missingRequiredFields.join(', ')}`);
            }

            // Validate data types in sample rows
            if (lines.length > 1) {
                const sampleSize = Math.min(10, lines.length - 1);
                for (let i = 1; i <= sampleSize; i++) {
                    const row = lines[i].split(delimiter);
                    const dataValidation = this.validateRowData(row, headers, schema, i);
                    if (dataValidation.errors.length > 0) {
                        errors.push(...dataValidation.errors);
                    }
                    if (dataValidation.warnings.length > 0) {
                        warnings.push(...dataValidation.warnings);
                    }
                }
            }
        }

        // Check for inconsistent column counts
        let expectedColumns = headers.length;
        const inconsistentLines = [];

        for (let i = 1; i < Math.min(lines.length, 100); i++) { // Check first 100 lines
            const columns = lines[i].split(delimiter);
            if (columns.length !== expectedColumns) {
                inconsistentLines.push(i + 1);
            }
        }

        if (inconsistentLines.length > 0) {
            warnings.push(`Linhas com número inconsistente de colunas: ${inconsistentLines.slice(0, 10).join(', ')}${inconsistentLines.length > 10 ? '...' : ''}`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            healthcareDataType,
            metadata: {
                totalLines: lines.length,
                headers: headers,
                delimiter: delimiter,
                estimatedColumns: expectedColumns
            }
        };
    }

    /**
     * Validate individual row data against healthcare schema
     */
    validateRowData(row, headers, schema, lineNumber) {
        const errors = [];
        const warnings = [];

        headers.forEach((header, index) => {
            const value = row[index] ? row[index].trim() : '';
            const dataType = schema.dataTypes ? schema.dataTypes[header] : null;

            if (dataType && value) {
                const validation = this.validateDataType(value, dataType, header, lineNumber);
                if (!validation.isValid) {
                    if (validation.severity === 'error') {
                        errors.push(validation.message);
                    } else {
                        warnings.push(validation.message);
                    }
                }
            }

            // Check for missing required fields
            if (schema.requiredFields.includes(header) && !value) {
                errors.push(`Linha ${lineNumber}: Campo obrigatório '${header}' está vazio`);
            }
        });

        return { errors, warnings };
    }

    /**
     * Validate data type of individual field
     */
    validateDataType(value, dataType, fieldName, lineNumber) {
        switch (dataType) {
            case 'uuid':
                const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (!uuidPattern.test(value)) {
                    return {
                        isValid: false,
                        severity: 'error',
                        message: `Linha ${lineNumber}: ${fieldName} deve ser um UUID válido: ${value}`
                    };
                }
                break;

            case 'cpf':
                const cpfPattern = /^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/;
                if (!cpfPattern.test(value.replace(/\D/g, ''))) {
                    return {
                        isValid: false,
                        severity: 'warning',
                        message: `Linha ${lineNumber}: CPF em formato inválido: ${value}`
                    };
                }
                break;

            case 'email':
                const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailPattern.test(value)) {
                    return {
                        isValid: false,
                        severity: 'warning',
                        message: `Linha ${lineNumber}: Email em formato inválido: ${value}`
                    };
                }
                break;

            case 'phone':
                const phoneDigits = value.replace(/\D/g, '');
                if (phoneDigits.length < 10 || phoneDigits.length > 11) {
                    return {
                        isValid: false,
                        severity: 'warning',
                        message: `Linha ${lineNumber}: Telefone em formato inválido: ${value}`
                    };
                }
                break;

            case 'integer':
                if (!/^-?\d+$/.test(value)) {
                    return {
                        isValid: false,
                        severity: 'error',
                        message: `Linha ${lineNumber}: ${fieldName} deve ser um número inteiro: ${value}`
                    };
                }
                break;

            case 'decimal':
                if (!/^-?\d*\.?\d+$/.test(value)) {
                    return {
                        isValid: false,
                        severity: 'error',
                        message: `Linha ${lineNumber}: ${fieldName} deve ser um número decimal: ${value}`
                    };
                }
                break;

            case 'boolean':
                if (!['0', '1', 'true', 'false', 'sim', 'não', 'yes', 'no'].includes(value.toLowerCase())) {
                    return {
                        isValid: false,
                        severity: 'warning',
                        message: `Linha ${lineNumber}: ${fieldName} deve ser um valor booleano: ${value}`
                    };
                }
                break;

            case 'date':
                const datePatterns = [
                    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
                    /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
                    /^\d{2}-\d{2}-\d{4}$/ // DD-MM-YYYY
                ];
                if (!datePatterns.some(pattern => pattern.test(value))) {
                    return {
                        isValid: false,
                        severity: 'warning',
                        message: `Linha ${lineNumber}: Data em formato inválido: ${value}`
                    };
                }
                break;

            case 'numeric_code':
                if (!/^\d+$/.test(value)) {
                    return {
                        isValid: false,
                        severity: 'error',
                        message: `Linha ${lineNumber}: Código numérico inválido: ${value}`
                    };
                }
                break;

            case 'semicolon_separated':
                // Validate that it's a proper semicolon-separated list
                if (value.includes(';') && value.split(';').some(item => item.trim() === '')) {
                    return {
                        isValid: false,
                        severity: 'warning',
                        message: `Linha ${lineNumber}: Lista separada por ponto-e-vírgula contém itens vazios: ${value}`
                    };
                }
                break;
        }

        return { isValid: true };
    }

    /**
     * Validate XML structure
     */
    validateXMLStructure(content) {
        const warnings = [];
        const errors = [];

        try {
            // Basic XML validation
            if (!content.trim().startsWith('<?xml') && !content.trim().startsWith('<')) {
                errors.push('Conteúdo não parece ser XML válido');
            }

            // Check for balanced tags (simplified)
            const openTags = (content.match(/<[^\/][^>]*>/g) || []).length;
            const closeTags = (content.match(/<\/[^>]*>/g) || []).length;
            const selfClosingTags = (content.match(/<[^>]*\/>/g) || []).length;

            if (openTags !== closeTags + selfClosingTags) {
                warnings.push('Tags XML podem não estar balanceadas');
            }

            // Check for invalid XML characters
            const invalidChars = content.match(this.commonIssues.invalidXmlChars);
            if (invalidChars) {
                warnings.push('Caracteres inválidos para XML detectados');
            }

            return {
                isValid: errors.length === 0,
                errors,
                warnings,
                metadata: {
                    hasXmlDeclaration: content.trim().startsWith('<?xml'),
                    estimatedTags: openTags,
                    selfClosingTags: selfClosingTags
                }
            };

        } catch (error) {
            return {
                isValid: false,
                errors: ['Erro na validação XML: ' + error.message],
                warnings
            };
        }
    }

    /**
     * Validate JSON structure
     */
    validateJSONStructure(content) {
        const warnings = [];
        const errors = [];

        try {
            const parsed = JSON.parse(content);
            
            // Check if it's an array or object
            if (typeof parsed !== 'object') {
                warnings.push('JSON deve ser um objeto ou array');
            }

            return {
                isValid: true,
                errors,
                warnings,
                metadata: {
                    type: Array.isArray(parsed) ? 'array' : 'object',
                    estimatedSize: Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length
                }
            };

        } catch (error) {
            // Try to fix common JSON issues
            let fixedContent = this.fixCommonJSONIssues(content);
            try {
                JSON.parse(fixedContent);
                warnings.push('JSON teve problemas de sintaxe que foram corrigidos automaticamente');
                return {
                    isValid: true,
                    errors,
                    warnings,
                    fixedContent: fixedContent
                };
            } catch (secondError) {
                return {
                    isValid: false,
                    errors: ['JSON inválido: ' + error.message],
                    warnings
                };
            }
        }
    }

    /**
     * Validate HL7 structure
     */
    validateHL7Structure(content) {
        const warnings = [];
        const errors = [];
        const lines = content.split('\n').filter(line => line.trim() !== '');

        if (lines.length === 0) {
            errors.push('Arquivo HL7 vazio');
            return { isValid: false, errors, warnings };
        }

        // Check for MSH segment (required)
        const hasMSH = lines.some(line => line.startsWith('MSH|'));
        if (!hasMSH) {
            errors.push('Segmento MSH (Message Header) obrigatório não encontrado');
        }

        // Check segment structure
        const invalidSegments = [];
        lines.forEach((line, index) => {
            if (line.length > 0 && !line.match(/^[A-Z]{2,3}\|/)) {
                invalidSegments.push(index + 1);
            }
        });

        if (invalidSegments.length > 0) {
            warnings.push(`Linhas com formato de segmento inválido: ${invalidSegments.slice(0, 5).join(', ')}`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            metadata: {
                totalSegments: lines.length,
                hasRequiredMSH: hasMSH,
                segmentTypes: [...new Set(lines.map(line => line.substring(0, 3)))]
            }
        };
    }

    /**
     * Sanitize content to prevent security issues
     */
    async sanitizeContent(content, fileType) {
        // Remove potential SQL injection patterns
        content = content.replace(this.commonIssues.sqlInjection, '[FILTERED]');
        
        // Remove potential XSS patterns
        content = content.replace(this.commonIssues.xssPatterns, '[FILTERED]');
        
        // Remove invisible/zero-width characters
        content = content.replace(this.commonIssues.invisibleChars, '');
        
        // Type-specific sanitization
        switch (fileType) {
            case 'xml':
                // Remove invalid XML characters
                content = content.replace(this.commonIssues.invalidXmlChars, '');
                break;
                
            case 'csv':
                // Escape potentially dangerous CSV content
                content = this.sanitizeCSVContent(content);
                break;
                
            case 'json':
            case 'fhir':
                // Validate and sanitize JSON
                content = this.sanitizeJSONContent(content);
                break;
        }

        return content;
    }

    /**
     * Sanitize CSV content
     */
    sanitizeCSVContent(content) {
        const lines = content.split('\n');
        const sanitizedLines = lines.map(line => {
            // Remove cells that start with =, +, -, @ (potential formula injection)
            return line.replace(/^[=+\-@]/, "'$&");
        });
        
        return sanitizedLines.join('\n');
    }

    /**
     * Sanitize JSON content
     */
    sanitizeJSONContent(content) {
        try {
            const parsed = JSON.parse(content);
            const sanitized = this.sanitizeJSONObject(parsed);
            return JSON.stringify(sanitized, null, 2);
        } catch (error) {
            // If parsing fails, return sanitized string
            return content.replace(this.commonIssues.xssPatterns, '[FILTERED]');
        }
    }

    /**
     * Recursively sanitize JSON object
     */
    sanitizeJSONObject(obj) {
        if (typeof obj === 'string') {
            return obj.replace(this.commonIssues.xssPatterns, '[FILTERED]')
                     .replace(this.commonIssues.sqlInjection, '[FILTERED]');
        }
        
        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeJSONObject(item));
        }
        
        if (typeof obj === 'object' && obj !== null) {
            const sanitized = {};
            for (const [key, value] of Object.entries(obj)) {
                const cleanKey = key.replace(this.commonIssues.xssPatterns, '[FILTERED]');
                sanitized[cleanKey] = this.sanitizeJSONObject(value);
            }
            return sanitized;
        }
        
        return obj;
    }

    /**
     * Normalize data format for database compatibility
     */
    async normalizeDataFormat(content, fileType) {
        switch (fileType) {
            case 'csv':
                return this.normalizeCSVFormat(content);
            case 'xml':
                return this.normalizeXMLFormat(content);
            case 'json':
            case 'fhir':
                return this.normalizeJSONFormat(content);
            case 'hl7':
                return this.normalizeHL7Format(content);
            default:
                return content;
        }
    }

    /**
     * Normalize CSV format
     */
    normalizeCSVFormat(content) {
        const lines = content.split('\n');
        const delimiter = this.detectCSVDelimiter(lines[0]);
        
        const normalizedLines = lines.map((line, index) => {
            if (line.trim() === '') return '';
            
            const columns = line.split(delimiter);
            const normalizedColumns = columns.map(col => {
                // Trim whitespace
                col = col.trim();
                
                // Remove quotes if present
                if ((col.startsWith('"') && col.endsWith('"')) || 
                    (col.startsWith("'") && col.endsWith("'"))) {
                    col = col.slice(1, -1);
                }
                
                // Normalize dates
                col = this.normalizeDateString(col);
                
                // Normalize phone numbers
                col = this.normalizePhoneNumber(col);
                
                // Normalize CPF/CNPJ
                col = this.normalizeCPFCNPJ(col);
                
                return col;
            });
            
            return normalizedColumns.join(',');
        });
        
        return normalizedLines.join('\n');
    }

    /**
     * Normalize XML format
     */
    normalizeXMLFormat(content) {
        // Basic XML normalization
        content = content.replace(/>\s+</g, '><'); // Remove whitespace between tags
        content = content.replace(/\s+/g, ' '); // Normalize whitespace
        return content.trim();
    }

    /**
     * Normalize JSON format
     */
    normalizeJSONFormat(content) {
        try {
            const parsed = JSON.parse(content);
            const normalized = this.normalizeJSONObject(parsed);
            return JSON.stringify(normalized, null, 2);
        } catch (error) {
            return content;
        }
    }

    /**
     * Normalize HL7 format
     */
    normalizeHL7Format(content) {
        const lines = content.split('\n');
        const normalizedLines = lines.map(line => {
            if (line.trim() === '') return '';
            
            // HL7 segments should end with \r
            if (!line.endsWith('\r')) {
                line += '\r';
            }
            
            return line;
        });
        
        return normalizedLines.join('\n');
    }

    /**
     * Normalize JSON object recursively
     */
    normalizeJSONObject(obj) {
        if (Array.isArray(obj)) {
            return obj.map(item => this.normalizeJSONObject(item));
        }
        
        if (typeof obj === 'object' && obj !== null) {
            const normalized = {};
            for (const [key, value] of Object.entries(obj)) {
                let normalizedValue = value;
                
                if (typeof value === 'string') {
                    normalizedValue = this.normalizeDateString(value);
                    normalizedValue = this.normalizePhoneNumber(normalizedValue);
                    normalizedValue = this.normalizeCPFCNPJ(normalizedValue);
                } else if (typeof value === 'object') {
                    normalizedValue = this.normalizeJSONObject(value);
                }
                
                normalized[key] = normalizedValue;
            }
            return normalized;
        }
        
        return obj;
    }

    /**
     * Helper functions for data normalization
     */
    detectCSVDelimiter(line) {
        const delimiters = [',', ';', '\t', '|'];
        let maxCount = 0;
        let bestDelimiter = ',';
        
        delimiters.forEach(delimiter => {
            const count = (line.match(new RegExp('\\' + delimiter, 'g')) || []).length;
            if (count > maxCount) {
                maxCount = count;
                bestDelimiter = delimiter;
            }
        });
        
        return bestDelimiter;
    }

    normalizeDateString(str) {
        // Try to detect and normalize date formats
        const datePatterns = [
            /(\d{2})\/(\d{2})\/(\d{4})/g, // DD/MM/YYYY
            /(\d{4})-(\d{2})-(\d{2})/g,   // YYYY-MM-DD
            /(\d{2})-(\d{2})-(\d{4})/g    // DD-MM-YYYY
        ];
        
        datePatterns.forEach(pattern => {
            str = str.replace(pattern, (match, p1, p2, p3) => {
                // Convert to ISO format (YYYY-MM-DD)
                if (match.includes('/')) {
                    return `${p3}-${p2}-${p1}`; // DD/MM/YYYY to YYYY-MM-DD
                }
                return match;
            });
        });
        
        return str;
    }

    normalizePhoneNumber(str) {
        // Remove all non-digits and format Brazilian phone numbers
        const digitsOnly = str.replace(/\D/g, '');
        if (digitsOnly.length === 10 || digitsOnly.length === 11) {
            if (digitsOnly.length === 11) {
                return `(${digitsOnly.substring(0, 2)}) ${digitsOnly.substring(2, 7)}-${digitsOnly.substring(7)}`;
            } else {
                return `(${digitsOnly.substring(0, 2)}) ${digitsOnly.substring(2, 6)}-${digitsOnly.substring(6)}`;
            }
        }
        return str;
    }

    normalizeCPFCNPJ(str) {
        const digitsOnly = str.replace(/\D/g, '');
        if (digitsOnly.length === 11) {
            // CPF format: XXX.XXX.XXX-XX
            return `${digitsOnly.substring(0, 3)}.${digitsOnly.substring(3, 6)}.${digitsOnly.substring(6, 9)}-${digitsOnly.substring(9)}`;
        } else if (digitsOnly.length === 14) {
            // CNPJ format: XX.XXX.XXX/XXXX-XX
            return `${digitsOnly.substring(0, 2)}.${digitsOnly.substring(2, 5)}.${digitsOnly.substring(5, 8)}/${digitsOnly.substring(8, 12)}-${digitsOnly.substring(12)}`;
        }
        return str;
    }

    fixCommonJSONIssues(content) {
        // Fix trailing commas
        content = content.replace(/,(\s*[}\]])/g, '$1');
        
        // Fix unquoted keys
        content = content.replace(/(\w+)(\s*:)/g, '"$1"$2');
        
        // Fix single quotes to double quotes
        content = content.replace(/'/g, '"');
        
        return content;
    }

    getIssuesFound(original, sanitized) {
        const issues = [];
        
        if (original.length !== sanitized.length) {
            issues.push('Caracteres problemáticos removidos');
        }
        
        if (this.commonIssues.sqlInjection.test(original)) {
            issues.push('Possível injeção SQL detectada e neutralizada');
        }
        
        if (this.commonIssues.xssPatterns.test(original)) {
            issues.push('Possível XSS detectado e neutralizado');
        }
        
        if (this.hasEncodingIssues(original)) {
            issues.push('Problemas de encoding corrigidos');
        }
        
        return issues;
    }

    getCorrections(original, sanitized) {
        const corrections = [];
        
        const originalSize = original.length;
        const sanitizedSize = sanitized.length;
        
        if (originalSize !== sanitizedSize) {
            corrections.push(`Tamanho do arquivo alterado: ${originalSize} → ${sanitizedSize} caracteres`);
        }
        
        return corrections;
    }

    async calculateChecksum(content) {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
}

// Export for use in other modules
window.FileNormalizer = FileNormalizer;