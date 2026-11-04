# Colores

## Estado vigente — soporte dual Noche / Estudio, 2026-11-04

Fuente de verdad: `src/index.css:4-53`. El tema por defecto es **Oscuro · Noche** (`:root` con `color-scheme: dark`) y el alternativo es **Claro · Estudio** (`:root[data-theme='light']` con `color-scheme: light`), seleccionable desde el perfil de usuario.

### Tema Oscuro · Noche (`:root`)

| Token CSS (`--color-…`) | Hex | Uso |
| --- | --- | --- |
| `primary` / `primary-hover` / `on-primary` | `#b8d78c` / `#cbe6a3` / `#1c2a1c` | Acción primaria sólida con texto contrastado oscuro |
| `secondary` / `accent` | `#b8d78c` / `#b8d78c` | Enlaces, acentos y tabs |
| `background` / `surface` | `#161c1d` / `#1d2524` | Fondo de aplicación y superficies primarias |
| `surface-elevated` / `surface-hover` | `#252d2d` / `#34413c` | Cards del tablero, diálogo, controles elevados e interacción hover |
| `border` / `border-strong` | `#394542` / `#798d80` | Separadores de columnas/tarjetas y contornos acentuados |
| `text` / `text-muted` | `#eff3eb` / `#b5c2b8` | Texto principal y texto secundario/placeholder |
| `link` / `focus` | `#c5e9ad` / `#c5e9ad` | Enlaces y anillos de foco accesibles |
| `danger` / `danger-surface` / `danger-border` | `#fda4af` / `#351e2a` / `#864353` | Errores y acciones destructivas |
| `success` / `success-surface` | `#6ee7b7` / `#16352e` | Feedback de confirmación |

### Tema Claro · Estudio (`:root[data-theme='light']`)

| Token CSS (`--color-…`) | Hex | Uso |
| --- | --- | --- |
| `primary` / `primary-hover` / `on-primary` | `#9b3b29` / `#772b1d` / `#ffffff` | Acción primaria cálida terracota con texto blanco |
| `secondary` / `accent` | `#9b3b29` / `#803a2b` | Acentos editoriales cálidos |
| `background` / `surface` | `#f4eee6` / `#fffaf3` | Fondo pergamino cálido y tarjetas marfil |
| `surface-elevated` / `surface-hover` | `#eee4d9` / `#e6d9cc` | Paneles elevados y hover suave |
| `border` / `border-strong` | `#d4c5b6` / `#998478` | Delimitadores y bordes de columna |
| `text` / `text-muted` | `#382d2b` / `#6f5d56` | Tipografía principal sepia oscuro y secundario |
| `link` / `focus` | `#853a29` / `#883c2a` | Enlaces y foco visible contrastado |
| `danger` / `danger-surface` / `danger-border` | `#982d36` / `#fbe7e4` / `#b96a6b` | Alertas y errores en tono rubí suave |
| `success` / `success-surface` | `#235c42` / `#e0f0e3` | Mensajes de éxito en verde bosque |
| `priority-urgent` / `priority-high` | `#9b2b38` / `#8f4511` | Prioridades urgentes/altas adaptadas |
| `priority-normal` / `priority-low` | `#68487e` / `#286445` | Prioridades normales/bajas adaptadas |

- Consumo compartido: botones/campos/feedback/enlaces en `src/index.css:75-135`; estados hover solo bajo `@media (hover: hover)` en `src/index.css:171-178`. `primary-hover` ya tiene consumo explícito.
- Prioridades: `PRIORITY_COLORS` referencia variables, no hex locales (`src/features/board/constants.ts:11-16`); la card muestra además «Prioridad …», sin depender solo del color (`src/features/board/TaskCard.tsx:58-63`).
- Notas y feedback: `src/features/board/TaskCard.tsx:90-97`, `src/features/board/TaskDetailModal.tsx:122-147`.
- Valores directos aún observados: hover destructivo `#492636` (`src/index.css:175`), halo auth `rgb(79 70 229 / 0.12)` (`src/index.css:137`), backdrop `rgb(5 7 12 / 0.78)` (`src/index.css:146`) y sombras negras (`src/index.css:47`, `src/index.css:97`). Son excepciones documentadas, no nuevos tokens.

## Historial — inventario anterior al rediseño

Se conserva el registro previo. Los valores y referencias siguientes son históricos; el estado vigente figura arriba.

## Tokens globales declarados

Fuente de verdad: `src/index.css:4-20`.

| Nombre | Hex | Uso observado/declarado |
| --- | --- | --- |
| `--color-primary` | `#2563eb` | Primario; botones, foco y gradientes |
| `--color-primary-hover` | `#1d4ed8` | Estado hover declarado; no se detectó consumo fuera de la definición |
| `--color-secondary` | `#3b82f6` | Segundo tono de marca y gradientes |
| `--color-accent` | `#059669` | Acento verde |
| `--color-background` | `#0f0f0f` | Fondo de página |
| `--color-surface` | `#1a1a1a` | Superficies y tarjetas |
| `--color-surface-elevated` | `#242424` | Paneles y superficies elevadas |
| `--color-border` | `#2d2d2d` | Bordes |
| `--color-text` | `#ffffff` | Texto principal del body |
| `--color-text-muted` | `#888888` | Texto secundario |

## Colores semánticos y de feature

| Token/valor | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| `--color-primary` | No definido | `#2563eb` | Acción primaria y foco |
| `--color-secondary` | No definido | `#3b82f6` | Gradientes, interacción |
| `--color-accent` | No definido | `#059669` | Acción de alta de usuario |
| Prioridad `urgente` | No definido | `#ef4444` | Punto de prioridad |
| Prioridad `alta` | No definido | `#f97316` | Punto de prioridad |
| Prioridad `normal` | No definido | `#3b82f6` | Punto de prioridad |
| Prioridad `baja` | No definido | `#22c55e` | Punto de prioridad |
| Error | No definido | Tailwind `red-500` / `red-400` con opacidad | Mensajes de error |
| Nota especial | No definido | Tailwind `amber-400` / `amber-500` con opacidad | Aviso en tarjeta |

La escala de prioridades está centralizada en `src/features/board/constants.ts:11-16`; mensajes de error/nota se componen con clases locales en `CreateTaskModal.tsx:52-55` y `TaskCard.tsx:71-77`.

## Notas de estandarización

- El tema observado es oscuro; no hay variables ni reglas para tema claro (`src/index.css:4-28`).
- El hover azul `#1d4ed8` está declarado como token, mientras varios componentes emplean valores directos como `#3b82f6`, `#333333` y `#888888` (`src/features/board/TaskDetailModal.tsx:73-87`, `src/features/board/CommentsList.tsx:10-21`).
- Los nombres de prioridad son semánticos, pero error y aviso aún se expresan como utilities Tailwind y no como tokens compartidos.
- No se midió contraste WCAG en esta documentación; no asumir conformidad solo por la presencia de colores de foco.
