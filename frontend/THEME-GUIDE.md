# Guia de Tema (Light / Dark)

Este frontend usa un sistema de tema unificado con `data-theme` en `:root`.

## Reglas para nuevo contenido

1. Usa variables CSS, no colores hardcodeados.
2. Usa `var(--color-bg)`, `var(--color-bg-secondary)`, `var(--color-text)`, `var(--color-text-light)`, `var(--color-border)`, `var(--color-input-bg)`.
3. Para bloques nuevos puedes reutilizar utilidades:
   - `.theme-surface`
   - `.theme-input`
   - `.theme-text-muted`
4. Si creas una nueva pagina, incluye `js/theme-manager.js`.
5. Si la pagina tiene boton de tema, usa clase `.theme-toggle`.
6. Evita reglas por pagina tipo `body.dark-theme ...`; prioriza `:root[data-theme='dark']` y variables.

## Comportamiento global

- Preferencia persistida en `localStorage` bajo la clave `theme`.
- Tema aplicado desde `window.themeManager`.
- Evento disponible: `document.addEventListener('theme:change', handler)`.
