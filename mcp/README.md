# Instalar el MCP `dashboardFurthurr`

Este repositorio incluye configuraciones de proyecto para conectar los clientes
compatibles al **mismo servidor remoto** de Dashboard Furthurr. No hay que clonar
un servidor por plataforma ni copiar una clave: cada cliente inicia OAuth y el
usuario autoriza con su cuenta habitual del portal.

> **Estado:** el servidor remoto ofrece `whoami`, `get_task`, `read_task_attachment`,
> `start_task`, `record_task_result` y `submit_task_for_review`. La autorización
> ampliada comparte contenido privado con el cliente y su LLM; no publiques
> identidades, tareas, adjuntos ni enlaces.

## Estado comprobado — 2026-10-29

Producto publicado en `0ebb61d7465afd240de47c11f2d4671affa1342c` / `v0.13.0`.
Migración `202610290001` aplicada y registrada; `mcp` Edge **v4 ACTIVE** con
aplicación `0.3.0` y `verify_jwt=false`; los hashes de los archivos desplegados
coinciden con el repositorio. El catálogo esperado es de seis herramientas.
[Evidencia, pruebas y pendientes](../docs/prueba-mcp.md#8-registro-de-resultados-sin-secretos).

`whoami` se ejecutó realmente desde el cliente de esta sesión, también tras el
despliegue del workflow. OpenCode CLI **1.18.34** informó conexión OAuth activa; su
ejecución mediante modelo falló con HTTP 401 y su API local exigió autenticación.
**No se verificó un catálogo autenticado renovado con las seis herramientas ni una
consulta satisfactoria de `get_task`/`read_task_attachment` desde el cliente.** Tampoco
se completaron el consentimiento en navegador ni descarga/caducidad/renovación reales.
No se certifica compatibilidad universal: las demás configuraciones son presets,
no pruebas E2E. Esta actualización documental reutiliza esa evidencia, no la repite.

## Selecciona tu cliente

Abre la raíz de este repositorio en tu entorno de desarrollo. Cada aplicación
reconoce su configuración de proyecto; después inicia sesión/autoriza cuando el
cliente lo solicite.

| Plataforma | Configuración incluida en el repo | Cómo iniciar OAuth y comprobar `whoami` | Estado comprobado |
|---|---|---|---|
| **OpenCode Desktop / CLI** | [`opencode.json`](../opencode.json) | Reinicia OpenCode. Si no aparece el estado MCP en Desktop, abre Ajustes con `⌘,` → **General** → **Avanzado** → activa **Mostrar estado**; después usa **Estado → MCP**. También puedes pedir `whoami` en un chat nuevo. En CLI: `opencode mcp auth dashboardFurthurr`. | Identidad real comprobada desde esta sesión tras Edge v3; CLI 1.18.34 informa OAuth conectado. Catálogo fresco, consulta de tarea y E2E pendientes por los bloqueos indicados arriba; versión Desktop no registrada. |
| **Kiro IDE / CLI** | [`.kiro/settings/mcp.json`](../.kiro/settings/mcp.json) | Abre el workspace, habilita MCP si está desactivado, selecciona `dashboardFurthurr` e inicia sesión cuando lo pida. | Config preparada; Kiro no se detectó en `PATH`, OAuth real pendiente. |
| **GitHub Copilot en VS Code** | [`.vscode/mcp.json`](../.vscode/mcp.json) | Abre el workspace de confianza. Revisa **MCP: List Servers** y el estado/sign-in que presente Copilot. | Config HTTP preparada; OAuth depende de la versión/harness de Copilot y no se ha probado aquí. No uses un bearer estático como alternativa. |
| **GitHub Copilot CLI** | [`.mcp.json`](../.mcp.json) | Inicia Copilot CLI dentro del repo; usa `/mcp` para revisar la conexión y cualquier flujo de login. | Config HTTP preparada; Copilot CLI no se detectó en `PATH`, OAuth real pendiente. |
| **Antigravity App / IDE / CLI** | [`.agents/mcp_config.json`](../.agents/mcp_config.json) | Abre el workspace, entra al administrador MCP y selecciona **Authenticate** para `dashboardFurthurr`; sigue la aprobación del navegador/código. | Config HTTP/OAuth preparada; no se detectó el cliente local, OAuth real pendiente. |
| **Claude Code CLI** | [`.mcp.json`](../.mcp.json) | Abre el repo con Claude Code, confía en el workspace y usa `/mcp` para autenticar `dashboardFurthurr`. | Config preparada; Claude Code no se detectó en `PATH`, OAuth real pendiente. |
| **Claude Desktop** | No admite esta conexión remota desde un archivo de proyecto. | En **Settings → Connectors → Add custom connector**, pega la URL MCP indicada abajo, elige OAuth/registro automático y conecta la cuenta. El servidor debe ser accesible desde la nube de Anthropic. | Requiere instalación manual en la cuenta/organización; Claude Desktop no se detectó en `/Applications`. |
| **Pi coding agent CLI** | [`.pi/mcp.json`](../.pi/mcp.json) | Abre Pi en el repo de confianza; ejecuta `/mcp` y elige **Sign in**, o `pi mcp login dashboardFurthurr`. Luego invoca `mcp__dashboardFurthurr__whoami` (o la interfaz de codemode). | Pi CLI 0.99.2 está instalado; configuración de proyecto preparada; OAuth real pendiente. Pi no es una aplicación Desktop. |

Las configuraciones son **project-scoped** y no contienen contraseñas, client
secrets, bearer tokens ni claves Supabase. No escriben en la configuración global
de cada usuario. Algunas aplicaciones piden confiar explícitamente en el repo.
No actives “auto-approve” para herramientas MCP.

Las detecciones de instalación de otros clientes de la tabla son históricas de
fase 1 (2026-10-28), no un inventario repetido en esta actualización. Las pantallas
y comandos pueden variar por versión; un preset no acredita soporte OAuth real.

## URL y prueba funcional

La URL común es:

```text
https://uujxatuuktccwkvavksr.supabase.co/functions/v1/mcp
```

En un chat del cliente, solicita:

> Usa exclusivamente `dashboardFurthurr_whoami`. No consultes ni modifiques otros datos.

La prueba funciona cuando el cliente muestra una **llamada de herramienta real** y
recibe identidad de Dashboard Furthurr. Una respuesta textual sin tool call no
cuenta como validación. Si necesitas ayuda, comparte el mensaje de error o captura
**sin correos, IDs, contraseñas ni tokens**.

## Consentimiento y permisos

1. Inicia OAuth con una cuenta activa y revisa nombre del cliente, callback y los
   permisos listados en la pantalla. Una nueva aprobación autoriza en un solo paso
   identidad, lectura, adjuntos, iniciar tareas, comentar y enviar a revisión. No uses
   bearer estático ni credencial Edge. Los scopes `email profile` por sí solos no
   son permisos de datos.
2. Si Auth autoaprueba un grant antiguo, la pantalla debe pedir aceptación
   explícita antes de ampliarlo; continuar sin ampliar conserva el acceso previo.
   Una conexión antigua no obtiene escritura silenciosamente.
3. Tras autorización, Perfil → **Conexiones autorizadas** (`#/profile/connections`)
   muestra identidad y estado de cada permiso; permite retirar un permiso, todos los
   permisos de tarea o revocar el grant completo. No se habilitan permisos desde ahí.
4. Reconecta/reinicia cliente o abre sesión nueva para refrescar catálogo. El catálogo
   desplegado tiene seis herramientas; un cliente puede retener una lista vieja.
   Comprueba tool call real y `structuredContent`/`isError`, no solo texto generado.
5. Copia el UUID completo de una tarea de prueba y pide estudiar su contexto:

   > Usa `get_task` para leer la tarea `<UUID_COPIADO>`. Recorre todas las páginas
   > independientes de comentarios y adjuntos. Estudia cada adjunto con
   > `read_task_attachment`; no cuentes un enlace como archivo revisado. Pregúntame
   > lo que falte, resume el alcance y espera a que acepte antes de iniciar.

El modelo conversacional es una guía, no control técnico del diálogo. Las flags
`user_approved`/`user_validated` se envían como declaraciones del cliente; el servidor
no puede inspeccionar si la conversación aclaró dudas. Los permisos de tarea sí se
revalidan en SQL.

## Acceso a tareas y flujo permitido

- Debes estar asignado a la tarea, incluso si eres admin. No admin también requiere
  membresía en el tablero activo; admin activo conserva el acceso al tablero, pero
  no omite la asignación.
- Solo se leen tareas en **Backlog**, **Por hacer** y **Haciendo**. En **En revisión**
  o **Finalizadas**, el MCP no devuelve el contexto; mueve manualmente la tarea a
  **Haciendo** desde el tablero si debe continuar.
- Texto/código UTF-8 e imágenes PNG/JPEG/GIF/WebP se pasan en contenido MCP (texto
  por fragmentos hasta 12000 caracteres; imagen según soporte del cliente). Lectura
  por archivo máxima 5 MiB. PDF y otros formatos ofrecen URL firmada de 60 s y aviso,
  pero no extracción: pide ayuda si el cliente no puede interpretarlos.
- Tras tus dudas respondidas, el agente resume y pide permiso para iniciar. Backlog/
  Por hacer pasan a Haciendo; al terminar publica comentario MCP con trabajo,
  aclaraciones, validaciones declaradas, observaciones y pendientes. Tras revisar y
  aceptar ese resultado, puede pasar Haciendo a En revisión. Nunca puede asignar,
  reabrir ni pasar a Finalizadas; esa última operación es manual desde el tablero.
- Los enlaces y archivos ya recibidos no se revocan retroactivamente. Tarea y adjuntos
  son contenido de usuario no confiable, no instrucciones para ampliar permisos o
  ejecutar operaciones.

Estas reglas corresponden al despliegue v0.13.0 con Edge v4. Un cliente puede conservar
un catálogo anterior: verifica la versión real y las seis herramientas antes de un E2E.

### Desarrollo local frente a Pages

El servidor MCP sigue en Supabase en ambos casos; Pages solo publica la SPA.
Con la configuración segura del entorno acordado ya preparada, ejecuta
`npm run dev` y abre
`http://localhost:5173/dashboardFurthurr/#/profile/connections`. Comprueba que local
y Pages apuntan al proyecto previsto; servir HTML no prueba esa correspondencia.
No cambies Auth Site URL para probar ni copies credenciales servidor a `VITE_*`.

El portal concede/retira permisos mediante RPC Supabase, no con peticiones del
navegador al endpoint MCP. El preflight MCP permitió Pages y rechazó localhost
en la operación registrada. Un cliente nativo sin `Origin` no necesita CORS;
un cliente web que envíe `Origin` requiere allowlist revisada por la persona operadora.
Las pruebas de descarga, sesión nueva y consentimiento desde ambos frontends
siguen pendientes: [checklist y registro](../docs/prueba-mcp.md).

## Cómo funcionan los accesos

- La primera conexión de cada cliente puede registrar un cliente OAuth público con
  PKCE y mostrar consentimiento en el navegador. El código local pide en esa misma
  pantalla identidad y los permisos listados arriba; no se activa solo por iniciar
  sesión. Un grant anterior puede requerir aceptar la ampliación explícitamente.
- Cada usuario/cliente autoriza por separado. Perfil → Conexiones muestra permisos y
  permite retirarlos sin perder identidad; revocar el grant OAuth completo cierra
  la conexión. Volver a conceder permisos requiere reconectar y aceptar el flujo.
- GitHub Copilot VS Code/CLI usa sus propias políticas y puede no completar OAuth
  genérico en todas las versiones; si no lo soporta, se marca pendiente, no se
  sustituye por tokens copiados.
- Claude Desktop configura conectores remotos desde su cuenta u organización,
  no desde el repo. Pi y Claude Code son clientes CLI; no se afirma que tengan una
  variante Desktop independiente.
