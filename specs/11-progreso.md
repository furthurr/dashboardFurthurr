# 11 - Progreso

## 2026-04-28 (sesión inicial)

- Se creó documentación inicial del proyecto.
- Se creó `arquitectura.md`.
- Se creó carpeta `specs/`.
- Se definió SDD como método de trabajo.
- Se documentó stack recomendado compatible con GitHub Pages.
- Se registraron decisiones iniciales.
- Se inicializó repositorio Git.
- Se creó primer commit con documentación.

## 2026-04-28 (sesión actual)

- Se investigó compatibilidad de tecnologías con GitHub Pages.
- Se eligió `design-md/airtable` como referencia visual principal.
- Se creó `supabase-schema.sql` con esquema completo listo para ejecutar en SQL Editor.
- Se actualizaron specs 04 y 05 a estado `aprobada`.
- Se documentaron decisiones de roles y permisos resueltas.
- Se registraron políticas RLS en el schema.
- Se documentó trigger auto-crear perfil en signup.
- Se ejecutó schema SQL en Supabase (base de datos lista).
- Se creó scaffold del proyecto con Vite + React + TypeScript.
- Se instalaron dependencias: Supabase client, dnd-kit, TanStack Query, React Router, React Hook Form, Zod, Tailwind CSS.
- Se configuró Tailwind CSS con `@tailwindcss/vite`.
- Se configuró HashRouter para compatibilidad con GitHub Pages.
- Se configuró Supabase client con variables de entorno.
- Se crearon tipos TypeScript para el proyecto.
- Se creó estructura de carpetas: `features/`, `shared/`, `providers/`, `lib/`.
- Se configuró `vite.config.ts` con `base: '/dashboardFurthurr/'` para GitHub Pages.

## 2026-04-29

- Se implementó autenticación completa:
  - `AuthContext` con estado de sesión, usuario y perfil
  - `LoginPage` con formulario de login
  - `RegisterPage` con formulario de registro
  - `ProtectedRoute` para proteger rutas
  - Se agregó `baseUrl` + `paths` en tsconfig para alias `@/`
  - Build y lint pasan correctamente

## 2026-05-02

### Épica 4 - Tablero Kanban (completada)

- `BoardPage` con 5 columnas (Backlog, Por hacer, Haciendo, En revisión, Finalizadas)
- `TaskCard` y `SortableTaskCard` con soporte drag & drop
- `useTasks`, `useUpdateTaskStatus`, `useCreateTask`, `useUpdateTask`, `useDeleteTask` hooks
- Drag & drop con `@dnd-kit/core` y `@dnd-kit/sortable`
- Actualización optimista con revert en error
- `CreateTaskModal` para crear nuevas tareas
- `TaskDetailModal` con edición de título, descripción, estado y prioridad

### Épica 5 - Comentarios y Adjuntos (completada)

- `useComments`, `useCreateComment`, `useDeleteComment` hooks
- `useAttachments`, `useUploadAttachment`, `useDeleteAttachment` hooks
- `CommentsList` y `AttachmentsList` componentes
- `TaskDetailModal` con tabs para Detalles, Comentarios y Adjuntos
- Subida de archivos a Supabase Storage (máx 5 MB)
- Eliminación de archivos de Storage al eliminar adjunto

### Épica 6 - Deploy (en proceso)

- GitHub Actions workflow `.github/workflows/deploy.yml`
- Build pasa correctamente
- Falta: configurar secrets en GitHub y hacer deploy real

## Repo Creado

- URL: https://github.com/furthurr/dashboardFurthurr
- Primer commit: `7791d6e`

## Próximo Paso

- Configurar secrets en GitHub: `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`
- Hacer primer deploy a GitHub Pages
