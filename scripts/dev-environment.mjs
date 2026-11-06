// Vite gives inherited variables priority over project-local configuration.
// Remove the pair only for local development, before Vite loads any configuration.
// Never log their values or change the environment of the parent shell.
export function clearInheritedSupabase(environment) {
  const keys = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']
  const hadInheritedConfiguration = keys.some((key) => Object.hasOwn(environment, key))
  for (const key of keys) delete environment[key]
  return hadInheritedConfiguration
}
