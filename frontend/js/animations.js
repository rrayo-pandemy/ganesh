/* ============================================
   SCROLL REVEAL & ANIMATIONS
   ============================================ */

class AnimationManager {
    constructor() {
        this.observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        this.setupIntersectionObserver();
    }

    setupIntersectionObserver() {
        if (!('IntersectionObserver' in window)) {
            // Fallback for older browsers
            document.querySelectorAll('.scroll-reveal').forEach(el => {
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            });
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    // Unobserve after revealing
                    observer.unobserve(entry.target);
                }
            });
        }, this.observerOptions);

        document.querySelectorAll('.scroll-reveal').forEach(el => {
            observer.observe(el);
        });
    }

    // Parallax effect on scroll (subtle)
    setupParallax() {
        const parallaxElements = document.querySelectorAll('[data-parallax]');
        if (parallaxElements.length === 0) return;

        window.addEventListener('scroll', () => {
            const scrollY = window.scrollY;
            parallaxElements.forEach(el => {
                const speed = el.dataset.parallax || 0.5;
                el.style.transform = `translateY(${scrollY * speed}px)`;
            });
        }, { passive: true });
    }

    // Fade in animations on load
    setupInitialAnimations() {
        const fadeElements = document.querySelectorAll('.fade-in-up, .fade-in-right');
        fadeElements.forEach((el, index) => {
            el.style.animationDelay = (index * 0.1) + 's';
        });
    }

    // Initialize all animations
    init() {
        this.setupInitialAnimations();
        this.setupParallax();
    }
}

// Initialize animations when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const animationManager = new AnimationManager();
    animationManager.init();
});

/* ============================================
   SMOOTH SCROLL BEHAVIOR
   ============================================ */

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#') return;
        
        e.preventDefault();
        const target = document.querySelector(href);
        
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            
            // Close mobile menu if open
            const menuToggle = document.querySelector('.menu-toggle');
            const nav = document.querySelector('.nav');
            if (menuToggle && menuToggle.classList.contains('open')) {
                menuToggle.classList.remove('open');
                nav.classList.remove('open');
            }
        }
    });
});

/* ============================================
   UTILITY FUNCTIONS
   ============================================ */

// Debounce function for performance
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

// Format currency
function formatCurrency(value) {
    return new Intl.NumberFormat('es-PE', {
        style: 'currency',
        currency: 'PEN',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

// Log with timestamp
function log(message, type = 'info') {
    console.log(`[${new Date().toLocaleTimeString()}] ${type.toUpperCase()}: ${message}`);
}
