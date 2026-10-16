# ADR 0002: HashRouter para GitHub Pages

- Estado: Aceptada (decisión observada en la implementación)
- Fecha: 2026-10-16 (registro documental; no representa necesariamente la fecha original de adopción)

## Contexto

La aplicación es una SPA alojada en GitHub Pages y la configuración consultada no define rewrites de rutas hacia `index.html` (`.github/workflows/deploy.yml:17-53`). Las rutas internas necesitan funcionar al abrir o refrescar una URL publicada.

## Decisión

Usar `HashRouter` de React Router. La ruta raíz redirige a `/board`; las rutas implementadas son login, registro, callback de autenticación y tablero protegido.

## Alternativas consideradas

- Router basado en History API: no adoptado porque una ruta interna requiere que el host reescriba la URL al documento SPA, comportamiento que el repositorio no configura para GitHub Pages.

## Consecuencias

- Positivas: el estado de navegación queda en el fragmento y funciona bajo el hosting estático sin rewrites.
- Negativas / trade-offs: las URLs visibles incluyen `#`; el prefijo base de Vite y las rutas hash deben mantenerse coherentes.

## Evidencia

- `src/App.tsx:1-37`
- `vite.config.ts:6-13`
- `AGENTS.md:42-44` (sección «GitHub Pages Routing Gotcha»)
