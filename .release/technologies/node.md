# Perfil de release — Node/npm

- **Señales:** `package.json`, `package-lock.json` y Vite.
- **Archivo de versión:** `package.json`, clave `version`; sincronizar la versión raíz y `packages[""].version` en `package-lock.json`.
- **Formato:** SemVer `MAJOR.MINOR.PATCH`, sin contador de build.
- **Bump:** `npm version <major|minor|patch> --no-git-tag-version`; revisar previamente los scripts de versión. Actualiza ambos archivos sin crear commit ni tag y requiere un árbol Git limpio. No usar `--force` para eludir esa comprobación.
- **Herramienta CLI:** npm (`npm version`). El paquete declara `private: true`; no publicar en el registro npm.
- **Convención del proyecto:** tag anotado `vX.Y.Z` y `CHANGELOG.md` en español.
- **Rama y distribución:** `main` en `origin`; el push publica la SPA en GitHub Pages. La release de GitHub se crea con `gh`; migraciones y Edge Functions de Supabase se despliegan por separado.
- **Fuentes:** [npm version](https://docs.npmjs.com/cli/v11/commands/npm-version) y [Semantic Versioning 2.0.0](https://semver.org/) — consultadas el 2026-10-22.
