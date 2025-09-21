// ===== DASHBOARD.JS - Sistema APS Healthcare =====

// Healthcare Processing System Integration
let healthcareProcessor = null;
let uploadHandler = null;
let processedDataStats = {
    hospitals: 0,
    doctors: 0,
    municipalities: 0,
    states: 0,
    patients: 0,
    processedFiles: 0
};

// Aguardar carregamento completo
$(document).ready(function() {
    // Verificar autenticação
    checkAuthentication();
    
    // Inicializar sistemas de saúde
    initHealthcareProcessor();
    initFileUploadHandler();
    
    // Inicializar componentes
    initSidebar();
    initNavigation();
    initCharts();
    initDataTables();
    initQuickActions();
    initSearch();
    initUserData();
    
    // Carregar dados iniciais
    loadDashboardData();
    loadRecentActivities();
    loadHealthcareData();
});

// ===== HEALTHCARE SYSTEM INITIALIZATION =====
function initHealthcareProcessor() {
    if (window.healthcareAPI) {
        healthcareProcessor = window.healthcareAPI;
        console.log('🏥 Healthcare processor initialized');
    } else {
        console.error('❌ Healthcare API not found');
    }
}

function initFileUploadHandler() {
    if (window.AdvancedUploadHandler) {
        uploadHandler = new AdvancedUploadHandler();
        console.log('📁 Upload handler initialized');
        
        // Setup file upload listeners
        setupFileUploadListeners();
    } else {
        console.error('❌ Upload handler not found');
    }
}

function setupFileUploadListeners() {
    const fileInput = document.getElementById('file-input');
    const dropzone = document.getElementById('dropzone');
    
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelection);
    }
    
    if (dropzone) {
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('drag-over');
        });
        
        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('drag-over');
        });
        
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('drag-over');
            const files = Array.from(e.dataTransfer.files);
            processHealthcareFiles(files);
        });
    }
}

async function handleFileSelection(event) {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
        await processHealthcareFiles(files);
    }
}

async function processHealthcareFiles(files) {
    updateProcessingStatus('Iniciando processamento de arquivos de saúde...');
    
    for (let file of files) {
        try {
            updateProcessingStatus(`Processando ${file.name}...`);
            
            const result = await healthcareProcessor.processHealthcareFile(file, (progress, message) => {
                updateProcessingStatus(`${file.name}: ${progress}% - ${message}`);
            });
            
            if (result.success) {
                updateHealthcareStats(result);
                showSuccessNotification(`${file.name} processado com sucesso!`);
                addProcessingResult(result);
            } else {
                showErrorNotification(`Erro ao processar ${file.name}: ${result.error}`);
            }
            
        } catch (error) {
            showErrorNotification(`Erro ao processar ${file.name}: ${error.message}`);
        }
    }
    
    // Update dashboard stats
    updateDashboardStats();
    updateProcessingStatus('Processamento concluído.');
}

// ===== CONFIGURAÇÕES =====
const DASHBOARD_CONFIG = {
    apiBaseUrl: '/api',
    refreshInterval: 30000, // 30 segundos
    charts: {},
    tables: {}
};

// ===== HEALTHCARE DATA FUNCTIONS =====
function updateHealthcareStats(result) {
    processedDataStats.processedFiles++;
    
    // Update specific data type counters
    switch (result.dataType) {
        case 'medicos':
            processedDataStats.doctors += result.validRecords;
            break;
        case 'hospitais':
            processedDataStats.hospitals += result.validRecords;
            break;
        case 'municipios':
            processedDataStats.municipalities += result.validRecords;
            break;
        case 'estados':
            processedDataStats.states += result.validRecords;
            break;
        case 'pacientes':
            processedDataStats.patients += result.validRecords;
            break;
    }
}

function updateDashboardStats() {
    // Update the dashboard cards with real processed data
    document.getElementById('total-hospitals').textContent = processedDataStats.hospitals.toLocaleString();
    document.getElementById('total-doctors').textContent = processedDataStats.doctors.toLocaleString();
    document.getElementById('total-municipalities').textContent = processedDataStats.municipalities.toLocaleString();
    document.getElementById('total-states').textContent = processedDataStats.states.toLocaleString();
    document.getElementById('total-patients').textContent = processedDataStats.patients.toLocaleString();
    document.getElementById('processed-files').textContent = processedDataStats.processedFiles.toLocaleString();
}

function updateProcessingStatus(message) {
    const statusDiv = document.getElementById('processing-status');
    if (statusDiv) {
        statusDiv.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-heartbeat me-2"></i>
                ${message}
            </div>
        `;
    }
    console.log(`🏥 ${message}`);
}

function addProcessingResult(result) {
    const statusDiv = document.getElementById('processing-status');
    if (statusDiv) {
        const resultCard = document.createElement('div');
        resultCard.className = 'alert alert-success mt-2';
        resultCard.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>${result.fileName}</strong> (${result.dataType})
                    <br>
                    <small>
                        ${result.recordsProcessed} registros processados | 
                        ${result.validRecords} válidos | 
                        ${result.invalidRecords} inválidos
                    </small>
                </div>
                <div class="text-end">
                    <small class="text-muted">${new Date(result.processedAt).toLocaleString()}</small>
                </div>
            </div>
        `;
        statusDiv.appendChild(resultCard);
    }
}

function loadHealthcareData() {
    // Load any existing healthcare data from localStorage or API
    const savedStats = localStorage.getItem('healthcare_stats');
    if (savedStats) {
        processedDataStats = JSON.parse(savedStats);
        updateDashboardStats();
    }
}

function showSuccessNotification(message) {
    showNotification(message, 'success');
}

function showErrorNotification(message) {
    showNotification(message, 'error');
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// ===== AUTENTICAÇÃO =====
function checkAuthentication() {
    const sessionData = localStorage.getItem('aps_session');
    
    if (!sessionData) {
        window.location.href = 'login.html';
        return;
    }
    
    try {
        const session = JSON.parse(sessionData);
        const now = new Date();
        const expiresAt = new Date(session.expiresAt);
        
        if (now >= expiresAt) {
            localStorage.removeItem('aps_session');
            window.location.href = 'login.html';
            return;
        }
        
        // Salvar dados do usuário globalmente
        window.currentUser = session.user;
        
    } catch (error) {
        localStorage.removeItem('aps_session');
        window.location.href = 'login.html';
    }
}

// ===== SIDEBAR E NAVEGAÇÃO =====
function initSidebar() {
    // Toggle sidebar mobile
    $('#mobile-sidebar-toggle').click(function() {
        $('.sidebar').toggleClass('show');
        $('.main-content').toggleClass('expanded');
    });
    
    // Fechar sidebar ao clicar fora (mobile)
    $(document).click(function(e) {
        if (window.innerWidth <= 991) {
            if (!$(e.target).closest('.sidebar, #mobile-sidebar-toggle').length) {
                $('.sidebar').removeClass('show');
            }
        }
    });
    
    // Logout
    $('#logout-btn, #header-logout').click(function(e) {
        e.preventDefault();
        logout();
    });
}

function initNavigation() {
    // Navegação entre seções
    $('.menu-link[data-section]').click(function(e) {
        e.preventDefault();
        
        const section = $(this).data('section');
        showSection(section);
        
        // Atualizar menu ativo
        $('.menu-item').removeClass('active');
        $(this).closest('.menu-item').addClass('active');
        
        // Atualizar título
        const sectionTitle = $(this).find('span').text();
        $('#page-title').text(sectionTitle);
        
        // Fechar sidebar no mobile
        if (window.innerWidth <= 991) {
            $('.sidebar').removeClass('show');
        }
    });
}

function showSection(sectionName) {
    // Esconder todas as seções
    $('.content-section').removeClass('active');
    
    // Mostrar seção específica
    $(`#${sectionName}-section`).addClass('active');
    
    // Carregar dados específicos da seção
    loadSectionData(sectionName);
}

function loadSectionData(section) {
    switch(section) {
        case 'hospitals':
            loadHospitalsData();
            break;
        case 'doctors':
            loadDoctorsData();
            break;
        case 'patients':
            loadPatientsData();
            break;
        case 'allocations':
            loadAllocationsData();
            break;
        case 'imports':
            loadImportsData();
            break;
    }
}

// ===== DADOS DO USUÁRIO =====
function initUserData() {
    if (window.currentUser) {
        $('#user-name').text(window.currentUser.name);
        $('#user-role').text(window.currentUser.specialty || 'Médico');
    }
}

// ===== GRÁFICOS =====
function initCharts() {
    initAllocationsChart();
    initSpecialtiesChart();
}

function initAllocationsChart() {
    const ctx = document.getElementById('allocationsChart').getContext('2d');
    
    DASHBOARD_CONFIG.charts.allocations = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set'],
            datasets: [{
                label: 'Alocações',
                data: [65, 59, 80, 81, 56, 55, 40, 85, 92],
                borderColor: 'rgb(44, 90, 160)',
                backgroundColor: 'rgba(44, 90, 160, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function initSpecialtiesChart() {
    const ctx = document.getElementById('specialtiesChart').getContext('2d');
    
    DASHBOARD_CONFIG.charts.specialties = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Cardiologia', 'Pediatria', 'Ortopedia', 'Neurologia', 'Outros'],
            datasets: [{
                data: [30, 25, 20, 15, 10],
                backgroundColor: [
                    'rgb(44, 90, 160)',
                    'rgb(40, 167, 69)',
                    'rgb(255, 193, 7)',
                    'rgb(220, 53, 69)',
                    'rgb(108, 117, 125)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// ===== TABELAS DE DADOS =====
function initDataTables() {
    // Configuração padrão do DataTables
    $.extend($.fn.dataTable.defaults, {
        language: {
            url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/pt-BR.json'
        },
        responsive: true,
        pageLength: 25,
        dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>rtip'
    });
}

function loadHospitalsData() {
    if (!DASHBOARD_CONFIG.tables.hospitals) {
        // Dados de exemplo - substituir por chamada à API
        const hospitalsData = [
            {
                nome: 'Hospital das Clínicas',
                cidade: 'São Paulo',
                tipo: 'Público',
                medicos: 450,
                pacientes: 2800,
                status: 'Ativo'
            },
            {
                nome: 'Hospital Sírio-Libanês',
                cidade: 'São Paulo',
                tipo: 'Privado',
                medicos: 320,
                pacientes: 1500,
                status: 'Ativo'
            },
            // Mais dados...
        ];
        
        DASHBOARD_CONFIG.tables.hospitals = $('#hospitals-table').DataTable({
            data: hospitalsData,
            columns: [
                { 
                    data: 'nome',
                    render: function(data, type, row) {
                        return `<strong>${data}</strong>`;
                    }
                },
                { data: 'cidade' },
                { 
                    data: 'tipo',
                    render: function(data) {
                        const badge = data === 'Público' ? 'success' : data === 'Privado' ? 'primary' : 'info';
                        return `<span class="badge bg-${badge}">${data}</span>`;
                    }
                },
                { 
                    data: 'medicos',
                    render: function(data) {
                        return data.toLocaleString('pt-BR');
                    }
                },
                { 
                    data: 'pacientes',
                    render: function(data) {
                        return data.toLocaleString('pt-BR');
                    }
                },
                { 
                    data: 'status',
                    render: function(data) {
                        const badge = data === 'Ativo' ? 'success' : 'secondary';
                        return `<span class="badge bg-${badge}">${data}</span>`;
                    }
                },
                {
                    data: null,
                    orderable: false,
                    render: function(data, type, row) {
                        return `
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-primary" onclick="viewHospital('${row.nome}')" title="Visualizar">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn btn-outline-secondary" onclick="editHospital('${row.nome}')" title="Editar">
                                    <i class="fas fa-edit"></i>
                                </button>
                            </div>
                        `;
                    }
                }
            ]
        });
        
        // Filtros customizados
        initHospitalFilters();
    }
}

function initHospitalFilters() {
    $('#hospital-search').on('keyup', function() {
        DASHBOARD_CONFIG.tables.hospitals.search(this.value).draw();
    });
    
    $('#hospital-city-filter').on('change', function() {
        DASHBOARD_CONFIG.tables.hospitals.column(1).search(this.value).draw();
    });
    
    $('#hospital-type-filter').on('change', function() {
        DASHBOARD_CONFIG.tables.hospitals.column(2).search(this.value).draw();
    });
    
    $('#clear-hospital-filters').on('click', function() {
        $('#hospital-search').val('');
        $('#hospital-city-filter').val('');
        $('#hospital-type-filter').val('');
        DASHBOARD_CONFIG.tables.hospitals.search('').columns().search('').draw();
    });
}

// ===== AÇÕES RÁPIDAS =====
function initQuickActions() {
    $('.quick-action-btn').click(function() {
        const action = $(this).data('action');
        executeQuickAction(action);
    });
    
    // Add healthcare-specific action handlers
    $('#refresh-status').click(function() {
        refreshHealthcareStatus();
    });
}

function executeQuickAction(action) {
    switch(action) {
        case 'import':
            // Go to imports section
            showSection('imports');
            break;
        case 'allocate':
            // Ir para seção de alocações
            showSection('allocations');
            break;
        case 'report':
            // Gerar relatório
            generateHealthcareReport();
            break;
        case 'search':
            // Focar na busca global
            $('#global-search').focus();
            break;
    }
}

function refreshHealthcareStatus() {
    updateProcessingStatus('Atualizando status dos dados de saúde...');
    
    // Save current stats to localStorage
    localStorage.setItem('healthcare_stats', JSON.stringify(processedDataStats));
    
    // Reload healthcare data
    loadHealthcareData();
    
    setTimeout(() => {
        updateProcessingStatus('Status atualizado com sucesso.');
    }, 1000);
}

function generateHealthcareReport() {
    const report = {
        timestamp: new Date().toISOString(),
        totalFiles: processedDataStats.processedFiles,
        dataBreakdown: {
            hospitals: processedDataStats.hospitals,
            doctors: processedDataStats.doctors,
            municipalities: processedDataStats.municipalities,
            states: processedDataStats.states,
            patients: processedDataStats.patients
        }
    };
    
    // Display report
    showNotification(`Relatório gerado: ${report.totalFiles} arquivos processados`, 'success');
    console.log('Healthcare Report:', report);
}

// ===== BUSCA GLOBAL =====
function initSearch() {
    let searchTimeout;
    
    $('#global-search').on('input', function() {
        const query = $(this).val();
        
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            if (query.length >= 3) {
                performGlobalSearch(query);
            }
        }, 500);
    });
}

function performGlobalSearch(query) {
    // Implementar busca global nos dados
    console.log('Buscando:', query);
    // TODO: Implementar busca real
}

// ===== CARREGAMENTO DE DADOS =====
function loadDashboardData() {
    showLoading();
    
    // Simular carregamento de dados da API
    setTimeout(() => {
        updateStatCards();
        hideLoading();
    }, 1000);
}

function updateStatCards() {
    // Animar contadores
    animateCounter('#total-hospitals', 156);
    animateCounter('#total-doctors', 2847);
    animateCounter('#total-patients', 58392);
    animateCounter('#total-allocations', 1239);
}

function animateCounter(selector, target) {
    const element = $(selector);
    const duration = 1500;
    const step = target / (duration / 16);
    let current = 0;
    
    const timer = setInterval(() => {
        current += step;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        
        element.text(Math.floor(current).toLocaleString('pt-BR'));
    }, 16);
}

function loadRecentActivities() {
    const activities = [
        {
            icon: 'fas fa-user-plus',
            iconBg: 'bg-success',
            title: 'Novo médico cadastrado',
            description: 'Dr. Maria Santos - Cardiologia',
            time: 'há 5 minutos'
        },
        {
            icon: 'fas fa-exchange-alt',
            iconBg: 'bg-primary',
            title: 'Alocação realizada',
            description: 'Dr. João Silva → Hospital São Lucas',
            time: 'há 15 minutos'
        },
        {
            icon: 'fas fa-file-import',
            iconBg: 'bg-info',
            title: 'Dados importados',
            description: '150 novos registros de pacientes',
            time: 'há 1 hora'
        },
        {
            icon: 'fas fa-user-injured',
            iconBg: 'bg-warning',
            title: 'Paciente transferido',
            description: 'Transferência para UTI realizada',
            time: 'há 2 horas'
        }
    ];
    
    const activitiesHtml = activities.map(activity => `
        <div class="activity-item">
            <div class="activity-icon ${activity.iconBg}">
                <i class="${activity.icon} text-white"></i>
            </div>
            <div class="activity-info">
                <div class="activity-title">${activity.title}</div>
                <div class="activity-description">${activity.description}</div>
                <div class="activity-time">${activity.time}</div>
            </div>
        </div>
    `).join('');
    
    $('#recent-activities').html(activitiesHtml);
}

// ===== FUNÇÕES AUXILIARES =====
function showLoading() {
    $('#loading-overlay').addClass('show');
}

function hideLoading() {
    $('#loading-overlay').removeClass('show');
}

function logout() {
    if (confirm('Tem certeza que deseja sair?')) {
        localStorage.removeItem('aps_session');
        window.location.href = 'login.html';
    }
}

function showImportModal() {
    // TODO: Implementar modal de importação
    alert('Funcionalidade de importação em desenvolvimento');
}

function generateReport() {
    // TODO: Implementar geração de relatório
    alert('Funcionalidade de relatório em desenvolvimento');
}

function viewHospital(name) {
    // TODO: Implementar visualização de hospital
    alert(`Visualizar hospital: ${name}`);
}

function editHospital(name) {
    // TODO: Implementar edição de hospital
    alert(`Editar hospital: ${name}`);
}

// Funções vazias para outras seções (implementar depois)
function loadDoctorsData() {
    console.log('Carregando dados de médicos...');
}

function loadPatientsData() {
    console.log('Carregando dados de pacientes...');
}

function loadAllocationsData() {
    console.log('Carregando dados de alocações...');
}

function loadImportsData() {
    console.log('Carregando dados de importações...');
}

// ===== NOTIFICAÇÕES AVANÇADAS =====
function showAdvancedNotification(message, type = 'info', duration = 5000) {
    // Remover notificação anterior se existir
    const existingNotification = document.querySelector('.aps-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Criar nova notificação
    const notification = document.createElement('div');
    notification.className = `aps-notification alert alert-${getBootstrapAlertType(type)} alert-dismissible fade show`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        border: none;
    `;

    const icon = getNotificationIcon(type);
    notification.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="${icon} me-2"></i>
            <div class="flex-grow-1">${message}</div>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;

    document.body.appendChild(notification);

    // Auto remover após duration
    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 150);
            }
        }, duration);
    }
}

function getBootstrapAlertType(type) {
    const typeMap = {
        success: 'success',
        error: 'danger',
        warning: 'warning',
        info: 'info'
    };
    return typeMap[type] || 'info';
}

function getNotificationIcon(type) {
    const iconMap = {
        success: 'fas fa-check-circle text-success',
        error: 'fas fa-exclamation-triangle text-danger',
        warning: 'fas fa-exclamation-triangle text-warning',
        info: 'fas fa-info-circle text-info'
    };
    return iconMap[type] || 'fas fa-info-circle';
}

// ===== ATUALIZAÇÃO AUTOMÁTICA =====
setInterval(() => {
    // Atualizar apenas se a aba estiver ativa
    if (!document.hidden) {
        updateStatCards();
        loadRecentActivities();
    }
}, DASHBOARD_CONFIG.refreshInterval);

// ===== DEBUG (REMOVER EM PRODUÇÃO) =====
console.log('📊 Dashboard APS carregado com sucesso!');
console.log('👤 Usuário logado:', window.currentUser);

// Expor funções para debug e integração
window.apsDashboard = {
    loadDashboardData,
    showSection,
    updateStatCards,
    DASHBOARD_CONFIG
};

// Expor função de notificação globalmente
window.showAdvancedNotification = showAdvancedNotification;