# Tableros desactivados en solo lectura y borrado solo-servidor

Guía de despliegue y verificación de la regla «un tablero desactivado está en solo
lectura» y del borrado permanente **exclusivamente en servidor**.

> **Estado a 2026-11-06 (publicado en `v0.16.0`):** la migración
> `202611060001_inactive_board_readonly.sql` **NO está aplicada en el proyecto
> remoto**; la Edge Function `board-delete` **NO está desplegada**. El push a `main`
> publica la SPA en GitHub Pages, pero **Pages no despliega SQL ni Edge Functions**:
> hasta aplicar la migración y desplegar la función, el entorno desplegado conserva
> el comportamiento anterior. Nada de esta guía describe el estado del backend
> remoto.

## Qué cambia

| Antes (flujo retirado) | Ahora |
| --- | --- |
| Un tablero desactivado solo perdía el acceso de sus miembros; seguía admitiendo escrituras | Un tablero desactivado rechaza **toda** escritura, **también para el administrador activo** |
| El cliente enumeraba tareas y adjuntos, borraba objetos de Storage y luego llamaba a `delete_inactive_board` | La SPA invoca `board-delete`; el servidor decide qué rutas borrar y conserva un manifiesto |
| `delete_inactive_board` ejecutable por `authenticated` | `delete_inactive_board` **revocada**; el borrado solo existe en la Edge Function |
| Un fallo de limpieza dejaba el tablero activable | Un fallo deja el tablero inactivo, **bloquea la reactivación** y permite reintentar |

Decisión de arquitectura: [ADR 0007](../.architecture/decisions/0007-borrado-tablero-solo-servidor.md).
Contratos: [`.data/01-endpoints.md`](../.data/01-endpoints.md) y
[`.data/04-schema.md`](../.data/04-schema.md).

## Orden de despliegue

Los tres pasos van **coordinados en una ventana de mantenimiento**. Aplicar la
migración sin desplegar la Edge deja el borrado cerrado de forma explícita: falla, pero
no degrada a un borrado parcial desde el cliente.

### 1. Preflight de SQL

Antes de tocar nada, contrasta el ledger y los objetos reales del proyecto. El ledger
remoto no coincide con todos los objetos observados en el schema (ver
[`.data/04-schema.md`](../.data/04-schema.md) y [`supabase/README.md`](../supabase/README.md)).

```bash
npx supabase@2.122.0 db query --linked --project-ref <project-ref> --file supabase/tests/inactive_board_readonly.sql
```

Comprueba, como mínimo:

- Que `delete_inactive_board(uuid)` existe y está concedida a `authenticated` (es el
  estado previo esperado; la migración la revocará).
- Que `boards.is_active` existe y que las RPCs `rename_board`, `set_board_members`,
  `set_task_assignees`, `create_task_with_assignees` y `move_task_to_board` existen con
  sus firmas actuales.
- Que `storage.objects` tiene las policies del bucket `task-attachments`.
- Que `202611060001` **no** está en el ledger.

No ejecutes `db push` global: la migración no es idempotente (renombra funciones y
crea objetos) y un push masivo intentaría recrear objetos históricos.

### 2. Aplicar la migración

```bash
npx supabase@2.122.0 db query --linked --project-ref <project-ref> --file supabase/migrations/202611060001_inactive_board_readonly.sql
```

La migración:

- Crea `public.board_deletion_jobs` con RLS y sin grants cliente.
- Crea `lock_writable_board`, `lock_writable_task` y `lock_writable_task_object`.
- Añade policies **restrictivas** de escritura sobre `tasks`, `task_assignees`,
  `comments`, `task_attachments` y `storage.objects`.
- Renombra las cinco RPCs de escritura a `*_writable_internal` y recrea envoltorios que
  revalidan `lock_writable_*`.
- Crea el trigger `board_deletion_pending` y las RPCs `prepare_board_deletion` /
  `finish_board_deletion` (solo `service_role`).
- Revoca `delete_inactive_board` y emite `NOTIFY pgrst, 'reload schema'`.

**No la reapliques.** Si una operación se interrumpe, contrasta el estado real de cada
objeto antes de continuar; no asumas que «se aplicó a medias» ni que «se aplicó todo».

### 3. Desplegar la Edge Function

```bash
npx supabase@2.122.0 functions deploy board-delete --project-ref <project-ref>
```

`supabase/config.toml` declara `[functions.board-delete]` con `verify_jwt = false`: la
comprobación del bearer la hace el propio handler, que además **rechaza sesiones
OAuth** y exige perfil `admin` activo. `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`
las inyecta el entorno de funciones; nunca las copies al cliente ni a la documentación.

### 4. Publicar la SPA

Publica la versión que invoca `board-delete` y monta los tableros inactivos en solo
lectura. Hasta que la SPA publicada llame a la Edge, el borrado sigue usando el flujo
anterior; hasta que la Edge esté desplegada, el borrado falla de forma cerrada.

## Checklist de verificación manual

Ejecútalo en un **entorno de pruebas** con cuentas reales. Nada de esto sustituye a una
auditoría de seguridad.

### Solo lectura

1. Desactiva un tablero como administrador activo.
2. Ábrelo: debe aparecer el aviso «Tablero desactivado: solo lectura. Actívalo para
   realizar cambios.».
3. Comprueba que **no** se ofrecen: «+ Nueva Tarea», el CTA flotante «Crear tarea», el
   asa de arrastre, los botones de mover, la edición de campos, «Eliminar tarea», el
   alta de comentarios, la subida/renombrado/borrado de adjuntos, el guardado de
   responsables y el traslado a otro tablero.
4. Comprueba que las tarjetas siguen siendo legibles y que su título abre el detalle.
5. Intenta escribir **saltándote la interfaz** (por ejemplo, desde la consola del
   navegador o con un cliente PostgREST): la escritura debe ser rechazada por el
   servidor. En las RPCs de escritura el error es `55000` («Board is not writable»).
6. Repite el punto 5 con una cuenta `usuario` y con una `invitado` que tengan acceso:
   el rechazo debe ser el mismo.
7. En el selector, comprueba que «Gestionar miembros» y «Cambiar nombre» **no** se
   ofrecen para el tablero inactivo, y que «Activar» y «Eliminar tablero» sí.
8. Reactiva el tablero y comprueba que vuelve a ser editable.

### Borrado solo-servidor

1. Desactiva un tablero con al menos una tarea y un adjunto.
2. Como administrador activo, pulsa «Eliminar tablero» y confirma.
3. Comprueba que el tablero, sus tareas, comentarios, responsables y metadata de
   adjuntos desaparecen, y que los objetos de Storage del bucket `task-attachments`
   también.
4. Intenta el borrado con una sesión **OAuth** (por ejemplo, un cliente MCP): debe
   rechazarse con `403` («Se requiere una sesión del portal.»).
5. Intenta el borrado con una cuenta `usuario` o `invitado`: debe rechazarse con `403`.
6. Intenta invocar `delete_inactive_board` directamente desde el cliente: debe fallar
   por falta de permiso (`PGRST202` si la función no está en el esquema, o denegación
   de ejecución si lo está).
7. Intenta borrar un tablero **activo**: debe rechazarse con `409` («Solo se pueden
   eliminar tableros desactivados.»).

### Recuperación tras un fallo

1. Simula un fallo de Storage (por ejemplo, con un objeto huérfano que no se pueda
   eliminar) y lanza el borrado.
2. Comprueba que el tablero **sigue visible** para el administrador, continúa
   inactivo y conserva sus metadatos; algunos archivos pueden haber desaparecido.
3. Comprueba que «Activar» falla con `55000` («El tablero está desactivado o tiene un
   borrado pendiente…»): la reactivación está bloqueada mientras exista el trabajo
   pendiente.
4. Corrige la causa y vuelve a pulsar «Eliminar tablero»: el manifiesto se reutiliza y
   la operación se completa.
5. Comprueba que otro administrador activo también puede reintentar.

## Verificación local

```bash
npm run test:dev-env
npx vitest run --maxWorkers=2
deno test --allow-env supabase/functions/board-delete/index_test.ts
deno test --allow-read --allow-run=docker supabase/tests/inactive_board_bootstrap_test.ts
deno test --allow-read --allow-run=docker supabase/tests/mcp_sql_test.ts
npm run lint
npm run build
```

El harness SQL usa PostgreSQL 16 desechable con Auth/Storage simulados, en rutas
incremental y bootstrap; las fixtures se revierten. Los mocks de la Edge Function **no
son un E2E real** de Auth, OAuth ni Storage.

## Límites

- No hay transacción distribuida entre Storage y PostgreSQL, ni rollback de archivos ya
  eliminados, ni worker automático de reintento.
- Las URLs firmadas ya emitidas conservan su vigencia habitual mientras exista el
  objeto.
- La migración no es idempotente y no debe reaplicarse.
- La regla de solo lectura es la frontera efectiva; ocultar controles en React nunca
  sustituye a RLS, a las policies restrictivas ni a las guardas de las RPCs.
