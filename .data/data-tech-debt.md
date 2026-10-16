# Deuda técnica de datos/APIs

Hallazgos de contrato observados durante la documentación. No se ejecutaron cambios de código ni SQL.

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
| D-02 | URL pública solicitada para bucket declarado privado. | `supabase-schema.sql:353-356`, `src/features/board/attachmentsApi.ts:49-51` | Los enlaces devueltos pueden no ser accesibles como URL pública para objetos de bucket privado. | Bajo | Acordar contrato de acceso (p. ej. URL firmada o bucket público con policies revisadas) y sincronizar cliente, bucket y documentación. No se cambió nada. |
| D-03 | Las relaciones de perfiles se proyectan parcialmente y luego se castean a `Profile` completo. | `src/features/board/api.ts:7-21`, `src/features/board/commentsApi.ts:7-17`, `src/types/index.ts:7-16`, `src/types/index.ts:52-54` | Campos no seleccionados quedan ausentes aunque el tipo los declara obligatorios; consumidores pueden recibir `undefined`. | Bajo | Introducir tipos de proyección explícitos o ampliar la selección y validar/mapear la respuesta. |
| D-04 | Nombre de objeto plano no refleja la carpeta de usuario que comprueba la policy de borrado de Storage. | `src/features/board/attachmentsApi.ts:37-45`, `supabase-schema.sql:396-402` | El objeto cargado puede no cumplir la condición de path usada por la policy para borrar objetos. | Bajo | Alinear la convención de path con la policy prevista y validar en el proyecto Supabase. La evaluación de seguridad queda fuera de esta sincronización. |

## 🟢 Baja

| # | Hallazgo | Ubicación | Impacto | Esfuerzo | Recomendación |
| --- | --- | --- | --- | --- | --- |
| D-05 | Las lecturas listadas no muestran paginación; las listas se solicitan sin límite explícito en el cliente. | `src/features/board/api.ts:5-12`, `src/features/board/commentsApi.ts:5-14`, `src/features/board/attachmentsApi.ts:5-10` | Con crecimiento de datos, respuesta y consumo pueden crecer sin límite visible en esta capa. | Medio | Definir paginación/ventana si los volúmenes lo requieren y documentar el contrato. |

## Pendiente fuera del alcance

Los comentarios y predicados de algunas policies RLS/Storage no describen exactamente la misma regla. La documentación de schema registra los predicados observados; una evaluación de seguridad requiere sincronizar `.security/` con la skill `security` o `code-review` y no se realizó aquí.
