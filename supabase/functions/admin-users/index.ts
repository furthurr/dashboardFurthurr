import { createClient } from 'npm:@supabase/supabase-js@2.105.1'
import { parseAction } from './validation.ts'

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
    // getUser verifies the token with Auth; decoding a JWT is not authorization.
    const { data: identity, error: identityError } = await client.auth.getUser(authorization.slice(7))
    if (identityError || !identity.user) return reply(401, { error: 'La sesión no es válida.' })
    const { data: actor, error: actorError } = await client.from('profiles').select('role, is_active').eq('id', identity.user.id).single()
    if (actorError || actor?.role !== 'admin' || !actor.is_active) return reply(403, { error: 'Solo administradores activos pueden gestionar usuarios.' })

    let action
    try { action = parseAction(await request.json()) }
    catch (error) { return reply(400, { error: error instanceof Error ? error.message : 'Solicitud no válida.' }) }

    if (action.action === 'list') {
      const size = 50
      const { data, error, count } = await client.from('profiles')
        .select('id, full_name, email, role, is_active', { count: 'exact' })
        .order('created_at', { ascending: false }).order('id')
        .range((action.page - 1) * size, action.page * size - 1)
      if (error) return reply(500, { error: 'No se pudieron cargar los usuarios.' })
      return reply(200, { users: data, total: count, pageSize: size })
    }
    if (action.action === 'create') {
      const { data, error } = await client.auth.admin.createUser({
        email: action.email, password: action.password, email_confirm: true,
        user_metadata: { full_name: action.fullName },
      })
      if (error || !data.user) return reply(400, { error: 'No se pudo crear la cuenta. Comprueba que el correo no esté registrado y que la contraseña cumpla la política de Supabase.' })
      // Never accept role/state from caller or user-editable Auth metadata.
      const { error: profileError } = await client.from('profiles').update({ role: 'usuario', is_active: true }).eq('id', data.user.id).select('id').single()
      if (profileError) {
        // Compensate a partially completed account creation.
        const { error: cleanupError } = await client.auth.admin.deleteUser(data.user.id)
        return reply(500, { error: cleanupError ? 'Alta incompleta. Revisa la cuenta en Supabase antes de reintentar.' : 'No se pudo completar el perfil. La cuenta no se ha creado.' })
      }
      return reply(200, { success: true })
    }
    if (action.action === 'password') {
      const { error } = await client.auth.admin.updateUserById(action.userId, { password: action.password })
      if (error) return reply(400, { error: 'No se pudo cambiar la contraseña. Comprueba el usuario y la política de contraseñas de Supabase.' })
      return reply(200, { success: true })
    }
    if (action.action === 'rename') {
      const { error } = await client.from('profiles').update({ full_name: action.fullName }).eq('id', action.userId).select('id').single()
      if (error) return reply(400, { error: 'No se pudo actualizar el nombre. Comprueba que el usuario exista e inténtalo de nuevo.' })
      return reply(200, { success: true })
    }
    if (action.action === 'promote-admin') {
      const { error } = await client.from('profiles').update({ role: 'admin' }).eq('id', action.userId).select('id').single()
      if (error) return reply(400, { error: 'No se pudo promover al usuario. Comprueba que la cuenta exista e inténtalo de nuevo.' })
      return reply(200, { success: true })
    }
    if (!action.active && action.userId === identity.user.id) return reply(400, { error: 'No puedes desactivar tu propia cuenta.' })
    // is_active is authoritative: RLS checks it on every request, even with old JWTs.
    const { error } = await client.from('profiles').update({ is_active: action.active }).eq('id', action.userId).select('id').single()
    if (error) return reply(400, { error: 'No se pudo cambiar el estado del usuario.' })
    return reply(200, { success: true })
  } catch {
    // No payloads, passwords, service keys or raw upstream errors in logs/responses.
    return reply(500, { error: 'No se pudo completar la operación. Inténtalo de nuevo.' })
  }
}
}

if (import.meta.main) Deno.serve(createHandler())
