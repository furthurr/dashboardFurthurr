# 10 - Registro De Decisiones

Estado: `borrador`

## ADR-001 - Usar SPA Estática

Fecha: 2026-04-28

Decisión: La aplicación será una SPA estática.

Motivo: GitHub Pages no ejecuta backend propio ni SSR. Una SPA permite compatibilidad directa.

## ADR-002 - Usar Supabase Como Backend Gestionado

Fecha: 2026-04-28

Decisión: Supabase cubrirá auth, base de datos, storage y posible realtime.

Motivo: Permite funcionalidad dinámica sin servidor propio.

## ADR-003 - Usar React + Vite + TypeScript

Fecha: 2026-04-28

Decisión: El frontend recomendado será React con Vite y TypeScript.

Motivo: Alta compatibilidad con GitHub Pages, build rápido y ecosistema sólido para UI Kanban.

## ADR-004 - Usar HashRouter

Fecha: 2026-04-28

Decisión: Se recomienda `HashRouter`.

Motivo: Evita 404 en rutas internas al desplegar en GitHub Pages.

## ADR-005 - Usar Airtable-Inspired Design

Fecha: 2026-04-28

Decisión: La referencia visual principal será `design-md/airtable`.

Motivo: Encaja con productividad, datos estructurados, cards y tableros visuales.

## ADR-006 - Usar dnd-kit

Fecha: 2026-04-28

Decisión: La librería recomendada para drag & drop será `dnd-kit`.

Motivo: Compatible con React, TypeScript, SPA estática y accesibilidad.
