# Dashboard Furthurr

## Propósito

- **Qué es:** SPA Kanban con cuentas, comentarios, adjuntos y asignación múltiple de responsables.
- **Alcance:** web estática en GitHub Pages más backend gestionado en Supabase: Auth/Postgres/Storage, Edge Function administrativa y RPCs transaccionales. No hay servidor independiente ni SSR.

## Stack

- Lenguajes y frameworks: TypeScript, React 19, Vite 8, Tailwind CSS v4.
- Datos: Supabase Auth, PostgreSQL y Storage; TanStack Query para caché; dnd-kit para ordenar tareas.
- Build: `npm ci`; `npm run dev`, `npm run build`, `npm run lint`, `npm run preview`.
- Entrypoints: `src/main.tsx` → `src/App.tsx`.

## Mapa rápido

- `src/features/auth/` → login, sesión, perfil activo y rutas protegidas.
- `src/features/users/` → listado, alta, nombre, contraseña y estado de cuentas para administradores.
- `src/features/board/` → tablero, tareas/comentarios/adjuntos y `AssigneePicker`; contratos RPC en `api.ts`, cuentas activas en `assigneesApi.ts`.
- `src/shared/ui/` → Dialog/Toast y controles de cuenta compartidos.
- `src/lib/supabase.ts` → cliente Supabase y validación de variables requeridas.
- `src/types/index.ts` → tipos compartidos de perfiles y tareas.
- `src/index.css` → estilos globales y variables visuales.
- `supabase-schema.sql` → tablas, policies, buckets, vistas y grants de referencia.
- `supabase/functions/admin-users/` → operaciones administrativas privilegiadas verificadas en servidor.
- `supabase/migrations/` → estado/grants y RPCs incrementales; `supabase/README.md` explica despliegue y pruebas SQL.
- Detalle y dependencias: [`module-map.json`](module-map.json).

## Convenciones

- Usa `HashRouter`; GitHub Pages no reescribe rutas internas y Vite publica bajo `/dashboardFurthurr/`.
- `/board` exige cuenta activa; `/users` añade rol admin; `/register` redirige a `/users`. El cambio concurrente añade `/profile` y acceso desde `AccountMenu`, cuyo flujo completo queda fuera de esta revisión.
- Cualquier cuenta activa, incluidos invitados, puede guardar responsables por separado; crear tareas sigue reservado a admin/usuario. No confundir asignación con permiso de edición de otros campos.
- `specs/` conserva requisitos/intención de producto; actualiza la spec antes de implementar funcionalidad.
- Contrasta cambios de persistencia con `supabase-schema.sql` y la matriz de `specs/05-auth-roles-permisos.md`.
- Verifica comportamiento en el código y contratos: los índices de Navigator son orientación, no fuente de verdad.

## Docs y contexto externo

- `README.md` — onboarding, configuración local, scripts y rutas.
- `AGENTS.md` — instrucciones del proyecto y mapa documental; su sección `Folder Structure` histórica puede diferir del código actual.
- `.architecture/README.md` — arquitectura implementada y ADRs.
- `.data/README.md` — operaciones de Supabase, modelos y schema observado.
- `.design/README.md` — fundamentos visuales y componentes.
- `specs/README.md` — especificaciones SDD y estado de producto.
- `.sdd/` — workflow externo observado en el worktree; no leído ni sincronizado en esta operación.
- `arquitectura.md` — enlace legado a `.architecture/README.md`.
- `.quality/` y `.security/` — no inicializadas en esta sincronización; no implican auditoría de esos dominios.

## Riesgos y restricciones

- Nunca usar claves privilegiadas en la SPA. La Edge Function usa su entorno servidor; RLS/grants y comprobaciones Edge/RPC autorizan acciones, no la UI. `is_active` no invalida criptográficamente JWTs ni archivos ya descargados.
- No indexar ni copiar `.env`, `.env.*`, credenciales o datos personales. Variables permitidas por nombre: `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`; no registrar sus valores.
- El working tree contiene cambios locales de producto/documentación; no se asigna `source_commit` hasta que exista un baseline Git verificable.

## Meta

- Actualizado: 2026-10-20, sincronización focalizada autorizada de cuentas y responsables.
- Source commit: omitido; working tree con cambios locales no incluidos en `HEAD`.
- HEAD observado: `1d3069d904bc9e1dc6a7363d3967ad4c2709dace`, no baseline de los cambios documentados.
- Cambios concurrentes `ProfilePage`/`AccountMenu`: localizados para evitar rutas obsoletas; comportamiento completo y nuevas pruebas no sincronizados ni validados aquí.
- Navigator root: `.`
- Actualizado con: project-navigator, capas 0–1; símbolos y grafo permanecen deshabilitados. `config.yaml` se conservó.
