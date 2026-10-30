Deno.test('MCP bootstrap and incremental migration stay identical', async () => {
  const root = new URL('../../', import.meta.url)
  const schema = await Deno.readTextFile(new URL('supabase-schema.sql', root))
  const migrations = ['202610280002_mcp_identity', '202610280003_mcp_task_read', '202610290001_mcp_workflow']
  for (const name of migrations) {
    const migration = (await Deno.readTextFile(new URL(`supabase/migrations/${name}.sql`, root))).trim()
    if (!schema.includes(migration)) throw new Error(`MCP bootstrap differs from ${name}`)
  }
  // The automation block is formatted for the bootstrap but must keep the same
  // SQL tokens, including literal messages. Ignore only whitespace and comments.
  const marker = '-- MCP automation bootstrap: equivalent to 202610300001_mcp_automation.sql.'
  if (!schema.includes(marker)) throw new Error('Missing automation bootstrap')
  const tokens = (sql: string) => (sql.match(/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|[a-zA-Z_][a-zA-Z_0-9]*|[^\s]/g) ?? [])
    .filter(token => !token.startsWith('--') && !token.startsWith('/*')).join('\n')
  const automation = await Deno.readTextFile(new URL('supabase/migrations/202610300001_mcp_automation.sql', root))
  if (tokens(schema.slice(schema.indexOf(marker))) !== tokens(automation)) throw new Error('Automation bootstrap SQL differs from incremental migration')
})
