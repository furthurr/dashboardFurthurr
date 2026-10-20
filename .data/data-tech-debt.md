# Deuda técnica de datos/APIs

Hallazgos de contrato observados durante la documentación. No se ejecutaron cambios de código ni SQL.

Revisión focalizada 2026-10-20: D-03 queda **parcialmente resuelta** por `AssigneeProfile`; el resto conserva alcance y severidad, sin auditoría de seguridad adicional. D-02 no se cierra por las miniaturas firmadas: el upload sigue almacenando una URL pública.

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
| D-02 | URL pública solicitada para bucket declarado privado; miniaturas usan URLs firmadas pero metadata conserva `getPublicUrl`. | `supabase-schema.sql:354-357`, `src/features/board/attachmentsApi.ts:67-95`, `:123-134` | El enlace general persistido puede no ser accesible aunque funcionen miniaturas firmadas. | Bajo | Acordar contrato de acceso general y alinear cliente/bucket/documentación; no se cambió producto. |
| D-03 | Parcialmente resuelta: responsables usan `AssigneeProfile` explícito; el autor de comentarios aún se castea a `Profile` completo desde una proyección parcial. | `src/types/index.ts:32-38`, `:55-57`, `src/features/board/commentsApi.ts:7-16` | El autor puede carecer de email, estado activo y otros campos que el tipo exige. | Bajo | Tipar la proyección de autor o ampliar/validar la respuesta; no reabrir el caso ya corregido de responsables. |
| D-04 | Nombre de objeto plano no refleja la carpeta de usuario que comprueba la policy de borrado de Storage. | `src/features/board/attachmentsApi.ts:111-119`, `supabase-schema.sql:397-403` | El objeto puede no cumplir la condición de path para borrarlo; además el cliente no comprueba el resultado del borrado de Storage. | Bajo | Alinear path/policy y comprobar resultado; evaluación de seguridad fuera de esta sincronización. |

## 🟢 Baja

| # | Hallazgo | Ubicación | Impacto | Esfuerzo | Recomendación |
| --- | --- | --- | --- | --- | --- |
| D-05 | Las lecturas listadas no muestran paginación; las listas se solicitan sin límite explícito en el cliente. | `src/features/board/api.ts:5-12`, `src/features/board/commentsApi.ts:5-14`, `src/features/board/attachmentsApi.ts:5-10` | Con crecimiento de datos, respuesta y consumo pueden crecer sin límite visible en esta capa. | Medio | Definir paginación/ventana si los volúmenes lo requieren y documentar el contrato. |

D-05 se limita a tareas/comentarios/adjuntos, no al nuevo listado administrativo (50 por página) ni al fetch paginado de usuarios asignables (500 por lote); este último termina acumulando todos los perfiles activos en memoria.

## Pendiente fuera del alcance

Los comentarios y predicados de algunas policies RLS/Storage no describen exactamente la misma regla. La documentación de schema registra los predicados observados; una evaluación de seguridad requiere sincronizar `.security/` con la skill `security` o `code-review` y no se realizó aquí.
