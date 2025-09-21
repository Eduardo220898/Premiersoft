/**
 * APS Healthcare Platform - Advanced Upload Handler
 * Handles secure file uploads with validation, normalization, and corruption detection
 */

class AdvancedUploadHandler {
    constructor() {
        this.validationService = new FileValidationService();
        this.uploadQueue = new Map();
        this.activeUploads = new Map();
        this.maxConcurrentUploads = 3;
        this.maxRetries = 3;
        
        this.config = {
            chunkSize: 1024 * 1024, // 1MB chunks
            allowedTypes: [
                'text/csv', 'text/plain', 'application/json',
                'text/xml', 'application/xml', 
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ],
            maxFileSize: 100 * 1024 * 1024, // 100MB
            endpoints: {
                upload: '/api/files/upload',
                validate: '/api/files/validate',
                process: '/api/files/process',
                status: '/api/files/status'
            }
        };

        this.initializeEventHandlers();
    }

    /**
     * Initialize event handlers for drag and drop and file input
     */
    initializeEventHandlers() {
        // Setup drag and drop zones
        const dropZones = document.querySelectorAll('.file-upload-zone');
        dropZones.forEach(zone => {
            this.setupDropZone(zone);
        });

        // Setup file input handlers
        const fileInputs = document.querySelectorAll('input[type="file"]');
        fileInputs.forEach(input => {
            input.addEventListener('change', (e) => this.handleFileInput(e));
        });
    }

    /**
     * Setup drag and drop functionality for a zone
     */
    setupDropZone(zone) {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.remove('drag-over');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.remove('drag-over');
            
            const files = Array.from(e.dataTransfer.files);
            this.handleMultipleFiles(files);
        });

        // Click to upload
        zone.addEventListener('click', () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.multiple = true;
            fileInput.accept = this.config.allowedTypes.join(',');
            fileInput.onchange = (e) => this.handleFileInput(e);
            fileInput.click();
        });
    }

    /**
     * Handle file input change event
     */
    handleFileInput(event) {
        const files = Array.from(event.target.files);
        this.handleMultipleFiles(files);
    }

    /**
     * Handle multiple file uploads
     */
    async handleMultipleFiles(files) {
        if (files.length === 0) return;

        // Pre-validate all files
        const validFiles = [];
        const invalidFiles = [];

        for (const file of files) {
            const preValidation = this.preValidateFile(file);
            if (preValidation.valid) {
                validFiles.push(file);
            } else {
                invalidFiles.push({ file, reasons: preValidation.reasons });
            }
        }

        // Show invalid files to user
        if (invalidFiles.length > 0) {
            this.showInvalidFilesDialog(invalidFiles);
        }

        // Process valid files
        if (validFiles.length > 0) {
            await this.processFileQueue(validFiles);
        }
    }

    /**
     * Pre-validate file before processing
     */
    preValidateFile(file) {
        const reasons = [];

        // Check file size
        if (file.size > this.config.maxFileSize) {
            reasons.push(`Arquivo muito grande (${this.formatFileSize(file.size)} > ${this.formatFileSize(this.config.maxFileSize)})`);
        }

        if (file.size === 0) {
            reasons.push('Arquivo vazio');
        }

        // Check file type
        if (!this.config.allowedTypes.includes(file.type) && file.type !== '') {
            reasons.push(`Tipo de arquivo não permitido: ${file.type}`);
        }

        // Check file name
        if (!file.name || file.name.trim() === '') {
            reasons.push('Nome do arquivo inválido');
        }

        // Check for dangerous extensions
        const extension = file.name.toLowerCase().split('.').pop();
        const dangerousExtensions = ['exe', 'bat', 'cmd', 'scr', 'com', 'pif', 'js', 'vbs'];
        if (dangerousExtensions.includes(extension)) {
            reasons.push(`Extensão perigosa: .${extension}`);
        }

        return {
            valid: reasons.length === 0,
            reasons
        };
    }

    /**
     * Process queue of valid files
     */
    async processFileQueue(files) {
        // Add files to upload queue
        files.forEach(file => {
            const uploadId = this.generateUploadId();
            this.uploadQueue.set(uploadId, {
                file,
                uploadId,
                status: 'queued',
                createdAt: new Date(),
                retryCount: 0
            });
        });

        // Update UI
        this.updateUploadQueueUI();

        // Start processing queue
        await this.processQueue();
    }

    /**
     * Process the upload queue
     */
    async processQueue() {
        while (this.uploadQueue.size > 0 && this.activeUploads.size < this.maxConcurrentUploads) {
            const [uploadId, uploadItem] = this.uploadQueue.entries().next().value;
            this.uploadQueue.delete(uploadId);
            this.activeUploads.set(uploadId, uploadItem);

            // Start upload process
            this.processUpload(uploadId, uploadItem);
        }
    }

    /**
     * Process individual upload
     */
    async processUpload(uploadId, uploadItem) {
        try {
            // Update status
            uploadItem.status = 'validating';
            this.updateUploadItemUI(uploadId, uploadItem);

            // Step 1: Comprehensive validation
            const validationResult = await this.validationService.validateFile(uploadItem.file, {
                strictMode: false,
                allowQuarantine: true,
                performDeepScan: true
            });

            if (!validationResult.success) {
                throw new Error(`Validação falhou: ${validationResult.error.message}`);
            }

            // Step 2: Check if file needs quarantine
            if (validationResult.quarantine?.required) {
                uploadItem.status = 'quarantined';
                uploadItem.quarantineReason = validationResult.quarantine.reason;
                this.updateUploadItemUI(uploadId, uploadItem);
                this.showQuarantineDialog(uploadId, uploadItem, validationResult);
                return;
            }

            // Step 3: Upload normalized file
            uploadItem.status = 'uploading';
            uploadItem.validationResult = validationResult;
            this.updateUploadItemUI(uploadId, uploadItem);

            const uploadResult = await this.uploadNormalizedFile(uploadId, uploadItem, validationResult);

            if (!uploadResult.success) {
                throw new Error(`Upload falhou: ${uploadResult.error}`);
            }

            // Step 4: Process in backend
            uploadItem.status = 'processing';
            uploadItem.uploadResult = uploadResult;
            this.updateUploadItemUI(uploadId, uploadItem);

            const processResult = await this.processInBackend(uploadId, uploadItem, uploadResult);

            // Step 5: Complete
            uploadItem.status = processResult.success ? 'completed' : 'failed';
            uploadItem.processResult = processResult;
            uploadItem.completedAt = new Date();
            this.updateUploadItemUI(uploadId, uploadItem);

            if (processResult.success) {
                this.showSuccessNotification(uploadItem);
            } else {
                throw new Error(`Processamento falhou: ${processResult.error}`);
            }

        } catch (error) {
            // Handle upload failure
            uploadItem.status = 'failed';
            uploadItem.error = error.message;
            uploadItem.failedAt = new Date();
            this.updateUploadItemUI(uploadId, uploadItem);

            // Retry logic
            if (uploadItem.retryCount < this.maxRetries) {
                uploadItem.retryCount++;
                uploadItem.status = 'queued';
                this.uploadQueue.set(uploadId, uploadItem);
                this.showRetryNotification(uploadItem);
            } else {
                this.showErrorNotification(uploadItem, error);
            }
        } finally {
            // Remove from active uploads
            this.activeUploads.delete(uploadId);
            
            // Continue processing queue
            setTimeout(() => this.processQueue(), 1000);
        }
    }

    /**
     * Upload normalized file to server
     */
    async uploadNormalizedFile(uploadId, uploadItem, validationResult) {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            
            // Create blob from normalized content
            const normalizedBlob = new Blob([validationResult.normalized.content], {
                type: 'text/plain'
            });

            formData.append('file', normalizedBlob, uploadItem.file.name);
            formData.append('uploadId', uploadId);
            formData.append('originalName', uploadItem.file.name);
            formData.append('originalSize', uploadItem.file.size.toString());
            formData.append('validationId', validationResult.validationId);
            formData.append('fileType', validationResult.normalized.detectedType);
            formData.append('validationReport', JSON.stringify(validationResult));

            const xhr = new XMLHttpRequest();

            // Track upload progress
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    uploadItem.uploadProgress = percentComplete;
                    this.updateUploadProgressUI(uploadId, percentComplete);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (e) {
                        reject(new Error('Resposta inválida do servidor'));
                    }
                } else {
                    reject(new Error(`Erro HTTP: ${xhr.status} - ${xhr.statusText}`));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Erro de rede durante upload'));
            });

            xhr.addEventListener('timeout', () => {
                reject(new Error('Timeout durante upload'));
            });

            xhr.open('POST', this.config.endpoints.upload);
            xhr.timeout = 5 * 60 * 1000; // 5 minutes timeout
            xhr.send(formData);
        });
    }

    /**
     * Process file in backend
     */
    async processInBackend(uploadId, uploadItem, uploadResult) {
        try {
            const response = await fetch(this.config.endpoints.process, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    uploadId: uploadId,
                    fileId: uploadResult.fileId,
                    validationId: uploadItem.validationResult.validationId,
                    processingOptions: {
                        importToDatabase: true,
                        detectDuplicates: true,
                        autoResolveConflicts: false
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            return result;

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * UI Update Methods
     */
    updateUploadQueueUI() {
        const queueContainer = document.getElementById('upload-queue');
        if (!queueContainer) return;

        queueContainer.innerHTML = '';

        // Add queued items
        this.uploadQueue.forEach((item, uploadId) => {
            this.createUploadItemUI(uploadId, item, queueContainer);
        });

        // Add active items
        this.activeUploads.forEach((item, uploadId) => {
            this.createUploadItemUI(uploadId, item, queueContainer);
        });
    }

    createUploadItemUI(uploadId, uploadItem, container) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'upload-item';
        itemDiv.id = `upload-item-${uploadId}`;
        
        itemDiv.innerHTML = `
            <div class="upload-item-header">
                <div class="file-info">
                    <i class="fas fa-file-alt"></i>
                    <span class="filename">${uploadItem.file.name}</span>
                    <span class="filesize">(${this.formatFileSize(uploadItem.file.size)})</span>
                </div>
                <div class="upload-status">
                    <span class="status-badge status-${uploadItem.status}">${this.getStatusText(uploadItem.status)}</span>
                </div>
            </div>
            <div class="upload-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${this.getProgressWidth(uploadItem)}%"></div>
                </div>
                <span class="progress-text">${this.getProgressText(uploadItem)}</span>
            </div>
            <div class="upload-details" id="upload-details-${uploadId}">
                ${this.getUploadDetails(uploadItem)}
            </div>
            <div class="upload-actions">
                ${this.getUploadActions(uploadId, uploadItem)}
            </div>
        `;

        container.appendChild(itemDiv);
    }

    updateUploadItemUI(uploadId, uploadItem) {
        const itemElement = document.getElementById(`upload-item-${uploadId}`);
        if (!itemElement) return;

        // Update status badge
        const statusBadge = itemElement.querySelector('.status-badge');
        if (statusBadge) {
            statusBadge.className = `status-badge status-${uploadItem.status}`;
            statusBadge.textContent = this.getStatusText(uploadItem.status);
        }

        // Update progress
        this.updateUploadProgressUI(uploadId, this.getProgressWidth(uploadItem));

        // Update details
        const detailsElement = document.getElementById(`upload-details-${uploadId}`);
        if (detailsElement) {
            detailsElement.innerHTML = this.getUploadDetails(uploadItem);
        }

        // Update actions
        const actionsElement = itemElement.querySelector('.upload-actions');
        if (actionsElement) {
            actionsElement.innerHTML = this.getUploadActions(uploadId, uploadItem);
        }
    }

    updateUploadProgressUI(uploadId, progress) {
        const progressFill = document.querySelector(`#upload-item-${uploadId} .progress-fill`);
        const progressText = document.querySelector(`#upload-item-${uploadId} .progress-text`);
        
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
        
        if (progressText) {
            const uploadItem = this.activeUploads.get(uploadId) || this.uploadQueue.get(uploadId);
            progressText.textContent = this.getProgressText(uploadItem);
        }
    }

    /**
     * Helper methods for UI
     */
    getStatusText(status) {
        const statusTexts = {
            'queued': 'Na fila',
            'validating': 'Validando',
            'uploading': 'Enviando',
            'processing': 'Processando',
            'completed': 'Concluído',
            'failed': 'Falhou',
            'quarantined': 'Quarentena',
            'retrying': 'Tentando novamente'
        };
        return statusTexts[status] || status;
    }

    getProgressWidth(uploadItem) {
        switch (uploadItem.status) {
            case 'queued': return 0;
            case 'validating': return 25;
            case 'uploading': return 25 + (uploadItem.uploadProgress || 0) * 0.5;
            case 'processing': return 75;
            case 'completed': return 100;
            case 'failed': return 0;
            case 'quarantined': return 25;
            default: return 0;
        }
    }

    getProgressText(uploadItem) {
        switch (uploadItem.status) {
            case 'queued': return 'Aguardando...';
            case 'validating': return 'Validando arquivo...';
            case 'uploading': return `Enviando... ${Math.round(uploadItem.uploadProgress || 0)}%`;
            case 'processing': return 'Processando no servidor...';
            case 'completed': return 'Upload concluído!';
            case 'failed': return `Erro: ${uploadItem.error || 'Falha desconhecida'}`;
            case 'quarantined': return `Em quarentena: ${uploadItem.quarantineReason}`;
            default: return '';
        }
    }

    getUploadDetails(uploadItem) {
        let details = '';
        
        if (uploadItem.validationResult) {
            const validation = uploadItem.validationResult;
            details += `
                <div class="validation-summary">
                    <strong>Validação:</strong>
                    <span class="status-${validation.summary.status}">${validation.summary.status}</span>
                </div>
            `;
            
            if (validation.healthcare?.stats) {
                const stats = validation.healthcare.stats;
                details += `
                    <div class="healthcare-stats">
                        <small>Registros: ${stats.recordsFound} | Válidos: ${stats.validRecords} | 
                        Qualidade: ${stats.dataQualityScore.toFixed(1)}%</small>
                    </div>
                `;
            }
        }
        
        if (uploadItem.error) {
            details += `<div class="error-details"><small class="text-danger">${uploadItem.error}</small></div>`;
        }
        
        return details;
    }

    getUploadActions(uploadId, uploadItem) {
        let actions = '';
        
        if (uploadItem.status === 'failed' && uploadItem.retryCount < this.maxRetries) {
            actions += `<button class="btn btn-sm btn-warning" onclick="uploadHandler.retryUpload('${uploadId}')">
                <i class="fas fa-redo"></i> Tentar Novamente
            </button>`;
        }
        
        if (uploadItem.status === 'quarantined') {
            actions += `
                <button class="btn btn-sm btn-info" onclick="uploadHandler.showQuarantineDetails('${uploadId}')">
                    <i class="fas fa-info-circle"></i> Detalhes
                </button>
                <button class="btn btn-sm btn-warning" onclick="uploadHandler.forceUpload('${uploadId}')">
                    <i class="fas fa-exclamation-triangle"></i> Forçar Upload
                </button>
            `;
        }
        
        if (['completed', 'failed'].includes(uploadItem.status)) {
            actions += `<button class="btn btn-sm btn-secondary" onclick="uploadHandler.removeUpload('${uploadId}')">
                <i class="fas fa-times"></i> Remover
            </button>`;
        }
        
        return actions;
    }

    /**
     * Action methods
     */
    retryUpload(uploadId) {
        const uploadItem = this.getUploadItem(uploadId);
        if (uploadItem && uploadItem.retryCount < this.maxRetries) {
            uploadItem.status = 'queued';
            uploadItem.retryCount++;
            uploadItem.error = null;
            this.uploadQueue.set(uploadId, uploadItem);
            this.updateUploadItemUI(uploadId, uploadItem);
            this.processQueue();
        }
    }

    forceUpload(uploadId) {
        const uploadItem = this.getUploadItem(uploadId);
        if (uploadItem && uploadItem.status === 'quarantined') {
            uploadItem.status = 'queued';
            this.uploadQueue.set(uploadId, uploadItem);
            this.updateUploadItemUI(uploadId, uploadItem);
            this.processQueue();
        }
    }

    removeUpload(uploadId) {
        this.uploadQueue.delete(uploadId);
        this.activeUploads.delete(uploadId);
        const element = document.getElementById(`upload-item-${uploadId}`);
        if (element) {
            element.remove();
        }
    }

    showQuarantineDetails(uploadId) {
        const uploadItem = this.getUploadItem(uploadId);
        if (uploadItem && uploadItem.validationResult) {
            this.showQuarantineDialog(uploadId, uploadItem, uploadItem.validationResult);
        }
    }

    /**
     * Dialog methods
     */
    showInvalidFilesDialog(invalidFiles) {
        const modal = this.createModal('Arquivos Inválidos', `
            <p>Os seguintes arquivos não puderam ser processados:</p>
            <ul class="list-unstyled">
                ${invalidFiles.map(({file, reasons}) => `
                    <li class="mb-2">
                        <strong>${file.name}</strong>
                        <ul class="text-danger">
                            ${reasons.map(reason => `<li>${reason}</li>`).join('')}
                        </ul>
                    </li>
                `).join('')}
            </ul>
        `);
        modal.show();
    }

    showQuarantineDialog(uploadId, uploadItem, validationResult) {
        const threats = validationResult.security?.postscan?.threats || [];
        const modal = this.createModal('Arquivo em Quarentena', `
            <div class="alert alert-warning">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Motivo:</strong> ${uploadItem.quarantineReason}
            </div>
            
            ${threats.length > 0 ? `
                <h6>Ameaças Detectadas:</h6>
                <ul class="list-group mb-3">
                    ${threats.map(threat => `
                        <li class="list-group-item d-flex justify-content-between">
                            <span>${threat.type}</span>
                            <span class="badge badge-${threat.severity === 'high' ? 'danger' : 'warning'}">${threat.severity}</span>
                        </li>
                    `).join('')}
                </ul>
            ` : ''}
            
            <p>Você pode:</p>
            <ul>
                <li>Cancelar o upload e corrigir o arquivo</li>
                <li>Forçar o upload (não recomendado para ameaças de alta severidade)</li>
            </ul>
        `, [
            {
                text: 'Cancelar',
                class: 'btn-secondary',
                action: () => this.removeUpload(uploadId)
            },
            {
                text: 'Forçar Upload',
                class: 'btn-warning',
                action: () => this.forceUpload(uploadId)
            }
        ]);
        modal.show();
    }

    showSuccessNotification(uploadItem) {
        this.showNotification('success', `
            <i class="fas fa-check-circle"></i>
            <strong>Upload Concluído!</strong><br>
            ${uploadItem.file.name} foi processado com sucesso.
        `);
    }

    showErrorNotification(uploadItem, error) {
        this.showNotification('error', `
            <i class="fas fa-exclamation-circle"></i>
            <strong>Erro no Upload</strong><br>
            ${uploadItem.file.name}: ${error.message}
        `);
    }

    showRetryNotification(uploadItem) {
        this.showNotification('warning', `
            <i class="fas fa-redo"></i>
            <strong>Tentativa ${uploadItem.retryCount}</strong><br>
            Tentando reenviar ${uploadItem.file.name}...
        `);
    }

    /**
     * Utility methods
     */
    generateUploadId() {
        return 'upload_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getUploadItem(uploadId) {
        return this.activeUploads.get(uploadId) || this.uploadQueue.get(uploadId);
    }

    createModal(title, content, buttons = []) {
        const modalId = 'modal_' + Date.now();
        const modalHtml = `
            <div class="modal fade" id="${modalId}" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${title}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">${content}</div>
                        <div class="modal-footer">
                            ${buttons.map(btn => `
                                <button type="button" class="btn ${btn.class}" data-bs-dismiss="modal">
                                    ${btn.text}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalElement = document.getElementById(modalId);
        const modal = new bootstrap.Modal(modalElement);

        // Add button event listeners
        buttons.forEach((btn, index) => {
            const buttonElement = modalElement.querySelectorAll('.modal-footer .btn')[index];
            if (btn.action) {
                buttonElement.addEventListener('click', btn.action);
            }
        });

        // Remove modal from DOM when hidden
        modalElement.addEventListener('hidden.bs.modal', () => {
            modalElement.remove();
        });

        return modal;
    }

    showNotification(type, message) {
        const notificationContainer = document.getElementById('notifications') || document.body;
        const notificationId = 'notification_' + Date.now();
        
        const notificationHtml = `
            <div id="${notificationId}" class="alert alert-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'warning'} alert-dismissible fade show position-fixed" 
                 style="top: 20px; right: 20px; z-index: 9999; max-width: 400px;">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;

        notificationContainer.insertAdjacentHTML('beforeend', notificationHtml);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            const notification = document.getElementById(notificationId);
            if (notification) {
                notification.remove();
            }
        }, 5000);
    }

    /**
     * Public API methods
     */
    getQueueStatus() {
        return {
            queued: this.uploadQueue.size,
            active: this.activeUploads.size,
            maxConcurrent: this.maxConcurrentUploads
        };
    }

    clearQueue() {
        this.uploadQueue.clear();
        this.updateUploadQueueUI();
    }

    pauseQueue() {
        this.maxConcurrentUploads = 0;
    }

    resumeQueue() {
        this.maxConcurrentUploads = 3;
        this.processQueue();
    }
}

// Initialize global upload handler
const uploadHandler = new AdvancedUploadHandler();

// Export for use in other modules
window.AdvancedUploadHandler = AdvancedUploadHandler;
window.uploadHandler = uploadHandler;