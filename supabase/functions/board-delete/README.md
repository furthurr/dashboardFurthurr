# Borrado completo de tableros desactivados

`board-delete` sustituye el borrado directo desde la SPA. Requiere sesión del
portal verificada por Auth y administrador activo; rechaza sesiones OAuth.
No acepta rutas de archivos ni identidad del actor desde el cliente.

## Instalación

1. Contrastar primero el ledger y objetos del entorno. Aplicar únicamente la
   migración pendiente `202611060001_inactive_board_readonly.sql`, tras sus
   prerrequisitos existentes. No ejecutar el bootstrap en una BD existente ni
   hacer un `db push` global. El bootstrap nuevo ya incluye esta migración.
2. Desplegar `supabase functions deploy board-delete` usando la configuración
   `verify_jwt=false` del repositorio: el propio handler verifica el bearer.
3. Publicar la SPA compatible. Coordinar los pasos en una ventana de mantenimiento:
   SQL revoca inmediatamente el antiguo borrado cliente y, hasta que Edge/SPA
   estén disponibles, ese borrado fallará de forma cerrada. No restaurar los grants
   anteriores ni añadir un fallback directo para eludirlo.

La implementación local y las pruebas no acreditan que estos pasos se hayan
ejecutado en remoto. La función usa la configuración de servicio inyectada por
Supabase; nunca copiarla al cliente ni a evidencias.

## Consistencia y recuperación

- SQL bloquea escrituras en tableros inactivos incluso para administradores;
  conserva la visibilidad existente. Las RPCs definer tienen guardas adicionales.
- `prepare_board_deletion` y `finish_board_deletion` solo son ejecutables por
  `service_role`; revalidan el administrador y el tablero desactivado.
- Preparar bloquea la fila del tablero y guarda un manifiesto privado en
  `board_deletion_jobs`. Resuelve nombres en el bucket fijo, incluyendo rutas
  nuevas, objetos huérfanos bajo el prefijo de tarea y adjuntos históricos planos.
- Edge elimina mediante la API Storage en lotes de 100. Solo después SQL comprueba
  que no quedan objetos del manifiesto y elimina los datos relacionales.
- Ante un fallo, el tablero permanece visible para admin, inactivo y con sus
  metadatos; algunos archivos pueden haber desaparecido. La reactivación queda
  bloqueada. Reintentar «Eliminar tablero» reutiliza el manifiesto y completa la
  operación. Otro administrador activo también puede reintentar.
- No existe transacción distribuida ni rollback de archivos ya borrados. No hay
  worker automático: requiere reintento administrativo. Las URLs firmadas ya
  emitidas conservan su vigencia habitual mientras exista el objeto.

## Verificación local

```bash
deno test --allow-read --allow-run=docker supabase/tests/mcp_sql_test.ts
deno test --allow-env supabase/functions/board-delete/index_test.ts
deno test --allow-read supabase/tests/inactive_board_bootstrap_test.ts
npx vitest run --maxWorkers=2
npm run lint
npm run build
```

SQL usa PostgreSQL 16 desechable con Auth/Storage simulados, en bootstrap e
incremental; las fixtures se revierten. Los mocks Edge no son un E2E real de
OAuth, Auth o Storage. Validar el flujo autenticado en un entorno de pruebas
antes de dar por comprobado el despliegue.
