<!-- 
  ╔════════════════════════════════════════════════════════════╗
  ║     Ganesh - Mejoras Recomendadas para Frontend       ║
  ║     Implementación de WCAG 2.1 AA + Accesibilidad         ║
  ╚════════════════════════════════════════════════════════════╝
-->

<!-- PARTE 1: AGREGAR AL <HEAD> -->

<!-- 1. Skip to Main Content (Accesibilidad prioritaria) -->
<a href="#main-content" class="skip-to-main">
    Ir al contenido principal
</a>

<!-- 2. Preload de fuentes críticas (Performance) -->
<link rel="preload" as="font" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" crossorigin>

<!-- 3. Manifest para PWA (Progressive Web App) -->
<link rel="manifest" href="/manifest.json">

<!-- 4. Meta tags adicionales para accesibilidad -->
<meta http-equiv="X-UA-Compatible" content="ie=edge">
<meta name="color-scheme" content="light dark">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">

<!-- 5. Importar CSS de accesibilidad -->
<link rel="stylesheet" href="css/accessibility.css">

<!-- PARTE 2: CAMBIOS EN HTML SEMÁNTICO -->

<!-- 
  MEJORA 1: Cambiar estructura navegación con <nav> semántica
  ANTES:
  <div class="nav" role="navigation">
  
  MEJOR:
  <nav aria-label="Menú principal">
-->

<!-- 
  MEJORA 2: Usar <button> correcto para accesibilidad
  ANTES:
  <div class="menu-toggle" onclick="...">
  
  MEJOR:
  <button class="menu-toggle" aria-label="Menú móvil" aria-expanded="false">
-->

<!-- 
  MEJORA 3: Secciones con <section> y <article> semántica
  ANTES:
  <div id="productos" class="products">
  
  MEJOR:
  <section id="productos" aria-labelledby="products-heading">
    <h2 id="products-heading">Productos Destacados</h2>
-->

<!-- 
  MEJORA 4: Etiquetas ARIA para carrito dinámico
  <span class="cart-badge" aria-live="polite" aria-atomic="true">0</span>
  
  Esto anuncia cambios a lectores de pantalla inmediatamente
-->

<!-- 
  MEJORA 5: Form fields con labels correctos
  ANTES:
  <input class="search">
  
  MEJOR:
  <label for="search-input">Buscar productos:</label>
  <input id="search-input" type="search" placeholder="Busca aquí...">
-->

<!-- PARTE 3: MEJORAS CSS A AÑADIR -->

/*
  En css/styles.css, luego de las variables:

  /* Focus outline para navegación teclado */
  :focus-visible {
      outline: 3px solid var(--color-primary);
      outline-offset: 2px;
  }

  /* Botones con tamaño mínimo para toque móvil */
  button {
      min-height: 44px;
      min-width: 44px;
  }

  /* Asegurar suficiente contraste */
  body {
      color: #1a1410;          /* Contrast ratio: 7:1 - AAA */
      background: #fafaf8;
  }

  /* Texto muted con contraste AA mínimo */
  .text-light {
      color: #6b6560;          /* Contrast ratio: 4.5:1 - AA */
  }

  /* Respeto a preferencias de movimiento */
  @media (prefers-reduced-motion: reduce) {
      * {
          animation-duration: 0.01ms !important;
          transition-duration: 0.01ms !important;
      }
  }

  /* Dark mode automático */
  @media (prefers-color-scheme: dark) {
      :root {
          --color-bg: #1a1410;
          --color-text: #fafaf8;
      }
  }
*/

<!-- PARTE 4: MEJORAS JAVASCRIPT -->

/*
  En js/main.js, mejorar accesibilidad dinámica:

  // Cuando carrito se actualiza, anunciar a screen readers
  const cartBadge = document.querySelector('.cart-badge');
  cartBadge.setAttribute('aria-live', 'polite');
  cartBadge.setAttribute('aria-atomic', 'true');

  // Cuando menú abre/cierra
  function toggleMenu() {
      const menuOpen = !menu.classList.contains('open');
      menuToggle.setAttribute('aria-expanded', menuOpen ? 'true' : 'false');
      menu.setAttribute('aria-hidden', menuOpen ? 'false' : 'true');
  }

  // Notificaciones con live region
  function showNotification(message) {
      const notification = document.createElement('div');
      notification.setAttribute('role', 'status');
      notification.setAttribute('aria-live', 'polite');
      notification.textContent = message;
      document.body.appendChild(notification);
  }

  // Validación con mensajes accesibles
  function validateEmail(email) {
      const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      const input = document.querySelector('#email');
      
      if (!isValid) {
          input.setAttribute('aria-invalid', 'true');
          input.setAttribute('aria-describedby', 'email-error');
          document.querySelector('#email-error').textContent = 'Email inválido';
      } else {
          input.setAttribute('aria-invalid', 'false');
      }
      
      return isValid;
  }
*/

<!-- PARTE 5: TESTING DE ACCESIBILIDAD -->

/*
  HERRAMIENTAS RECOMENDADAS (GRATIS):

  1. Google Lighthouse (en Chrome DevTools)
     - F12 → Lighthouse → Generate report
     - Verifica: Performance, Accessibility, Best Practices

  2. axe DevTools (extensión Chrome)
     - Escanea automáticamente violaciones WCAG
     - Muy detallado y fácil de usar

  3. WAVE Web Accessibility Evaluation Tool
     - wave.webaim.org
     - Ingresa: http://localhost:8000
     - Puedes ver contrastes, missing alt text, etc

  4. WebAIM Color Contrast Checker
     - webaim.org/resources/contrastchecker
     - Verifica relación de contraste (AAA/AA)

  5. Screen Reader Testing
     - NVDA (gratis, Windows/Linux)
     - JAWS (pago, Windows)
     - VoiceOver (gratis, Mac/iOS)
*/

<!-- PARTE 6: CHECKLIST FINAL ACCESIBILIDAD -->

/*
  ✅ WCAG 2.1 AA COMPLIANCE CHECKLIST:

  PERCEPCIÓN:
  ☐ Contraste de texto >= 4.5:1 (normal) o 3:1 (large)
  ☐ No usar color solamente para comunicar información
  ☐ Imágenes tienen alt text descriptivo
  ☐ Videos tienen subtítulos y descripciones
  ☐ Contenido no parpadea > 3 veces/segundo

  OPERACIÓN:
  ☐ Navegación completa por teclado (Tab key)
  ☐ Focus indicator visible en todos los elementos
  ☐ Links tienen texto descriptivo (no "click aquí")
  ☐ Formularios tienen labels con <label>
  ☐ Orden lógico de Tab (top-left → bottom-right)
  ☐ Atajos de teclado no interfieren con navegador

  COMPRENSIÓN:
  ☐ Lenguaje claro y simple
  ☐ Instrucciones explícitas para formularios
  ☐ Páginas tienen títulos descriptivos (<title>)
  ☐ Secciones tienen encabezados
  ☐ Abreviaturas explicadas (ej: "IVA (Impuesto al Valor Añadido)")

  ROBUSTEZ:
  ☐ HTML válido (W3C html validator)
  ☐ ARIA labels correctos
  ☐ Elementos con rol explícito cuando es necesario
  ☐ Validación clara en formularios
  ☐ Compatible con screen readers
*/

<!-- PARTE 7: EJEMPLO MEJORADO DE COMPONENTE -->

<!-- 
  PRODUCTO CARD MEJORADO CON ACCESIBILIDAD COMPLETA:
-->

<article class="product-card" data-product-id="1">
    <!-- Imagen con alt descriptivo -->
    <div class="product-image">
        <img 
            src="/images/aurinium-pro.jpg" 
            alt="Aurinium Pro 2026 - Dispositivo premium con tecnología futura"
            loading="lazy"
            width="300"
            height="250"
        >
        <span class="product-badge-premium" aria-label="Producto destacado">Estrella</span>
    </div>

    <div class="product-content">
        <!-- Heading descriptivo con ID para aria-labelledby -->
        <h3 id="product-1-name" class="product-name">Aurinium Pro 2026</h3>
        
        <p class="product-description">
            Dispositivo premium con tecnología futura. Diseño elegante minimalista.
        </p>

        <!-- Precio accesible -->
        <div class="product-price" aria-label="Precio del producto">
            <span class="sr-only">Precio actual:</span>
            <span class="product-price-current">S/. 299.99</span>
            <span class="sr-only">Precio original:</span>
            <span class="product-price-original">S/. 399.99</span>
            
            <span aria-label="Descuento del 25%" class="discount-badge">-25%</span>
        </div>

        <!-- Botones con aria-label completo -->
        <div class="product-actions">
            <button 
                class="btn-add-cart"
                onclick="cartManager.addToCart(1)"
                aria-label="Añadir Aurinium Pro 2026 al carrito"
            >Añadir al Carrito
            </button>
            
            <button 
                class="btn-wishlist"
                title="Añadir a favoritos"
                aria-label="Añadir Aurinium Pro 2026 a favoritos"
            >
                ♡
            </button>
        </div>
    </div>
</article>

<!-- 
  CAMBIOS CLAVE:
  ✓ <article> - elemento semántico
  ✓ aria-label en imagen - describe el contenido
  ✓ loading="lazy" - performance
  ✓ width/height - previene layout shift
  ✓ .sr-only - información para screen readers
  ✓ aria-label en botones - accesibles sin ver UI
  ✓ onclick directo - alternativa: usar <form>
-->

<!-- DEPLOYMENT CHECKLIST -->

/*
  ANTES DE DEPLOYAR A PRODUCCIÓN:

  SEGURIDAD:
  ☐ npm audit - sin vulnerabilidades
  ☐ .env.production con valores seguros
  ☐ JWT_SECRET regenerado (no usar default)
  ☐ HTTPS certificado instalado
  ☐ CORS restringido a dominios permitidos
  ☐ Rate limiting vigente
  ☐ Helmet headers activos
  ☐ Database backup configurado

  ACCESIBILIDAD:
  ☐ Lighthouse score >= 90 (Accessibility)
  ☐ axe DevTools sin errores
  ☐ Navegación completa con teclado
  ☐ Screen reader testing (con NVDA o similar)
  ☐ Contraste verificado (WebAIM)

  PERFORMANCE:
  ☐ Lighthouse score >= 90 (Performance)
  ☐ First Contentful Paint < 2s
  ☐ Largest Contentful Paint < 2.5s
  ☐ Cumulative Layout Shift < 0.1

  FUNCIONALIDAD:
  ☐ Todos los links funcionan
  ☐ Carrito persiste en localStorage
  ☐ Animaciones smooth en mobile
  ☐ Forms validan correctamente
  ☐ Errores se muestran claramente

  SEO:
  ☐ Meta tags completos
  ☐ robots.txt configurado
  ☐ Sitemap.xml generado
  ☐ Structured data (JSON-LD)
  ☐ Open Graph tags
*/
