# Datos sensibles y PII

Este inventario describe tipos/campos existentes; no contiene valores reales ni certifica controles del servicio Supabase. La implementación local no especifica cifrado propio ni política de retención. El cifrado administrado por el proveedor no se puede verificar solo desde el repositorio.

| Campo/dato | Dónde aparece | Sensibilidad | Cifrado verificable en repo | Almacenamiento | Notas |
| --- | --- | --- | --- | --- | --- |
| Email | `profiles.email`, modelo `Profile` | PII alta | No verificable | PostgreSQL Supabase | Campo obligatorio (`supabase-schema.sql:21-30`, `src/types/index.ts:7-16`) |
| Nombre completo y nickname | `profiles.full_name`, `profiles.nickname` | PII | No verificable | PostgreSQL Supabase | El nombre se deriva de metadata de Auth en el trigger (`supabase-schema.sql:142-154`) |
| Avatar URL | `profiles.avatar_url`, bucket `avatars` | Identificador potencial | No verificable | PostgreSQL + Storage | Bucket declarado público (`supabase-schema.sql:348-351`) |
| Identificadores de Auth/usuario | IDs de perfil, creador, autor y cargador | Dato identificable | No verificable | PostgreSQL/Supabase Auth | UUID asociados a actividad (`supabase-schema.sql:21-30`, `39-50`, `73-98`) |
| Título, descripción y notas | `tasks.title`, `description`, `special_notes` | Contenido de usuario; potencialmente confidencial | No verificable | PostgreSQL Supabase | No hay clasificación de contenido en el repo |
| Comentarios | `comments.body` | Contenido de usuario; potencialmente confidencial | No verificable | PostgreSQL Supabase | Relacionado a tarea y autor |
| Adjuntos y metadata | `file_name`, `file_url`, `file_size`, `mime_type` y objeto | Potencialmente confidencial | No verificable | PostgreSQL + Storage | El bucket de tareas está declarado privado (`supabase-schema.sql:353-356`) |
| Contraseña de alta/cambio | `UsersPage` → `admin-users` → Supabase Auth | Secreto de autenticación | Cifrado del proveedor no verificable aquí | Estado transitorio de formulario/petición; no columna pública | No se devuelve en respuestas ni se registra explícitamente en logs; no se promete revocar sesiones al cambiarla (`supabase/functions/admin-users/index.ts:43-61`) |
| Rol/estado activo | `profiles.role`, `profiles.is_active` | Autorización y estado de cuenta | No verificable | PostgreSQL | No son editables por grants cliente; `is_active` no invalida JWTs existentes (`supabase/migrations/202610190001_user_administration.sql:4-16`) |
| Responsables | `task_assignees` y proyección `AssigneeProfile` | Identidad/actividad del equipo | No verificable | PostgreSQL y caché cliente | La lista activa incluye nombre/correo; no requiere rol admin (`src/features/board/assigneesApi.ts:5-20`) |

## Tratamiento observado

- La app usa una publishable key, cuyo valor no se copia a documentación (`src/lib/supabase.ts:3-10`).
- `AuthContext` escribe el error de carga de perfil en consola sin adjuntar explícitamente el perfil; limpia la caché al perder acceso/cambiar identidad (`src/features/auth/AuthContext.tsx:35-65`).
- `SUPABASE_SERVICE_ROLE_KEY` se usa solo en el entorno de la Edge Function; nunca documentar su valor ni copiarla a variables `VITE_*` (`supabase/functions/admin-users/index.ts:20-23`).
- URLs firmadas de imágenes duran una hora y viven en la caché de UI; no se retiran retroactivamente al desactivar la cuenta ni equivalen al `file_url` persistido (`src/features/board/attachmentsApi.ts:67-95`).
- Editar nombre cambia el perfil público de aplicación, no el nombre en metadata de Auth (`supabase/functions/admin-users/index.ts:63-66`).
- No se documentan requisitos de retención, exportación, borrado de cuenta ni clasificación de datos.
- No se leyó ni transcribió `.env.local`; se omiten URLs/IDs de proyecto y cualquier valor de entorno.
