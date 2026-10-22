# Sistema de diseño — Dashboard Furthurr

Documentación canónica de lo visual. Léela antes de añadir pantallas, componentes o estilos.

## Estado de sincronización

- Tecnología detectada: React + TypeScript, Tailwind CSS v4 y CSS custom properties.
- Commit base revisado: `eb25418de42c045d6be32a3091f8bb3f36b24ba0` (2026-10-21), contiene el selector y los componentes de tableros documentados aquí.
- Baseline vigente: release `v0.6.0`, commit `21a44df45258f8b7ebc030ec95a4c5189d69dade` (2026-10-22, `chore(release): preparar versión v0.6.0`), con tag anotado `v0.6.0` apuntando a ese commit. La rama `main` está sincronizada con `origin/main` en `93c1db2` (`docs(canonica): actualizar baseline tras la publicación de v0.6.0`), que ya incluye la edición de `specs/05-auth-roles-permisos.md`; el árbol de trabajo solo contiene la actualización documental de este ciclo (cierre de los pendientes de despliegue de `admin-users` y de la configuración de Auth), pendiente de commit, y no hay diferencias de producto ni migraciones sin trackear. **Esta documentación declara `93c1db2` como fuente sincronizada; el baseline de release sigue siendo `v0.6.0` (`21a44df`).**
- Última actualización documental: 2026-10-22, ciclo de vida de tableros en el selector (secciones activa/desactivada, badge de pendientes, diálogos de renombrado y de activar/desactivar), **aplicación verificada de `202610220001` y `202610220002` en el proyecto Supabase remoto** (las tres suites SQL remotas pasan y revierten sus fixtures con `ROLLBACK`) y **publicación de la SPA con `v0.6.0` en GitHub Pages**.
- No hay cambios visuales relevantes posteriores a ese commit. La revisión del 2026-10-22 ya está versionada en `21a44df`: el baseline Git no queda pendiente.
- La única clase visual nueva es `.ui-badge` (`src/index.css:139`); no se añadieron tokens, paleta, tema ni tipografía.
- Revisión de `ProfilePage` y `AccountMenu` completa queda fuera del alcance de esta revisión.
- La documentación de despliegue remoto y las releases anteriores no alteran el sistema visual. La publicación de la SPA compatible en GitHub Pages **ya se realizó** con `v0.6.0` el 2026-10-22 (workflow «Deploy to GitHub Pages», run `39860177282`, `headSha=21a44df`) y está servida en <https://furthurr.github.io/dashboardFurthurr/>.
- Revisión focalizada de notificaciones: cambios sobre `dfbf1be` (2026-10-16), documentados en [componentes](components.md#actualización--notificaciones-temporales-2026-10-16). No sustituye el baseline del inventario completo.
- Revisión focalizada de adjuntos durante el alta de tareas (2026-10-19): selector múltiple, límite por archivo, estados de envío y fallos parciales documentados en [componentes](components.md). Esa revisión ya está versionada; no registra un baseline Git nuevo.

## Contexto para IA

- **Estado actual:** `/users` reemplaza el alta aislada: administración solo para admin activo con listado, alta, nombre, contraseña y activación. `/register` redirige a esa ruta; `RegisterPage` ya no existe (`src/App.tsx:24-37`, `src/features/users/UsersPage.tsx:10-133`).
- **Selector de tableros:** después del login, una card por tablero accesible; admin ve todos y puede crear. Admin gestiona miembros por diálogo; usuarios/invitados ven solo sus membresías. Estados de carga, error/reintento y vacío; cards reutilizan `ui-*` y `Dialog` sin crear tokens nuevos (`src/features/boards/BoardsPage.tsx:11-36`).
- **Ciclo de vida de tableros (2026-10-22):** el selector se divide en dos secciones, «Tableros activos» y «Tableros desactivados»; la segunda solo se renderiza para administradores activos y solo si hay tableros desactivados. Cada card muestra «Tareas pendientes:» con un badge numérico. Para admin aparecen «Cambiar nombre» y «Activar/Desactivar»; el botón de desactivar usa la variante `ui-button--danger`. Los diálogos de renombrado y de activar/desactivar reutilizan `Dialog`, `ui-field`, `ui-label` y `ui-feedback--error`; no hay tokens nuevos (`src/features/boards/BoardsPage.tsx:27-70,118-165`, `src/index.css:139`).
- **Detalle y traslado:** permite escoger destino y exige confirmación; informa que la tarea sale del tablero actual y conserva contenido/relaciones. El destino se limita a tableros accesibles y activos. Usa Dialog y controles existentes, sin tokens nuevos (`src/features/board/TaskDetailModal.tsx`, `src/features/board/BoardPage.tsx:411`).
- **Acceso concurrente observado:** el tablero ahora monta `AccountMenu`; «Usuarios» está dentro del menú para administradores, no como botón directo junto al correo. El menú añade `/profile`, fuera de la revisión de comportamiento (`src/shared/ui/AccountMenu.tsx:20-35`).
- **Responsables:** `AssigneePicker` compartido en creación y detalle: búsqueda, casillas múltiples y chips retirables; conserva asignados inactivos sin ofrecerlos como nuevas opciones. En detalle, «Guardar asignaciones» es independiente, disponible para todas las cuentas activas, incluidos invitados (`src/features/board/AssigneePicker.tsx:17-52`, `src/features/board/TaskDetailModal.tsx:87-97`, `:167-176`).
- **Edición compartida de tareas (2026-10-20):** en el detalle, título, descripción, estado y prioridad son editables para cualquier cuenta activa con acceso al tablero, sobre tareas propias o ajenas; «Eliminar tarea» solo se ofrece al creador o a un admin. No se introdujeron tokens, estilos ni componentes nuevos: cambia la disponibilidad de controles ya existentes (`src/features/board/BoardPage.tsx`, `src/features/board/TaskDetailModal.tsx`).
- **Notificaciones temporales (2026-10-16):** `Toast` y `useToast` en `src/shared/ui/` sustituyen las confirmaciones inline del tablero y del detalle por avisos flotantes con cierre a los 4 segundos, pausa con puntero/foco y cierre manual. Consumen los tokens de éxito, sombra, espaciado y radio existentes mediante `.ui-toast-*` (`src/index.css:129-132`). Errores conservados en contexto; spec en `specs/06-ui-ux-diseno.md`. Build y lint correctos, 39 pruebas aprobadas incluida temporización con relojes simulados; sin nueva validación visual en navegador.
- **Revisión de dominio (2026-10-16):** inventario del rediseño local por lectura estática; las secciones históricas conservan las observaciones anteriores, no describen el estado vigente.
- **Tokens y patrones:** paleta índigo/oscura, colores semánticos, spacing, tamaños de texto, radios, sombra y transiciones en `src/index.css:4-50`. Clases compartidas `ui-*`, `auth-*`, `dialog-*`, `task-tabs` y `board-*` en `src/index.css:74-169`.
- **Tipografía y tema:** Plus Jakarta Sans con fallback de sistema, `color-scheme: dark`; no selector ni paleta clara en el CSS revisado (`src/index.css:1-5`, `src/index.css:52-71`).
- **Componentes:** login conserva `auth-*`; administración reutiliza `board-header`, `ui-feedback`, `Dialog` y formularios compartidos; selector consume `ui-field`, `ui-list-card`, `ui-button`, `ui-badge`, bordes/radios existentes y checkbox nativo. No se introdujeron tokens, tema ni tipografía nuevos en esta feature (`src/features/users/UsersPage.tsx:18-65`, `:105-132`, `src/features/board/AssigneePicker.tsx:26-50`).
- **Estandarización y límites:** persisten utilities locales/SVG y la deuda ya registrada. Las comprobaciones visuales previas no equivalen a una auditoría de contraste ni uso con lector de pantalla; no se ejecutó otra auditoría durante esta sincronización.
- **Pruebas y evidencia:** 128 pruebas Vitest, lint/build correctos; Chrome headless con CDP y backend simulado comprobó las dos secciones, el badge, el renombrado, el ciclo desactivar/reactivar y la vista de rol no administrador. El contrato que sostiene esta UI sí está aplicado en el proyecto Supabase remoto (2026-10-22) y la SPA compatible **ya está publicada en GitHub Pages** con `v0.6.0` (2026-10-22, run `39860177282`), aunque esa publicación no aporta evidencia funcional nueva: la UI sigue sin verificarse contra el servicio real. No son E2E con cuentas reales ni auditoría completa de accesibilidad; ver [componentes](components.md).

### Evidencia posterior a la revisión estática

La entrega UI ejecutó 33 pruebas correctas, build y lint, y comprobó Chromium a 360/768/1440 px con datos simulados: sin overflow del documento y con scroll del Kanban y diálogos dentro del viewport. Se revisaron capturas y se verificó movimiento reducido. Contrastes calculados puntuales: primario 6,29:1 y texto secundario/superficie elevada 7,47:1. No constituye auditoría completa WCAG ni prueba con lector de pantalla. La fuente externa estuvo bloqueada y las capturas usan fallback. Evidencia, comandos y limitaciones en [la spec de entrega](../.sdd/specs/mejora-integral-ui/spec.md#4-verificación-y-cierre); el baseline Git vigente es `v0.6.0` / `21a44df` y ya no está pendiente.

### Historial de contexto previo al rediseño

Se conserva el texto anterior por trazabilidad. Sus valores, referencias de línea y pendientes corresponden a la observación previa y pueden estar superados por la revisión vigente.

- **Stack visual:** Tailwind CSS v4 más estilos globales en `src/index.css`; componentes React de autenticación y tablero.
- **Dónde viven los tokens:** custom properties de color, radio y transición en `src/index.css:4-20`; estados de tarea/prioridad en `src/features/board/constants.ts:3-16`.
- **Temas:** solo se observa una paleta oscura aplicada; no hay selector ni tema claro implementado en las fuentes revisadas (`src/index.css:4-28`).
- **Intención vs. implementación:** la spec de UI sigue en borrador y cita Airtable/Linear como referencias; este catálogo describe la UI oscura que existe en el código (`specs/06-ui-ux-diseno.md:3-20`, `src/index.css:4-28`).
- **Convenciones:** fuente base Plus Jakarta Sans; la mayor parte de spacing, texto, forma y elevación usa utilities Tailwind en cada componente.
- **Estandarización:** algunos colores y radios están tokenizados, pero existen colores y medidas hardcodeados en modales, listas y estados. No se detectó una librería de iconos; hay SVG inline y emoji.
- **Accesibilidad observada:** hay `:focus-visible` para controles comunes y reducción de movimiento (`src/index.css:34-51`); el marcado de modales y ciertos controles icon-only necesita completar su semántica.

## Índice

- Fundamentos: [colores](foundations/colors.md), [tipografía](foundations/typography.md), [espaciado](foundations/spacing.md), [formas y elevación](foundations/shape-elevation.md), [iconografía](foundations/iconography.md).
- [Componentes visuales](components.md).
- [Deuda técnica de UI](ui-tech-debt.md).
- Producto y flujo: [especificación UI/UX](../specs/06-ui-ux-diseno.md).

## Cómo se mantiene

Actualizar esta carpeta cuando cambien estilos, componentes visuales o tokens. Los documentos registran la implementación observada; `specs/06-ui-ux-diseno.md` conserva la intención de producto y no se sustituye por este catálogo.
