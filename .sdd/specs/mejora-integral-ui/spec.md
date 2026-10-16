# Mejora integral de interfaz e interacciones

Modo SDD: tiny
Tipo: feature de UI/UX con correcciones de interacción
Intención: implementación
Estado: Implementado y verificado — pendiente de aceptación de cierre
Gate actual: Gate 4 pendiente
Gate 3: aprobado explícitamente mediante «procede» tras presentar el plan; implementación iniciada después de esa aprobación.
Alcance y selección: aprobados por el usuario mediante «Procede» tras la propuesta de alcance.
Continuidad: complementa `specs/06-ui-ux-diseno.md`; conserva su cierre del detalle al pulsar fuera del panel y no migra las specs existentes.

## 1. Alcance y aceptación

Objetivo: mejorar coherencia, legibilidad y fluidez de todas las interfaces existentes, sin cambiar las funciones de producto ni los contratos de datos.

- **A1. Sistema visual:** acceso, alta de usuario, tablero, creación y detalle de tareas comparten colores semánticos, escala tipográfica, espaciados y tratamientos de campos, botones y estados. Se mantiene la identidad oscura y la fuente actual; texto secundario legible, foco visible y estados reconocibles sin depender solo del color.
- **A2. Tablero y tarjetas:** reforzar jerarquía de cabecera, columnas, contadores, prioridades y acciones. Abrir detalles y arrastrar/mover no compiten por el mismo gesto de teclado; los controles de movimiento mantienen su función actual y las tarjetas se pueden abrir con teclado sin activar un arrastre accidental.
- **A3. Responsive:** cabecera y acciones se adaptan a 360, 768 y 1440 px sin desbordamiento horizontal del documento; el Kanban conserva scroll horizontal propio. Los modales caben en el viewport, con contenido desplazable y acciones accesibles; títulos largos y listas vacías no rompen el layout.
- **A4. Diálogos y pestañas:** diálogos con nombre accesible, foco inicial, foco contenido, Escape, bloqueo del scroll de fondo y restauración al origen cuando sigue presente. El detalle conserva cierre por clic en fondo, sin cerrar al interactuar dentro. Las pestañas exponen selección y panel asociado, con navegación por teclado. Al cerrar y reabrir, se inicializan datos de la tarea actual, pestaña y confirmación de eliminación; no reaparecen borradores descartados.
- **A5. Operaciones y errores:** carga, vacío, éxito y error se comunican con texto accesible, además de su estilo. Guardar solo cierra después del éxito; un fallo conserva valores y contexto. Operaciones en curso deshabilitan su acción para impedir doble envío; comentarios y adjuntos conservan contenido ante fallo, y los errores de tamaño se muestran dentro del modal. Las operaciones destructivas conservan confirmación y permisos existentes. Los fallos al mover tareas muestran feedback sin modificar el mecanismo de persistencia.
- **A6. Fluidez:** hover, pressed, foco y transiciones breves consistentes, sin escalados que dificulten apuntar. Se respeta movimiento reducido. Solo los elementos interactivos muestran cursor de acción. La carga de archivos es accesible por teclado y las acciones icon-only tienen nombre.

Invariantes: HashRouter y base de GitHub Pages intactos; consultas, roles, validación de backend y esquema sin cambios; límite de archivos de 5 MB conservado; cierre exterior existente preservado. Ninguna comprobación usa secretos o modifica datos reales sin autorización.

Exclusiones: tema claro, nuevas funciones, nuevas rutas, cambios de autenticación/autorización, backend o esquema. Los problemas ajenos a UI se informarán y no se corregirán ampliando el alcance silenciosamente.

Supuestos: mantener tema oscuro es la dirección visual acordada; se reutilizan las APIs y hooks actuales. La comprobación visual con datos reales depende de disponer de sesión; si no existe, se verifican componentes con fixtures y se registra la limitación. Cambios locales previos en AGENTS, esta spec de producto, TaskDetailModal y documentación de dominio se preservan.

Esfuerzo previsto del LLM: 5 🟢
Referente: F05–F06 como orientación ordinal; no requiere su coordinación transaccional, pero sí regresión transversal de UI y estados asíncronos sobre infraestructura existente.
Justificación: superficie visual compartida; contratos/hooks reutilizados; estados de diálogo y operaciones pendientes por corregir; cobertura funcional inexistente que debe incorporarse.
Atención: normal; controlar errores y restauración de foco sin modificar persistencia.
exceeds_x13: false
Profundidad recomendada / seleccionada: SDD-Tiny / SDD-Tiny.

## 2. Enfoque técnico y estrategia de pruebas

- Consolidar tokens y estilos de UI en `src/index.css`; sustituir colores directos repetidos en pantallas/componentes afectados. Mantener Tailwind y no incorporar otro framework visual.
- Extraer únicamente patrones ya repetidos: contenedor de diálogo accesible para creación/detalle, y tratamientos compartidos de controles/feedback. No crear un sistema de componentes anticipado.
- Mantener lógica de red en hooks existentes y la coordinación de resultados en `BoardPage`; pasar callbacks asíncronos/estados de operación al detalle, sin llamadas Supabase desde nuevos componentes visuales.
- Montar el contenido del detalle por sesión de apertura/tarea para reinicializar borradores sin actualizaciones de estado durante render. Separar activación de tarjeta y asa de arrastre, manteniendo dnd-kit y sus sensores.
- Gestionar errores de operaciones en el contexto visible y anuncios de estado. No suprimir errores, no introducir `any` ni singletons nuevos. Los adaptadores/hook actuales se conservan: su reorganización arquitectónica no pertenece a esta entrega.
- Configurar Vitest, entorno DOM y Testing Library como dependencias de desarrollo, con script `npm run test -- --run`. Pruebas sin backend ni credenciales.
- **Regresión/caracterización:** reproducir apertura repetida, guardado fallido/cierre prematuro y carga de archivos; proteger cierre exterior existente y acciones de tarjetas. Observar RED por el defecto antes de corregirlo.
- **TDD focalizado:** diálogos (Escape, Tab/Shift+Tab y restauración), pestañas, activación por teclado y estados pendientes/error. RED → GREEN mínimo correcto → refactor solo ante duplicación real.
- **Visual:** comprobar composición responsive y overflow a 360/768/1440 px mediante navegador si está disponible. Revisar foco, contraste, títulos largos, listas vacías, scroll del modal y movimiento reducido. Una prueba DOM no acredita layout ni una auditoría completa de accesibilidad.
- **Integración:** ejecutar `npm run test -- --run`, `npm run build` y `npm run lint`; registrar fallos iniciales y reparaciones, incluidos preexistentes. PBT no aplica: no hay invariantes algebraicos nuevos.

## 3. Checklist

Secuencia: baseline/pruebas → fundamentos visuales → diálogos/detalle → tablero → integración. Sin Quick Plan.

- [x] T1. Baseline build/lint correcto; `vitest.config.ts`, `src/test/setup.ts`, script test y cuatro archivos de pruebas. Ver comandos abajo (A1–A6).
- [x] T2. Tokens/patrones en `src/index.css`; acceso/registro y carga de sesión en `src/features/auth/`; vacíos en listas y columnas (A1, A3, A5, A6).
- [x] T3. `src/shared/ui/Dialog.tsx`, creación/detalle y callbacks asíncronos del tablero; 9 pruebas de creación y 13 del detalle (A3–A6).
- [x] T4. Tablero, columnas y tarjetas; 5 pruebas de tarjeta y 6 de integración; Chromium responsive (A1–A3, A5–A6).
- [x] T5. `specs/06-ui-ux-diseno.md`, `.design/` afectada, suite/build/lint y comprobaciones visuales descritas abajo (A1–A6).
- [x] T6. Evidencia y límites registrados en esta sección; Gate 4 presentado para aceptación, no cierre automático.

## 4. Verificación y cierre

### Baseline e historial de pruebas

- Inicial: `npm run build` y `npm run lint` correctos; build ya advertía chunk >500 kB. No había suite funcional declarada.
- Se añadieron Vitest, jsdom, Testing Library y jest-dom como herramientas de desarrollo, utilizadas en pruebas reales. `npm install -D vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom`: instalación correcta; npm notificó 11 vulnerabilidades (1 baja, 1 moderada, 9 altas). No se ejecutó `npm audit fix`, no se ha atribuido su origen ni realizado una auditoría de seguridad; revisión separada pendiente, fuera de UI.
- `npx vitest run src/features/board/TaskCard.test.tsx --environment jsdom`: RED 4 fallos/1 correcto antes del cambio (apertura/asa inexistentes y propagación de teclado al drag); GREEN 5/5 después.
- `npm run test -- --run src/features/board/CreateTaskModal.test.tsx`: RED 7 fallos/2 correctos; GREEN 9/9 tras integrar Dialog, foco, cierre y pendientes.
- `npm run test -- --run src/features/board/TaskDetailModal.test.tsx`: RED 5 fallos antes de corregir guardado, reinicio, semántica y comentario; GREEN inicial 5/5. Después se ampliaron honestamente como cobertura retroactiva a 13 pruebas: blancos, confirmación/eliminación, pendientes, reintentos de archivo y cargas/errores de queries. Se corrigió la prueba de reapertura para proporcionar `onSave` y acreditar que el borrador realmente cambia antes de descartarse.
- `npm run test -- --run src/features/board/BoardPage.test.tsx`: RED 5 fallos antes de integración asíncrona y feedback; GREEN 5/5 después. Regresión adicional con sensores reales de dnd-kit: soltar sobre la propia tarjeta producía una mutación `{position: 1}`; RED 1 fallo/5 correctos, guard de ID idéntico y GREEN 6/6.
- Los fallos anteriores se observaron antes de sus correcciones; las pruebas adicionales posteriores no se presentan como TDD.

### Resultado final de comandos

| Comando | Resultado observado |
| --- | --- |
| `npm run test -- --run` | 33 pruebas correctas, 4 archivos: tarjeta 5, creación 9, detalle 13, tablero 6 |
| `npm run build` | TypeScript y Vite correctos; JS principal 553,25 kB / gzip 159,93 kB; aviso >500 kB conservado |
| `npm run lint` | Correcto, sin findings |
| `git diff --check` | Correcto |

### Navegador y evidencia visual

Chromium headless mediante Playwright instalado fuera del repositorio. Servidor aislado con URL/clave placeholder de Supabase:

`VITE_SUPABASE_URL=https://ui-preview.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=ui-preview-public-placeholder npm run dev -- --host 127.0.0.1 --port 5178`

Comprobación: `node /var/folders/d7/z7388kp51w532q4c0rj7hqqh0000gn/T/opencode/verify-ui.mjs`.

- PASS a **360, 768 y 1440 × 900 px**: acceso, tablero, crear tarea, detalle, pestañas, adjuntos y registro. Sin desbordamiento horizontal del documento; Kanban con scroll interno; límites del diálogo dentro del viewport.
- Capturas `login-{ancho}.png`, `board-{ancho}.png`, `create-{ancho}.png`, `detail-{ancho}.png`, `register-{ancho}.png` en el mismo directorio temporal. Inspección de capturas de tablero móvil/desktop, detalle móvil y acceso desktop: jerarquía, contraste aparente, etiquetas y acciones legibles.
- Transición real de tarjetas: inicialmente **0s**, porque una utility de duración recibía `150ms ease`. Regresión de estilo computado falló; sustituida por duración válida y GREEN **0,15s**. Movimiento reducido: **0,00001s**.
- Cero errores de página en la ejecución final. Todo tráfico externo bloqueado salvo respuestas simuladas del dominio placeholder; ninguna operación sobre backend real.
- Fallos del harness conservados: selector de heading de login equivocado; init script de sesión no se ejecutaba en navegación de solo hash; acceso a localStorage en `about:blank`. Se corrigieron selector, navegación completa y guard de hostname. No eran defectos de producto ni se contaron como RED funcional.

### Evidencia por aceptación

| Aceptación | Artefacto y evidencia |
| --- | --- |
| A1 | Tokens/clases en `src/index.css`, acceso/registro, listas y columnas; capturas Chromium. Contraste calculado de botones principales 6,29:1 y texto secundario/superficie elevada 7,47:1; no es auditoría completa WCAG. |
| A2 | `TaskCard.tsx`, `SortableTaskCard.tsx`, `BoardPage.tsx`; pruebas de teclado, aislamiento de movimientos, asa y self-drop; capturas del tablero. |
| A3 | Clases board/dialog, cabecera adaptable, scroll y botones; mediciones DOM reales y capturas en las tres anchuras. |
| A4 | `Dialog.tsx`, `CreateTaskModal.test.tsx` y `TaskDetailModal.test.tsx`: foco, Tab/Shift+Tab, Escape, cierre exterior, pestañas, reapertura y restauración. |
| A5 | Promesas de hooks coordinadas en BoardPage; error conserva formulario/comentario/archivo, doble envío bloqueado, eliminación confirmada, éxito anunciado; pruebas de detalle e integración. |
| A6 | Cursor/foco y controles semánticos, SVG decorativos ocultos; prueba de input de archivo por teclado y estilos computados de transición/reduced-motion en Chromium. |

### Spot-check de calidad, exclusiones y límites

- UI nueva no llama Supabase; se conservan hooks/adaptadores existentes y sus contratos. No se ha reorganizado infraestructura legada ni introducido singleton o capa adicional.
- HashRouter, base de Vite, esquema y permisos no modificados. Las pruebas de integración mockean hooks; **no acreditan autorización ni integridad del backend**.
- Mensajes de error visibles seguros, sin filtrar detalles del servidor; errores de operaciones no se tratan como éxito. No se introdujo `any`.
- Sin dependencia PBT ni abstracciones anticipadas; Dialog se comparte porque había dos consumidores reales.
- La carga inicial de sesión usa ahora el mismo feedback visual y texto accesible, sin cambiar autenticación.
- No validado con lector de pantalla, Safari/Firefox, teclado virtual o zoom extremo. Las capturas usan fallback tipográfico al bloquear las fuentes externas; no acreditan la descarga de Google Fonts. Comprobación con sesión/datos reales no ejecutada.
- Los contadores de comentario/adjunto en tarjetas se muestran si los datos existentes los proporcionan; la consulta actual no añade dichos conteos. Esa brecha previa de producto no se resolvió cambiando contratos fuera de alcance.
- Conservados cambios ajenos en AGENTS, README, arquitectura e índices auxiliares. TaskDetailModal y la spec de UI incorporan las mejoras manteniendo el cierre exterior local previo. Sin commits ni push.

Cierre: implementación y verificación realizadas; **pendiente de aprobación de Gate 4**. Los límites anteriores no se presentan como verificaciones aprobadas.

### Preparación de publicación solicitada

El usuario solicitó explícitamente commit de todos los cambios y push, seguido de comprobación en la web pública. Se incluyen también los cambios locales documentales revisados, sin secretos confirmados. Esto registra autorización de publicación, no inventa una aceptación visual adicional.

- Se detectó que `@testing-library/jest-dom` 7 exige Node >=22 y el workflow utiliza Node 20. Se fijó la versión compatible `6.9.1` (Node >=14), sin cambiar runtime ni CI.
- Verificación repetida tras ajustar lockfile: `npm ci`, `npm run test -- --run` (33 correctas), `npm run build` y `npm run lint`: correctos. Avisos de bundle y dependencias conservados.
- El remoto contiene un commit de licencia/autoría posterior a la base local; se preservará al integrar antes del push, sin force-push.

### Corrección detectada al comprobar la publicación

El commit `da6fca3` se publicó en main y GitHub Pages completó build/deploy correctamente (run `38950816893`). La comprobación pública con Chromium detectó un defecto adicional dentro de A1/A6: el botón de acceso aparecía en el árbol accesible sin nombre, con `status` como único hijo. La misma estructura existía en registro. Se separó el anuncio de estado del texto del botón, sin modificar autenticación ni apariencia.

- Evidencia RED de navegador: el heading nuevo se encuentra y el botón existe visualmente, pero `getByRole('button', {name: 'Iniciar sesión'})` agota espera; snapshot accesible muestra botón sin nombre con hijo status.
- `src/features/auth/AuthPages.test.tsx`: cuatro regresiones añadidas antes del fix; RED 4/4, GREEN después de separar anuncios. Comprueban nombre, ubicación independiente de status, pendiente y recuperación tras error con backend simulado.
- Verificación repetida: `npm run test -- --run`: **37 pruebas correctas en 5 archivos**; `npm run build`, `npm run lint`, `git diff --check`: correctos. El aviso del bundle permanece. Esta corrección se publica en un commit nuevo, sin amend del anterior.
