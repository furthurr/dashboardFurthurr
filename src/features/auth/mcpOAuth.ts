// Keep OAuth navigation local; never accept an arbitrary return/redirect URL.
export function authorizationId(value: string | null): string | null {
  // GoTrue's authorization_id is an opaque 32-character alphanumeric value,
  // not the UUID of the authorization row. Accept legacy UUID fixtures too.
  return value && /^(?:[a-z0-9]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(value) ? value : null
}

export function consentPath(id: string): string {
  return `/oauth/consent?authorization_id=${encodeURIComponent(id)}`
}

// Auth appends authorization_id as a normal query parameter. GitHub Pages must
// receive the SPA's real root URL, not a non-existent /oauth/consent pathname.
export function normalizeConsentLocation(location: Pick<Location, 'href'>): string | null {
  const url = new URL(location.href)
  if (!url.searchParams.has('authorization_id') && url.searchParams.get('mcp_consent') !== '1') return null
  const id = authorizationId(url.searchParams.get('authorization_id'))
  url.searchParams.delete('mcp_consent')
  url.searchParams.delete('authorization_id')
  url.hash = id ? consentPath(id) : '/oauth/consent'
  return url.href
}

// Only navigate to a callback returned by Supabase, not from query parameters.
// Public clients may use loopback HTTP; all other callbacks require HTTPS.
export function safeOAuthCallback(value: string): string {
  const url = new URL(value)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))) {
    throw new Error('Callback OAuth no permitido.')
  }
  return url.href
}

export function redirectOAuthCallback(value: string): void {
  window.location.assign(safeOAuthCallback(value))
}
