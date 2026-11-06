import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clearInheritedSupabase } from './dev-environment.mjs'

test('removes the inherited Supabase pair before local configuration is loaded', () => {
  const environment = {
    VITE_SUPABASE_URL: 'https://wrong-project.example.test',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'placeholder-not-a-real-key',
  }
  assert.equal(clearInheritedSupabase(environment), true)
  assert.deepEqual(environment, {})
})

test('removes even partial inherited configuration rather than mixing projects', () => {
  for (const key of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']) {
    const environment = { [key]: 'placeholder' }
    assert.equal(clearInheritedSupabase(environment), true)
    assert.equal(Object.hasOwn(environment, key), false)
  }
})

test('preserves all unrelated environment settings and has no global side effects', () => {
  const parent = {
    PATH: '/example/bin', NODE_ENV: 'development',
    VITE_OTHER_SETTING: 'keep', VITE_SUPABASE_URL: 'https://example.test',
  }
  const child = { ...parent }
  clearInheritedSupabase(child)
  assert.deepEqual(child, { PATH: '/example/bin', NODE_ENV: 'development', VITE_OTHER_SETTING: 'keep' })
  assert.equal(parent.VITE_SUPABASE_URL, 'https://example.test')
})

test('is idempotent and does not invent a fallback project or key', () => {
  const environment = { PATH: '/example/bin' }
  assert.equal(clearInheritedSupabase(environment), false)
  assert.equal(clearInheritedSupabase(environment), false)
  assert.deepEqual(environment, { PATH: '/example/bin' })
})
