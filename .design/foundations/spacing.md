# Espaciado y dimensiones

## Estado vigente — rediseño local, 2026-10-16

Hay una escala CSS explícita, combinada con utilities de composición Tailwind.

| Token | Valor |
| --- | --- |
| `--space-1` | `0.25rem` |
| `--space-2` | `0.5rem` |
| `--space-3` | `0.75rem` |
| `--space-4` | `1rem` |
| `--space-5` | `1.25rem` |
| `--space-6` | `1.5rem` |
| `--space-8` | `2rem` |

Fuente: `src/index.css:31-37`. No se convierten rem a píxeles como garantía de tamaño de dispositivo.

| Patrón | Medidas observadas | Evidencia |
| --- | --- | --- |
| Botón / campo | Alto mínimo `2.75rem`; botón compacto `2.25rem` | `src/index.css:75-116` |
| Panel auth | Ancho máximo `28rem`; padding `clamp(1.5rem, 5vw, 2.5rem)`; shell con `100dvh` | `src/index.css:137-138` |
| Diálogo | Ancho máximo `44rem`; gutter `clamp(0.75rem, 3vw, 2rem)`; alto máximo `calc(100dvh - 2 * gutter)` | `src/index.css:146-147` |
| Cuerpo y pie | Cuerpo con scroll vertical, `min-height: 0`, `scrollbar-gutter: stable`; cabecera/pie fuera del scroll | `src/index.css:148-152` |
| Pantallas hasta 480px | Padding de diálogo `--space-4`; botones de pie flexibles | `src/index.css:180-185` |
| Tablero | Columnas horizontales con scroll contenido; gap `--space-4`; padding lateral fluido | `src/index.css:157-162` |
| Columna | Base/ancho `18rem`, máximo `100%`; cuerpo mínimo `14rem`, padding/gap `--space-3` | `src/index.css:163-168` |

Creación ajusta el ancho con `max-w-lg` (`src/features/board/CreateTaskModal.tsx:36`). Detalle usa grid de una columna y dos desde `sm`; creación mantiene dos columnas (`src/features/board/TaskDetailModal.tsx:132`, `src/features/board/CreateTaskModal.tsx:74`). El body declara mínimo `320px` (`src/index.css:55`). Estas reglas documentan la intención del CSS; no demuestran ausencia de overflow ni usabilidad a tamaños/zoom concretos. No se realizó comprobación responsive visual.

## Historial — inventario anterior al rediseño

Se conservan las utilities y observaciones previas como historial; la ausencia de escala custom y medidas antiguas no describen el estado vigente.

Fuente de verdad: clases de Tailwind en `src/features/board/BoardPage.tsx`, `BoardColumn.tsx`, `TaskCard.tsx` y modales; no hay escala de spacing custom en `src/index.css:4-51`.

## Utilities observadas

| Utility | Uso visible |
| --- | --- |
| `p-1.5`, `p-2`, `p-3`, `p-4`, `p-6` | Botones compactos, contenido de card, paneles y modales |
| `px-2`, `px-3`, `px-4`, `py-1.5`, `py-2`, `py-3`, `py-4` | Controles, labels, headers y acciones |
| `gap-1`, `gap-1.5`, `gap-2`, `gap-3`, `gap-4` | Grupos de controles, columnas y layout |
| `space-y-2`, `space-y-3`, `space-y-4`, `space-y-5` | Formularios, tarjetas y listas |
| `w-72` | Ancho de cada columna Kanban |
| `max-w-md`, `max-w-2xl` | Ancho máximo de modal de creación y detalle |
| `min-h-[200px]`, `max-h-[90vh]` | Altura mínima de lista y límite vertical del modal |

Evidencia: `src/features/board/BoardPage.tsx:268-290`, `src/features/board/BoardColumn.tsx:19-31`, `src/features/board/CreateTaskModal.tsx:33-35`, `src/features/board/TaskDetailModal.tsx:73-80`.

## Notas de estandarización

- Las medidas se declaran en los componentes con utilities; no hay tokens de spacing nombrados fuera de Tailwind.
- Las columnas usan `w-72` y scroll horizontal (`BoardPage.tsx:268-272`); no se observó apilamiento responsive alternativo.
- Consolidar una escala propia solo si el proyecto decide mantener valores de spacing distintos de los defaults de Tailwind.
