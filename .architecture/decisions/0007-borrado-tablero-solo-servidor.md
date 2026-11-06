# ADR 0007: tableros desactivados en solo lectura y borrado solo en servidor

- Estado: implementado y publicado en `v0.16.0` (código, migración y pruebas). La migración `202611060001_inactive_board_readonly.sql` **no está aplicada en remoto** y la Edge Function `board-delete` **no está desplegada**: el push a `main` publica la SPA en GitHub Pages, pero Pages no despliega SQL ni Edge Functions, así que el entorno desplegado conserva el comportamiento anterior.
- Fecha: 2026-11-06.
- Amplía el ciclo de vida de tableros descrito en [ADR 0003](0003-membresia-explicita-tableros.md) y sustituye el borrado cliente descrito en [ADR 0001](0001-spa-estatica-supabase.md).

## Contexto

El producto permite desactivar un tablero sin borrar su contenido. El problema observado
era que un tablero desactivado seguía admitiendo escrituras: la interfaz solo ocultaba
algunos controles y el servidor no impedía crear tareas, moverlas, reasignar
responsables, renombrar el tablero, cambiar sus miembros o subir/borrar adjuntos.

En paralelo, el borrado permanente se ejecutaba desde el navegador: el cliente
enumeraba tareas y adjuntos, derivaba rutas de Storage, borraba los objetos y después
invocaba la RPC `delete_inactive_board`. Eso dejaba al cliente como responsable de
decidir qué rutas eliminar, sin manifiesto persistido, sin idempotencia y con una
ventana en la que el tablero seguía existiendo en la base de datos con parte de sus
archivos ya borrados.

## Decisión implementada

- **Tablero desactivado = solo lectura en el servidor.** La migración
  `202611060001_inactive_board_readonly.sql` añade policies **restrictivas** de
  `INSERT`/`UPDATE`/`DELETE` sobre `tasks`, `task_assignees`, `comments`,
  `task_attachments` y `storage.objects` (bucket `task-attachments`), todas condicionadas
  a `lock_writable_board` / `lock_writable_task` / `lock_writable_task_object`. La regla
  se aplica **también al administrador activo**: desactivar es un estado de solo lectura
  para todos, no una excepción de rol.
- **Guardas en las RPCs de escritura.** Las funciones `SECURITY DEFINER` que evitan
  RLS (`rename_board`, `set_board_members`, `set_task_assignees`,
  `create_task_with_assignees`, `move_task_to_board`) se renombran a
  `*_writable_internal` —con sus validaciones originales intactas— y se recrean como
  envoltorios que comprueban admin/acceso y `lock_writable_*` antes de delegar. Un
  tablero inactivo responde `55000` («Board is not writable»).
- **Borrado solo en servidor.** La Edge Function `board-delete` es la única vía de
  borrado. Verifica el bearer con `auth.getUser`, **rechaza sesiones OAuth**
  (`client_id` presente o `role != authenticated`), exige perfil `admin` activo y
  llama a dos RPCs `service_role`: `prepare_board_deletion` (bloquea la fila, exige
  tablero inactivo y guarda un manifiesto de rutas en `board_deletion_jobs`) y
  `finish_board_deletion` (comprueba que no queden objetos del manifiesto y elimina
  tareas y tablero). La eliminación de objetos usa la API de Storage en lotes de 100.
- **Sin fallback cliente.** `delete_inactive_board` queda revocada para `public`,
  `anon` y `authenticated`; el cliente ya no enumera rutas ni borra objetos. No se
  restaura el grant anterior ni se añade una vía alternativa.
- **Reactivación bloqueada durante un borrado pendiente.** El trigger
  `board_deletion_pending` impide volver a activar un tablero con un trabajo de
  borrado registrado, para que un fallo de limpieza de Storage no deje un tablero
  parcialmente vaciado y reutilizable.
- **Reintento administrativo.** No hay transacción distribuida ni worker automático:
  si falla la limpieza, el tablero permanece visible para el admin, inactivo y con sus
  metadatos; algunos archivos pueden haber desaparecido. Reintentar «Eliminar tablero»
  reutiliza el manifiesto y completa la operación. La reactivación queda bloqueada
  mientras exista el trabajo pendiente.
- **Interfaz alineada.** `BoardRoute` propaga `readOnly={!board.is_active}` a
  `BoardPage`, que oculta «+ Nueva Tarea», el CTA flotante, el asa de arrastre, los
  controles de movimiento y las acciones de edición/comentarios/adjuntos, y muestra un
  aviso «Tablero desactivado: solo lectura. Actívalo para realizar cambios.». En el
  selector, «Gestionar miembros» y «Cambiar nombre» solo se ofrecen en tableros
  activos; «Activar» y «Eliminar tablero» siguen disponibles para el admin.

## Consecuencias y límites

- La regla de solo lectura es la frontera efectiva: un cliente que omita la capa React
  recibe el mismo rechazo. Ocultar controles nunca es la garantía.
- El borrado sigue sin ser atómico entre Storage y PostgreSQL. No hay rollback de
  archivos ya eliminados ni restauración desde la aplicación.
- La migración no es idempotente (renombra funciones y crea objetos) y **no debe
  reaplicarse**. En una base existente requiere contraste previo de ledger y objetos;
  el bootstrap `supabase-schema.sql` ya incluye los mismos objetos para instalaciones
  nuevas.
- La ventana entre aplicar la migración y desplegar la Edge Function y publicar la SPA
  deja el borrado cerrado de forma explícita: falla, pero no degrada a un borrado
  parcial desde el cliente. Debe coordinarse en una ventana de mantenimiento.
- La verificación local usa PostgreSQL 16 desechable con Auth/Storage simulados y mocks
  de la Edge Function. No es E2E de Auth, OAuth ni Storage real.

## Evidencia y operación

- `supabase/migrations/202611060001_inactive_board_readonly.sql:1-172`.
- `supabase/functions/board-delete/index.ts:1-63`, `supabase/functions/board-delete/README.md`.
- `supabase/config.toml` (`[functions.board-delete]`, `verify_jwt = false`).
- `src/features/boards/api.ts` (`deleteInactiveBoard` invoca solo la Edge Function),
  `src/features/boards/BoardRoute.tsx`, `src/features/boards/BoardsPage.tsx`.
- `src/features/board/BoardPage.tsx`, `src/features/board/BoardColumn.tsx`,
  `src/features/board/SortableTaskCard.tsx` (prop `readOnly`).
- Contratos y datos: [`.data/01-endpoints.md`](../../.data/01-endpoints.md) y
  [`.data/04-schema.md`](../../.data/04-schema.md).
- Procedimiento y checklist: [guía de tableros en solo lectura](../../docs/tableros-solo-lectura.md).
