# Deuda técnica de UI

Hallazgos visuales/documentales detectados en los componentes y estilos revisados. No se modificó UI ni se ejecutó una auditoría automatizada de accesibilidad.

## Revisión vigente — rediseño local, 2026-10-16

Estado basado en lectura del código sin commit. «Corregida en código» describe evidencia de implementación, no validación visual ni cierre de una auditoría de accesibilidad. Las filas originales se conservan abajo como historial, con sus referencias antiguas.

| ID histórico | Estado observado | Evidencia vigente y alcance |
| --- | --- | --- |
| U-01 | Corregida en código para creación y detalle | Ambos consumen `Dialog` (`src/features/board/CreateTaskModal.tsx:36`, `src/features/board/TaskDetailModal.tsx:102`). Nombre, `role=dialog`, `aria-modal` y cierre etiquetado: `src/shared/ui/Dialog.tsx:84-93`; foco inicial, Tab, Escape, contención y restauración: `src/shared/ui/Dialog.tsx:29-76`. Falta verificación con lector de pantalla/navegador real. |
| U-02 | Corregida en código | Cursor pointer restringido a selectores interactivos; disabled not-allowed y campos cursor text (`src/index.css:64-67`). No se afirma auditoría exhaustiva de todos los cursores de la app. |
| U-03 | Parcialmente corregida | Radios, colores semánticos y patrones compartidos sí se consumen (`src/index.css:75-168`); listas/modales migrados (`src/features/board/CommentsList.tsx:12-53`, `src/features/board/AttachmentsList.tsx:18-67`, `src/features/board/TaskDetailModal.tsx:122-198`). Persisten valores directos y excepciones de forma: ver R-01. |
| U-04 | Parcialmente corregida | Emoji de adjuntos/cierre sustituidos por SVG; nombres de controles explícitos (`src/features/board/AttachmentsList.tsx:18-67`, `src/shared/ui/Dialog.tsx:88-93`). Persisten SVG inline con tamaños/trazos distintos y sin wrapper común (`src/features/board/TaskCard.tsx:110-165`); ver R-02. |
| U-05 | Corregida la ausencia de escala; adopción parcial | Existen `--space-*` y `--text-*` (`src/index.css:31-42`) y consumo en patrones compartidos (`src/index.css:75-168`); permanecen utilities locales (`src/features/board/TaskCard.tsx:43-66`). No se presenta como migración total. |

### Deuda residual observada

| ID | Prioridad | Hallazgo y evidencia | Seguimiento documental/técnico |
| --- | --- | --- | --- |
| R-01 (U-03) | Baja | Excepciones directas: hover danger `#492636`, halo auth y backdrop (`src/index.css:175`, `src/index.css:137`, `src/index.css:146`); radios locales en adjunto/avatar excedente (`src/features/board/AttachmentsList.tsx:35`, `src/features/board/TaskCard.tsx:83`). | Evaluar consolidación si se reutilizan; la centralización actual no es total. |
| R-02 (U-04) | Baja | Paths/trazos/tamaños SVG locales; los decorativos de movimiento ya declaran `aria-hidden` (`src/features/board/TaskCard.tsx:110-165`). | Queda consolidación opcional de estilos de icono; no exige una abstracción compartida sin reutilización demostrada. |
| R-03 | Corregida | En Chromium se reprodujo transición de tarjetas de 0s por duración inválida; `src/features/board/TaskCard.tsx:39` usa ahora `duration-150 ease-out`. | GREEN de estilo computado: 0,15s y 0,00001s con movimiento reducido. Evidencia en spec de entrega. |

### Evidencia de pruebas y límites

Disponibles, no ejecutadas aquí: `solo monta el diálogo al abrir, lo nombra y enfoca el primer campo`, `bloquea el scroll y restaura el foco y overflow originales al cerrar con Escape`, `contiene Tab y Shift+Tab y permite recorrer campos interiores` (`src/features/board/CreateTaskModal.test.tsx:12`, `:23`, `:39`); `ofrece diálogo nombrado, pestañas con flechas y cierre exterior sin cerrar al pulsar dentro` (`src/features/board/TaskDetailModal.test.tsx:108`). Más referencias en [componentes](components.md#pruebas-disponibles-y-límites).

Son pruebas DOM en jsdom (`vitest.config.ts:8`), no validación visual por sí mismas. Posteriormente la entrega ejecutó 33 pruebas correctas y Chromium a 360/768/1440 px: sin overflow horizontal del documento, con scroll interno, diálogos dentro del viewport y movimiento reducido comprobado. Se revisaron capturas y contrastes puntuales; no se declara conformidad WCAG. Quedan sin comprobar zoom extremo, fuentes externas bloqueadas, lector de pantalla y otros navegadores. Evidencia en [la spec](../.sdd/specs/mejora-integral-ui/spec.md#4-verificación-y-cierre). El baseline Git continúa pendiente.

## Historial — hallazgos anteriores al rediseño

Las tablas siguientes conservan las observaciones originales; consultar arriba su estado vigente. Las ubicaciones históricas no apuntan necesariamente a las mismas líneas del árbol actual.

## 🔴 Crítica

| # | Hallazgo | Ubicación (archivo:línea) | Impacto | Esfuerzo | Recomendación |
| --- | --- | --- | --- | --- | --- |
| — | Sin hallazgos visuales críticos verificados en este alcance. | — | — | — | — |

## 🟠 Alta

| # | Hallazgo | Ubicación | Impacto | Esfuerzo | Recomendación |
| --- | --- | --- | --- | --- | --- |
| — | Sin hallazgos visuales altos verificados en este alcance. | — | — | — | — |

## 🟡 Media

| # | Hallazgo | Ubicación | Impacto | Esfuerzo | Recomendación |
| --- | --- | --- | --- | --- | --- |
| U-01 | Modales sin semántica de diálogo ni nombres accesibles explícitos para los botones de cierre observados. | `src/features/board/CreateTaskModal.tsx:33-48`, `src/features/board/TaskDetailModal.tsx:73-87` | Puede dificultar el uso con lector de pantalla/teclado; no se observa en estos fragmentos `role="dialog"`, `aria-modal`, etiqueta ni foco inicial gestionado. | Bajo/medio | Añadir semántica y etiqueta accesible, gestionar foco/escape y verificar con teclado/lector de pantalla. |
| U-02 | La regla global asigna `cursor: pointer` a todos los elementos. | `src/index.css:30-32` | Indica falsamente interactividad en texto y elementos no interactivos; puede confundir a usuarios. | Bajo | Limitar cursor pointer a controles/enlaces interactivos. |
| U-03 | Los tokens de radio y varios colores declarados no se consumen de forma uniforme; hay valores directos repetidos en modales/listas. | `src/index.css:4-20`, `src/features/board/TaskDetailModal.tsx:73-87`, `src/features/board/CommentsList.tsx:10-24` | Aumenta divergencia entre pantallas y hace más costoso cambiar el tema. | Medio | Centralizar los valores semánticos y migrar gradualmente estilos duplicados. |

## 🟢 Baja

| # | Hallazgo | Ubicación | Impacto | Esfuerzo | Recomendación |
| --- | --- | --- | --- | --- | --- |
| U-04 | Iconografía combina SVG inline, emoji y caracteres sin wrapper compartido. | `src/features/board/TaskCard.tsx:82-127`, `src/features/board/AttachmentsList.tsx:27-33`, `src/features/board/TaskDetailModal.tsx:81-87` | Diferencias de escala, estilo y semántica entre acciones. | Medio | Definir convención de iconos y texto alternativo al añadir/refactorizar controles. |
| U-05 | No se observa una escala tipográfica ni espaciado semánticos propios; se usan utilities locales de Tailwind. | `src/index.css:1-51`, `src/features/board/BoardColumn.tsx:20-31` | La consistencia depende de mantener valores locales parecidos. | Bajo | Documentar aliases solo si se necesita una escala de marca común; hoy los defaults de Tailwind son la convención efectiva. |
