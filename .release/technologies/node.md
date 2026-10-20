# Perfil de release — Node/npm

- Señales: `package.json`, `package-lock.json` y Vite.
- Archivo de versión: `package.json`, clave `version`; sincronizar la versión raíz y la entrada raíz de `package-lock.json`.
- Formato: SemVer `MAJOR.MINOR.PATCH`, sin contador de build.
- Bump: `npm version <version> --no-git-tag-version`; revisar previamente los scripts de versión. No crea commit ni tag con esta opción.
- Convención del proyecto: tag anotado `vX.Y.Z` y `CHANGELOG.md` en español.
- Publicación: SPA privada, sin `npm publish`; push a `main` para GitHub Pages y release mediante `gh`.
- No usar `--force` ni crear tags automáticamente antes de las verificaciones y confirmación.
- Fuente: https://docs.npmjs.com/cli/v11/commands/npm-version — consultada el 2026-10-20.
