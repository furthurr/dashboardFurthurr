# Iconografía y assets

## Estado vigente — rediseño local, 2026-10-16

- Continúan los SVG inline; no hay dependencia dedicada de iconos en el manifiesto revisado (`package.json:13-46`). `.ui-icon` aporta `1.25rem` de ancho/alto y evita encogimiento (`src/index.css:131`). No constituye un wrapper React ni un set centralizado de paths.
- Auth usa SVG decorativos con `aria-hidden`; marca `w-6 h-6`, retorno al tablero con `.ui-icon` (`src/features/auth/LoginPage.tsx:33-36`, `src/features/auth/RegisterPage.tsx:40-43`, `src/features/auth/RegisterPage.tsx:118-123`).
- Cierre compartido: SVG `w-5 h-5` oculto al árbol accesible, dentro de botón con `aria-label="Cerrar diálogo"` (`src/shared/ui/Dialog.tsx:88-93`).
- Clip/archivo y vacíos de listas se representan ahora con SVG `aria-hidden`, no emoji en esos componentes (`src/features/board/AttachmentsList.tsx:18-24`, `src/features/board/AttachmentsList.tsx:35-38`, `src/features/board/CommentsList.tsx:12-18`). Borrados muestran texto «Eliminar» y nombres contextualizados (`src/features/board/AttachmentsList.tsx:59-67`, `src/features/board/CommentsList.tsx:42-50`).
- Asa de arrastre: SVG de puntos, nombre «Arrastrar tarea: …», cursor grab y activador independiente (`src/features/board/SortableTaskCard.tsx:53-71`). Movimientos conservan SVG locales `w-4 h-4`, `aria-label` y `title`; esos SVG no declaran `aria-hidden` (`src/features/board/TaskCard.tsx:110-165`).
- Persisten tamaños/trazos distintos (`1.75`, `2`, fill); U-04 se considera parcial, no una unificación completa. No hubo revisión visual de alineación ni prueba con lector de pantalla.

## Historial — inventario anterior al rediseño

Se preservan las observaciones anteriores de emoji/glifos y deuda; para los componentes revisados arriba han sido sustituidas por la evidencia vigente.

## Sistema observado

- No se detectó dependencia dedicada de iconos en `package.json:12-39` ni una carpeta de assets visuales dentro de `src/assets/` (vacía al sincronizar).
- Los iconos de acciones se escriben como SVG inline en componentes, por ejemplo movimientos en `src/features/board/TaskCard.tsx:82-127` y cierre de modal en `src/features/board/TaskDetailModal.tsx:82-87`.
- También aparecen glifos/emoji: papelera/cierre como caracteres y clip de adjunto `📎` (`src/features/board/TaskDetailModal.tsx:81-87`, `src/features/board/AttachmentsList.tsx:27-33`).

## Convenciones existentes

- SVG inline con `viewBox`, trazos y clases Tailwind para tamaño/color; no hay set compartido o wrappers de iconos identificados.
- El emoji de adjunto se muestra junto a nombre y tamaño de archivo (`src/features/board/AttachmentsList.tsx:24-38`).
- No se copiaron assets ni capturas a `.design/`; mantener referencias a sus ubicaciones originales si se documentan posteriormente.

## Notas de estandarización

- Una misma acción puede usar SVG inline, emoji o texto; una convención compartida permitiría uniformidad de tamaño, peso, foco y nombre accesible.
- Los controles que solo muestran un icono necesitan un nombre accesible en el DOM; ver la deuda U-01.
