# Componentes visuales

Catálogo de componentes actuales, no una promesa de API reutilizable fuera de sus props observadas.

## Estado vigente — rediseño local, 2026-10-16

Revisión estática del árbol de trabajo sin commit. Tokens y clases compartidas proceden de `src/index.css:4-169`; no se verificó su apariencia en navegador.

| Componente/patrón | Presentación, variantes y estados observados | Fuente |
| --- | --- | --- |
| Controles `ui-*` | Botón base/primary/secondary/danger y tamaño `sm`; active, disabled, hover condicionado al dispositivo. Campo, label, placeholder, focus e invalid; feedback base/error/success, vacío, enlace, lista y avatar | `src/index.css:75-135`, `src/index.css:171-178` |
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

Pruebas presentes en el árbol local; **no ejecutadas en esta revisión documental**. Runner disponible `npm run test -- --run` (`package.json:6-11`), entorno jsdom (`vitest.config.ts:5-8`). Referencias representativas por nombre exacto:

| Archivo | Test disponible | Evidencia que cubre |
| --- | --- | --- |
| `src/features/board/CreateTaskModal.test.tsx:12` | `solo monta el diálogo al abrir, lo nombra y enfoca el primer campo` | Montaje, nombre y foco inicial |
| `src/features/board/CreateTaskModal.test.tsx:23` | `bloquea el scroll y restaura el foco y overflow originales al cerrar con Escape` | Ciclo de foco/scroll y Escape |
| `src/features/board/CreateTaskModal.test.tsx:39` | `contiene Tab y Shift+Tab y permite recorrer campos interiores` | Recorrido y contención de teclado |
| `src/features/board/CreateTaskModal.test.tsx:80` | `bloquea todos los cierres, campos y nuevos envíos durante pending` | Estado pendiente |
| `src/features/board/TaskDetailModal.test.tsx:27` | `conserva el formulario abierto y el borrador si falla el guardado` | Recuperación de error |
| `src/features/board/TaskDetailModal.test.tsx:108` | `ofrece diálogo nombrado, pestañas con flechas y cierre exterior sin cerrar al pulsar dentro` | Semántica, tabs e interacción de fondo |
| `src/features/board/TaskDetailModal.test.tsx:157` | `permite alcanzar el input por teclado y rechaza archivos superiores a 5 MB sin subirlos` | Acceso al archivo y límite local |
| `src/features/board/TaskCard.test.tsx:35` | `abre con Enter y Espacio desde el título sin activar los listeners de drag` | Apertura independiente |
| `src/features/board/TaskCard.test.tsx:51` | `mueve en las cuatro direcciones con ratón y teclado sin abrir ni iniciar drag` | Acciones de movimiento separadas |
| `src/features/board/TaskCard.test.tsx:100` | `muestra prioridad textual y contadores disponibles, incluido cero` | Información no dependiente solo de color |
| `src/features/board/BoardPage.test.tsx:78` | `muestra un error seguro al mover y restaura la tarea` | Error/recuperación del tablero |
| `src/features/board/BoardPage.test.tsx:105` | `ofrece reintentar la consulta fallida` | Reintento de carga |

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

- **Propósito:** mostrar icono, nombre, tamaño, enlace «Ver» y borrado condicional.
- **Variantes/estados:** vacía y con adjuntos; borrar depende de `canDelete`.
- **Fuente:** `src/features/board/AttachmentsList.tsx:15-61`.

## Controles de formulario

- **Propósito:** email, contraseña, nombre, título, descripción, estado y prioridad.
- **Estados:** focus visible por regla global; botones pueden representar disabled/loading/error.
- **Tokens/clases:** texto muted, superficie, borde, focus ring primary y transiciones.
- **Fuente:** `src/features/auth/LoginPage.tsx:48-91`, `src/features/auth/RegisterPage.tsx:55-115`, `src/features/board/CreateTaskModal.tsx:51-140`, `src/index.css:34-41`.
