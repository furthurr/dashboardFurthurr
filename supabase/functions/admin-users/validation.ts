export type AdminAction =
  | { action: 'list'; page: number }
  | { action: 'create'; email: string; password: string; fullName: string }
  | { action: 'password'; userId: string; password: string }
  | { action: 'rename'; userId: string; fullName: string }
  | { action: 'set-active'; userId: string; active: boolean }

export function parseAction(input: unknown): AdminAction {
  if (!input || typeof input !== 'object') throw new Error('Solicitud no válida.')
  const body = input as Record<string, unknown>
  if (body.action === 'list') {
    const page = body.page ?? 1
    if (!Number.isInteger(page) || (page as number) < 1 || (page as number) > 100000) throw new Error('Página no válida.')
    return { action: 'list', page: page as number }
  }
  if (body.action === 'create' || body.action === 'password') {
    if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) {
      throw new Error('La contraseña debe tener entre 8 y 128 caracteres.')
    }
  }
  if (body.action === 'create' || body.action === 'rename') {
    if (typeof body.fullName !== 'string' || !body.fullName.trim() || body.fullName.trim().length > 120) throw new Error('Nombre no válido (máximo 120 caracteres).')
  }
  if (body.action === 'create') {
    if (typeof body.email !== 'string' || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) throw new Error('Correo no válido.')
    return { action: 'create', fullName: (body.fullName as string).trim(), email: body.email.trim().toLowerCase(), password: body.password as string }
  }
  if (typeof body.userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.userId)) throw new Error('Usuario no válido.')
  if (body.action === 'password') return { action: 'password', userId: body.userId, password: body.password as string }
  if (body.action === 'rename') return { action: 'rename', userId: body.userId, fullName: (body.fullName as string).trim() }
  if (body.action === 'set-active' && typeof body.active === 'boolean') return { action: 'set-active', userId: body.userId, active: body.active }
  throw new Error('Operación no válida.')
}
