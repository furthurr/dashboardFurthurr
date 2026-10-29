# Operación y despliegue de Supabase

La SPA sigue alojada en GitHub Pages. La administración privilegiada se ejecuta en
`admin-users`; el servidor remoto MCP se ejecuta en `mcp`. La firma privilegiada
de adjuntos MCP ocurre solo en Edge, nunca en navegador, presets ni cliente MCP.

## Estado operativo MCP — 2026-10-29

Baseline de producto: `c2677c9b9084e3a56b6db36a1783c5d722e82780` (`v0.12.1`),
correcciones en `a6adb89`; fase 2 implementada en `9ecc905`. Proyecto identificado
mediante CLI autenticada: **`furthurr'sDashboard`**, ref `uujxatuuktccwkvavksr`.
Esta actualización documental reutiliza la evidencia operativa anterior de esta
sesión y las [notas de release](https://github.com/furthurr/dashboardFurthurr/releases/tag/v0.12.1),
no vuelve a aplicar SQL, desplegar ni probar servicios.

| Capa | Resultado comprobado |
| --- | --- |
| PostgreSQL | Aplicada y registrada **solo `202610280003_mcp_task_read.sql`**; definiciones, columnas, RLS, grants y FK/cascada comprobados |
| Edge MCP (evidencia remota) | **v3 ACTIVE**, `verify_jwt=false`; correspondía al código de fase 2 (`index.ts`, `task.ts`, `deno.json`); aplicación `0.2.0` |
| Pages | [Run 40923924908](https://github.com/furthurr/dashboardFurthurr/actions/runs/40923924908), success para `c2677c9`; HTML y assets nuevos responden 200 |
| SQL remoto | `mcp_task_read.sql` y `mcp_identity.sql`: PASS, fixtures revertidos; ausencia de cuentas/clientes/tableros de prueba residuales y cero permisos de lectura al finalizar |
| Cliente real | `whoami` correcto tras despliegue; OpenCode CLI 1.18.34 informa OAuth conectado. Catálogo fresco y consulta MCP de tarea aún no acreditados |

No confundir release `0.12.1`, aplicación MCP `0.2.0` y Edge v3. El registro no
acredita OAuth E2E, consentimiento en navegador, comparación completa MCP/UI ni
descarga real/caducidad/renovación de archivos. Esos casos y sus bloqueos están en
[la guía de prueba](../docs/prueba-mcp.md#8-registro-de-resultados-sin-secretos).

El árbol local posterior añade `202610290001_mcp_workflow.sql`, `workflow.ts` y
`serverInfo.version=0.3.0`; no hay evidencia de aplicación, despliegue ni prueba con
servicios reales. No presentar este código como Edge v3 desplegada ni ejecutar la
migración automáticamente como parte de la lectura de esta guía.

### Discrepancia del ledger: conservar, no «reparar» a ciegas

Ledger observado tras la activación: `202610190001`, `202610200001`, `202610200002`,
`202610210001`, `202610220001`, `202610280002`, **`202610280003`**.
El inventario histórico del 2026-10-28 observó objetos de `202610220002`,
`202610280001` y parte de `202610260003` sin sus entradas, y no encontró la policy
de renombrado `202610260001` ni `delete_inactive_board` de `202610260002`.
La activación del día 29 no certifica esas migraciones como aplicadas ni resuelve
esa discrepancia; no inferir registro de una migración por presencia de objetos.

Antes de fase 2 se comprobaron ledger, objetos y precondiciones reales. Se descargó
el historial registrado con `migration fetch` a un directorio temporal independiente
y se añadió una copia idéntica de `202610280003`. El `db push --dry-run` aislado
seleccionó exclusivamente ese archivo; se aplicó con `--skip-vault`, sin roles ni
seeds, y se comprobó después su registro. La CLI usada fue 2.122.0 vía `npx`.
No se alteraron entradas históricas ni se ejecutó un push global del directorio
del repositorio. Esto describe una ejecución ya realizada, **no un comando para
repetir la migración**: no es idempotente y sus objetos ya existen.

### Operación y fronteras de fase 2

- `mcp_identity` conserva identidad/sesión OAuth y puede ejecutar `mcp_get_task`,
  sin grants directos de tareas/Storage ni ejecución de gestión del consentimiento.
  El portal `authenticated` activo puede gestionar sus sesiones, no ejecutar la
  RPC MCP como sustituto del flujo OAuth.
- Conexiones exige consentimiento adicional para sesiones actuales. Las nuevas no
  heredan permisos; retirar lectura conserva `whoami`, y borrar la sesión elimina
  su permiso por cascada. No admin requiere membresía explícita y tablero activo;
  asignación sola no basta. Admin activo con consentimiento puede leer inactivos.
- Ese resumen describe el consentimiento de lectura por sesión ya comprobado. El
  workflow local propuesto sustituye el paso de habilitar en Perfil por aceptación
  conjunta al conectar; el permiso se asocia al grant OAuth. La implementación local
  exige asignación para todos los roles y estados backlog/por_hacer/haciendo.
- La firma de 60 s usa credencial exclusivamente servidor después de autorizar
  tarea y validar origen/bucket/path. No se confirmó su funcionamiento con Storage
  real: falta descarga, caducidad y renovación. No mover archivos legacy para
  eludir validación; se conservan con `download_error`.
- Edge sin bearer devuelve 401 con challenge. Preflight Pages permitido, localhost
  y origen ajeno denegados. El portal usa RPC Supabase para consentimiento; cliente
  nativo sin `Origin` no necesita CORS. No cambiar allowlist ni Auth global por
  una prueba fallida sin revisar entorno y cliente.
- Dependencias corregidas en v0.12.1: React Router DOM 7.18.5, Zod 4.6.7 también en
  MCP, Vite 8.3.5 y transitivas npm. Auditorías locales npm/Deno sin vulnerabilidades
  conocidas reportadas; no certifican seguridad integral del servicio desplegado.

Comandos de comprobación para una futura operación autorizada (identificar primero
el proyecto; no imprimen credenciales). No ejecutados por esta actualización:

```bash
npx supabase@2.122.0 functions list --project-ref <project-ref>
npx supabase@2.122.0 db query --linked --project-ref <project-ref> --file supabase/tests/mcp_task_read.sql
npx supabase@2.122.0 db query --linked --project-ref <project-ref> --file supabase/tests/mcp_identity.sql
```

Las suites crean fixtures Auth/Postgres y terminan con `ROLLBACK`; revisar schema
administrado y usar un entorno autorizado. **Nunca ejecutar `tests/support/mcp_harness.sql`
contra Supabase**. Las cuatro suites del harness local usan Auth/Storage simulados;
SQL remoto no es OAuth E2E. Esta operación no redesplegó `admin-users` ni cambió
hooks/Auth globales. Para conectar usuarios: [guía de clientes](../mcp/README.md).

### Workflow MCP local, pendiente de aplicación y despliegue

`202610290001_mcp_workflow.sql` se añade después de la base OAuth/lectura; modifica
`mcp_get_task`, crea `mcp_workflow_permissions` y `mcp_task_operations`, añade RPCs
para aceptar/listar/retirar permisos, leer adjuntos y ejecutar tres acciones de tarea.
La nueva instalación recibe estos objetos desde `supabase-schema.sql`; una base
existente requiere preflight para confirmar qué migraciones/objetos están realmente
presentes y aplicar solo la migración pendiente mediante el procedimiento aprobado.
El ledger anterior incluye `202610280003`, no incluye evidencia de `202610290001`.
No reejecutar la migración si los objetos ya existen ni intentar arreglar el ledger
con un push global.

Pruebas locales documentadas: seis suites SQL más concurrencia en PostgreSQL 16
desechable con Auth/Storage simulados; no son E2E remoto. Tras un eventual SQL
aprobado, Edge `mcp` y SPA deben desplegarse como cambios separados y probarse con
una cuenta asignada en entorno de prueba. No conceder permiso por SQL para suplir el
consentimiento OAuth de usuario.

## Instalación existente

La secuencia siguiente es una guía histórica de instalación base, no el conjunto
pendiente del proyecto ya activado. Contrastar siempre con el estado anterior.
Después de esa base existen `202610280001_board_assignment_access.sql`,
`202610280002_mcp_identity.sql` y `202610280003_mcp_task_read.sql`; no aplicarlas
en bloque para reconciliar el ledger. El bootstrap actual también incluye MCP.
`202610290001_mcp_workflow.sql` es una ampliación local posterior; el estado remoto
documentado no la incluye. Revisarla en la subsección «Workflow MCP local» y no
añadirla a la lista de instalación base sin verificar sus precondiciones.

1. Realiza una copia de seguridad y prueba primero en un proyecto de pruebas.
2. Ejecuta **solo las migraciones pendientes**, en este orden:
   1. `migrations/202610190001_user_administration.sql`
   2. `migrations/202610200001_task_assignments.sql`
   3. `migrations/202610200002_shared_task_editing.sql`
   4. `migrations/202610210001_boards.sql`
   5. `migrations/202610220001_board_access_returning.sql`
   6. `migrations/202610220002_board_lifecycle.sql`
   7. `migrations/202610260001_task_attachment_management.sql`
   8. `migrations/202610260002_delete_inactive_boards.sql`
   9. `migrations/202610260003_profile_avatars.sql`

   No vuelvas a ejecutar el schema bootstrap en una instalación existente. Las tareas y cuentas activas existentes se asignan a `Offline`; `General` inicia vacío. Revisa la política de asignación antes de aplicar en producción. Las migraciones `202610260001`–`202610260003` están presentes en el árbol local; su aplicación remota no se verificó durante la última sincronización documental.
3. En Supabase Auth, deshabilita **Allow new users to sign up** (registro público). La API administrativa `createUser` continúa disponible. No es necesario desactivar globalmente la confirmación por correo: esta función usa `email_confirm: true` al crear cada cuenta.

   Alternativamente, con CLI **2.121.0** se puede revisar y aplicar el único ajuste declarado de Auth en `config.toml`, conservando las propiedades no declaradas:

   ```bash
   npx supabase@2.121.0 config diff --project-ref <project-ref>
   npx supabase@2.121.0 config push --project-ref <project-ref>
   ```
4. Despliega con la CLI de Supabase, autenticada y vinculada al proyecto correcto:

   ```bash
   supabase functions deploy admin-users
   ```

   `config.toml` desactiva únicamente la validación JWT del gateway de esta función: la función valida el bearer token con `auth.getUser` y exige un perfil `admin` activo antes de cualquier operación. `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` son variables del entorno de funciones de Supabase. **Nunca** las copies a variables `VITE_*` ni a la SPA.

    Estado remoto histórico verificado el 2026-10-22: `admin-users` estaba desplegada en la **versión 4, ACTIVE**, y el código descargado coincidía byte a byte con el repo. La versión anterior (3) no incluía `promote-admin`; después del redespliegue la función respondía sin sesión con 401 y validaba el bearer en su código. `supabase config diff` no informaba cambios aplicables, `auth.enable_signup` estaba deshabilitado y `verify_jwt: false`. No se repitieron esas consultas en la sincronización documental actual; este registro no verifica el estado remoto presente ni los cambios locales posteriores.
5. Publica la web con `npm run build` y el flujo habitual de GitHub Pages.

Para una instalación nueva, `../supabase-schema.sql` incluye el modelo de tableros, RPC de borrado, permisos del nombre de adjunto y bucket/policies de avatares. No apliques además las migraciones ya incluidas en el bootstrap.

### Tableros y acceso por membresía

`202610210001_boards.sql` crea `boards` y `board_members`, asigna las tareas/usuarios activos existentes a `Offline`, y crea `General` vacío. `202610220001_board_access_returning.sql` corrige la comprobación RLS usada al devolver la fila recién creada por PostgREST. `202610220002_board_lifecycle.sql` añade `boards.is_active`, las RPCs de renombrado y de activación, y el listado con tareas pendientes. El contrato base de membresía de estas migraciones se amplía en el portal por `202610280001`: membresía **o asignación** en tablero activo, además de admin activo. MCP mantiene membresía explícita para no admin; no reutilizar el helper más amplio del portal para autorizar `get_task`. Las cuentas nuevas no reciben membresías automáticamente.

### Ciclo de vida de los tableros

`202610220002_board_lifecycle.sql` añade `boards.is_active` (por defecto `true`) y tres RPCs:

- `rename_board(p_board_id, p_name)`: solo administrador activo. Recorta el nombre y exige entre 1 y 120 caracteres; el índice único sigue rechazando nombres duplicados (`23505`) y el nombre inválido devuelve `22023`.
- `set_board_active(p_board_id, p_active)`: solo administrador activo. Desactiva o reactiva un tablero **sin borrar** tareas, comentarios, adjuntos ni membresías.
- `list_boards_with_pending_counts()`: devuelve `id`, `name`, `is_active`, `created_at` y `pending_count` (tareas en `backlog`, `por_hacer` y `haciendo`). El administrador activo ve todos los tableros, incluidos los desactivados; las demás cuentas solo ven los tableros activos de los que son miembros.

Al desactivar un tablero, sus miembros dejan de verlo en el selector y de acceder a sus tareas (RLS), incluida la URL directa; el administrador activo conserva el acceso y puede reactivarlo. La policy de lectura de `boards` ya no llama a ninguna función que lea `boards`, para no reintroducir la recursión que corrigió `202610220001_board_access_returning.sql`; los miembros leen su propia fila de `board_members` mediante la policy «Members read own memberships».

RLS limita tareas, asignaciones, comentarios, metadata de adjuntos y Storage por tablero. Crear tarea exige rol admin/usuario activo y acceso al tablero; cambiar tablero usa `move_task_to_board`, exige acceso a origen y destino y actualiza la misma tarea conservando sus relaciones. El probe SQL remoto de la secuencia base se registró el 2026-10-21; las verificaciones posteriores de `202610220001`/`202610220002` se registran a continuación. Los registros son históricos y no verifican migraciones posteriores.

Registro remoto histórico: `202610220001_board_access_returning.sql` y `202610220002_board_lifecycle.sql` se aplicaron en el proyecto elegido el 2026-10-22, en ese orden. Después se ejecutaron las tres suites (`boards.sql`, `task_assignments.sql`, `user_access.sql`) con `PASS` y fixtures revertidos con `ROLLBACK`. El proyecto conservaba sus 4 tableros y 32 tareas; `is_active` quedó `true`. Esta evidencia no verifica las migraciones `202610260001`–`202610260003` ni el estado remoto actual.

Las cargas nuevas usan path `<task-id>/<UUID>.<ext>`; las antiguas con path plano se resuelven desde metadata. El bucket de adjuntos permanece privado. La UI genera URLs firmadas de corta duración; accesos firmados ya emitidos o archivos descargados no se revocan retroactivamente.

## Gestión de adjuntos (migración local `202610260001`)

`202610260001_task_attachment_management.sql` permite actualizar en cliente únicamente `task_attachments.file_name`. RLS autoriza al uploader, creador de la tarea o administrador activo, siempre con acceso activo al tablero; los otros campos y el path de Storage no se modifican.

La eliminación quita primero el objeto del bucket privado y después su metadata. Son peticiones separadas a Storage y PostgreSQL, no una transacción conjunta. Si falla la segunda etapa, la fila puede permanecer aunque el objeto ya se haya eliminado. La migración no requiere otra Edge Function.

## Borrado permanente de tableros inactivos (migración local `202610260002`)

`202610260002_delete_inactive_boards.sql` crea la RPC `delete_inactive_board(p_board_id)`. Requiere administrador activo, tablero existente y `is_active = false`; la función bloquea la fila, elimina sus tareas y luego el tablero. Las relaciones de tarea se eliminan por cascada. El cliente elimina previamente, por lotes, los objetos del bucket `task-attachments`.

Storage y PostgreSQL no comparten transacción. Un fallo de Storage detiene la llamada a la RPC; si la RPC falla después de limpiar Storage, las filas pueden quedar y faltar algunos objetos. La operación es permanente y no hay restauración desde la aplicación.

La suite `tests/boards.sql` cubre permisos de renombrado de adjuntos y borrado de tableros inactivos. Ejecutarla después de `202610260002` en una base de pruebas; usa fixtures transaccionales con `ROLLBACK`:

```bash
npx supabase@2.121.0 db query --linked --project-ref <project-ref> --file supabase/tests/boards.sql
```

## Avatares de perfil (migración local `202610260003`)

`202610260003_profile_avatars.sql` declara público el bucket `avatars`, limita archivos a 2 MiB y a `image/jpeg`, `image/png` o `image/webp`, y autoriza al propietario o a un administrador activo a insertar/reemplazar objetos. La aplicación usa `<profile-id>/avatar` y persiste la URL pública en `profiles.avatar_url`. Los objetos son legibles públicamente: no cargues imágenes sensibles.

La suite `tests/profile_avatars.sql` comprueba límites, carga/reemplazo propio, escritura administrativa y denegaciones cruzadas; termina con `ROLLBACK`:

```bash
npx supabase@2.121.0 db query --linked --project-ref <project-ref> --file supabase/tests/profile_avatars.sql
```

La migración y esta suite están en el árbol local; no se confirmó su aplicación ni ejecución remota durante la última sincronización.

Las pruebas SQL transaccionales crean fixtures que terminan con `ROLLBACK`. Verificación local histórica: `boards.sql`, `task_assignments.sql` y `user_access.sql` pasaron contra PostgreSQL embebido con Auth/Storage simulados, bootstrap y secuencia incremental. Verificación remota histórica: las mismas suites pasaron contra el proyecto Supabase seleccionado. Ninguna prueba es auditoría de seguridad completa ni valida otros entornos. Las suites no se ejecutaron en la sincronización documental actual; los probes nuevos en `boards.sql` requieren aplicar hasta `202610260002`, y `profile_avatars.sql` requiere `202610260003`.

## Contrato y comprobación manual

POST autenticado a `admin-users`, vía `supabase.functions.invoke`:

- `{ action: 'list', page: 1 }`: devuelve `users`, `total`, `pageSize` (50); el código local proyecta `avatar_url`.
- `{ action: 'create', fullName, email, password }`: alta como `usuario`, activa y confirmada.
- `{ action: 'password', userId, password }`: establece contraseña (8–128 caracteres, además de la política de Supabase).
- `{ action: 'rename', userId, fullName }`: administrador activo actualiza solo el nombre en `profiles` (1–120 caracteres tras recortar espacios exteriores); no cambia metadata de Auth ni otros campos de la cuenta.
- `{ action: 'set-active', userId, active }`: cambia el estado; prohíbe desactivarse a sí mismo.
- `{ action: 'promote-admin', userId }`: solo un administrador activo puede promover cualquier cuenta no administradora (`usuario` o `invitado`, activa o inactiva); fija `profiles.role = 'admin'` y conserva `is_active`. No existe acción de degradación.
- Errores: `{ error: string }`, HTTP 400/401/403/405/500. No se devuelven secretos ni contraseñas.

Comprueba con cuentas separadas:

En un entorno de pruebas antes de desplegar, verifica: admin ve Offline y General, usuario/invitado ve solo tableros asignados, asignar una tarea no añade membresía, miembro de ambos tableros traslada una sola tarea conservando sus relaciones, y la cuenta que no pertenece al destino recibe denegación. Al retirar una membresía, nuevas peticiones de tablas/Storage deben quedar denegadas.

Para el ciclo de vida de los tableros: en «Tableros», el administrador ve «Cambiar nombre», «Desactivar» y «Activar»; el tablero desactivado pasa a su propia sección, visible solo para administradores. Comprueba que un miembro deja de ver el tablero desactivado y que su URL directa responde «no tienes acceso»; que «Tareas pendientes» suma `backlog`, `por_hacer` y `haciendo`; y que una cuenta no administradora recibe denegación al invocar `rename_board` o `set_board_active` directamente.

Para gestión de adjuntos: uploader/creador/admin con acceso al tablero puede cambiar `file_name` sin alterar path/contenido; confirma el borrado con el nombre y verifica el objeto y metadata. Prueba fallos de Storage y de Postgres por separado: no son una transacción común.

Para el borrado de tableros: solo un administrador activo debe poder eliminar un tablero desactivado. Verifica que un tablero activo es rechazado, que el tablero inactivo y sus tareas/relaciones desaparecen, y que Storage se limpia. Ejecuta en un entorno de prueba porque el borrado no tiene recuperación; recuerda que los objetos de Storage se eliminan antes de la RPC SQL.

Para avatares: comprueba carga/reemplazo propio y por admin, rechazo de otros usuarios, límite de 2 MiB y tipos JPG/PNG/WebP. Confirma que la imagen es públicamente legible y que `profiles.avatar_url` queda actualizado. No cargues datos sensibles.

1. Un admin ve «Usuarios»; usuario e invitado no pueden abrir la ruta ni invocar la función (403).
2. Alta: la sesión del admin no cambia; la cuenta nueva entra inmediatamente sin correo.
3. Cambia la contraseña; la nueva permite entrar y la anterior no. Esto no promete revocar sesiones existentes.
4. Desactiva una cuenta ya conectada: con su JWT anterior, tareas, comentarios, asignaciones, vistas y Storage privado dejan de ser accesibles. La UI comprueba el perfil cada 30 segundos y al volver a la ventana. Reactiva y verifica el acceso.
5. Intenta cambiar `role` o `is_active` directamente con el cliente autenticado: debe ser rechazado por permisos de columnas.
6. Verifica que las tareas, comentarios y adjuntos del usuario desactivado se conservan.
7. Desde «Usuarios», confirma la promoción de una cuenta `usuario` o `invitado`; verifica que el rol cambia a `admin`, que `is_active` no cambia y que una cuenta no administradora recibe 403 si intenta invocar directamente la operación. Re-despliega `admin-users` para que la acción nueva esté disponible en Supabase.
8. En «Usuarios» y el menú de cuenta, cambia un avatar autorizado; verifica fallback si la imagen no carga y permisos por propietario/admin.

`is_active` es el estado de acceso a **esta plataforma**: no elimina el usuario de Auth ni invalida criptográficamente sus JWT. La protección inmediata es RLS, que consulta el estado en cada petición. El cliente autenticado puede leer su propio perfil inactivo para mostrar el bloqueo, pero no modificarlo. Los avatares del bucket público siguen siendo públicos; archivos ya descargados o URLs firmadas emitidas previamente no pueden retirarse retroactivamente mediante RLS.

La migración presupone las tablas y vistas del schema local. No certifica políticas adicionales, RPCs o buckets creados fuera del repositorio: revísalos en el proyecto desplegado antes de producción.

### Prueba SQL de permisos

`tests/user_access.sql` necesita al menos un administrador activo. Comprueba acceso activo, protección de columnas y bloqueo de lecturas/escrituras con una identidad inactiva, incluidas las vistas. Crea una tarea y desactiva temporalmente al administrador **solo dentro de una transacción que termina en `ROLLBACK`**; no deja datos de prueba ni cambios de estado persistentes.

```bash
npx supabase@2.121.0 db query --linked --project-ref <project-ref> --file supabase/tests/user_access.sql
```

## Asignación múltiple de tareas

La migración `202610200001_task_assignments.sql` es necesaria antes de usar la nueva creación de tareas. Si la administración de usuarios ya está desplegada, aplica solamente esta migración pendiente. Esta característica usa funciones Postgres; no necesita otra Edge Function.

- `create_task_with_assignees(p_title, p_description, p_status, p_priority, p_assignee_ids)` devuelve una tarea JSON. Solo `admin` y `usuario` activos pueden crear; el propietario se obtiene de `auth.uid()`. La tarea y sus asignaciones se guardan juntas, sin tareas huérfanas si falla la validación.
- `set_task_assignees(p_task_id, p_assignee_ids)` reemplaza el conjunto completo de responsables y devuelve sus perfiles (`id`, `full_name`, `email`, `avatar_url`, `role`, `is_active`). Una lista vacía desasigna a todos. Puede usarla cualquier cuenta activa, **incluidos invitados**, en cualquier tarea.
- Ambas requieren sesión. Eliminan duplicados y rechazan IDs nulos/inexistentes o nuevos responsables inactivos. Una asignación previa a una cuenta inactiva puede conservarse o retirarse.
- Las escrituras directas del cliente a `task_assignees` están revocadas; no se amplían permisos para editar otros campos de tareas. Las sustituciones concurrentes se serializan bloqueando la tarea; prevalece el último conjunto guardado.
- La lista de usuarios activos se obtiene desde `profiles` con paginación y RLS; no requiere acceso a la función de administración de usuarios.

Prueba transaccional de permisos y consistencia, con cuentas/tareas de prueba que se revierten al terminar:

```bash
npx supabase@2.121.0 db query --linked --project-ref <project-ref> --file supabase/tests/task_assignments.sql
```

Comprobación manual: crea una tarea con varios responsables, quita uno y guarda las asignaciones en el detalle. Comprueba las iniciales en la tarjeta, reabre y desasigna a todos. Repite con usuario e invitado sobre una tarea ajena: deben poder guardar asignaciones y editar título, descripción, estado y prioridad, pero no eliminar la tarea. En el detalle, los responsables se guardan mediante «Guardar asignaciones», por separado del resto del borrador.

## Edición compartida de tareas

La migración `202610200002_shared_task_editing.sql` amplía la edición de tareas a cualquier cuenta activa. Si la administración de usuarios y las asignaciones ya están desplegadas, aplica solamente esta migración pendiente. No necesita otra Edge Function.

- Cualquier cuenta autenticada y activa, incluidos `admin`, `usuario` e `invitado`, puede editar `title`, `description`, `status`, `priority` y `position` de cualquier tarea y moverla o reordenarla.
- La creación de tareas sigue reservada a `admin` y `usuario`, y el borrado sigue reservado al creador o a un `admin`.
- La migración revoca el permiso de `UPDATE` sobre la tabla completa y concede permisos por columna. `created_by` deja de ser escribible desde el cliente, de modo que nadie puede reclamar una tarea ajena para después eliminarla.
- La policy restrictiva «Active account required» se mantiene: una cuenta desactivada no puede escribir tareas aunque tenga la sesión vigente.

Prueba transaccional de permisos y consistencia, con cuentas/tareas de prueba que se revierten al terminar:

```bash
npx supabase@2.121.0 db query --linked --project-ref <project-ref> --file supabase/tests/task_assignments.sql
```

Comprobación manual: con una cuenta `usuario` o `invitado`, abre una tarea creada por otra persona, cambia el título y guarda. El cambio debe persistir tras recargar. Comprueba que «Eliminar tarea» no aparece para esa cuenta y que sigue apareciendo para el creador y para un admin. Intenta cambiar `created_by` desde el cliente: debe ser rechazado por permisos de columnas.
