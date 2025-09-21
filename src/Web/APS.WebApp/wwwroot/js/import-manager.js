// ===== IMPORT MANAGER - Sistema APS =====

class ImportManager {
    constructor() {
        this.uploadQueue = [];
        this.currentUploads = new Map();
        this.duplicateQueue = [];
        this.importHistory = [];
        
        this.initializeEventListeners();
        this.loadImportHistory();
    }

    // ===== INICIALIZAÇÃO =====
    initializeEventListeners() {
        // File input e dropzone
        const fileInput = document.getElementById('file-input');
        const dropzone = document.getElementById('dropzone');

        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        if (dropzone) {
            // Drag and drop eventos
            dropzone.addEventListener('dragover', (e) => this.handleDragOver(e));
            dropzone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            dropzone.addEventListener('drop', (e) => this.handleDrop(e));
            dropzone.addEventListener('click', () => fileInput?.click());
        }

        // Botões de ação
        document.getElementById('clear-queue-btn')?.addEventListener('click', () => this.clearQueue());
        document.getElementById('refresh-results')?.addEventListener('click', () => this.refreshResults());
        
        // Modais
        document.getElementById('clear-history')?.addEventListener('click', () => this.clearHistory());
        document.getElementById('skip-duplicates')?.addEventListener('click', () => this.skipDuplicates());
        document.getElementById('resolve-duplicates')?.addEventListener('click', () => this.resolveDuplicates());
    }

    // ===== DRAG AND DROP =====
    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('dropzone').classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('dropzone').classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('dropzone').classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        this.processFiles(files);
    }

    // ===== FILE HANDLING =====
    handleFileSelect(e) {
        const files = e.target.files;
        this.processFiles(files);
        // Limpar input para permitir re-upload do mesmo arquivo
        e.target.value = '';
    }

    async processFiles(files) {
        const validFiles = [];
        const invalidFiles = [];

        // Validar arquivos de forma assíncrona
        const validationPromises = Array.from(files).map(async (file) => {
            const isValid = await this.validateFile(file);
            if (isValid) {
                validFiles.push(file);
            } else {
                invalidFiles.push(file);
            }
        });

        await Promise.all(validationPromises);

        // Mostrar erros para arquivos inválidos
        if (invalidFiles.length > 0) {
            this.showNotification(
                `${invalidFiles.length} arquivo(s) inválido(s): ${invalidFiles.map(f => f.name).join(', ')}`,
                'error'
            );
        }

        // Adicionar arquivos válidos à fila
        validFiles.forEach(file => this.addToQueue(file));
        
        if (validFiles.length > 0) {
            this.updateQueueDisplay();
            this.startProcessing();
        }
    }

    async validateFile(file) {
        // Usar API Mock se disponível
        if (window.healthcareAPI) {
            try {
                const result = await window.healthcareAPI.processHealthcareFile(file);
                return result.success;
            } catch (error) {
                console.error('Erro na validação via API Mock:', error);
            }
        }
        
        // Validação local como fallback
        // Validar tamanho (máx 50MB)
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
            return false;
        }

        // Validar extensões
        const allowedExtensions = ['.xml', '.json', '.hl7', '.txt'];
        const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        
        return allowedExtensions.includes(extension);
    }

    // ===== QUEUE MANAGEMENT =====
    addToQueue(file) {
        const uploadItem = {
            id: this.generateId(),
            file: file,
            name: file.name,
            size: file.size,
            type: this.detectFileType(file.name),
            status: 'pending',
            progress: 0,
            startTime: null,
            endTime: null,
            result: null,
            duplicates: []
        };

        this.uploadQueue.push(uploadItem);
        return uploadItem;
    }

    detectFileType(filename) {
        const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
        const typeMap = {
            '.xml': 'XML',
            '.json': 'JSON',
            '.hl7': 'HL7',
            '.txt': 'HL7' // Assumir HL7 para arquivos .txt
        };
        return typeMap[extension] || 'Unknown';
    }

    clearQueue() {
        // Cancelar uploads em andamento
        this.uploadQueue.forEach(item => {
            if (item.status === 'processing') {
                this.cancelUpload(item.id);
            }
        });

        this.uploadQueue = [];
        this.updateQueueDisplay();
        this.updateQueueStats();
    }

    // ===== PROCESSING =====
    async startProcessing() {
        const pendingItems = this.uploadQueue.filter(item => item.status === 'pending');
        
        // Processar até 3 arquivos simultaneamente
        const maxConcurrent = 3;
        const processing = Math.min(pendingItems.length, maxConcurrent);
        
        for (let i = 0; i < processing; i++) {
            if (pendingItems[i]) {
                this.processFile(pendingItems[i]);
            }
        }
    }

    async processFile(uploadItem) {
        try {
            uploadItem.status = 'processing';
            uploadItem.startTime = new Date();
            
            this.updateUploadItemDisplay(uploadItem);
            this.updateQueueStats();

            // Simular upload com progress
            await this.simulateUpload(uploadItem);

            // Processar arquivo (mock API call)
            const result = await this.callProcessingAPI(uploadItem);
            
            uploadItem.result = result;
            uploadItem.endTime = new Date();

            // Verificar duplicatas
            if (result.duplicates && result.duplicates.length > 0) {
                uploadItem.duplicates = result.duplicates;
                uploadItem.status = 'has_duplicates';
                this.duplicateQueue.push(uploadItem);
                this.showDuplicateModal();
            } else {
                uploadItem.status = 'completed';
                this.addToHistory(uploadItem);
            }

            this.updateUploadItemDisplay(uploadItem);
            this.updateQueueStats();
            this.updateResults(result);

            // Continuar processando próximo item
            this.processNextInQueue();

        } catch (error) {
            uploadItem.status = 'error';
            uploadItem.error = error.message;
            uploadItem.endTime = new Date();
            
            this.updateUploadItemDisplay(uploadItem);
            this.updateQueueStats();
            this.showNotification(`Erro ao processar ${uploadItem.name}: ${error.message}`, 'error');
        }
    }

    async simulateUpload(uploadItem) {
        return new Promise((resolve) => {
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 20;
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(interval);
                    resolve();
                }
                uploadItem.progress = progress;
                this.updateUploadItemDisplay(uploadItem);
            }, 200);
        });
    }

    async callProcessingAPI(uploadItem) {
        // Usar API Mock enquanto o backend não está implementado
        if (window.healthcareAPI) {
            const result = await window.healthcareAPI.processFile(uploadItem.id, uploadItem.dataType);
            return result.result;
        }
        
        // Fallback para mock local se a API Mock não estiver disponível
        return new Promise((resolve) => {
            setTimeout(() => {
                const mockResult = this.generateMockResult(uploadItem);
                resolve(mockResult);
            }, 1000 + Math.random() * 2000);
        });
    }

    generateMockResult(uploadItem) {
        const baseRecords = Math.floor(Math.random() * 1000) + 100;
        const duplicateChance = Math.random();
        
        const result = {
            totalRecords: baseRecords,
            newPatients: Math.floor(baseRecords * 0.6),
            newDoctors: Math.floor(baseRecords * 0.1),
            newHospitals: Math.floor(baseRecords * 0.05),
            errors: Math.floor(Math.random() * 5),
            duplicates: []
        };

        // 30% de chance de ter duplicatas
        if (duplicateChance > 0.7) {
            result.duplicates = this.generateMockDuplicates();
        }

        return result;
    }

    generateMockDuplicates() {
        const duplicates = [];
        const count = Math.floor(Math.random() * 5) + 1;

        for (let i = 0; i < count; i++) {
            duplicates.push({
                type: Math.random() > 0.5 ? 'patient' : 'doctor',
                existing: this.generateMockRecord('existing'),
                new: this.generateMockRecord('new'),
                confidence: Math.floor(Math.random() * 30) + 70 // 70-100%
            });
        }

        return duplicates;
    }

    generateMockRecord(type) {
        if (type === 'existing') {
            return {
                id: Math.floor(Math.random() * 10000),
                name: 'Dr. João Silva',
                cpf: '123.456.789-00',
                email: 'joao.silva@email.com',
                phone: '(11) 99999-9999',
                specialty: 'Cardiologia',
                crm: 'CRM/SP 123456'
            };
        } else {
            return {
                name: 'João da Silva',
                cpf: '123.456.789-00',
                email: 'j.silva@hospital.com',
                phone: '(11) 88888-8888',
                specialty: 'Cardiologia',
                crm: 'CRM/SP 123456'
            };
        }
    }

    processNextInQueue() {
        const nextPending = this.uploadQueue.find(item => item.status === 'pending');
        if (nextPending) {
            const processingCount = this.uploadQueue.filter(item => item.status === 'processing').length;
            if (processingCount < 3) {
                this.processFile(nextPending);
            }
        }
    }

    // ===== UI UPDATES =====
    updateQueueDisplay() {
        const queueContainer = document.getElementById('upload-queue');
        const emptyQueue = queueContainer.querySelector('.empty-queue');

        if (this.uploadQueue.length === 0) {
            if (emptyQueue) emptyQueue.style.display = 'block';
            return;
        }

        if (emptyQueue) emptyQueue.style.display = 'none';

        // Remover itens existentes (exceto empty-queue)
        queueContainer.querySelectorAll('.upload-item').forEach(item => item.remove());

        // Adicionar novos itens
        this.uploadQueue.forEach(uploadItem => {
            const itemElement = this.createUploadItemElement(uploadItem);
            queueContainer.appendChild(itemElement);
        });
    }

    createUploadItemElement(uploadItem) {
        const item = document.createElement('div');
        item.className = `upload-item ${uploadItem.status}`;
        item.setAttribute('data-id', uploadItem.id);

        const statusIcon = this.getStatusIcon(uploadItem.status);
        const statusText = this.getStatusText(uploadItem.status);
        const progressBar = uploadItem.status === 'processing' ? 
            `<div class="upload-progress">
                <div class="upload-progress-bar" style="width: ${uploadItem.progress}%"></div>
            </div>` : '';

        item.innerHTML = `
            <div class="upload-item-header">
                <div class="upload-item-name">
                    <i class="${statusIcon} me-2"></i>
                    ${uploadItem.name}
                </div>
                <div class="upload-item-size">${this.formatFileSize(uploadItem.size)}</div>
            </div>
            ${progressBar}
            <div class="upload-item-status">
                <span class="status-text">
                    <span class="badge bg-${this.getStatusColor(uploadItem.status)}">${uploadItem.type}</span>
                    ${statusText}
                </span>
                <div class="upload-item-actions">
                    ${this.getActionButtons(uploadItem)}
                </div>
            </div>
        `;

        return item;
    }

    updateUploadItemDisplay(uploadItem) {
        const itemElement = document.querySelector(`[data-id="${uploadItem.id}"]`);
        if (itemElement) {
            itemElement.className = `upload-item ${uploadItem.status}`;
            
            // Atualizar ícone de status
            const statusIcon = itemElement.querySelector('.upload-item-name i');
            if (statusIcon) {
                statusIcon.className = `${this.getStatusIcon(uploadItem.status)} me-2`;
            }

            // Atualizar progress bar
            const progressBar = itemElement.querySelector('.upload-progress-bar');
            if (progressBar && uploadItem.status === 'processing') {
                progressBar.style.width = `${uploadItem.progress}%`;
            }

            // Atualizar texto de status
            const statusText = itemElement.querySelector('.status-text');
            if (statusText) {
                statusText.innerHTML = `
                    <span class="badge bg-${this.getStatusColor(uploadItem.status)}">${uploadItem.type}</span>
                    ${this.getStatusText(uploadItem.status)}
                `;
            }

            // Atualizar botões de ação
            const actions = itemElement.querySelector('.upload-item-actions');
            if (actions) {
                actions.innerHTML = this.getActionButtons(uploadItem);
            }
        }
    }

    updateQueueStats() {
        const pending = this.uploadQueue.filter(item => item.status === 'pending').length;
        const processing = this.uploadQueue.filter(item => item.status === 'processing').length;
        const completed = this.uploadQueue.filter(item => 
            item.status === 'completed' || item.status === 'has_duplicates'
        ).length;

        document.getElementById('queue-pending').textContent = pending;
        document.getElementById('queue-processing').textContent = processing;
        document.getElementById('queue-completed').textContent = completed;
    }

    updateResults(result) {
        if (!result) return;

        const totalRecords = document.getElementById('total-records');
        const newPatients = document.getElementById('new-patients');
        const newDoctors = document.getElementById('new-doctors');
        const duplicatesFound = document.getElementById('duplicates-found');

        if (totalRecords) {
            const current = parseInt(totalRecords.textContent) || 0;
            totalRecords.textContent = current + result.totalRecords;
        }

        if (newPatients) {
            const current = parseInt(newPatients.textContent) || 0;
            newPatients.textContent = current + result.newPatients;
        }

        if (newDoctors) {
            const current = parseInt(newDoctors.textContent) || 0;
            newDoctors.textContent = current + result.newDoctors;
        }

        if (duplicatesFound) {
            const current = parseInt(duplicatesFound.textContent) || 0;
            duplicatesFound.textContent = current + (result.duplicates ? result.duplicates.length : 0);
        }
    }

    // ===== UTILITY METHODS =====
    getStatusIcon(status) {
        const icons = {
            pending: 'fas fa-clock text-muted',
            processing: 'fas fa-spinner fa-spin text-warning',
            completed: 'fas fa-check-circle text-success',
            error: 'fas fa-exclamation-circle text-danger',
            has_duplicates: 'fas fa-exclamation-triangle text-warning'
        };
        return icons[status] || 'fas fa-file';
    }

    getStatusText(status) {
        const texts = {
            pending: 'Aguardando processamento',
            processing: 'Processando...',
            completed: 'Concluído com sucesso',
            error: 'Erro no processamento',
            has_duplicates: 'Duplicatas encontradas'
        };
        return texts[status] || 'Status desconhecido';
    }

    getStatusColor(status) {
        const colors = {
            pending: 'secondary',
            processing: 'warning',
            completed: 'success',
            error: 'danger',
            has_duplicates: 'warning'
        };
        return colors[status] || 'secondary';
    }

    getActionButtons(uploadItem) {
        switch (uploadItem.status) {
            case 'pending':
                return `<button class="btn btn-sm btn-outline-danger" onclick="importManager.removeFromQueue('${uploadItem.id}')">
                    <i class="fas fa-times"></i>
                </button>`;
            case 'processing':
                return `<button class="btn btn-sm btn-outline-warning" onclick="importManager.cancelUpload('${uploadItem.id}')">
                    <i class="fas fa-stop"></i>
                </button>`;
            case 'has_duplicates':
                return `<button class="btn btn-sm btn-outline-primary" onclick="importManager.showDuplicateDetails('${uploadItem.id}')">
                    <i class="fas fa-eye"></i>
                </button>`;
            case 'completed':
                return `<button class="btn btn-sm btn-outline-info" onclick="importManager.showProcessingDetails('${uploadItem.id}')">
                    <i class="fas fa-info"></i>
                </button>`;
            case 'error':
                return `<button class="btn btn-sm btn-outline-danger" onclick="importManager.retryUpload('${uploadItem.id}')">
                    <i class="fas fa-redo"></i>
                </button>`;
            default:
                return '';
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // ===== DUPLICATE HANDLING =====
    showDuplicateModal() {
        const modal = new bootstrap.Modal(document.getElementById('duplicateModal'));
        this.renderDuplicateList();
        modal.show();
    }

    renderDuplicateList() {
        const container = document.getElementById('duplicate-list');
        container.innerHTML = '';

        this.duplicateQueue.forEach(uploadItem => {
            uploadItem.duplicates.forEach((duplicate, index) => {
                const duplicateElement = this.createDuplicateElement(duplicate, uploadItem.id, index);
                container.appendChild(duplicateElement);
            });
        });
    }

    createDuplicateElement(duplicate, uploadId, index) {
        const element = document.createElement('div');
        element.className = 'duplicate-item';
        element.setAttribute('data-upload-id', uploadId);
        element.setAttribute('data-duplicate-index', index);

        const typeIcon = duplicate.type === 'patient' ? 'fas fa-user' : 'fas fa-user-md';
        const typeName = duplicate.type === 'patient' ? 'Paciente' : 'Médico';

        element.innerHTML = `
            <div class="duplicate-header">
                <div class="duplicate-type">
                    <i class="${typeIcon} me-2"></i>
                    ${typeName} - ${duplicate.confidence}% de similaridade
                </div>
            </div>
            <div class="duplicate-content">
                <div class="duplicate-comparison">
                    <div class="existing-record">
                        <div class="record-header">
                            <i class="fas fa-database"></i>
                            Registro Existente (ID: ${duplicate.existing.id})
                        </div>
                        ${this.renderRecordFields(duplicate.existing, duplicate.new)}
                    </div>
                    
                    <div class="duplicate-actions">
                        <button class="btn btn-outline-primary" onclick="importManager.selectDuplicateAction('${uploadId}', ${index}, 'keep_existing')">
                            <i class="fas fa-hand-paper me-1"></i>
                            Manter Existente
                        </button>
                        <button class="btn btn-outline-success" onclick="importManager.selectDuplicateAction('${uploadId}', ${index}, 'replace')">
                            <i class="fas fa-sync-alt me-1"></i>
                            Substituir
                        </button>
                        <button class="btn btn-outline-info" onclick="importManager.selectDuplicateAction('${uploadId}', ${index}, 'merge')">
                            <i class="fas fa-object-group me-1"></i>
                            Mesclar
                        </button>
                    </div>
                    
                    <div class="new-record">
                        <div class="record-header">
                            <i class="fas fa-file-import"></i>
                            Novo Registro
                        </div>
                        ${this.renderRecordFields(duplicate.new, duplicate.existing)}
                    </div>
                </div>
            </div>
        `;

        return element;
    }

    renderRecordFields(record, compareWith) {
        const fields = ['name', 'cpf', 'email', 'phone', 'specialty', 'crm'];
        let html = '';

        fields.forEach(field => {
            if (record[field]) {
                const isDifferent = compareWith && record[field] !== compareWith[field];
                const valueClass = isDifferent ? 'field-value different' : 'field-value';
                
                html += `
                    <div class="record-field">
                        <span class="field-label">${this.getFieldLabel(field)}:</span>
                        <span class="${valueClass}">${record[field]}</span>
                    </div>
                `;
            }
        });

        return html;
    }

    getFieldLabel(field) {
        const labels = {
            name: 'Nome',
            cpf: 'CPF',
            email: 'Email',
            phone: 'Telefone',
            specialty: 'Especialidade',
            crm: 'CRM'
        };
        return labels[field] || field;
    }

    selectDuplicateAction(uploadId, duplicateIndex, action) {
        const uploadItem = this.uploadQueue.find(item => item.id === uploadId);
        if (uploadItem && uploadItem.duplicates[duplicateIndex]) {
            uploadItem.duplicates[duplicateIndex].resolution = action;
            
            // Atualizar visual do botão selecionado
            const element = document.querySelector(`[data-upload-id="${uploadId}"][data-duplicate-index="${duplicateIndex}"]`);
            if (element) {
                element.querySelectorAll('.duplicate-actions .btn').forEach(btn => {
                    btn.classList.remove('btn-primary', 'btn-success', 'btn-info');
                    btn.classList.add('btn-outline-primary', 'btn-outline-success', 'btn-outline-info');
                });
                
                const selectedBtn = element.querySelector(`[onclick*="'${action}'"]`);
                if (selectedBtn) {
                    selectedBtn.classList.remove('btn-outline-primary', 'btn-outline-success', 'btn-outline-info');
                    const colorMap = { keep_existing: 'primary', replace: 'success', merge: 'info' };
                    selectedBtn.classList.add(`btn-${colorMap[action]}`);
                }
            }
        }
    }

    skipDuplicates() {
        this.duplicateQueue.forEach(uploadItem => {
            uploadItem.duplicates.forEach(duplicate => {
                duplicate.resolution = 'skip';
            });
        });
        
        this.processDuplicateResolutions();
        bootstrap.Modal.getInstance(document.getElementById('duplicateModal')).hide();
    }

    resolveDuplicates() {
        // Verificar se todas as duplicatas foram resolvidas
        let allResolved = true;
        this.duplicateQueue.forEach(uploadItem => {
            uploadItem.duplicates.forEach(duplicate => {
                if (!duplicate.resolution) {
                    allResolved = false;
                }
            });
        });

        if (!allResolved) {
            this.showNotification('Por favor, resolva todas as duplicatas antes de continuar.', 'warning');
            return;
        }

        this.processDuplicateResolutions();
        bootstrap.Modal.getInstance(document.getElementById('duplicateModal')).hide();
    }

    processDuplicateResolutions() {
        this.duplicateQueue.forEach(uploadItem => {
            uploadItem.status = 'completed';
            this.addToHistory(uploadItem);
            this.updateUploadItemDisplay(uploadItem);
        });

        this.duplicateQueue = [];
        this.updateQueueStats();
        this.showNotification('Duplicatas resolvidas com sucesso!', 'success');
    }

    // ===== HISTORY MANAGEMENT =====
    addToHistory(uploadItem) {
        const historyItem = {
            id: uploadItem.id,
            timestamp: new Date(),
            filename: uploadItem.name,
            type: uploadItem.type,
            size: uploadItem.size,
            status: uploadItem.status,
            result: uploadItem.result,
            duplicates: uploadItem.duplicates || [],
            processingTime: uploadItem.endTime - uploadItem.startTime
        };

        this.importHistory.unshift(historyItem);
        this.saveImportHistory();
    }

    loadImportHistory() {
        const saved = localStorage.getItem('aps-import-history');
        if (saved) {
            try {
                this.importHistory = JSON.parse(saved);
            } catch (e) {
                console.error('Erro ao carregar histórico:', e);
                this.importHistory = [];
            }
        }
    }

    saveImportHistory() {
        try {
            localStorage.setItem('aps-import-history', JSON.stringify(this.importHistory));
        } catch (e) {
            console.error('Erro ao salvar histórico:', e);
        }
    }

    clearHistory() {
        this.importHistory = [];
        this.saveImportHistory();
        this.showNotification('Histórico limpo com sucesso!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('importHistoryModal')).hide();
    }

    // ===== ACTIONS =====
    removeFromQueue(uploadId) {
        this.uploadQueue = this.uploadQueue.filter(item => item.id !== uploadId);
        this.updateQueueDisplay();
        this.updateQueueStats();
    }

    cancelUpload(uploadId) {
        const uploadItem = this.uploadQueue.find(item => item.id === uploadId);
        if (uploadItem) {
            uploadItem.status = 'cancelled';
            this.updateUploadItemDisplay(uploadItem);
            this.updateQueueStats();
        }
    }

    retryUpload(uploadId) {
        const uploadItem = this.uploadQueue.find(item => item.id === uploadId);
        if (uploadItem) {
            uploadItem.status = 'pending';
            uploadItem.progress = 0;
            uploadItem.error = null;
            this.updateUploadItemDisplay(uploadItem);
            this.updateQueueStats();
            this.startProcessing();
        }
    }

    showDuplicateDetails(uploadId) {
        const uploadItem = this.uploadQueue.find(item => item.id === uploadId);
        if (uploadItem && uploadItem.duplicates.length > 0) {
            this.duplicateQueue = [uploadItem];
            this.showDuplicateModal();
        }
    }

    showProcessingDetails(uploadId) {
        const uploadItem = this.uploadQueue.find(item => item.id === uploadId);
        if (uploadItem) {
            this.renderProcessingDetails(uploadItem);
            const modal = new bootstrap.Modal(document.getElementById('processingModal'));
            modal.show();
        }
    }

    renderProcessingDetails(uploadItem) {
        const container = document.getElementById('processing-details');
        const result = uploadItem.result;
        
        const steps = [
            { name: 'Upload do arquivo', status: 'completed', time: '2.3s' },
            { name: 'Validação do formato', status: 'completed', time: '0.5s' },
            { name: 'Processamento dos dados', status: 'completed', time: '15.2s' },
            { name: 'Detecção de duplicatas', status: 'completed', time: '3.1s' },
            { name: 'Inserção no banco', status: 'completed', time: '5.8s' }
        ];

        container.innerHTML = `
            <div class="processing-summary mb-4">
                <h6>Resumo do Processamento</h6>
                <div class="row">
                    <div class="col-md-6">
                        <strong>Arquivo:</strong> ${uploadItem.name}<br>
                        <strong>Tamanho:</strong> ${this.formatFileSize(uploadItem.size)}<br>
                        <strong>Tipo:</strong> ${uploadItem.type}
                    </div>
                    <div class="col-md-6">
                        <strong>Tempo total:</strong> ${this.formatDuration(uploadItem.processingTime)}<br>
                        <strong>Registros:</strong> ${result.totalRecords}<br>
                        <strong>Status:</strong> <span class="badge bg-success">Concluído</span>
                    </div>
                </div>
            </div>
            
            <div class="processing-steps">
                <h6>Etapas do Processamento</h6>
                ${steps.map(step => `
                    <div class="processing-step">
                        <div class="step-icon ${step.status}">
                            <i class="fas fa-${step.status === 'completed' ? 'check' : 'clock'}"></i>
                        </div>
                        <div class="step-content">
                            <div class="step-title">${step.name}</div>
                            <div class="step-time">${step.time}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="processing-results mt-4">
                <h6>Resultados</h6>
                <div class="row">
                    <div class="col-md-3">
                        <div class="text-center">
                            <div class="h4 text-primary">${result.totalRecords}</div>
                            <small>Total de registros</small>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="text-center">
                            <div class="h4 text-success">${result.newPatients}</div>
                            <small>Novos pacientes</small>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="text-center">
                            <div class="h4 text-info">${result.newDoctors}</div>
                            <small>Novos médicos</small>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="text-center">
                            <div class="h4 text-warning">${result.duplicates.length}</div>
                            <small>Duplicatas</small>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        if (minutes > 0) {
            return `${minutes}m ${remainingSeconds}s`;
        } else {
            return `${remainingSeconds}s`;
        }
    }

    refreshResults() {
        // Simular refresh dos dados
        this.showNotification('Resultados atualizados!', 'info');
    }

    // ===== NOTIFICATIONS =====
    showNotification(message, type = 'info') {
        // Usar o sistema de notificações existente do dashboard
        if (window.showAdvancedNotification) {
            window.showAdvancedNotification(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
}

// Inicializar o gerenciador de importação quando o dashboard carregar
let importManager;

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('imports-section')) {
        importManager = new ImportManager();
        console.log('✅ Import Manager inicializado');
    }
});