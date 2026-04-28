# Arquitectura Del Proyecto

## Resumen

La aplicación será una SPA estática desplegada en GitHub Pages. El frontend se comunicará directamente con Supabase para autenticación, base de datos, almacenamiento y, opcionalmente, actualizaciones en tiempo real.

No se contempla backend propio en esta fase para mantener compatibilidad completa con GitHub Pages.

## Stack Recomendado

- Frontend: React + Vite + TypeScript
- Estilos: Tailwind CSS
- Routing: React Router con `HashRouter`
- Backend gestionado: Supabase
- Auth: Supabase Auth
- Base de datos: Supabase PostgreSQL
- Storage: Supabase Storage
- Realtime: Supabase Realtime, opcional
- Drag & drop: dnd-kit
- Data fetching/cache: TanStack Query
- Formularios: React Hook Form
- Validación: Zod
- Deploy: GitHub Actions + GitHub Pages

## Razón De Arquitectura

GitHub Pages solo sirve contenido estático. Por eso la app debe compilarse a HTML, CSS y JavaScript sin depender de un servidor Node, SSR o API propia.

Supabase cubrirá las necesidades dinámicas del sistema:

- Registro e inicio de sesión.
- Perfiles de usuario.
- Persistencia de tareas, comentarios y asignaciones.
- Adjuntos y fotos de usuario.
- Reglas de seguridad con Row Level Security.
- Actualización colaborativa mediante Realtime si se activa.

## Diagrama Lógico

```txt
Usuario
  |
  v
GitHub Pages
  |
  v
SPA React/Vite
  |
  +--> Supabase Auth
  +--> Supabase PostgreSQL
  +--> Supabase Storage
  +--> Supabase Realtime opcional
```

## Capas Del Frontend

- `app`: inicialización, rutas, providers y configuración global.
- `features/auth`: login, registro, sesión y perfil.
- `features/board`: tablero Kanban, columnas y cards.
- `features/tasks`: detalle, edición, prioridad, asignaciones y adjuntos.
- `features/comments`: comentarios y permisos de edición.
- `shared/ui`: componentes reutilizables.
- `shared/lib`: clientes, helpers y validadores.

Esta estructura es una propuesta para cuando inicie la implementación. No se creará todavía.

## Rutas Previstas

- `/#/login`: inicio de sesión.
- `/#/register`: registro de usuario.
- `/#/board`: tablero principal.
- `/#/tasks/:taskId`: detalle de tarea, si se decide usar ruta dedicada.
- `/#/settings/profile`: perfil de usuario.
- `/#/admin/users`: administración de usuarios, solo admin.

## Compatibilidad Con GitHub Pages

Se recomienda `HashRouter` porque GitHub Pages no reescribe automáticamente todas las rutas hacia `index.html`. Con rutas hash se evitan errores 404 al refrescar páginas internas.

Ejemplo:

```txt
https://usuario.github.io/dashboardFurthurr/#/board
```

## Seguridad

La seguridad no debe depender solo del frontend. Las reglas reales deben estar en Supabase mediante RLS.

Principios:

- No exponer claves secretas en el frontend.
- Usar solo `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
- No usar `service_role` en cliente.
- Validar roles en Supabase para operaciones sensibles.
- Limitar adjuntos a 5 MB en frontend y storage.

## Diseño

Referencia principal: `design-md/airtable`.

Motivo:

- Se adapta a herramientas de productividad y datos estructurados.
- Permite una interfaz amigable y colorida sin copiar marca de Trello.
- Funciona bien con tableros, columnas, cards, etiquetas y estados.

Referencia secundaria posible: `design-md/linear.app` si se decide una estética más sobria y precisa.
