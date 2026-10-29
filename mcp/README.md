# Instalar el MCP `dashboardFurthurr`

Este repositorio incluye configuraciones de proyecto para conectar los clientes
compatibles al **mismo servidor remoto** de Dashboard Furthurr. No hay que clonar
un servidor por plataforma ni copiar una clave: cada cliente inicia OAuth y el
usuario autoriza con su cuenta habitual del portal.

> **Herramienta disponible en esta fase:** `whoami`. Devuelve identificador,
> nombre, correo, rol y cliente OAuth. No expone herramientas de tableros, tareas,
> comentarios, archivos ni usuarios. Trata el resultado como dato personal y no lo
> pegues en issues o chats públicos.

## Selecciona tu cliente

Abre la raíz de este repositorio en tu entorno de desarrollo. Cada aplicación
reconoce su configuración de proyecto; después inicia sesión/autoriza cuando el
cliente lo solicite.

| Plataforma | Configuración incluida en el repo | Cómo iniciar OAuth y comprobar `whoami` | Estado comprobado |
|---|---|---|---|
| **OpenCode Desktop / CLI** | [`opencode.json`](../opencode.json) | Reinicia OpenCode. Si no aparece el estado MCP en Desktop, abre Ajustes con `⌘,` → **General** → **Avanzado** → activa **Mostrar estado**; después usa **Estado → MCP**. También puedes pedir `whoami` en un chat nuevo. En CLI: `opencode mcp auth dashboardFurthurr`. | Desktop ejecutó `furthurr_whoami` correctamente con el alias anterior. El alias ahora es `dashboardFurthurr`; puede pedir reautorización. CLI pendiente de validación independiente. |
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

## Cómo funcionan los accesos

- La primera conexión de cada cliente puede registrar un cliente OAuth público con
  PKCE y mostrar consentimiento en el navegador.
- Cada usuario/client debe aceptar por separado. Los consentimientos se pueden
  revocar desde la gestión de conexiones de Dashboard Furthurr.
- GitHub Copilot VS Code/CLI usa sus propias políticas y puede no completar OAuth
  genérico en todas las versiones; si no lo soporta, se marca pendiente, no se
  sustituye por tokens copiados.
- Claude Desktop configura conectores remotos desde su cuenta u organización,
  no desde el repo. Pi y Claude Code son clientes CLI; no se afirma que tengan una
  variante Desktop independiente.
