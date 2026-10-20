# Dashboard Furthurr

Dashboard web para organizar tareas en un tablero Kanban. Incluye autenticación con Supabase, columnas por estado, prioridades, visualización de asignaciones, comentarios y adjuntos. La aplicación es una SPA estática; las operaciones administrativas de usuarios se ejecutan en una Edge Function de Supabase.

## Stack

- React 19, TypeScript y Vite.
- Tailwind CSS v4.
- React Router con `HashRouter` para GitHub Pages.
- TanStack Query para caché y mutaciones.
- Supabase Auth, PostgreSQL y Storage.
- dnd-kit para ordenar y mover tareas.

## Requisitos y ejecución local

Se requiere Node.js 20 o compatible con el workflow de despliegue.

```bash
npm ci
cp .env.example .env.local
# Completar las variables indicadas abajo
npm run dev
```

Comandos disponibles:

| Comando | Uso |
| --- | --- |
| `npm run dev` | Servidor de desarrollo de Vite |
| `npm run build` | Verificación TypeScript y build de producción en `dist/` |
| `npm run lint` | ESLint |
| `npm run preview` | Previsualizar localmente el build |

## Configuración de Supabase

El cliente necesita estas variables tanto en desarrollo como durante el build:

| Variable | Descripción |
| --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave publicable para inicializar el cliente |

En GitHub Actions se proporcionan mediante secretos con esos nombres. No uses `VITE_SUPABASE_KEY`, no incluyas credenciales en el repositorio y nunca expongas una `service_role` en el frontend. `.env.local` debe mantenerse fuera de Git.

El schema de referencia, incluidas tablas, RLS, Storage y vistas, está en [`supabase-schema.sql`](supabase-schema.sql). Según las instrucciones del proyecto, los cambios al schema se realizan allí y se aplican desde Supabase SQL Editor. Contrasta permisos con [`specs/05-auth-roles-permisos.md`](specs/05-auth-roles-permisos.md).

**Administración de usuarios:** antes de publicar esta versión, aplica la migración de estado/permisos, despliega `admin-users` y deshabilita el registro público de Auth siguiendo [`supabase/README.md`](supabase/README.md). El build de GitHub Pages no despliega funciones ni SQL. Las altas administrativas quedan confirmadas y activas sin enviar un enlace por correo.

**Responsables de tareas:** creación y detalle permiten asignar/desasignar varias personas mediante un desplegable por nombre/correo. Los ya asignados desaparecen de las opciones y «Todos» añade a todos los usuarios activos disponibles. Requiere también la migración `202610200001_task_assignments.sql` de la misma guía. Cualquier cuenta activa, incluidos invitados, puede guardar asignaciones en tareas ajenas sin obtener permiso para editar otros campos. La tarea y sus responsables iniciales se crean en una sola transacción. El tablero permite filtrar por personas y precarga esas personas al crear una tarea; con el filtro «Todos» se inicia sin asignados.

## Rutas y GitHub Pages

La app usa `HashRouter` porque GitHub Pages no reescribe rutas SPA. La ruta raíz redirige al tablero. Rutas implementadas:

- `/dashboardFurthurr/#/login`
- `/dashboardFurthurr/#/users` (requiere administrador activo)
- `/dashboardFurthurr/#/profile` (perfil propio, requiere cuenta activa)
- `/dashboardFurthurr/#/register` (compatibilidad: redirige a `/users`)
- `/dashboardFurthurr/#/auth/callback`
- `/dashboardFurthurr/#/board` (requiere sesión y cuenta activa)

Vite publica bajo `/dashboardFurthurr/`; conserva el prefijo `base` de `vite.config.ts` y el router hash alineados.

El workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) despliega al hacer push a `main` o mediante `workflow_dispatch`: ejecuta `npm ci`, `npm run build` y publica `dist` en GitHub Pages.

## Estructura principal

```text
src/
  App.tsx                    Providers y rutas
  main.tsx                   Entrada React
  features/auth/             Login, sesión y rutas protegidas
  features/users/            Administración de usuarios
  features/board/            Tablero, tareas, comentarios y adjuntos
  lib/supabase.ts             Cliente Supabase
  types/index.ts             Tipos compartidos
  index.css                  Estilos globales y tokens visuales
specs/                       Especificaciones de producto (fuente de verdad SDD)
supabase-schema.sql          Schema SQL de referencia
supabase/                    Edge Function, migración y guía de despliegue
```

Antes de implementar funcionalidad, actualiza o crea la especificación correspondiente en `specs/`. El progreso se sigue contra esas especificaciones.

## Documentación canónica

- [Arquitectura](.architecture/README.md) — módulos, límites, decisiones y despliegue.
- [Datos y API](.data/README.md) — operaciones de Supabase, modelos, schema y datos sensibles.
- [Sistema de diseño](.design/README.md) — fundamentos visuales, componentes y deuda de UI.
- [Mapa de navegación](.navigator/ai-context.md) — contexto breve; [mapa de módulos](.navigator/module-map.json).
- [Especificaciones](specs/README.md) — requisitos, modelo de datos, permisos, UI/UX y flujo Kanban.

La documentación canónica describe y referencia las fuentes de implementación; `specs/` conserva la intención funcional, el SQL define el schema fuente y el código describe el comportamiento actualmente implementado.

## Autor

<a href="https://furthurr.github.io/" target="_blank" rel="noopener noreferrer">Pedro G. V. @furthurr</a>

- **GitHub:** https://github.com/furthurr
- **Email:** pedrogvas@gmail.com

## Licencia

MIT
