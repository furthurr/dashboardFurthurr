Deno.test('MCP bootstrap and incremental migration stay identical', async () => {
  const root = new URL('../../', import.meta.url)
  const schema = await Deno.readTextFile(new URL('supabase-schema.sql', root))
  const migrations = ['202610280002_mcp_identity', '202610280003_mcp_task_read', '202610290001_mcp_workflow']
  for (const name of migrations) {
    const migration = (await Deno.readTextFile(new URL(`supabase/migrations/${name}.sql`, root))).trim()
    if (!schema.includes(migration)) throw new Error(`MCP bootstrap differs from ${name}`)
  }
})
