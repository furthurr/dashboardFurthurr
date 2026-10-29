# Componentes visuales

Catálogo de componentes actuales, no una promesa de API reutilizable fuera de sus props observadas.

## Actualización focalizada — copia de UUID y lectura MCP, 2026-10-28

Describe cambios locales sin commit sobre `be391de`, no una publicación. No añade
tokens ni clases CSS propias; los botones reutilizan `ui-button ui-button--sm`,
SVG decorativo de 16 px y estilos de foco existentes. Las entradas siguientes
prevalecen sobre las descripciones históricas del botón de comentarios.

| Componente/patrón | Propósito, estados y comportamiento | Fuente |
| --- | --- | --- |
| `CopyTaskId` | Botón con solo icono, tooltip y `aria-label` «Copiar ID de {título}». Copia solo UUID completo. Estado `copying` bloquea doble envío; éxito `role=status` por 4 s; fallo `role=alert` muestra UUID seleccionable y opción de copia manual/reintento. No propaga clic/pointer-down al contenedor | `src/features/board/CopyTaskId.tsx:9-50` |
| Acciones de tarjeta | Copiar ID y comentarios juntos a la derecha, contenedor `ml-auto flex ... gap-2`. Ambos usan el mismo estilo de botón e icono de 16 px; comentarios mantiene badge solo con total >0 y su nombre accesible con singular/plural. Copiar sigue disponible sin asignados ni callback de comentarios | `src/features/board/TaskCard.tsx:102-144`, `src/features/board/TaskCard.test.tsx:36-52` |
| ID en detalle | Fila de solo lectura por encima de las tres pestañas; UUID completo seleccionable siempre visible e icono de copiar. No depende de permiso de edición y no guarda ni cierra el detalle al copiar | `src/features/board/TaskDetailModal.tsx:165-171`, `src/features/board/CopyTaskId.tsx:35-47` |
| Consentimiento OAuth | La conexión inicial sigue siendo identidad; texto explica que consultar tareas exige autorización adicional posterior en Gestionar conexiones. No crea scope OAuth nuevo ni autoriza lectura al aprobar identidad | `src/features/auth/OAuthConsentPage.tsx:65-78` |
| Permisos en Conexiones | Lista grants y luego permisos. Sin verificar deshabilita lectura; error no impide revocar OAuth. Autorizar requiere un `Dialog` que describe textos, nombres, adjuntos/enlaces de 60 s y ausencia de escritura. Cancelar no concede permisos; un fallo conserva diálogo/error; confirmar muestra feedback de éxito | `src/features/auth/OAuthConnectionsPage.tsx:20-108` |
| Sesiones mixtas y retirada | Si existen sesiones nuevas sin permiso junto a autorizadas, muestra aviso y botón «Autorizar nuevas sesiones», con otra confirmación. «Retirar lectura de tareas» quita permisos de todas sin revocar `whoami`; «Revocar conexión» elimina el grant OAuth | `src/features/auth/OAuthConnectionsPage.tsx:44-67,79-106` |

### Verificación y pendientes

Se reutilizan 200 pruebas Vitest (22 archivos), 11 Deno MCP y lint/build correctos
de la implementación de esta conversación, no ejecuciones documentales nuevas.
Las pruebas DOM cubren teclado, texto exacto copiado, bloqueo/error del portapapeles,
agrupación de botones, confirmación, permisos mixtos y fallos de migración/RPC.
No hay validación real nueva de navegador responsive, descarga de archivos,
lector de pantalla o contraste; la publicación de esta UI está pendiente.
[Guía de test](../docs/prueba-mcp.md) y [contratos de datos](../.data/01-endpoints.md).

## Registro de fase 1 — OAuth MCP y conexiones, 2026-10-28

El flujo visual usa estilos y componentes existentes; no agrega tokens, tema ni
clases CSS. El contenido de identidad/cliente que muestra consentimiento incluye
PII e identificadores, por lo que la UI advierte revisar cliente y callback.

| Componente/patrón | Propósito, estados y comportamiento | Fuente |
| --- | --- | --- |
| `OAuthConsentPage` | Ruta `#/oauth/consent`; shell y panel de auth. Redirige a login conservando el `authorization_id`; muestra comprobación de sesión, perfil inactivo, carga/error recuperable, cliente, ID, redirect URI y scopes; permite autorizar o denegar. Muestra advertencia de PII y que la contraseña no se comparte | `src/features/auth/OAuthConsentPage.tsx:18-78`, `src/features/auth/LoginPage.tsx:25-28`, `src/features/auth/mcpOAuth.ts:2-21` |
| `OAuthConnectionsPage` | Ruta protegida `#/profile/connections`; cabecera de perfil, lista de grants, estado de carga/error/vacío, botón destructivo de revocar y feedback de operación. Revoca el grant OAuth, no elimina datos de negocio | `src/features/auth/OAuthConnectionsPage.tsx:15-57`, `src/App.tsx:39-42` |
| Confirmación y callback OAuth | La solicitud contiene un ID opaco, no un redirect arbitrario; la navegación de retorno se acepta solo desde `redirect_url` de Supabase Auth y el helper limita destinos a HTTPS o loopback HTTP | `src/features/auth/mcpOAuth.ts:2-36`, `src/features/auth/OAuthConsentPage.tsx:23-49` |

### Verificación y límites

Las pruebas DOM prueban consentimiento, denegación, reintentos, estado inactivo,
revocación y callback seguro. No se hizo revisión visual del layout MCP en navegador,
cálculo de contraste ni auditoría con lector de pantalla; no se declara conformidad
WCAG. El build remoto de Pages pasó, pero ello no equivale a validación visual.

## Actualización focalizada — adjuntos, eliminación de tableros y avatares, 2026-10-26

Describe el árbol local aún sin commit sobre adjuntos, tableros y avatares. `HEAD` es `bbacf5c62a8ab0bf144e602ae3666c4026882f0e` (`v0.9.0` en preparación); esta entrada no afirma que esos cambios estén incluidos en `HEAD` ni publicados.

No se añaden tokens, tema ni clases CSS; se reutilizan `ui-list-card`, `ui-field`, `Dialog`, botones existentes y variables visuales. El renombrado de adjuntos solo cambia metadata, no el archivo de Storage.

| Componente/patrón | Propósito, estados y comportamiento | Fuente |
| --- | --- | --- |
| `AttachmentsList` — renombrar | Cada archivo autorizado muestra «Cambiar nombre». La acción sustituye el nombre por un campo precargado y con etiqueta accesible; «Guardar nombre» se deshabilita si está vacío o no cambió, y «Cancelar» abandona la edición. Durante una mutación se bloquean los controles; un fallo conserva el borrador y el detalle anuncia el error | `src/features/board/AttachmentsList.tsx:37-67,85-91`, `src/features/board/TaskDetailModal.tsx:111-114` |
| `AttachmentsList` — eliminar | El botón contextual «Eliminar» abre la confirmación inline del detalle con el nombre del archivo y aviso de irreversibilidad. La acción espera resultado, comunica éxito/error y mantiene la confirmación ante un fallo | `src/features/board/AttachmentsList.tsx:92-96`, `src/features/board/TaskDetailModal.tsx:150-160,278-287` |
| Disponibilidad por adjunto | La interfaz muestra ambas acciones al uploader, creador de la tarea o administrador activo; Postgres/Storage y el acceso activo al tablero siguen siendo la autoridad del permiso | `src/features/board/BoardPage.tsx:465-476`, `supabase/migrations/202610260001_task_attachment_management.sql:10-22` |
| `BoardsPage` — eliminar tablero inactivo | Solo el admin ve «Eliminar tablero» en cards desactivadas. El `Dialog` identifica el tablero y advierte que tareas, comentarios, asignaciones y adjuntos se eliminan sin recuperación; la acción usa `ui-button--danger`, muestra espera y conserva el diálogo ante errores específicos de Storage/RPC | `src/features/boards/BoardsPage.tsx:33-43,64-71,98-110,187-207` |
| `ProfileAvatar` | Círculo con imagen lazy/async y recorte `object-cover`; si no hay URL o falla la carga muestra icono o inicial. Tamaños `sm`, `md`, `lg`; la variante de administración conserva iniciales como fallback. Reutilizado en cuenta, lista de usuarios, autores de comentarios, tarjetas Kanban y responsables seleccionados. Usa superficie/color existentes y utilities, sin token ni clase propia | `src/shared/ui/ProfileAvatar.tsx:3-45`, `src/features/users/UsersPage.tsx:37-40,148-154`, `src/shared/ui/AccountMenu.tsx:61`, `src/features/board/CommentsList.tsx:28-30`, `src/features/board/TaskCard.tsx:101-112`, `src/features/board/AssigneePicker.tsx:27-34` |
| `AccountMenu` — avatar propio | El panel de cuenta permite seleccionar una imagen; muestra espera, mensaje `role=status` o error `role=alert`. El selector acepta JPG/PNG/WebP y la ayuda visual declara máximo 2 MB | `src/shared/ui/AccountMenu.tsx:17-41,58-75` |
| `UsersPage` — avatar administrativo | La fila de cuenta muestra el avatar/las iniciales y expone «Cambiar foto». El diálogo previsualiza archivo/foto existente, informa formatos/tamaño y bloquea el envío mientras guarda | `src/features/users/UsersPage.tsx:37-54,80-99,138-173` |

### Verificación y límites

La evidencia previa al cambio de tableros/avatares para la gestión de adjuntos registró 157 pruebas Vitest en 16 archivos, build y lint correctos; no valida por sí sola las ampliaciones añadidas después. En esta sincronización documental no se ejecutaron pruebas, build, lint ni suite SQL, no se aplicaron migraciones remotas y no se hizo revisión visual en navegador, prueba con lector de pantalla o auditoría de contraste. La UI actual no se presenta como publicada.

## Actualización focalizada — visor de imágenes y descripción de tarea, 2026-10-23

Registro histórico de la revisión del 2026-10-23: en esa fecha se anotó `HEAD=9444ced119b66271530b5e8f0c0ba4260a6c0ced` y `v0.8.1` (run `40004615822`) como publicación. No es el baseline Git actual ni se consultaron referencias remotas en la revisión de 2026-10-26; el visor descrito no debe inferirse como publicado por esta entrada.

No se añaden tokens ni clases CSS propias. El visor reutiliza `Dialog` y controles `ui-button`; sus flechas son SVG inline. El `Dialog` acepta un subtítulo opcional y lo asocia como descripción accesible, manteniendo el título de tarea como nombre del diálogo.

| Componente/patrón | Propósito, estados y comportamiento | Fuente |
| --- | --- | --- |
| Visor de imágenes de `TaskCard` | Al abrir una miniatura, muestra el título de la tarea en el encabezado del diálogo y el nombre del archivo como subtítulo. La imagen ampliada conserva como texto alternativo su nombre; debajo aparece «Descripción de la actividad» con el texto completo y saltos de línea, o «Esta tarea no tiene descripción.» si está vacía. Cuando la tarea tiene varias imágenes, muestra controles accesibles anterior/siguiente que recorren solo la colección de esa tarea; se ocultan con una imagen y se deshabilitan en los extremos | `src/features/board/TaskCard.tsx:80-95,220-267`, `src/shared/ui/Dialog.tsx:3-10,24-26,87-94` |
| Subtítulo opcional de `Dialog` | Se renderiza bajo el título, con tipografía `text-sm` y color muted existentes; `aria-labelledby` identifica el título y `aria-describedby` asocia el subtítulo. Los diálogos sin `subtitle` conservan su presentación y semántica previas | `src/shared/ui/Dialog.tsx:3-10,24-26,87-94` |

### Verificación y límites

140 pruebas Vitest en 16 archivos, `npm run build` y `npm run lint` correctos; el build conserva el aviso de chunk principal >500 kB. Las pruebas DOM comprueban título/subtítulo, descripción, ausencia de flechas con una imagen y navegación/estados de extremos con varias imágenes (`src/features/board/TaskCard.test.tsx:143-190`, `src/features/board/BoardPage.test.tsx:279-289`). No se hizo una nueva revisión visual en navegador, auditoría de contraste ni prueba con lector de pantalla para este cambio. El visor no está publicado.

## Actualización focalizada — acción y badge de comentarios en tarjetas, 2026-10-23

Registro histórico de la revisión del 2026-10-23: se anotó `HEAD=9444ced119b66271530b5e8f0c0ba4260a6c0ced` y `v0.8.1` (run `40004615822`) como publicación. No representa el baseline Git actual ni una consulta remota realizada durante esta actualización.

No se añaden tokens, tema, paleta ni clases CSS propias. El icono es SVG inline; el botón usa colores y foco existentes. El botón permanece disponible con cero o con conteo desconocido, y su nombre accesible incluye el total cuando está disponible. El badge visual se omite con cero y solo se superpone cuando hay comentarios.

| Componente/patrón | Propósito, estados y comportamiento | Fuente |
| --- | --- | --- |
| Botón de comentarios de `TaskCard` | Alineado a la derecha de la fila de avatares. Al activarlo, selecciona la tarea y abre su detalle en la pestaña «Comentarios»; evita propagar el clic al botón del título. `aria-label` nombra la acción y el total con singular/plural. El badge superpuesto aparece solo si el conteo es mayor que cero; con cero queda el icono sin badge | `src/features/board/TaskCard.tsx:98-138`, `src/features/board/BoardColumn.tsx:12-18,40-50`, `src/features/board/BoardPage.tsx:74-80,384-387`, `src/features/board/TaskDetailModal.tsx:15-16,50-55,158-174`, `src/features/board/TaskCard.test.tsx:102-136`, `src/features/board/BoardPage.test.tsx:90-101` |

### Verificación y límites

139 pruebas Vitest en 16 archivos, `npm run build`, TypeScript y `npm run lint` correctos. Las pruebas DOM comprueban el clic y la pestaña inicial, el nombre accesible, la posición junto a avatares y que cero no genere badge. No se hizo revisión visual en navegador, prueba con lector de pantalla ni auditoría de contraste para este cambio. Esta interacción todavía no está publicada.

## Actualización focalizada — alta rápida y pegado de imágenes, 2026-10-22

Registro histórico de la revisión del 2026-10-22: entonces se consultaron `main` y `origin/main` en `83dacec5bf207ba9105742cd9ba28c5c4ae85a05` y se anotó la release `v0.6.0` (`21a44df`). No se verificaron ramas remotas en esta actualización.

No se añaden tokens, paleta, tema ni tipografía. El CTA flotante reutiliza `ui-button--primary`, `--space-4` y `--shadow-panel`; su geometría particular es local en `.board-create-fab` (`src/index.css:93-98`). El texto de ayuda usa el color muted existente.

| Componente/patrón | Propósito, estados y comportamiento | Fuente |
| --- | --- | --- |
| CTA flotante de creación | Añade «Crear tarea» fijo en la esquina inferior derecha, con offsets para el área segura, nombre accesible y SVG decorativo oculto; abre el mismo diálogo que «+ Nueva Tarea». Solo se muestra a cuentas distintas de invitado. | `src/features/board/BoardPage.tsx:337-345,467-479`, `src/index.css:97-98` |
| `CreateTaskModal` — pegado | Ctrl+V / ⌘+V añade las imágenes del portapapeles a la selección existente. Reutiliza el límite de 5 MB y el aviso de archivos rechazados; el texto normal no se intercepta. La subida sigue ocurriendo después de crear la tarea. | `src/features/board/CreateTaskModal.tsx:45-75,114-127`, `src/features/board/clipboardImages.ts:1-24`, `src/shared/ui/Dialog.tsx:84-96` |
| `TaskDetailModal` — pegado en Adjuntos | Solo cuando está activa esa pestaña, pegar una imagen inicia la subida automáticamente; se conserva el límite de 5 MB y el estado/feedback existentes. | `src/features/board/TaskDetailModal.tsx:109-141,248-263`, `src/features/board/clipboardImages.ts:1-24` |

### Verificación y límites

133 pruebas Vitest en 15 archivos, `npm run build` y `npm run lint` correctos. El build conserva el aviso de chunk principal >500 kB. Las nuevas pruebas simulan el evento de portapapeles en jsdom; no se hizo una prueba con portapapeles real en navegador, revisión visual responsive ni auditoría WCAG/lector de pantalla.

## Actualización — ciclo de vida de tableros, 2026-10-22

Describe el release `v0.6.0` (commit `21a44df`), ya versionado: el baseline Git no queda pendiente. No añade tokens, paleta, tema ni tipografía: la única clase visual nueva es `.ui-badge`, que reutiliza `--color-border`, `--radius-sm`, `--color-surface-elevated`, `--color-text`, `--space-2` y `--text-xs` (`src/index.css:139`).

| Componente/patrón | Propósito, estados y comportamiento | Fuente |
| --- | --- | --- |
| Secciones del selector | Dos bloques con título y descripción: «Tableros activos» y «Tableros desactivados». La sección de desactivados solo se renderiza para admin activo y solo si hay tableros desactivados; ambos bloques comparten el componente `BoardSection`, que muestra «No hay tableros en esta sección.» cuando la lista está vacía. El listado se deriva en cliente de `is_active` sobre la misma query | `src/features/boards/BoardsPage.tsx:19-20,27-37,45-70` |
| Badge de pendientes | Cada card muestra la etiqueta «Tareas pendientes:» seguida de `.ui-badge` con el número de tareas en `backlog`, `por_hacer` y `haciendo`. El badge es texto numérico con cifras tabulares, no un indicador solo por color | `src/features/boards/BoardsPage.tsx:60`, `src/index.css:139` |
| Acciones de administración | Solo para admin activo: «Gestionar miembros», «Cambiar nombre» y «Activar/Desactivar». El botón de desactivar usa `ui-button--danger` y cambia de texto y nombre accesible según el estado del tablero («Desactivar X» / «Activar X») | `src/features/boards/BoardsPage.tsx:61-66` |
| Diálogo de renombrado | `Dialog` con el nombre precargado, campo `ui-field` con `maxLength={120}`, ayuda «El nombre debe ser único y tener entre 1 y 120 caracteres», error `role=alert` con `ui-feedback--error` y pie con «Cancelar» / «Guardar nombre». El envío se bloquea mientras está pendiente y un fallo conserva el borrador | `src/features/boards/BoardsPage.tsx:118-141` |
| Diálogo de activar/desactivar | `Dialog` de confirmación con el texto del efecto: al desactivar avisa de que los miembros dejarán de ver el tablero y sus tareas y de que **no se borra ninguna tarea, comentario, adjunto ni membresía**; al activar avisa de que los miembros recuperan el acceso. Acción destructiva en `ui-button--danger` y acción principal en `ui-button--primary` | `src/features/boards/BoardsPage.tsx:143-165` |
| Mensajes de error del ciclo de vida | `describeBoardError` traduce el código de Postgres a lenguaje claro: duplicado, permisos insuficientes, sesión caducada, nombre fuera de rango y tablero inexistente; `getBoardUpdateErrorMessage` lo reutiliza para renombrar y activar/desactivar | `src/features/boards/BoardsPage.tsx:72-91` |
| Entrada a un tablero desactivado | La ruta resuelve el tablero contra el catálogo accesible; un tablero desactivado no aparece para sus miembros, así que la URL directa cae en el aviso «El tablero no existe o no tienes acceso.» con vuelta al selector. El admin activo sí lo ve en la sección de desactivados | `src/features/boards/BoardRoute.tsx:10-12`, `src/features/boards/BoardsPage.tsx:34-35` |
| Destinos de traslado | El selector de destino del detalle solo ofrece tableros activos distintos del actual; un tablero desactivado no se ofrece | `src/features/board/BoardPage.tsx:411` |

### Verificación y límites

128 pruebas Vitest en 15 archivos, lint y build correctos (persiste el aviso preexistente de chunk principal >500 kB). Comprobación en Chrome headless con CDP contra `npm run dev`, interceptando las llamadas a Supabase con datos simulados: se verificaron las dos secciones, el badge, el renombrado (diálogo precargado y actualización de la lista), el ciclo desactivar/reactivar y la vista de rol no administrador sin acciones ni sección de desactivados.

Límites: no es E2E con cuentas reales ni auditoría WCAG/lector de pantalla; la verificación SQL del ciclo de vida se hizo en local con Auth/Storage simulados. El contrato que sostiene esta UI **sí está aplicado en el proyecto Supabase remoto** desde el 2026-10-22 (`202610220001` y `202610220002`, en ese orden; las tres suites SQL remotas pasan y revierten sus fixtures con `ROLLBACK`) y la **SPA compatible ya está publicada en GitHub Pages** con `v0.6.0` el 2026-10-22 (workflow «Deploy to GitHub Pages», run `39860177282`, `headSha=21a44df`), pero esa publicación no aporta evidencia funcional nueva: la UI sigue sin verificarse contra el servicio real (ver [datos](../.data/README.md)). No se comprobaron viewports adicionales ni contraste calculado en esta revisión.

## Actualización — tableros y pertenencia, 2026-10-21

Esta sección describe el flujo local de selección/gestión de tableros y movimiento de tareas. No añade tokens, paleta, tema ni componente visual base; reutiliza `board-header`, `ui-button`, `ui-list-card`, `ui-feedback`, `Dialog` y `AssigneePicker`. Las partes de ciclo de vida (secciones, badge, renombrado y activar/desactivar) quedan **superadas** por la sección del 2026-10-22.

| Componente/patrón | Propósito, estados y comportamiento | Fuente |
| --- | --- | --- |
| Selector `BoardsPage` | Cards enlazan a `/board/:boardId`; carga, error/reintento y vacío. Admin ve todas las cards y puede crear/gestionar miembros; usuarios e invitados solo reciben las accesibles desde RLS. | `src/features/boards/BoardsPage.tsx:11-36` |
| Crear tablero | `Dialog` con nombre 1–120, estado pendiente, error general y duplicado con mensaje específico. El texto aclara que se crea sin miembros. Visible solo para admin. | `src/features/boards/BoardsPage.tsx:39-62` |
| Gestionar miembros | Diálogo usa `AssigneePicker`, lista actual, selección múltiple, estados de carga/error y guardado separado; solo admin accede al control. Los asignados a tareas no obtienen automáticamente acceso. | `src/features/boards/BoardsPage.tsx:64-88` |
| Entrada al tablero | Ruta concreta valida que el catálogo accesible contenga el ID; inexistente o no autorizado presenta aviso y vuelta al selector sin montar tareas. La cabecera ofrece «Cambiar tablero». | `src/features/boards/BoardRoute.tsx`, `src/features/board/BoardPage.tsx` |
| Traslado en detalle | Selector de destino, confirmación explícita y mensaje de salida del origen; destino solo entre tableros accesibles. Error mantiene el detalle y destino; éxito cierra el modal. No se añaden estilos base. | `src/features/board/TaskDetailModal.tsx` |

### Verificación y límites

111 pruebas Vitest, lint y build correctos; Chromium con backend simulado comprobó selector, gestión de miembros y traslado a 360/768/1440 px, sin errores de página ni desbordamiento de documento/diálogo. No es E2E con cuentas reales, ni auditoría WCAG, lectores de pantalla u otros navegadores. No hubo cambios de tokens ni pruebas de contraste necesarias por cambio visual.

## Estado actual — edición compartida de tareas, 2026-10-20

Esta sección prevalece sobre el historial inferior para las áreas modificadas. Describe el release `v0.6.0` (commit `21a44df`), ya versionado; no altera tokens ni convierte las revisiones históricas en baseline Git. El antiguo `RegisterPage` fue eliminado y las referencias inferiores a él son **históricas**, no rutas/archivos actuales.

| Componente/patrón | Propósito, variantes y estados | Fuente |
| --- | --- | --- |
| Cabecera / rutas | `/users` protegido por perfil activo + rol admin; `/register` redirige allí. Al cierre se detectó el cambio concurrente de cabecera a `AccountMenu`, con «Usuarios» dentro para admin. La nueva ruta `/profile` y el menú no tienen inventario/validación completo en esta revisión | `src/App.tsx:24-39`, `src/features/auth/ProtectedRoute.tsx:21-32`, `src/shared/ui/AccountMenu.tsx:20-35` |
| `UsersPage` | Cabecera adaptable, enlace al tablero y alta; lista paginada de nombre/correo/rol/estado, marca «(tú)», acciones «Editar nombre», «Cambiar contraseña», «Activar/Desactivar». Carga, vacío, error/reintento y anterior/siguiente; desactivación propia deshabilitada con explicación | `src/features/users/UsersPage.tsx:18-65` |
| `UserEditor` local | Reutiliza `Dialog`. Variantes create/rename/password/set-active; rename precarga nombre, no pide correo ni contraseña; activación muestra confirmación. Nombre 1–120, contraseña 8–128; envío bloquea campos/cierres y doble submit; error conserva borrador; éxito cierra y refresca lista | `src/features/users/UsersPage.tsx:70-132` |
| Confirmaciones de usuarios | Región `role=status` en la página para cuenta/nombre/contraseña/estado; error `role=alert` en listado o diálogo. No se describe como toast temporizado: esta página mantiene aviso inline | `src/features/users/UsersPage.tsx:29-31`, `:57-64`, `:109-125` |
| Acceso no disponible | Panel con alerta por cuenta inactiva o perfil no verificable y acción de cerrar sesión; no muestra el tablero protegido | `src/features/auth/ProtectedRoute.tsx:25-30` |
| `AssigneePicker` compartido | Fieldset con leyenda «Usuarios asignados»; seleccionados en lista nombrada con «Quitar»/nombre accesible «Desasignar a …». Busca por nombre/correo sin distinguir mayúsculas. Grupo de casillas nativas con nombre y correo; lista con altura máxima y scroll; carga, error/reintento, vacío y sin coincidencias diferenciados | `src/features/board/AssigneePicker.tsx:17-52` |
| Responsables inactivos | Asignación previa se muestra con «(inactivo)» y permite retirarla; no aparece como nueva opción. Sin selección muestra «Sin usuarios asignados» | `src/features/board/AssigneePicker.tsx:21-48` |
| Creación con responsables | Selector mantiene IDs en el borrador y los envía con el resto de datos; usa el mismo estado de bloqueo de creación/adjuntos. Un fallo de creación conserva selección y archivos | `src/features/board/CreateTaskModal.tsx`, `src/features/board/CreateTaskModal.test.tsx` |
| Detalle / guardado independiente | Precarga IDs y conserva borradores de campos/responsables por separado. «Guardar asignaciones» no cierra el detalle ni guarda título/estado. Cambios pendientes avisan y deshabilitan «Guardar cambios» para evitar descartarlos. Durante una operación bloquea selección/cierre/doble envío; ante error conserva selección; éxito muestra toast | `src/features/board/TaskDetailModal.tsx:54-97`, `:167-176` |
| Edición compartida en detalle | Cualquier cuenta activa, incluida `invitado`, recibe `onSave` y puede editar título, descripción, estado y prioridad de tareas propias o ajenas en el tablero accesible. «Eliminar tarea» solo se ofrece al creador o admin. La interfaz no restringe edición por rol/autoría; SQL añade el ámbito de membresía | `src/features/board/BoardPage.tsx`, `src/features/board/TaskDetailModal.tsx`, `supabase/migrations/202610210001_boards.sql` |

### Verificación de esta entrega y límites

Evidencia de implementación previa en esta sesión, **no nuevos comandos ejecutados durante la sincronización documental**:

- 79 pruebas Vitest, build y lint correctos; el bundle principal sigue avisando de tamaño superior a 500 kB.
- `UsersPage.test.tsx`: edición de nombre precargada, rechazo de espacios, conservación/reintento/cancelación, alta, contraseña, estado, listado y protección de ruta.
- `AssigneePicker.test.tsx`: búsqueda nombre/correo, multiselección, retirada completa, inactivos, carga/error/reintento y vacío.
- `CreateTaskModal.test.tsx`: envío múltiple, retención ante fallo y bloqueo durante envío. `TaskDetailModal.test.tsx`: guardado independiente sin editar campos, fallos conservando borrador y bloqueo de doble envío/cierre.
- `BoardPage.test.tsx`: en la entrega anterior, usuario e invitado sobre una tarea ajena no guardaban otros campos ni eliminaban la tarea, pero sí gestionaban responsables; ese comportamiento cambió con la edición compartida y la cobertura actual se detalla más abajo. La tarjeta reutiliza sus iniciales/avatares existentes (`src/features/board/TaskCard.tsx:96-115`).

Para el cambio de edición compartida, la implementación registró 89 pruebas Vitest, lint y build correctos. `BoardPage.test.tsx` cubre ahora que `usuario` e `invitado` pueden editar y guardar una tarea ajena, que el botón «Eliminar tarea» sigue reservado al creador y al administrador, y que «Guardar cambios» aparece para cualquier rol activo. `TaskDetailModal.test.tsx` mantiene la cobertura del guardado de responsables sin callback de guardado de campos. No se ejecutó una nueva validación visual en navegador ni una auditoría de contraste o lector de pantalla: los cambios no introducen tokens, estilos ni componentes nuevos, solo la disponibilidad de controles ya existentes.
- Chromium a 360/768/1440 px con backend simulado: selección múltiple en creación/detalle, guardado independiente, retirada por invitado, sin errores de página ni desbordamiento del documento/diálogo; capturas temporales revisadas, no versionadas.

Las pruebas DOM y visuales simuladas no certifican todo el flujo de administración en navegador, funcionamiento E2E con usuarios reales, contraste completo WCAG, otros navegadores ni lector de pantalla. Las pruebas SQL/Edge se describen en [datos](../.data/README.md), no son evidencia visual.

Los resultados anteriores preceden a los cambios concurrentes de perfil/menú: no se reutilizan como validación de esos archivos ni de la nueva combinación completa del árbol de trabajo.

## Actualización — notificaciones temporales, 2026-10-16

Revisión histórica de los cambios locales sobre `dfbf1be`; sus referencias de línea y resultados se conservan como evidencia de esa entrega, no del estado actual completo.

| Componente/patrón | Presentación, variantes y estados observados | Fuente |
| --- | --- | --- |
| `Toast` compartido | Confirmación verde flotante abajo a la derecha, ancho máximo 26rem y márgenes de seguridad; no desplaza el contenido ni intercepta clics fuera del aviso. Botón de cierre de 2,75rem con nombre «Cerrar notificación» | `src/shared/ui/Toast.tsx:19-40`, `src/index.css:127-132` |
| Temporización y accesibilidad | Cierre a los 4 segundos; pausa con puntero o foco interior y nuevo plazo al salir. Región persistente `role=status` con contenido atómico; no mueve el foco al aparecer. Limpia el temporizador al cambiar el aviso o desmontar | `src/shared/ui/Toast.tsx:9-38` |
| `useToast` | Mantiene un aviso por consumidor; sustituye el anterior y reinicia el plazo incluso al repetir texto. Mensaje vacío y cierre manual limpian el aviso | `src/shared/ui/useToast.ts:3-10` |
| Integración | El tablero notifica movimientos/cancelación y creación/guardado/eliminación de tareas. El detalle monta su propio toast dentro del diálogo para comentarios y adjuntos. Los errores permanecen en contexto | `src/features/board/BoardPage.tsx`, `src/features/board/TaskDetailModal.tsx` |
| Envío de comentarios | Botón compacto con SVG de envío o espera, sin texto visible; nombre accesible y título «Enviar»/«Enviando…», deshabilitado en curso o sin contenido; permanece junto al campo | `src/features/board/TaskDetailModal.tsx:151-168` |

Requisito funcional: [notificaciones temporales](../specs/06-ui-ux-diseno.md#notificaciones-temporales).

Verificación ejecutada: `npm run test -- --run` (39 pruebas correctas), `npm run build` y `npm run lint`. `src/shared/ui/Toast.test.tsx` verifica cierre automático, reinicio al repetir, pausa con puntero/foco y cierre manual. Las pruebas DOM no sustituyen una revisión visual en navegador ni una prueba con lector de pantalla. El build advierte del tamaño del chunk principal, sin impedir su generación.

## Actualización focalizada — adjuntos en alta de tarea, 2026-10-19

Revisión estática de los cambios locales de creación de tareas con archivos. Complementa el inventario del rediseño del 2026-10-16; no representa un baseline Git completo ni una validación visual en navegador.

| Componente/patrón | Presentación, variantes y estados observados | Fuente |
| --- | --- | --- |
| `CreateTaskModal` — selección de adjuntos | Botón visible «Seleccionar archivos» abre un selector múltiple. Cada archivo debe pesar como máximo 5 MB; los que exceden el límite se rechazan con `role=alert` sin quitar los válidos. La lista anuncia los nombres, muestra el tamaño y permite quitar cada archivo. Reutiliza `ui-button`, `ui-list-card` y `ui-feedback--error`; no añade tokens visuales | `src/features/board/CreateTaskModal.tsx:39-53`, `src/features/board/CreateTaskModal.tsx:94-143`, `src/index.css:75-135` |
| Envío de alta con adjuntos | La tarea se crea antes de subir los archivos. Durante ambas operaciones el diálogo impide nuevos envíos y cierres; el botón de creación informa «Creando tarea y adjuntos…». Si todo se completa, el tablero confirma el alta; ante fallos parciales conserva la tarea y muestra una alerta descartable con los nombres de los archivos no adjuntados | `src/features/board/CreateTaskModal.tsx:56-57`, `src/features/board/CreateTaskModal.tsx:186-203`, `src/features/board/BoardPage.tsx:230-283`, `src/features/board/BoardPage.tsx:318-325`, `src/features/board/BoardPage.tsx:366-375` |
| Accesibilidad y recuperación | El botón selector describe el límite de tamaño, la lista tiene nombre accesible, los errores se anuncian como alertas y el diálogo queda ocupado durante el envío. Si falla la creación, se conservan el borrador y los archivos seleccionados; si falla una subida tras crear la tarea, se indica añadir el archivo desde el detalle | `src/features/board/CreateTaskModal.tsx:94-143`, `src/features/board/BoardPage.tsx:237-281`, `src/features/board/BoardPage.tsx:318-325` |

Verificación de la implementación local: `npm run test -- --run` (48 pruebas correctas), `npm run build` y `npm run lint`. El build termina con una advertencia de chunk principal superior a 500 kB. No se hizo comprobación visual de la UI ni prueba con lector de pantalla.

## Revisión estática — rediseño local, 2026-10-16

Revisión estática histórica, realizada sobre código entonces sin commit y hoy versionado en `v0.6.0` / `21a44df`. Tokens y clases compartidas proceden de `src/index.css:4-169`; no se verificó su apariencia en navegador. La revisión focalizada del 2026-10-19 anterior complementa el estado de `CreateTaskModal`.

| Componente/patrón | Presentación, variantes y estados observados | Fuente |
| --- | --- | --- |
| Controles `ui-*` | Botón base/primary/secondary/danger y tamaño `sm`; active, disabled, hover condicionado al dispositivo. Campo, label, placeholder, focus e invalid; feedback base/error/success, vacío, enlace, lista, avatar y badge numérico | `src/index.css:75-140`, `src/index.css:171-178` |
| Login / registro | Shell centrado con halo, panel con borde/sombra; acción primaria sólida compartida. Labels asociados, autocomplete, `aria-busy`, error `role=alert` y texto de envío `role=status`; registro añade ayuda de contraseña | `src/features/auth/LoginPage.tsx:30-95`, `src/features/auth/RegisterPage.tsx:37-126`, `src/index.css:137-143` |
| BoardPage | Carga y error con reintento; header flexible, resumen por estado, CTA y anuncios de éxito/error; columnas horizontales enfocables, busy durante movimientos y DragOverlay | `src/features/board/BoardPage.tsx:72-89`, `src/features/board/BoardPage.tsx:235-295` |
| BoardColumn | Sección nombrada, contador, vacío con instrucción; borde/superficie de destino al arrastrar; movimientos disponibles según posición | `src/features/board/BoardColumn.tsx:19-54`, `src/index.css:163-168` |
| TaskCard / SortableTaskCard | Título como botón de apertura independiente del asa; prioridad textual/coloreada, descripción truncada, avatares, nota y contadores si disponibles (incluido cero). Movimientos nativos separados; dragging reduce opacidad | `src/features/board/TaskCard.tsx:35-168`, `src/features/board/SortableTaskCard.tsx:31-81` |
| Dialog compartido | `role=dialog`, `aria-modal`, título vinculado, `aria-busy`, cierre nombrado; enfoca campo/botón/panel, contiene Tab/foco, Escape, restaura origen y overflow; busy impide cierre, fondo solo cierra si se pulsa directamente | `src/shared/ui/Dialog.tsx:11-98` |
| CreateTaskModal | Consume Dialog (`max-w-lg`); cuerpo con scroll y footer separado asociado al formulario. Campos/cierres bloqueados durante envío; error anunciado, título vacío rechazado; en BoardPage se remonta al cambiar apertura | `src/features/board/CreateTaskModal.tsx:20-133`, `src/features/board/BoardPage.tsx:297-328` |
| TaskDetailModal | Consume Dialog; detalles/comentarios/adjuntos con tablist y tabpanel vinculados, roving tabindex, flechas/Home/End. Guardado pendiente mantiene abierto, bloqueo de doble operación, error conserva datos; confirmación destructiva inline, carga/error por lista y estados de envío/subida | `src/features/board/TaskDetailModal.tsx:29-99`, `src/features/board/TaskDetailModal.tsx:101-199` |
| CommentsList / AttachmentsList | Vacío descriptivo, listas nombradas y tarjetas comunes; autor/fecha o archivo/tamaño; borrado condicional con nombre contextualizado. Enlace «Ver» anuncia nueva pestaña. La carga/error la presenta el detalle | `src/features/board/CommentsList.tsx:9-57`, `src/features/board/AttachmentsList.tsx:15-73`, `src/features/board/TaskDetailModal.tsx:157-182` |

### Composición y límites observados

- Layout de diálogo: altura limitada por `100dvh`, header/tabs/footer fuera del scroll del cuerpo, padding reducido hasta 480px (`src/index.css:145-155`, `src/index.css:180-185`). Reglas documentadas, sin validación responsive visual.
- El cierre desmonta contenido del detalle y reinicia borrador/tab/confirmación; no implica conservar borradores tras cerrar (`src/features/board/TaskDetailModal.tsx:29-44`). La conservación documentada corresponde a fallos de operaciones mientras permanece abierto (`src/features/board/TaskDetailModal.tsx:59-87`).
- Input de archivo nativo accesible por label; límite local 5 MB, retención ante fallo y limpieza tras éxito (`src/features/board/TaskDetailModal.tsx:160-179`). No es evidencia de pruebas del almacenamiento real.
- `.ui-field[aria-invalid]` es un estilo disponible (`src/index.css:115`); no se presupone que todos los formularios vinculen errores por campo. Auth muestra error global (`src/features/auth/LoginPage.tsx:43-48`, `src/features/auth/RegisterPage.tsx:50-55`).

## Pruebas disponibles y límites

Runner disponible `npm run test -- --run` (`package.json:6-11`), entorno jsdom (`vitest.config.ts:5-8`). La tabla siguiente es el registro histórico del 2026-10-19, no una cobertura actual completa; las líneas pueden haber cambiado al añadir pruebas:

| Archivo | Test disponible | Evidencia que cubre |
| --- | --- | --- |
| `src/features/board/CreateTaskModal.test.tsx:12` | `solo monta el diálogo al abrir, lo nombra y enfoca el primer campo` | Montaje, nombre y foco inicial |
| `src/features/board/CreateTaskModal.test.tsx:23` | `bloquea el scroll y restaura el foco y overflow originales al cerrar con Escape` | Ciclo de foco/scroll y Escape |
| `src/features/board/CreateTaskModal.test.tsx:39` | `contiene Tab y Shift+Tab y permite recorrer campos interiores` | Recorrido y contención de teclado |
| `src/features/board/CreateTaskModal.test.tsx:80` | `bloquea todos los cierres, campos y nuevos envíos durante pending` | Estado pendiente |
| `src/features/board/CreateTaskModal.test.tsx:132` | `permite adjuntar varios archivos, rechaza los mayores a 5 MB y permite quitar los seleccionados` | Selector múltiple, validación local y eliminación de una selección |
| `src/features/board/TaskDetailModal.test.tsx:27` | `conserva el formulario abierto y el borrador si falla el guardado` | Recuperación de error |
| `src/features/board/TaskDetailModal.test.tsx:108` | `ofrece diálogo nombrado, pestañas con flechas y cierre exterior sin cerrar al pulsar dentro` | Semántica, tabs e interacción de fondo |
| `src/features/board/TaskDetailModal.test.tsx:157` | `permite abrir el selector con teclado, rechaza archivos superiores a 5 MB y sube automáticamente los válidos` | Acceso al selector, límite local y subida automática |
| `src/features/board/TaskCard.test.tsx:35` | `abre con Enter y Espacio desde el título sin activar los listeners de drag` | Apertura independiente |
| `src/features/board/TaskCard.test.tsx:51` | `mueve en las cuatro direcciones con ratón y teclado sin abrir ni iniciar drag` | Acciones de movimiento separadas |
| `src/features/board/TaskCard.test.tsx:100` | `muestra prioridad textual y contadores disponibles, incluido cero` | Información no dependiente solo de color |
| `src/features/board/BoardPage.test.tsx:72` | `crea la tarea antes de subir los archivos seleccionados y los asocia a su id` | Secuencia y asociación a la tarea creada |
| `src/features/board/BoardPage.test.tsx:103` | `mantiene la tarea si falla alguna subida y anuncia los archivos que se pueden añadir desde el detalle` | Recuperación ante fallos parciales |
| `src/features/board/BoardPage.test.tsx:135` | `no intenta subir adjuntos ni cierra el formulario si falla la creación de la tarea` | No subir ante fallo de creación; conserva borrador/selección |
| `src/features/board/BoardPage.test.tsx:183` | `muestra un error seguro al mover y restaura la tarea` | Error/recuperación del tablero |
| `src/features/board/BoardPage.test.tsx:210` | `ofrece reintentar la consulta fallida` | Reintento de carga |

Estos tests DOM no acreditan renderizado, contraste WCAG, carga real de fuente, layout/overflow a distintos viewports o zoom, drag geométrico real, reduced motion efectivo ni compatibilidad con lectores de pantalla. No se revisaron pruebas dedicadas de auth; las suites citadas no certifican esa pantalla. No se declara validación visual ni accesibilidad integral.

## Historial — catálogo anterior al rediseño

Se conserva el catálogo previo. Sus estilos (por ejemplo gradientes), rangos de línea y estados son históricos; las fuentes vigentes y límites se detallan arriba.

## Navegación y composición de la aplicación

- **Propósito:** envolver la app con caché y autenticación y elegir página por ruta hash.
- **Variantes/estados:** login, registro, callback y board protegido; ruta raíz redirige al board.
- **Estilo:** global dark theme; Tailwind.
- **Fuente:** `src/App.tsx:19-42`.

## Página de login y registro

- **Propósito:** autenticación por email/contraseña y alta de usuario.
- **Variantes/estados:** carga, mensaje de error; registro pide nombre, email y contraseña.
- **Estilo:** panel centrado, superficie elevada, inputs dark y acción primaria en gradiente.
- **Fuente:** `src/features/auth/LoginPage.tsx:30-103`, `src/features/auth/RegisterPage.tsx:37-125`.

## Tablero Kanban

- **Propósito:** mostrar tareas agrupadas por estado, permitir seleccionar y ordenar/mover.
- **Variantes/estados:** cargando, error, listo; drag overlay y disposición horizontal con scroll.
- **Estilo:** columnas de ancho fijo, separación `gap-4`, fondo oscuro.
- **Fuente:** `src/features/board/BoardPage.tsx:67-83`, `src/features/board/BoardPage.tsx:211-295`.

## Columna

- **Propósito:** representar un estado con etiqueta, contador y tareas dropeables.
- **Variantes/estados:** el `id` es `TaskStatus`; controles de mover se habilitan/deshabilitan por límites de columna/lista.
- **Estilo:** superficie, borde, radio grande, encabezado elevado.
- **Fuente:** `src/features/board/BoardColumn.tsx:15-49`.

## Card de tarea / sortable

- **Propósito:** presentar título, prioridad, descripción, asignados y notas; ofrecer movimiento en lista y entre columnas.
- **Variantes/estados:** normal, dragging, con/sin descripción/asignados/notas; botones de mover según límites.
- **Estilo:** color de prioridad, superficie, borde, elevación y transición.
- **Fuente:** `src/features/board/TaskCard.tsx:17-131`, `src/features/board/SortableTaskCard.tsx:19-64`.

## Modal de creación

- **Propósito:** capturar título, descripción, estado y prioridad.
- **Variantes/estados:** cerrado/abierto, error, envío; submit deshabilitado sin título o durante carga.
- **Estilo:** overlay, panel centrado, inputs y botones de cancelar/crear.
- **Fuente:** `src/features/board/CreateTaskModal.tsx:19-31`, `src/features/board/CreateTaskModal.tsx:33-143`.

## Modal de detalle

- **Propósito:** editar datos de tarea y gestionar comentarios/adjuntos.
- **Variantes/estados:** tabs `details`, `comments`, `attachments`; confirmación de borrado; cierre por botón o click en overlay.
- **Estilo:** panel ancho con altura limitada, encabezado/tabs, acciones al pie.
- **Fuente:** `src/features/board/TaskDetailModal.tsx:39-76`, `src/features/board/TaskDetailModal.tsx:79-121`, `src/features/board/TaskDetailModal.tsx:264-311`.

## Lista de comentarios

- **Propósito:** mostrar autor, fecha, cuerpo y acción condicional de borrar.
- **Variantes/estados:** vacía y con comentarios; borrar depende de `canDelete`.
- **Fuente:** `src/features/board/CommentsList.tsx:9-49`.

## Lista de adjuntos

- **Propósito:** mostrar icono, nombre, tamaño y enlace «Ver»; ofrece cambio de nombre inline y borrado con confirmación a los adjuntos administrables por la cuenta.
- **Variantes/estados:** vacía y con adjuntos; editor de nombre precargado, botones guardar/cancelar, bloqueo durante mutación y acciones condicionales por uploader/creador de tarea/admin activo.
- **Estilo:** reutiliza `ui-list-card`, `ui-field` y botones `ui-*`; no añade tokens ni clases CSS propias.
- **Fuente:** `src/features/board/AttachmentsList.tsx:18-99`, `src/features/board/TaskDetailModal.tsx:275-287`, `src/features/board/BoardPage.tsx:465-476`.

## Controles de formulario

- **Propósito:** email, contraseña, nombre, título, descripción, estado y prioridad.
- **Estados:** focus visible por regla global; botones pueden representar disabled/loading/error.
- **Tokens/clases:** texto muted, superficie, borde, focus ring primary y transiciones.
- **Fuente:** `src/features/auth/LoginPage.tsx:48-91`, `src/features/auth/RegisterPage.tsx:55-115`, `src/features/board/CreateTaskModal.tsx:51-140`, `src/index.css:34-41`.
