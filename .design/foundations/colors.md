# Colores

## Estado vigente — rediseño local, 2026-10-16

Fuente de verdad: `src/index.css:4-30`. Solo tema oscuro (`color-scheme: dark`); no se midió contraste ni se validó el renderizado.

| Token CSS (`--color-…`) | Hex | Uso en el rediseño |
| --- | --- | --- |
| `primary` / `primary-hover` / `on-primary` | `#4f46e5` / `#4338ca` / `#ffffff` | Acción primaria sólida; hover y texto sobre primario |
| `secondary` / `accent` | `#818cf8` / `#6ee7b7` | Borde de tab activo/hover primario; acento declarado |
| `background` / `surface` | `#101116` / `#181a22` | Página/campos; paneles, columnas y listas |
| `surface-elevated` / `surface-hover` | `#21242f` / `#2b2f3d` | Pie de diálogo, tab activo, controles; hover/avatar |
| `border` / `border-strong` | `#383d4e` / `#656d85` | Divisores/superficies; contornos de controles y diálogo |
| `text` / `text-muted` | `#f3f4fa` / `#adb4c8` | Texto principal/secundario y placeholder |
| `link` / `focus` | `#b0b8ff` / `#b0b8ff` | Enlaces y outline global |
| `danger` / `danger-surface` / `danger-border` | `#fda4af` / `#351e2a` / `#864353` | Error, acción destructiva y confirmación |
| `success` / `success-surface` | `#6ee7b7` / `#16352e` | Feedback de éxito |
| `warning` | `#fcd58a` | Notas especiales |
| `priority-urgent` / `priority-high` | `#fda4af` / `#fdba74` | Prioridades urgente/alta |
| `priority-normal` / `priority-low` | `#a5b4fc` / `#6ee7b7` | Prioridades normal/baja |

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
