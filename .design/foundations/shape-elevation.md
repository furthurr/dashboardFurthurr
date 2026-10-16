# Formas, bordes y elevación

## Estado vigente — rediseño local, 2026-10-16

| Token | Valor CSS | Consumo observado |
| --- | --- | --- |
| `--radius-sm` | `0.375rem` | Tabs, contador y badge de prioridad |
| `--radius-md` | `0.625rem` | Botón, campo, feedback, vacío y tarjeta de lista |
| `--radius-lg` | `0.875rem` | Marca auth y columna |
| `--radius-xl` | `1.25rem` | Panel auth y diálogo |
| `--shadow-panel` | `0 24px 72px rgb(0 0 0 / 0.32)` | Panel auth y diálogo |
| `--transition-fast` | `150ms ease` | Colores/bordes de controles, tabs y columnas |
| `--transition-normal` | `220ms ease` | Declarado; sin consumo explícito en los patrones CSS revisados |

Definiciones: `src/index.css:43-49`. Consumos de radios/sombra: `src/index.css:75-168`, `src/features/board/TaskCard.tsx:58-63`. Los tokens de radio ya no son solo declaraciones sin uso.

- Bordes compartidos de `1px` con `--color-border` o `--color-border-strong`; foco global outline `2px` con offset `3px` (`src/index.css:69`, `src/index.css:82-83`, `src/index.css:105-106`, `src/index.css:147`).
- Pulsación de botón: sombra interior `0 2px 4px rgb(0 0 0 / 0.25)`; disabled `opacity: 0.55` (`src/index.css:97-98`).
- Backdrop fijo `z-index: 50`, opacidad oscura y blur `6px`; tab activo con borde inferior de `2px` (`src/index.css:146`, `src/index.css:154-155`).
- Avatar compartido circular `50%`; todavía hay utilities locales de forma (avatar excedente y bloque de adjunto: `src/features/board/TaskCard.tsx:83-84`, `src/features/board/AttachmentsList.tsx:35`).
- Reducción de movimiento declarada para animaciones/transiciones y scroll (`src/index.css:187-196`). La card combina `transition-colors` con `duration-[var(--transition-fast)]`, mientras el token contiene duración **y** easing (`src/features/board/TaskCard.tsx:39`, `src/index.css:48`); queda pendiente comprobar el CSS generado/efecto en navegador, no se afirma que esa duración sea efectiva.

No se validó visualmente elevación, recorte, foco ni movimiento reducido.

## Historial — inventario anterior al rediseño

Se conserva el texto previo; la falta de consumo de radios y el valor anterior de transición normal son históricos.

Fuente de verdad: `src/index.css:15-20` y clases visuales de los componentes.

## Radios declarados

| Token | Valor | Uso |
| --- | --- | --- |
| `--radius-sm` | `6px` | Declarado; sin uso global demostrado en las pantallas leídas |
| `--radius-md` | `10px` | Declarado; sin uso global demostrado en las pantallas leídas |
| `--radius-lg` | `14px` | Declarado; sin uso global demostrado en las pantallas leídas |

Los componentes usan utilities `rounded`, `rounded-lg`, `rounded-xl`, `rounded-2xl` y `rounded-full`; no hay vínculo explícito entre estas clases y las custom properties (por ejemplo `BoardColumn.tsx:21-26`, `CreateTaskModal.tsx:34-35`, `TaskCard.tsx:30-35`). Las búsquedas en `src/` encontraron las variables `--radius-*` solo en su definición (`src/index.css:15-17`).

## Bordes y elevación

| Patrón | Implementación | Ejemplo |
| --- | --- | --- |
| Borde de superficie | `border` + `--color-border` o color hardcodeado | Columna y card (`BoardColumn.tsx:21-22`, `TaskCard.tsx:30-35`) |
| Sombra de modal | `shadow-2xl` con negro | Creación (`CreateTaskModal.tsx:33-35`) |
| Sombra de acción/card | `shadow-lg`, `shadow-md`, `shadow-xl` | Card y botones (`TaskCard.tsx:31-35`, `TaskCard.tsx:53-56`) |
| Transición | `--transition-fast` 150 ms y `--transition-normal` 250 ms | `src/index.css:18-19` |

## Notas de estandarización

- Hay radios custom definidos, pero las pantallas usan la escala predeterminada de Tailwind; evaluar si se consumen o se eliminan para evitar tokens sin efecto.
- Bordes/sombras se configuran localmente por componente, no por niveles semánticos compartidos.
- `prefers-reduced-motion` reduce duración de animaciones y transiciones (`src/index.css:43-51`).
