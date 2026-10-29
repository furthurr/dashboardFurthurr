# Dashboard Furthurr

Dashboard web para organizar tareas en tableros Kanban. Incluye autenticación con Supabase, asignaciones, comentarios, adjuntos y avatares de perfil. La aplicación cliente es una SPA estática; las operaciones administrativas de usuarios y tableros se validan en servicios gestionados de Supabase.

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

El bootstrap de referencia, incluidas tablas, RLS, Storage, vistas, grants y RPCs, está en [`supabase-schema.sql`](supabase-schema.sql). Para una instalación existente usa únicamente las migraciones incrementales pendientes en el orden de [`supabase/README.md`](supabase/README.md); no vuelvas a ejecutar el bootstrap sobre esa base. Contrasta permisos con [`specs/05-auth-roles-permisos.md`](specs/05-auth-roles-permisos.md).

**Administración de usuarios:** el alta, cambios de contraseña, activación y promoción a administrador pasan por la Edge Function `admin-users`; la función valida la sesión y el rol en servidor. El registro público de Auth debe estar deshabilitado. Las altas administrativas quedan confirmadas y activas sin enviar un enlace por correo. El build de GitHub Pages no despliega funciones ni SQL; consulta [`supabase/README.md`](supabase/README.md) para instalación y operación.

**Ciclo de vida de tableros:** el selector consulta `list_boards_with_pending_counts`; el administrador puede renombrar, activar y desactivar. Desactivar conserva tareas y membresías, pero retira el acceso a los miembros. La interfaz local también permite eliminar permanentemente un tablero solo si ya está desactivado. Requiere `202610220001_board_access_returning.sql`, `202610220002_board_lifecycle.sql` y `202610260002_delete_inactive_boards.sql` en instalaciones existentes. El registro de aplicación remota de las migraciones `202610220001`/`202610220002` y de sus suites corresponde al 2026-10-22; no acredita la aplicación de `202610260002`.

**Responsables de tareas:** creación y detalle permiten asignar/desasignar varias personas mediante un desplegable por nombre/correo. Los ya asignados desaparecen de las opciones y «Todos» añade a todos los usuarios activos disponibles. Requiere también la migración `202610200001_task_assignments.sql` de la misma guía. Cualquier cuenta activa, incluidos invitados, puede guardar asignaciones en tareas ajenas sin obtener permiso para editar otros campos. La tarea y sus responsables iniciales se crean en una sola transacción. El tablero permite filtrar por personas y precarga esas personas al crear una tarea; con el filtro «Todos» se inicia sin asignados.

**Adjuntos de tareas:** la cuenta que subió un archivo, quien creó la tarea o un administrador activo con acceso al tablero puede cambiar el nombre visible o eliminarlo. Renombrar actualiza solo `task_attachments.file_name`, sin mover ni cambiar el objeto de Storage. El borrado confirma la acción y elimina el objeto y su metadata; Storage y PostgreSQL son operaciones separadas. Instalaciones existentes requieren `202610260001_task_attachment_management.sql`.

**Avatares:** las personas pueden cambiar su propia foto y un administrador puede cambiar la de cualquier cuenta. Se aceptan JPG, PNG y WebP de hasta 2 MiB. El bucket `avatars` es público para lectura; no cargues imágenes sensibles. Instalaciones existentes requieren `202610260003_profile_avatars.sql`.

Las migraciones `202610260001`–`202610260003` están en el árbol local y su aplicación remota no se verificó en esta actualización. Aplica las pendientes en el orden indicado en [`supabase/README.md`](supabase/README.md) antes de usar esos cambios en una base existente.

## Rutas y GitHub Pages

La app usa `HashRouter` porque GitHub Pages no reescribe rutas SPA. La ruta raíz redirige al selector de tableros. Rutas implementadas:

- `/dashboardFurthurr/#/login`
- `/dashboardFurthurr/#/boards` (selector de tableros; requiere sesión y cuenta activa)
- `/dashboardFurthurr/#/board/:boardId` (tablero Kanban; requiere sesión y acceso al tablero)
- `/dashboardFurthurr/#/users` (requiere administrador activo)
- `/dashboardFurthurr/#/profile` (perfil propio, requiere cuenta activa)
- `/dashboardFurthurr/#/profile/connections` (grants OAuth y autorización adicional de lectura MCP en fase 2 local)
- `/dashboardFurthurr/#/register` (compatibilidad: redirige a `/users`)
- `/dashboardFurthurr/#/auth/callback`
- `/dashboardFurthurr/#/board` (compatibilidad: redirige a `/boards`)

Vite publica bajo `/dashboardFurthurr/`; conserva el prefijo `base` de `vite.config.ts` y el router hash alineados.

El workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) despliega al hacer push a `main` o mediante `workflow_dispatch`: ejecuta `npm ci`, `npm run build` y publica `dist` en GitHub Pages.

## Estructura principal

```text
src/
  App.tsx                    Providers y rutas
  main.tsx                   Entrada React
  features/auth/             Login, sesión y rutas protegidas
  features/users/            Administración de usuarios y avatares
  features/boards/           Selector, miembros y ciclo de vida de tableros
  features/board/            Tablero, tareas, comentarios y adjuntos
  shared/ui/                 Componentes compartidos, incluido ProfileAvatar
  lib/                       Cliente Supabase y utilidades Storage
  types/index.ts             Tipos compartidos
  index.css                  Estilos globales y tokens visuales
specs/                       Especificaciones de producto (fuente de verdad SDD)
supabase-schema.sql          Schema SQL de referencia
supabase/                    Edge Function, migraciones, pruebas SQL y guía operativa
```

Antes de implementar funcionalidad, actualiza o crea la especificación correspondiente en `specs/`. El progreso se sigue contra esas especificaciones.

## Documentación canónica

- [Arquitectura](.architecture/README.md) — módulos, límites, decisiones y despliegue.
- [Datos y API](.data/README.md) — operaciones de Supabase, modelos, schema y datos sensibles.
- [Sistema de diseño](.design/README.md) — fundamentos visuales, componentes y deuda de UI.
- [Mapa de navegación](.navigator/ai-context.md) — contexto breve; [mapa de módulos](.navigator/module-map.json).
- [MCP para clientes de desarrollo](mcp/README.md) — selector e instalación OAuth por plataforma; conserva información de fase 1.
- [Preparar y probar MCP de tareas](docs/prueba-mcp.md) — fase 2 local: `get_task`, permiso explícito por sesión, paginación y adjuntos. Incluye pasos de activación pendientes y resultados que deben verificarse; no acredita despliegue remoto.
- [Especificaciones](specs/README.md) — requisitos, modelo de datos, permisos, UI/UX y flujo Kanban.
- [Operación Supabase](supabase/README.md) — orden de migraciones, pruebas SQL y publicación de Edge Functions.

La documentación canónica describe y referencia las fuentes de implementación; `specs/` conserva la intención funcional, el SQL define el schema fuente y el código describe el comportamiento actualmente implementado.

### MCP de tareas: estado de preparación

El árbol local añade `get_task` junto a `whoami`. El ID completo se copia desde
el icono junto a comentarios o desde el detalle; copiarlo no concede acceso.
La consulta devuelve título, descripción, estado, prioridad, tablero, responsables,
comentarios y metadata/enlaces temporales de adjuntos. Primero se requiere
«Autorizar lectura de tareas» en Conexiones; las sesiones nuevas no heredan ese
permiso. No permite escritura ni interpreta archivos.

Antes de probar desde el cliente MCP remoto, revisar el estado real de Supabase,
aplicar únicamente la migración pendiente `202610280003_mcp_task_read.sql`, desplegar
la función y publicar el portal compatible según [la guía](docs/prueba-mcp.md).
No se ejecutaron esos pasos en la sincronización documental. No admin requiere
membresía explícita en tablero activo, aunque el portal admita acceso por asignación.
Rutas legacy no firmables mantienen metadata con error, no enlace de descarga.

## Autor

<a href="https://furthurr.github.io/" target="_blank" rel="noopener noreferrer">Pedro G. V. @furthurr</a>

- **GitHub:** https://github.com/furthurr
- **Email:** pedrogvas@gmail.com

## Licencia

MIT
