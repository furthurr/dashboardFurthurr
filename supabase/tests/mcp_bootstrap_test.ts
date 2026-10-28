Deno.test('MCP bootstrap and incremental migration stay identical', async () => {
  const root = new URL('../../', import.meta.url)
  const schema = await Deno.readTextFile(new URL('supabase-schema.sql', root))
  const migration = await Deno.readTextFile(new URL('supabase/migrations/202610280002_mcp_identity.sql', root))
  const marker = '-- Phase 1: OAuth clients can identify themselves, not use the portal\'s business APIs.'
  if (schema.slice(schema.indexOf(marker)).trim() !== migration.trim()) throw new Error('MCP bootstrap differs from migration')
})
