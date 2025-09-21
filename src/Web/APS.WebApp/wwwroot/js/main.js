// ===== MAIN.JS - Sistema APS =====

document.addEventListener('DOMContentLoaded', function() {
    // Inicializar AOS (Animate On Scroll)
    AOS.init({
        duration: 800,
        easing: 'ease-in-out',
        once: true,
        offset: 50
    });

    // Inicializar todas as funcionalidades
    initScrollEffects();
    initCounters();
    initSmoothScrolling();
    initNavbarEffects();
    initAnimations();
    initContactForm();
    initDemoVideo();
    initTooltips();
    initFloatingCards();
});

// ===== ANIMAÇÕES DOS CARDS FLUTUANTES =====
function initFloatingCards() {
    const floatingCards = document.querySelectorAll('.floating-card');
    
    floatingCards.forEach((card, index) => {
        // Animação de entrada escalonada
        card.style.animationDelay = `${index * 0.3}s`;
        
        // Movimento flutuante contínuo
        card.style.animation = `floating 3s ease-in-out infinite`;
        card.style.animationDelay = `${index * 0.5}s`;
    });
    
    // Adicionar keyframes se não existirem
    if (!document.querySelector('#floating-keyframes')) {
        const style = document.createElement('style');
        style.id = 'floating-keyframes';
        style.textContent = `
            @keyframes floating {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-10px); }
            }
        `;
        document.head.appendChild(style);
    }
}

// ===== DEMO VIDEO INTERACTION =====
function initDemoVideo() {
    const videoPlaceholder = document.querySelector('.video-placeholder');
    const playButton = document.querySelector('.play-button');

    if (videoPlaceholder && playButton) {
        playButton.addEventListener('click', function() {
            // Simular reprodução de vídeo
            this.innerHTML = '<i class="fas fa-pause"></i>';
            this.style.background = 'rgba(255, 255, 255, 0.4)';
            
            // Adicionar overlay de progresso
            if (!document.querySelector('.video-progress')) {
                const progressBar = document.createElement('div');
                progressBar.className = 'video-progress';
                progressBar.style.cssText = `
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    height: 4px;
                    background: var(--accent-color);
                    width: 0%;
                    transition: width 10s linear;
                `;
                videoPlaceholder.appendChild(progressBar);
                
                // Simular progresso
                setTimeout(() => {
                    progressBar.style.width = '100%';
                }, 100);
                
                // Resetar após conclusão
                setTimeout(() => {
                    this.innerHTML = '<i class="fas fa-play"></i>';
                    this.style.background = 'rgba(255, 255, 255, 0.2)';
                    progressBar.remove();
                }, 10000);
            }
        });
    }
}

// ===== FORMULÁRIO DE CONTATO AVANÇADO =====
function initContactForm() {
    const contactForm = document.getElementById('contactForm');
    if (!contactForm) return;

    // Máscara para telefone
    const phoneInput = contactForm.querySelector('input[name="phone"]');
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            
            if (value.length >= 11) {
                value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
            } else if (value.length >= 10) {
                value = value.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
            } else if (value.length >= 6) {
                value = value.replace(/(\d{2})(\d{4})/, '($1) $2');
            } else if (value.length >= 2) {
                value = value.replace(/(\d{2})/, '($1) ');
            }
            
            e.target.value = value;
        });
    }

    // Validação em tempo real
    const inputs = contactForm.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateField(this);
        });
    });

    // Submit do formulário
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        let isValid = true;
        const errors = [];

        // Validações
        const validations = [
            { field: 'name', min: 2, message: 'Nome deve ter pelo menos 2 caracteres' },
            { field: 'email', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email inválido' },
            { field: 'phone', pattern: /^\(\d{2}\)\s\d{4,5}-\d{4}$/, message: 'Telefone inválido' },
            { field: 'institution', min: 2, message: 'Instituição é obrigatória' },
            { field: 'specialty', required: true, message: 'Especialidade é obrigatória' },
            { field: 'message', min: 10, message: 'Mensagem deve ter pelo menos 10 caracteres' }
        ];

        validations.forEach(validation => {
            const value = formData.get(validation.field);
            
            if (validation.required && !value) {
                isValid = false;
                errors.push(validation.message);
            } else if (validation.min && (!value || value.length < validation.min)) {
                isValid = false;
                errors.push(validation.message);
            } else if (validation.pattern && value && !validation.pattern.test(value)) {
                isValid = false;
                errors.push(validation.message);
            }
        });

        // Processar resultado
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        if (isValid) {
            // Simular envio
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
            submitBtn.disabled = true;

            setTimeout(() => {
                showAdvancedNotification('Mensagem enviada com sucesso! Entraremos em contato em breve.', 'success');
                this.reset();
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }, 2000);
        } else {
            showAdvancedNotification(errors.join('<br>'), 'error');
        }
    });
}

// Validação individual de campo
function validateField(field) {
    const value = field.value.trim();
    let isValid = true;
    let message = '';

    switch(field.name) {
        case 'name':
            isValid = value.length >= 2;
            message = 'Nome deve ter pelo menos 2 caracteres';
            break;
        case 'email':
            isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            message = 'Email inválido';
            break;
        case 'phone':
            isValid = /^\(\d{2}\)\s\d{4,5}-\d{4}$/.test(value);
            message = 'Formato: (XX) XXXXX-XXXX';
            break;
        case 'institution':
            isValid = value.length >= 2;
            message = 'Instituição é obrigatória';
            break;
        case 'message':
            isValid = value.length >= 10;
            message = 'Mensagem deve ter pelo menos 10 caracteres';
            break;
    }

    // Aplicar visual de validação
    field.classList.remove('is-valid', 'is-invalid');
    if (value) {
        field.classList.add(isValid ? 'is-valid' : 'is-invalid');
    }

    return isValid;
}

// ===== SISTEMA DE TOOLTIPS =====
function initTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    
    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', function(e) {
            showTooltip(e.target, e.target.dataset.tooltip);
        });

        element.addEventListener('mouseleave', function(e) {
            hideTooltip(e.target);
        });
    });
}

function showTooltip(element, text) {
    // Remover tooltip existente
    hideTooltip(element);
    
    const tooltip = document.createElement('div');
    tooltip.className = 'custom-tooltip';
    tooltip.textContent = text;
    tooltip.style.cssText = `
        position: absolute;
        background: rgba(0,0,0,0.9);
        color: white;
        padding: 0.5rem 0.75rem;
        border-radius: 6px;
        font-size: 0.875rem;
        white-space: nowrap;
        z-index: 1000;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    document.body.appendChild(tooltip);
    
    // Posicionar tooltip
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    
    tooltip.style.left = rect.left + (rect.width / 2) - (tooltipRect.width / 2) + 'px';
    tooltip.style.top = rect.top - tooltipRect.height - 8 + window.scrollY + 'px';
    
    // Animar entrada
    setTimeout(() => tooltip.style.opacity = '1', 100);
    
    element.tooltipElement = tooltip;
}

function hideTooltip(element) {
    if (element.tooltipElement) {
        element.tooltipElement.remove();
        element.tooltipElement = null;
    }
}

// ===== EFEITOS DE SCROLL =====
function initScrollEffects() {
    const navbar = document.querySelector('.navbar');
    
    window.addEventListener('scroll', function() {
        if (window.scrollY > 100) {
            navbar.classList.add('scrolled');
            navbar.style.background = 'rgba(44, 90, 160, 0.95)';
            navbar.style.backdropFilter = 'blur(10px)';
            navbar.style.boxShadow = '0 2px 20px rgba(0,0,0,0.1)';
        } else {
            navbar.classList.remove('scrolled');
            navbar.style.background = 'var(--primary-color)';
            navbar.style.backdropFilter = 'none';
            navbar.style.boxShadow = 'none';
        }
    });
}

// ===== CONTADORES ANIMADOS =====
function initCounters() {
    const counters = document.querySelectorAll('[data-count]');
    let countersAnimated = false;

    function animateCounters() {
        if (countersAnimated) return;
        
        counters.forEach(counter => {
            const target = parseInt(counter.getAttribute('data-count'));
            const duration = 2000; // 2 segundos
            const step = target / (duration / 16); // 60fps
            let current = 0;
            
            const timer = setInterval(() => {
                current += step;
                if (current >= target) {
                    current = target;
                    clearInterval(timer);
                }
                
                if (target < 100) {
                    counter.textContent = Math.floor(current) + '%';
                } else if (target >= 1000) {
                    counter.textContent = Math.floor(current).toLocaleString('pt-BR');
                } else {
                    counter.textContent = Math.floor(current);
                }
            }, 16);
            
            counter.parentElement.classList.add('animate');
        });
        
        countersAnimated = true;
    }

    // Observar quando a seção de estatísticas entra na tela
    const statsSection = document.querySelector('.bg-primary.text-white');
    if (statsSection) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounters();
                }
            });
        }, { threshold: 0.5 });
        
        observer.observe(statsSection);
    }
}

// ===== SCROLL SUAVE PARA ÂNCORAS =====
function initSmoothScrolling() {
    const links = document.querySelectorAll('a[href^="#"]');
    
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                const offsetTop = targetSection.offsetTop - 80; // Compensar navbar fixa
                
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
                
                // Fechar menu mobile se estiver aberto
                const navbarCollapse = document.querySelector('.navbar-collapse');
                if (navbarCollapse.classList.contains('show')) {
                    const navbarToggler = document.querySelector('.navbar-toggler');
                    navbarToggler.click();
                }
            }
        });
    });
}

// ===== EFEITOS DA NAVBAR =====
function initNavbarEffects() {
    const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
    
    // Destacar link ativo baseado na seção visível
    window.addEventListener('scroll', function() {
        let current = '';
        const sections = document.querySelectorAll('section[id]');
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            const sectionHeight = section.clientHeight;
            
            if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
                current = section.getAttribute('id');
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
}

// ===== ANIMAÇÕES DE ENTRADA =====
function initAnimations() {
    // Observador para animações quando elementos entram na tela
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);
    
    // Elementos para animar
    const elementsToAnimate = document.querySelectorAll('.feature-card, .feature-item, .contact-item');
    elementsToAnimate.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// ===== ADICIONAR CLASSE DE ANIMAÇÃO =====
document.addEventListener('DOMContentLoaded', function() {
    const style = document.createElement('style');
    style.textContent = `
        .animate-in {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
        
        .navbar-nav .nav-link.active {
            color: var(--accent-color) !important;
        }
    `;
    document.head.appendChild(style);
});

// ===== UTILITÁRIOS =====

// Função para mostrar/esconder loading
function showLoading(element) {
    element.classList.add('loading');
}

function hideLoading(element) {
    element.classList.remove('loading');
}

// Função para notificações avançadas
function showAdvancedNotification(message, type = 'info') {
    // Remover notificação existente
    const existing = document.querySelector('.advanced-notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `advanced-notification notification-${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };

    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${icons[type]}"></i>
            <div class="notification-text">${message}</div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type]};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        z-index: 1000;
        max-width: 400px;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.2);
    `;

    // Estilos internos
    const style = document.createElement('style');
    style.textContent = `
        .notification-content {
            display: flex;
            align-items: flex-start;
            gap: 0.75rem;
        }
        
        .notification-content i:first-child {
            font-size: 1.25rem;
            margin-top: 0.125rem;
        }
        
        .notification-text {
            flex: 1;
            line-height: 1.4;
        }
        
        .notification-close {
            background: none;
            border: none;
            color: rgba(255,255,255,0.8);
            cursor: pointer;
            padding: 0;
            font-size: 1rem;
            margin-left: 0.5rem;
        }
        
        .notification-close:hover {
            color: white;
        }
    `;
    
    if (!document.querySelector('#notification-styles')) {
        style.id = 'notification-styles';
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Animar entrada
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);

    // Configurar fechamento
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    });

    // Auto-remover após 5 segundos
    setTimeout(() => {
        if (document.body.contains(notification)) {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// ===== PARALLAX E EFEITOS VISUAIS =====
function initParallaxEffects() {
    const parallaxElements = document.querySelectorAll('.parallax-element');
    
    if (parallaxElements.length > 0) {
        const handleParallax = debounce(() => {
            const scrolled = window.pageYOffset;
            
            parallaxElements.forEach(element => {
                const speed = parseFloat(element.dataset.speed) || 0.5;
                const yPos = -(scrolled * speed);
                element.style.transform = `translateY(${yPos}px)`;
            });
        }, 10);
        
        window.addEventListener('scroll', handleParallax);
    }
}

// ===== LAZY LOADING PARA IMAGENS =====
function initLazyLoading() {
    const images = document.querySelectorAll('img[data-src]');
    
    if (images.length > 0) {
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    img.classList.add('loaded');
                    imageObserver.unobserve(img);
                }
            });
        }, {
            rootMargin: '50px'
        });

        images.forEach(img => {
            img.classList.add('lazy');
            imageObserver.observe(img);
        });
    }
}

// ===== GESTOS TOUCH PARA MOBILE =====
function initTouchGestures() {
    let startX, startY, distX, distY;
    const threshold = 100;
    
    document.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    });
    
    document.addEventListener('touchend', function(e) {
        if (!startX || !startY) return;
        
        distX = e.changedTouches[0].clientX - startX;
        distY = e.changedTouches[0].clientY - startY;
        
        // Detectar swipe horizontal
        if (Math.abs(distX) > Math.abs(distY) && Math.abs(distX) > threshold) {
            if (distX > 0) {
                // Swipe direita
                handleSwipeRight();
            } else {
                // Swipe esquerda
                handleSwipeLeft();
            }
        }
        
        startX = startY = 0;
    });
}

function handleSwipeRight() {
    // Implementar ação para swipe direita
    console.log('Swipe direita detectado');
}

function handleSwipeLeft() {
    // Implementar ação para swipe esquerda  
    console.log('Swipe esquerda detectado');
}

// ===== PERFORMANCE MONITORING =====
function initPerformanceMonitoring() {
    // Monitorar tempo de carregamento
    window.addEventListener('load', function() {
        const loadTime = performance.now();
        console.log(`⚡ Página carregada em ${Math.round(loadTime)}ms`);
        
        // Verificar Core Web Vitals
        if ('web-vitals' in window) {
            // Implementar métricas de performance se necessário
        }
    });
    
    // Monitorar erros JavaScript
    window.addEventListener('error', function(e) {
        console.error('❌ Erro JavaScript:', e.error);
        // Aqui poderia enviar erro para serviço de monitoramento
    });
}

// ===== ACESSIBILIDADE =====
function initAccessibility() {
    // Detectar navegação por teclado
    let isTabbing = false;
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            isTabbing = true;
            document.body.classList.add('keyboard-navigation');
        }
    });
    
    document.addEventListener('mousedown', function() {
        isTabbing = false;
        document.body.classList.remove('keyboard-navigation');
    });
    
    // Skip links para navegação por teclado
    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.className = 'skip-link';
    skipLink.textContent = 'Pular para o conteúdo principal';
    skipLink.style.cssText = `
        position: absolute;
        top: -40px;
        left: 6px;
        background: var(--primary-color);
        color: white;
        padding: 8px;
        text-decoration: none;
        z-index: 1000;
        border-radius: 4px;
        transition: top 0.3s ease;
    `;
    
    skipLink.addEventListener('focus', function() {
        this.style.top = '6px';
    });
    
    skipLink.addEventListener('blur', function() {
        this.style.top = '-40px';
    });
    
    document.body.insertBefore(skipLink, document.body.firstChild);
}

// ===== INICIALIZAÇÃO COMPLETA =====
document.addEventListener('DOMContentLoaded', function() {
    // Funcionalidades adicionais
    initParallaxEffects();
    initLazyLoading();
    initTouchGestures();
    initPerformanceMonitoring();
    initAccessibility();
});

// ===== OTIMIZAÇÕES =====
// Precarregar recursos críticos
function preloadCriticalResources() {
    const criticalImages = [
        '/images/hero-bg.jpg',
        '/images/dashboard-preview.png'
    ];
    
    criticalImages.forEach(src => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = src;
        document.head.appendChild(link);
    });
}

// Animações CSS para notificações
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(notificationStyles);

// ===== VALIDAÇÕES E HELPERS =====

// Verificar se um elemento está visível na tela
function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// Debounce function para otimizar eventos de scroll
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Aplicar debounce ao scroll
window.addEventListener('scroll', debounce(function() {
    // Funções que precisam de debounce podem ser chamadas aqui
}, 10));

// ===== LOG DE DEBUG E INICIALIZAÇÃO FINAL =====
window.addEventListener('load', function() {
    const preloader = document.querySelector('.preloader');
    if (preloader) {
        preloader.style.opacity = '0';
        setTimeout(() => {
            preloader.style.display = 'none';
        }, 300);
    }
    
    // Precarregar recursos críticos
    preloadCriticalResources();
    
    // Log de sucesso
    console.log('🏥 Sistema APS - Landing Page Moderna Carregada!');
    console.log('✅ Funcionalidades Ativas:');
    console.log('   • Animações AOS e flutuantes');
    console.log('   • Contadores animados');
    console.log('   • Formulário de contato avançado');
    console.log('   • Sistema de notificações');
    console.log('   • Demo de vídeo interativo');
    console.log('   • Tooltips personalizados');
    console.log('   • Efeitos parallax');
    console.log('   • Lazy loading de imagens');
    console.log('   • Navegação acessível');
    console.log('   • Suporte a gestos touch');
    console.log('� Interface otimizada para profissionais de saúde');
});

// ===== ESTILOS DINÂMICOS =====
const dynamicStyles = document.createElement('style');
dynamicStyles.textContent = `
    /* Navegação por teclado */
    .keyboard-navigation *:focus {
        outline: 2px solid var(--accent-color) !important;
        outline-offset: 2px;
    }
    
    /* Lazy loading */
    .lazy {
        opacity: 0;
        transition: opacity 0.3s ease;
    }
    
    .loaded {
        opacity: 1;
    }
    
    /* Animações de notificação */
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    /* Estados de validação */
    .form-control.is-valid {
        border-color: #28a745;
        background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3e%3cpath fill='%2328a745' d='m2.3 6.73.8-.43c0 0 .15-.1.28-.1s.28.1.28.1l.8.43c.24.13.54-.09.54-.36V1.2c0-.27-.3-.49-.54-.36l-.8.43s-.15.1-.28.1-.28-.1-.28-.1l-.8-.43c-.24-.13-.54.09-.54.36v5.17c0 .27.3.49.54.36z'/%3e%3c/svg%3e");
        background-repeat: no-repeat;
        background-position: right calc(.375em + .1875rem) center;
        background-size: calc(.75em + .375rem) calc(.75em + .375rem);
    }
    
    .form-control.is-invalid {
        border-color: #dc3545;
        background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3e%3ccircle cx='6' cy='6' r='4.5'/%3e%3cpath stroke='%23dc3545' d='m5.8 3.6h.4L6 6.5z'/%3e%3ccircle cx='6' cy='8.2' r='.6' fill='%23dc3545'/%3e%3c/svg%3e");
        background-repeat: no-repeat;
        background-position: right calc(.375em + .1875rem) center;
        background-size: calc(.75em + .375rem) calc(.75em + .375rem);
    }
`;
document.head.appendChild(dynamicStyles);