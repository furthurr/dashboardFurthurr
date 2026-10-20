# Releases de Dashboard Furthurr

- Tecnología: React + TypeScript, Vite y npm.
- Versión: SemVer en `package.json` y `package-lock.json`.
- Rama de publicación: `main`; remoto: `origin`.
- Tag anotado: `vX.Y.Z`.
- Notas: `CHANGELOG.md` y release de GitHub.
- Web: `.github/workflows/deploy.yml` publica en GitHub Pages tras el push a `main`.
- Backend: las migraciones y Edge Functions se despliegan por separado en Supabase; consultar `supabase/README.md`.
- Perfil del ecosistema: [Node/npm](technologies/node.md).

## Verificación y publicación

1. Revisar el diff y excluir configuración local, credenciales y `supabase/.temp/`.
2. Ejecutar `npm ci`, `npm run build`, `npm run lint` y `npm run test -- --run --no-file-parallelism`.
3. Para cambios del backend, ejecutar `deno test --allow-env supabase/functions/admin-users/index_test.ts` y las pruebas SQL transaccionales de `supabase/tests/` contra el proyecto correcto.
4. Confirmar alcance, versión, commit, tag, push y despliegue antes de publicar.
5. Actualizar versión y changelog; crear el commit de release y el tag anotado, y publicar rama y tag.
6. Crear la release en GitHub y comprobar el workflow de Pages y los archivos publicados.

No guardar secretos en esta carpeta. Usar la autenticación de las herramientas y los secretos configurados en GitHub/Supabase.
