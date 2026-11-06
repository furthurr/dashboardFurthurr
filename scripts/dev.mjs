import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearInheritedSupabase } from './dev-environment.mjs'

if (clearInheritedSupabase(process.env)) {
  console.info('Desarrollo: se ignoran las variables Supabase heredadas; Vite usará la configuración local del proyecto.')
}

// Execute the installed CLI in this process: preserve Vite flags, signals and
// exit codes without another server/process supervisor or a shell dependency.
const require = createRequire(import.meta.url)
const viteRoot = dirname(require.resolve('vite/package.json'))
await import(pathToFileURL(join(viteRoot, 'bin', 'vite.js')).href)
