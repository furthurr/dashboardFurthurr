# Dashboard Furthurr - Planeación SDD

Este repositorio está en fase de planeación. Todavía no contiene el proyecto web ni código de aplicación.

La fuente de verdad del proyecto será la carpeta [`specs/`](./specs), donde iremos documentando, ajustando y aprobando las decisiones antes y durante el desarrollo.

## Objetivo

Crear una aplicación web tipo Trello para gestión de tareas mediante tableros Kanban, conectada a Supabase, con autenticación, roles, comentarios, asignaciones múltiples, adjuntos ligeros y despliegue en GitHub Pages.

## Estado Actual

- Fase: Planeación
- Metodología: SDD, Specification Driven Development
- Backend previsto: Supabase
- Frontend previsto: React + Vite + TypeScript
- Deploy previsto: GitHub Pages
- Diseño de referencia: `design-md/airtable`, con experiencia de tablero similar a Trello

## Documentos Principales

- [`arquitectura.md`](./arquitectura.md): arquitectura técnica propuesta.
- [`specs/README.md`](./specs/README.md): índice y reglas de trabajo SDD.
- [`specs/00-init.md`](./specs/00-init.md): documento inicial del proyecto.
- [`specs/01-producto.md`](./specs/01-producto.md): visión, alcance y usuarios.
- [`specs/02-requisitos-funcionales.md`](./specs/02-requisitos-funcionales.md): funcionalidades esperadas.
- [`specs/03-requisitos-no-funcionales.md`](./specs/03-requisitos-no-funcionales.md): rendimiento, seguridad y compatibilidad.
- [`specs/04-modelo-datos.md`](./specs/04-modelo-datos.md): modelo inicial de Supabase.
- [`specs/05-auth-roles-permisos.md`](./specs/05-auth-roles-permisos.md): autenticación, roles y RLS.
- [`specs/06-ui-ux-diseno.md`](./specs/06-ui-ux-diseno.md): guía visual y experiencia de usuario.
- [`specs/07-kanban-drag-drop.md`](./specs/07-kanban-drag-drop.md): comportamiento del tablero.
- [`specs/08-deploy-github-pages.md`](./specs/08-deploy-github-pages.md): estrategia de despliegue.
- [`specs/09-backlog-sdd.md`](./specs/09-backlog-sdd.md): backlog técnico y funcional.
- [`specs/10-decisiones.md`](./specs/10-decisiones.md): registro de decisiones.
- [`specs/11-progreso.md`](./specs/11-progreso.md): bitácora de avance.

## Regla De Trabajo

Antes de programar una funcionalidad, debe existir una especificación en `specs/`. Si algo cambia durante el desarrollo, primero se actualiza la especificación correspondiente y después se implementa.
