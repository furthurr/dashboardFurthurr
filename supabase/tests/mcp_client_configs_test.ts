const base = new URL('../../', import.meta.url)
const expectedUrl = 'https://uujxatuuktccwkvavksr.supabase.co/functions/v1/mcp'
const clients = [
  { path: 'opencode.json', root: 'mcp', key: 'dashboardFurthurr' },
  { path: '.kiro/settings/mcp.json', root: 'mcpServers', key: 'dashboardFurthurr' },
  { path: '.vscode/mcp.json', root: 'servers', key: 'dashboardFurthurr' },
  { path: '.mcp.json', root: 'mcpServers', key: 'dashboardFurthurr' },
  { path: '.agents/mcp_config.json', root: 'mcpServers', key: 'dashboardFurthurr' },
  { path: '.pi/mcp.json', root: 'mcpServers', key: 'dashboardFurthurr' },
]

Deno.test('all project-scoped client presets point to the same MCP with no static credentials', async () => {
  for (const entry of clients) {
    const config = JSON.parse(await Deno.readTextFile(new URL(entry.path, base)))
    const server = config[entry.root]?.[entry.key]
    if (!server) throw new Error(`${entry.path}: missing ${entry.root}.${entry.key}`)
    const url = server.url ?? server.serverUrl
    if (url !== expectedUrl) throw new Error(`${entry.path}: unexpected MCP endpoint`)
    for (const prohibited of ['Authorization', 'access_token', 'clientSecret', 'client_secret', 'SUPABASE_SERVICE_ROLE_KEY']) {
      if (JSON.stringify(server).toLowerCase().includes(prohibited.toLowerCase())) {
        throw new Error(`${entry.path}: contains a static credential field`)
      }
    }
  }
})

Deno.test('OpenCode and protocol server use the requested display name', async () => {
  const config = JSON.parse(await Deno.readTextFile(new URL('opencode.json', base)))
  if (!config.mcp.dashboardFurthurr || config.mcp.furthurr) throw new Error('OpenCode MCP name mismatch')
  const source = await Deno.readTextFile(new URL('supabase/functions/mcp/index.ts', base))
  if (!source.includes("name: 'dashboardFurthurr'")) throw new Error('Protocol MCP name mismatch')
})
