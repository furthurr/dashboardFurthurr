# Sistema de diseño — Dashboard Furthurr

Documentación canónica de lo visual. Léela antes de añadir pantallas, componentes o estilos.

## Estado de sincronización

- Tecnología detectada: React + TypeScript, Tailwind CSS v4 y CSS custom properties.
- Commit base revisado: `81335b92bc1962a47c9c3bb963271c3667bc7b63` (2026-05-04); no incorpora los cambios locales.
- Última actualización documental: 2026-10-19 (revisión focalizada de creación de tareas con adjuntos).
- Estado: **pendiente de baseline Git**. Hay cambios locales de UI y documentación; esta revisión describe el árbol de trabajo sin commit. No declara HEAD sincronizado ni sustituye el commit base revisado.
- Revisión focalizada de notificaciones: cambios locales sobre `dfbf1be` (2026-10-16), documentados en [componentes](components.md#actualización--notificaciones-temporales-2026-10-16). No sustituye el baseline del inventario completo.
- Revisión focalizada de adjuntos durante el alta de tareas (2026-10-19): selector múltiple, límite por archivo, estados de envío y fallos parciales documentados en [componentes](components.md). Se documenta el árbol de trabajo; no se registra un baseline Git nuevo.

## Contexto para IA

- **Notificaciones temporales (2026-10-16):** `Toast` y `useToast` en `src/shared/ui/` sustituyen las confirmaciones inline del tablero y del detalle por avisos flotantes con cierre a los 4 segundos, pausa con puntero/foco y cierre manual. Consumen los tokens de éxito, sombra, espaciado y radio existentes mediante `.ui-toast-*` (`src/index.css:129-132`). Errores conservados en contexto; spec en `specs/06-ui-ux-diseno.md`. Build y lint correctos, 39 pruebas aprobadas incluida temporización con relojes simulados; sin nueva validación visual en navegador.
- **Revisión de dominio (2026-10-16):** inventario del rediseño local por lectura estática; las secciones históricas conservan las observaciones anteriores, no describen el estado vigente.
- **Tokens y patrones:** paleta índigo/oscura, colores semánticos, spacing, tamaños de texto, radios, sombra y transiciones en `src/index.css:4-50`. Clases compartidas `ui-*`, `auth-*`, `dialog-*`, `task-tabs` y `board-*` en `src/index.css:74-169`.
- **Tipografía y tema:** Plus Jakarta Sans con fallback de sistema, `color-scheme: dark`; no selector ni paleta clara en el CSS revisado (`src/index.css:1-5`, `src/index.css:52-71`).
- **Componentes:** auth usa panel y controles compartidos; tablero con resumen, columnas desplazables y estados explícitos; `Dialog` compartido aporta nombre, foco, Escape y bloqueo de scroll; detalle añade tabs con navegación por teclado (`src/features/auth/LoginPage.tsx:30-95`, `src/features/board/BoardPage.tsx:235-295`, `src/shared/ui/Dialog.tsx:21-98`, `src/features/board/TaskDetailModal.tsx:101-199`).
- **Estandarización y límites:** prioridades consumen variables CSS (`src/features/board/constants.ts:11-16`); persisten utilities locales, SVG inline y algunos valores directos. Las correcciones observadas y deuda residual están en [deuda UI](ui-tech-debt.md). No se realizó validación visual, medición de contraste ni prueba con lector de pantalla.
- **Pruebas disponibles:** Vitest/jsdom (`vitest.config.ts:5-8`); nombres, rutas y límites en [componentes](components.md#pruebas-disponibles-y-límites). Revisión focalizada del 2026-10-19: 48 pruebas correctas, build y lint correctos; sin nueva verificación visual en navegador ni con lector de pantalla.

### Evidencia posterior a la revisión estática

La entrega UI ejecutó 33 pruebas correctas, build y lint, y comprobó Chromium a 360/768/1440 px con datos simulados: sin overflow del documento y con scroll del Kanban y diálogos dentro del viewport. Se revisaron capturas y se verificó movimiento reducido. Contrastes calculados puntuales: primario 6,29:1 y texto secundario/superficie elevada 7,47:1. No constituye auditoría completa WCAG ni prueba con lector de pantalla. La fuente externa estuvo bloqueada y las capturas usan fallback. Evidencia, comandos y limitaciones en [la spec de entrega](../.sdd/specs/mejora-integral-ui/spec.md#4-verificación-y-cierre); baseline Git aún pendiente.

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
