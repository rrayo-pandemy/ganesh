// Test script to verify functionality
console.log('=== FUNCTIONALITY TEST ===');

// Test 1: Theme Toggle
console.log('Theme toggle elements count:', document.querySelectorAll('.theme-toggle').length);
console.log('Theme toggle first found:', !!document.querySelector('.theme-toggle'));


// Test 2: Dropdown elements
const dropdownToggle = document.querySelector('.nav__item--dropdown > .nav__link');
const dropdownItem = document.querySelector('.nav__item--dropdown');
console.log('Dropdown toggle found:', !!dropdownToggle);
console.log('Dropdown item found:', !!dropdownItem);
if (dropdownItem) {
    console.log('Dropdown item classes:', dropdownItem.className);
}

// Test 3: Fade-in elements
const fadeElements = document.querySelectorAll('.fade-in');
console.log('Fade-in elements found:', fadeElements.length);

// Test 4: Check if classes are initialized
setTimeout(() => {
    console.log('Navigation instance:', typeof window.navigation !== 'undefined' ? 'exists' : 'not found');
    console.log('ThemeManager instance:', typeof window.themeManager !== 'undefined' ? 'exists' : 'not found');
    console.log('ScrollAnimations instance:', typeof window.scrollAnimations !== 'undefined' ? 'exists' : 'not found');
}, 100);

// Manual test functions
window.testThemeToggle = () => {
    const btn = document.querySelector('.theme-toggle');
    // Test helpers for manual QA. Wait for DOM and initialization.
    document.addEventListener('DOMContentLoaded', () => {
        window.testThemeToggle = function() {
            console.log('Manually toggling theme...');
            const btn = document.querySelector('.theme-toggle');
            if (!btn) {
                console.warn('Theme toggle button not found');
                return;
            }
            // Prefer calling the manager if available to avoid event timing issues
            if (window.themeManager && typeof window.themeManager.toggleTheme === 'function') {
                window.themeManager.toggleTheme();
            } else {
                btn.click();
            }
            console.log('Body classes after toggle:', document.body.className);
            console.log('localStorage theme:', localStorage.getItem('theme'));
            console.log('window.themeManager present:', !!window.themeManager);
        };

        window.testDropdown = function() {
            const cat = document.querySelector('.categories');
            if (!cat) { console.warn('Categories menu not found'); return; }
            const toggle = cat.querySelector('.dropdown-toggle');
            if (toggle) toggle.click();
            console.log('Dropdown clicked');
        };

        window.testScroll = function() {
            console.log('Testing scroll reveal');
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        };
    });
};

window.testDropdown = () => {
    if (dropdownToggle) {
        console.log('Manually clicking dropdown toggle...');
        dropdownToggle.click();
        setTimeout(() => {
            console.log('Dropdown item classes after click:', dropdownItem.className);
        }, 100);
    } else {
        console.log('Dropdown toggle not found');
    }
};

window.testScroll = () => {
    const firstFade = document.querySelector('.fade-in');
    if (firstFade) {
        console.log('Adding visible class to first fade-in element...');
        firstFade.classList.add('visible');
    } else {
        console.log('No fade-in elements found');
    }
};

console.log('=== Test functions available: testThemeToggle(), testDropdown(), testScroll() ===');