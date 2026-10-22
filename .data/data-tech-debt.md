# Deuda técnica de datos/APIs

Hallazgos de contrato restantes después de la implementación local de tableros. Esta sincronización documenta evidencia; no modifica producto, ejecuta SQL remoto ni es una auditoría de seguridad.

Revisión focalizada 2026-10-21: D-03 sigue **parcialmente resuelta** por `AssigneeProfile`. D-04 queda **resuelta para el contrato observado**: path de tareas, comprobación del resultado de eliminación y soporte de paths previos en la policy. D-02 se reduce: vistas de archivos usan URLs firmadas, pero `file_url` sigue persistiendo una URL generada por `getPublicUrl` aunque el bucket sea privado. La migración y probes se ejecutaron en el proyecto Supabase seleccionado; esto no es auditoría de seguridad ni certifica otros entornos.

Revisión focalizada 2026-10-22 (ciclo de vida de tableros): el contrato de `boards.is_active` y de las tres RPCs nuevas quedó observado y verificado primero en local (PostgreSQL 16 en Docker con Auth/Storage simulados) y después **aplicado y verificado en el proyecto Supabase remoto** ese mismo 2026-10-22, en el orden `202610220001` → `202610220002`; las tres suites SQL remotas pasan y revierten sus fixtures con `ROLLBACK`. Se añade D-06 (coste del conteo de pendientes) y D-07, que pasa de «despliegue pendiente» a «publicación de la SPA pendiente».

## 🔴 Crítica

| # | Hallazgo | Ubicación (archivo:línea) | Impacto | Esfuerzo | Recomendación |
| --- | --- | --- | --- | --- | --- |
| — | Sin hallazgos verificados de esta severidad en el alcance documental. | — | — | — | — |

## 🟠 Alta

| # | Hallazgo | Ubicación | Impacto | Esfuerzo | Recomendación |
| --- | --- | --- | --- | --- | --- |
| — | Sin hallazgos verificados de esta severidad en el alcance documental. | — | — | — | — |

## 🟡 Media

| # | Hallazgo | Ubicación | Impacto | Esfuerzo | Recomendación |
| --- | --- | --- | --- | --- | --- |
| D-01 | Regla de borrado incompatible con nullabilidad: `comments.author_id` y `task_attachments.uploaded_by` son `NOT NULL` pero sus FKs especifican `ON DELETE SET NULL`. | `supabase-schema.sql:73-76`, `supabase-schema.sql:89-93` | Borrar perfil referenciado puede fallar por violación `NOT NULL` en lugar de conservar el comportamiento esperado por la FK. | Bajo | Decidir si la relación debe ser nullable, restringir el borrado o usar otra acción referencial; alinear SQL y especificaciones. |
| D-02 | Metadata conserva URL construida por `getPublicUrl` mientras `task-attachments` es privado; UI obtiene links firmados de 60 s. | `src/features/board/attachmentsApi.ts`, `supabase-schema.sql`, `supabase/migrations/202610210001_boards.sql:133-172` | La columna representa una URL no destinada a consumo directo; visualización requiere firma y acceso vigente al tablero. | Bajo | Considerar almacenar solo object path o formalizar la URL metadata como referencia opaca; no asumir la configuración remota sin verificar. |
| D-03 | Parcialmente resuelta: responsables usan `AssigneeProfile` explícito; el autor de comentarios aún se castea a `Profile` completo desde una proyección parcial. | `src/types/index.ts:41-47`, `:55-66`, `src/features/board/commentsApi.ts:7-16` | El autor puede carecer de email, estado activo y otros campos que el tipo exige. | Bajo | Tipar la proyección de autor o ampliar/validar la respuesta; no reabrir el caso ya corregido de responsables. |
| D-04 | **Resuelta en el árbol local**: las cargas nuevas usan `<taskId>/<UUID>.<ext>`; la policy autoriza por metadata/tarea, contempla paths legacy y cliente comprueba error al borrar. | `src/features/board/attachmentsApi.ts`, `supabase/migrations/202610210001_boards.sql:133-172` | No se reproduce el desacople de path detectado en la versión anterior; falta aplicación/remoto para comprobar entorno real. | — | Verificar despliegue junto a migración; no equivale a auditoría de Storage. |

## 🟢 Baja

| # | Hallazgo | Ubicación | Impacto | Esfuerzo | Recomendación |
| --- | --- | --- | --- | --- | --- |
| D-05 | Las lecturas listadas no muestran paginación; las listas se solicitan sin límite explícito en el cliente. | `src/features/board/api.ts:5-12`, `src/features/board/commentsApi.ts:5-14`, `src/features/board/attachmentsApi.ts:5-10` | Con crecimiento de datos, respuesta y consumo pueden crecer sin límite visible en esta capa. | Medio | Definir paginación/ventana si los volúmenes lo requieren y documentar el contrato. |
| D-06 | El conteo de pendientes se recalcula en cada listado: la RPC ejecuta un subselect correlacionado sobre `tasks` por tablero, y el cliente refresca cada 30 s. | `supabase/migrations/202610220002_board_lifecycle.sql:71-85`, `src/features/boards/api.ts:20-22` | Con muchos tableros y tareas el coste de la consulta crece; no hay caché ni materialización del conteo. | Medio/alto | Medir en el entorno real; considerar vista materializada o columna mantenida si el volumen lo justifica, o ampliar el intervalo de refresco. |
| D-07 | El contrato nuevo (`boards.is_active` y las RPCs `rename_board`, `set_board_active`, `list_boards_with_pending_counts`) está en el bootstrap y en migraciones y **se aplicó en el proyecto Supabase remoto el 2026-10-22**, en el orden `202610220001` → `202610220002`; lo que queda pendiente es la **publicación de la SPA** en GitHub Pages. | `supabase/migrations/202610220002_board_lifecycle.sql`, `supabase/migrations/202610220001_board_access_returning.sql`, `supabase/README.md` | Mientras la SPA no se publique, la base remota ya tiene el contrato pero los usuarios siguen viendo la versión anterior del selector; en una base sin las migraciones el listado por RPC fallaría y el selector quedaría en error con reintento. | Bajo | Publicar la SPA en GitHub Pages (push a `main`) y repetir la comprobación manual del ciclo de vida contra el servicio real. |

D-05 se limita a tareas/comentarios/adjuntos, no al nuevo listado administrativo (50 por página) ni al fetch paginado de usuarios asignables (500 por lote); este último termina acumulando todos los perfiles activos en memoria.

D-06 y D-07 son hallazgos del árbol de trabajo sin commit: aunque el contrato nuevo ya se aplicó y verificó en el proyecto Supabase remoto, no se midió el comportamiento del servicio real con la SPA publicada ni con cuentas reales, y el baseline Git sigue pendiente.

## Pendiente fuera del alcance

Los comentarios y predicados de algunas policies RLS/Storage no describen exactamente la misma regla. La documentación de schema registra los predicados observados; una evaluación de seguridad requiere sincronizar `.security/` con la skill `security` o `code-review` y no se realizó aquí.
