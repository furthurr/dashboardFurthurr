// Ensure both installation paths have exactly the same executable SQL.
const normalize = (sql: string) => sql.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim()
Deno.test('inactive-board bootstrap matches its incremental migration', async () => {
  const schema = await Deno.readTextFile(new URL('../../supabase-schema.sql', import.meta.url))
  const marker = '-- Read-only inactive boards (202611060001). Deletion requires board-delete Edge.'
  const migration = await Deno.readTextFile(new URL('../migrations/202611060001_inactive_board_readonly.sql', import.meta.url))
  if (!schema.includes(marker) || normalize(schema.split(marker)[1]) !== normalize(migration)) {
    throw new Error('Inactive-board bootstrap and migration differ')
  }
})
