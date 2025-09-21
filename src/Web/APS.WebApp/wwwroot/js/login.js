// ===== LOGIN.JS - Sistema APS =====

document.addEventListener('DOMContentLoaded', function() {
    // Inicializar funcionalidades
    initLoginForm();
    initPasswordToggle();
    initForgotPasswordForm();
    initDemoLogin();
    initFormValidation();
});

// ===== CONFIGURAÇÕES =====
const LOGIN_CONFIG = {
    apiBaseUrl: '/api', // Será configurado quando tivermos a API
    demoCredentials: {
        email: 'dr.demo@aps.com.br',
        password: 'demo123',
        crm: '123456'
    },
    redirectUrl: 'dashboard.html'
};

// ===== FORMULÁRIO DE LOGIN =====
function initLoginForm() {
    const loginForm = document.getElementById('login-form');
    const loginBtn = document.getElementById('login-btn');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (!loginForm.checkValidity()) {
            e.stopPropagation();
            loginForm.classList.add('was-validated');
            return;
        }

        const formData = {
            email: emailInput.value.trim(),
            password: passwordInput.value,
            remember: document.getElementById('remember-me').checked
        };

        await performLogin(formData);
    });

    // Enter key para submeter o form
    [emailInput, passwordInput].forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                loginForm.requestSubmit();
            }
        });
    });
}

// ===== REALIZAR LOGIN =====
async function performLogin(credentials) {
    const loginBtn = document.getElementById('login-btn');
    const btnText = loginBtn.querySelector('.btn-text');
    const btnLoading = loginBtn.querySelector('.btn-loading');

    try {
        // Mostrar loading
        setLoadingState(true);

        // Simular autenticação (substituir por chamada real à API)
        const loginResult = await simulateLogin(credentials);

        if (loginResult.success) {
            showAlert('Login realizado com sucesso! Redirecionando...', 'success');
            
            // Salvar dados da sessão
            saveUserSession(loginResult.user);
            
            // Redirecionar após delay
            setTimeout(() => {
                window.location.href = LOGIN_CONFIG.redirectUrl;
            }, 1500);
        } else {
            throw new Error(loginResult.message || 'Credenciais inválidas');
        }

    } catch (error) {
        console.error('Erro no login:', error);
        showAlert(error.message || 'Erro ao fazer login. Tente novamente.', 'danger');
    } finally {
        setLoadingState(false);
    }
}

// ===== SIMULAR LOGIN (REMOVER QUANDO TIVER API REAL) =====
async function simulateLogin(credentials) {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Verificar credenciais demo
    const { email, password } = credentials;
    const { demoCredentials } = LOGIN_CONFIG;

    if (email === demoCredentials.email && password === demoCredentials.password) {
        return {
            success: true,
            user: {
                id: 1,
                name: 'Dr. João Silva',
                email: demoCredentials.email,
                crm: demoCredentials.crm,
                specialty: 'Cardiologia',
                avatar: null
            },
            token: 'demo-jwt-token-' + Date.now()
        };
    }

    // Verificar se é um CRM válido (simulação)
    if (/^\d{6}$/.test(email) && password.length >= 6) {
        return {
            success: true,
            user: {
                id: 2,
                name: 'Dr. ' + email,
                email: `crm${email}@aps.com.br`,
                crm: email,
                specialty: 'Clínica Geral',
                avatar: null
            },
            token: 'demo-jwt-token-' + Date.now()
        };
    }

    // Login inválido
    return {
        success: false,
        message: 'Email/CRM ou senha incorretos. Use "dr.demo@aps.com.br" e "demo123" para demo.'
    };
}

// ===== GERENCIAR SESSÃO =====
function saveUserSession(user) {
    const sessionData = {
        user: user,
        loginTime: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() // 8 horas
    };

    localStorage.setItem('aps_session', JSON.stringify(sessionData));
    
    // Salvar remember-me se marcado
    const rememberMe = document.getElementById('remember-me').checked;
    if (rememberMe) {
        localStorage.setItem('aps_remember_email', user.email);
    } else {
        localStorage.removeItem('aps_remember_email');
    }
}

// ===== TOGGLE DE SENHA =====
function initPasswordToggle() {
    const passwordInput = document.getElementById('password');
    const passwordToggle = document.getElementById('password-toggle');

    passwordToggle.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        
        const icon = passwordToggle.querySelector('i');
        icon.classList.toggle('fa-eye');
        icon.classList.toggle('fa-eye-slash');
    });
}

// ===== ESQUECI A SENHA =====
function initForgotPasswordForm() {
    const forgotForm = document.getElementById('forgot-password-form');
    
    forgotForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('forgot-email').value;
        
        try {
            // Simular envio de email
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            showAlert('Instruções enviadas para seu email!', 'success');
            
            // Fechar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('forgot-password-modal'));
            modal.hide();
            
        } catch (error) {
            showAlert('Erro ao enviar instruções. Tente novamente.', 'danger');
        }
    });
}

// ===== LOGIN DEMO =====
function initDemoLogin() {
    const demoBtn = document.getElementById('demo-login');
    
    demoBtn.addEventListener('click', function() {
        const { demoCredentials } = LOGIN_CONFIG;
        
        // Preencher campos
        document.getElementById('email').value = demoCredentials.email;
        document.getElementById('password').value = demoCredentials.password;
        
        // Simular submit
        document.getElementById('login-form').requestSubmit();
    });
}

// ===== VALIDAÇÃO ===== 
function initFormValidation() {
    const forms = document.querySelectorAll('.needs-validation');
    
    Array.from(forms).forEach(form => {
        form.addEventListener('submit', function(event) {
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();
            }
            form.classList.add('was-validated');
        });
    });

    // Validação em tempo real
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    emailInput.addEventListener('input', function() {
        validateEmail(this);
    });

    passwordInput.addEventListener('input', function() {
        validatePassword(this);
    });

    // Carregar email lembrado
    loadRememberedEmail();
}

// ===== VALIDAÇÃO DE EMAIL =====
function validateEmail(input) {
    const value = input.value.trim();
    let isValid = false;
    let message = '';

    if (value === '') {
        message = 'Campo obrigatório';
    } else if (/^\d{6}$/.test(value)) {
        // CRM válido
        isValid = true;
        message = 'CRM válido';
    } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        // Email válido
        isValid = true;
        message = 'Email válido';
    } else {
        message = 'Digite um email válido ou CRM (6 dígitos)';
    }

    updateFieldValidation(input, isValid, message);
}

// ===== VALIDAÇÃO DE SENHA =====
function validatePassword(input) {
    const value = input.value;
    const isValid = value.length >= 6;
    const message = isValid ? 'Senha válida' : 'Senha deve ter pelo menos 6 caracteres';
    
    updateFieldValidation(input, isValid, message);
}

// ===== ATUALIZAR VALIDAÇÃO DO CAMPO =====
function updateFieldValidation(input, isValid, message) {
    const feedback = input.parentNode.querySelector('.invalid-feedback') || 
                    input.parentNode.querySelector('.valid-feedback');
    
    if (feedback) {
        feedback.textContent = message;
        feedback.className = isValid ? 'valid-feedback' : 'invalid-feedback';
    }
    
    input.classList.remove('is-valid', 'is-invalid');
    if (input.value.trim() !== '') {
        input.classList.add(isValid ? 'is-valid' : 'is-invalid');
    }
}

// ===== CARREGAR EMAIL LEMBRADO =====
function loadRememberedEmail() {
    const rememberedEmail = localStorage.getItem('aps_remember_email');
    if (rememberedEmail) {
        document.getElementById('email').value = rememberedEmail;
        document.getElementById('remember-me').checked = true;
    }
}

// ===== ESTADOS DE LOADING =====
function setLoadingState(loading) {
    const loginBtn = document.getElementById('login-btn');
    const btnText = loginBtn.querySelector('.btn-text');
    const btnLoading = loginBtn.querySelector('.btn-loading');
    
    if (loading) {
        loginBtn.disabled = true;
        loginBtn.classList.add('loading');
        btnText.classList.add('d-none');
        btnLoading.classList.remove('d-none');
    } else {
        loginBtn.disabled = false;
        loginBtn.classList.remove('loading');
        btnText.classList.remove('d-none');
        btnLoading.classList.add('d-none');
    }
}

// ===== MOSTRAR ALERTAS =====
function showAlert(message, type = 'info') {
    const alertsContainer = document.getElementById('login-alerts');
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Limpar alertas anteriores
    alertsContainer.innerHTML = '';
    alertsContainer.appendChild(alert);
    
    // Remover automaticamente após 5 segundos
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}

// ===== VERIFICAR SESSÃO EXISTENTE =====
function checkExistingSession() {
    const sessionData = localStorage.getItem('aps_session');
    
    if (sessionData) {
        try {
            const session = JSON.parse(sessionData);
            const now = new Date();
            const expiresAt = new Date(session.expiresAt);
            
            if (now < expiresAt) {
                // Sessão válida - redirecionar
                window.location.href = LOGIN_CONFIG.redirectUrl;
                return;
            } else {
                // Sessão expirada - limpar
                localStorage.removeItem('aps_session');
            }
        } catch (error) {
            // Dados corrompidos - limpar
            localStorage.removeItem('aps_session');
        }
    }
}

// ===== VERIFICAR SESSÃO AO CARREGAR =====
window.addEventListener('load', function() {
    checkExistingSession();
});

// ===== UTILITÁRIOS =====

// Log de debug (remover em produção)
console.log('🔐 Sistema de Login APS carregado');
console.log('📧 Credenciais demo:', LOGIN_CONFIG.demoCredentials);

// Expor funções para debug (remover em produção)
window.apsLogin = {
    performLogin,
    simulateLogin,
    checkExistingSession,
    showAlert
};