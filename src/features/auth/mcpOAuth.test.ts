import { describe, expect, it } from 'vitest'
import { authorizationId, consentPath, normalizeConsentLocation, safeOAuthCallback } from './mcpOAuth'

const id = '00000000-0000-0000-0000-000000000001'
describe('navegación OAuth con HashRouter', () => {
  it('acepta el ID opaco de GoTrue y la query real sin marcador adicional', () => {
    const opaque = 'aB12cD34eF56gH78iJ90kL12mN34oP56'
    expect(authorizationId(opaque)).toBe(opaque)
    expect(normalizeConsentLocation({ href: `https://example.test/dashboardFurthurr/?authorization_id=${opaque}` }))
      .toBe(`https://example.test/dashboardFurthurr/#${consentPath(opaque)}`)
    for (const invalid of ['x'.repeat(31), 'x'.repeat(33), '../oauth/consent', 'https://evil.test/callback']) {
      expect(authorizationId(invalid)).toBeNull()
    }
  })
  it('normaliza el retorno de Auth en el root real de Pages sin perder el ID', () => {
    expect(normalizeConsentLocation({ href: `https://example.test/dashboardFurthurr/?mcp_consent=1&authorization_id=${id}` }))
      .toBe(`https://example.test/dashboardFurthurr/#${consentPath(id)}`)
  })
  it('no modifica el login normal y rechaza IDs o retornos arbitrarios', () => {
    expect(normalizeConsentLocation({ href: 'https://example.test/dashboardFurthurr/#/boards' })).toBeNull()
    expect(authorizationId('https://evil.test')).toBeNull()
    expect(authorizationId(null)).toBeNull()
    expect(normalizeConsentLocation({ href: 'https://example.test/?mcp_consent=1&authorization_id=invalid' })).toBe('https://example.test/#/oauth/consent')
  })
  it('acepta HTTPS y loopback, pero nunca javascript, hosts HTTP externos o credenciales', () => {
    for (const url of ['https://example.test/callback?code=fixture', 'http://127.0.0.1:3000/callback', 'http://localhost:8080/oauth/callback']) {
      expect(safeOAuthCallback(url)).toBe(url)
    }
    for (const url of ['javascript:alert(1)', 'http://evil.test/callback', '//evil.test', 'https://name:pass@example.test/']) {
      expect(() => safeOAuthCallback(url)).toThrow()
    }
  })
})
