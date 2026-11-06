import { createClient } from 'npm:@supabase/supabase-js@2.105.1'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers })

export function createHandler(makeClient: typeof createClient = createClient) {
  return async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response(null, { headers })
    if (request.method !== 'POST') return reply(405, { error: 'Método no permitido.' })
    const authorization = request.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) return reply(401, { error: 'Inicia sesión para continuar.' })
    try {
      const client = makeClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { data: identity, error: identityError } = await client.auth.getUser(authorization.slice(7))
      if (identityError || !identity.user) return reply(401, { error: 'La sesión no es válida.' })
      // Claims are inspected only AFTER Auth verifies this exact bearer token.
      let claims: Record<string, unknown>
      try {
        const payload = authorization.slice(7).split('.')[1]
        claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
      } catch { return reply(401, { error: 'La sesión no es válida.' }) }
      if (claims.client_id != null || claims.role !== 'authenticated') return reply(403, { error: 'Se requiere una sesión del portal.' })
      const { data: actor, error: actorError } = await client.from('profiles').select('role, is_active').eq('id', identity.user.id).single()
      if (actorError || actor?.role !== 'admin' || !actor.is_active) return reply(403, { error: 'Solo administradores activos pueden eliminar tableros.' })
      let boardId: string
      try {
        const body = await request.json()
        if (typeof body?.boardId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.boardId)) throw new Error()
        boardId = body.boardId
      } catch { return reply(400, { error: 'Identificador de tablero no válido.' }) }
      const params = { p_board_id: boardId, p_actor_id: identity.user.id }
      const { data: paths, error: prepareError } = await client.rpc('prepare_board_deletion', params)
      if (prepareError) {
        if (prepareError.code === '42501') return reply(403, { error: 'Tu cuenta ya no puede eliminar tableros.' })
        if (prepareError.code === 'P0002') return reply(404, { error: 'El tablero ya no existe.' })
        if (prepareError.code === '55000') return reply(409, { error: 'Solo se pueden eliminar tableros desactivados.' })
        return reply(500, { error: 'No se pudo preparar el borrado. Comprueba la migración de solo lectura.' })
      }
      if (!Array.isArray(paths) || paths.some((path) => typeof path !== 'string' || !path)) {
        return reply(500, { error: 'No se pudo verificar la lista de archivos del tablero.' })
      }
      for (let offset = 0; offset < paths.length; offset += 100) {
        const { error } = await client.storage.from('task-attachments').remove(paths.slice(offset, offset + 100))
        if (error) return reply(503, { error: 'Limpieza pendiente. El tablero sigue desactivado; algunos archivos podrían haberse eliminado. Reintenta «Eliminar tablero» para completar el borrado.' })
      }
      const { error: finishError } = await client.rpc('finish_board_deletion', params)
      if (finishError) return reply(503, { error: 'Borrado pendiente de confirmar. Los archivos podrían haberse eliminado; el tablero permanece desactivado. Reintenta «Eliminar tablero».' })
      return reply(200, { success: true })
    } catch {
      return reply(500, { error: 'No se pudo completar el borrado. Si ya comenzó, el tablero seguirá desactivado. Reintenta «Eliminar tablero».' })
    }
  }
}

if (import.meta.main) Deno.serve(createHandler())
