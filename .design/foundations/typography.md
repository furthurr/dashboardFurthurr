# Tipografía

## Estado vigente — rediseño local, 2026-10-16

La familia sigue siendo Plus Jakarta Sans, importada con pesos 300/400/500/600/700 y fallback `system-ui, -apple-system, sans-serif` (`src/index.css:1`, `src/index.css:53-64`). El body usa `line-height: 1.6`; controles y enlaces heredan `font`. No se comprobó la carga efectiva de Google Fonts en navegador.

| Token | Valor declarado | Consumo observado |
| --- | --- | --- |
| `--text-xs` | `0.75rem` | Botón compacto, avatar y contador |
| `--text-sm` | `0.875rem` | Botones, campos, etiquetas, feedback, tabs y encabezado de columna |
| `--text-base` | `1rem` | Declarado; sin consumo explícito en los patrones CSS revisados |
| `--text-lg` | `1.125rem` | Título de diálogo y tablero |
| `--text-xl` | `1.5rem` | Título auth (valor propio del token, no inferido de Tailwind) |

Definiciones: `src/index.css:38-42`. Consumos: `src/index.css:75-150`, `src/index.css:154-167`. Son custom properties en `:root`; no se documentan como aliases `@theme` de Tailwind.

| Estilo | Peso / altura / tracking | Evidencia |
| --- | --- | --- |
| Botón | 600 / 1.4 | `src/index.css:86-88` |
| Campo | heredado / 1.5 | `src/index.css:109-110` |
| Etiqueta | 600 | `src/index.css:117` |
| Título auth | 700 / 1.3 / `-0.035em` | `src/index.css:141` |
| Título tablero | 700 / heredada / `-0.025em` | `src/index.css:160` |
| Título diálogo / columna | 600 | `src/index.css:150`, `src/index.css:166` |
| Tab seleccionado | 600 | `src/index.css:155` |
| Contador de columna | números tabulares | `src/index.css:167` |

Siguen coexistiendo utilities `text-xs`, `text-sm`, pesos y truncado locales (card: `src/features/board/TaskCard.tsx:43-66`; resumen: `src/features/board/BoardPage.tsx:238-253`). La escala CSS ya existe; la adopción no es exclusivamente mediante tokens. No se validó legibilidad, zoom ni sustitución de fuente visualmente.

## Historial — inventario anterior al rediseño

Se conserva el registro previo; las afirmaciones de ausencia de escala y sus referencias de línea quedan superadas por el estado vigente.

Fuente de verdad: `src/index.css:1-2`, `src/index.css:22-28` y clases de texto en los componentes citados.

## Fuentes

| Familia | Pesos disponibles | Uso |
| --- | --- | --- |
| Plus Jakarta Sans | 300, 400, 500, 600, 700 (Google Fonts import) | Fuente global del body |
| `system-ui`, `-apple-system`, `sans-serif` | Nativo del sistema | Fallback |

## Estilos observados

No existe una escala semántica propia de tipografía en CSS. Se usan las utilities de Tailwind en los componentes.

| Utility/clase | Tamaño/peso observado | Uso |
| --- | --- | --- |
| `text-xs` | Tamaño xs; peso variable | Contadores, etiquetas y metadata |
| `text-sm` | Tamaño sm; pesos 400/500/600 | Texto de UI, inputs, tarjetas y botones |
| `text-lg` | Tamaño lg; peso 600/700 | Encabezado de modales y producto |
| `text-2xl` | Tamaño 2xl; peso 700 | Título de autenticación |
| `font-medium` | Peso medio | Campos y acciones |
| `font-semibold`, `font-bold` | Semibold/bold | Títulos y encabezados |

Ejemplos: encabezado del tablero (`src/features/board/BoardPage.tsx:227-230`), card (`src/features/board/TaskCard.tsx:37-48`), títulos de login (`src/features/auth/LoginPage.tsx:41-45`) y formulario (`src/features/board/CreateTaskModal.tsx:57-83`).

## Notas de estandarización

- La familia base está centralizada; tamaños, pesos, altura de línea y tracking no tienen aliases propios.
- La mayoría de clases usa los defaults de Tailwind; no hay `font-size` custom declarado en `src/index.css`.
- La importación remota de Google Fonts implica que la fuente puede depender de esa carga externa; el fallback del sistema está declarado.
