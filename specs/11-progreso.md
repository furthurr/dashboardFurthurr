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

## 2026-10-20

- Se aprobó la edición compartida de tareas: cualquier cuenta autenticada y activa (`admin`, `usuario`, `invitado`) puede editar y mover cualquier card, aunque no la haya creado.
- La interfaz dejó de ocultar los campos de edición por rol o por autoría; el borrado sigue reservado al creador o a un `admin`.
- La base de datos acompaña la regla: nueva policy de `UPDATE` sobre `tasks` para todo autenticado activo y permisos por columna (`title`, `description`, `status`, `priority`, `position`) para que `created_by` no sea escribible desde el cliente.
- Se añadió la migración `supabase/migrations/202610200002_shared_task_editing.sql` para instalaciones existentes y se actualizó el bootstrap `supabase-schema.sql`.
- Se actualizaron las pruebas de cliente y el probe SQL que fijaban la regla anterior.

## Próximo Paso

- Configurar secrets en GitHub: `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`
- Hacer primer deploy a GitHub Pages

## 2026-10-27 — sincronización documental del árbol local

- Se actualizaron los requisitos funcionales, el modelo de datos, la matriz de permisos y la spec de UI/UX para reflejar avatares, gestión de adjuntos y borrado permanente de tableros desactivados.
- El código y las migraciones `202610260001_task_attachment_management.sql`, `202610260002_delete_inactive_boards.sql` y `202610260003_profile_avatars.sql` están presentes en el árbol local; esta anotación no afirma que sus migraciones estén aplicadas en Supabase ni que la SPA esté publicada con esos cambios.
- La secuencia y los probes de `202610220001`/`202610220002` conservan su verificación remota histórica del 2026-10-22. Las migraciones nuevas y sus suites SQL no se ejecutaron ni verificaron remotamente durante esta actualización documental.
- Se actualizaron además los READMEs operativos y los índices de arquitectura/datos/diseño/navegación. Las pruebas de producto no se ejecutaron como parte de este cambio documental.
