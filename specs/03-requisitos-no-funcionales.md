# 03 - Requisitos No Funcionales

Estado: `borrador`

## Compatibilidad

- Debe desplegarse en GitHub Pages.
- Debe funcionar como SPA estática.
- Debe funcionar en navegadores modernos.
- Debe ser usable en desktop y móvil.

## Seguridad

- Las reglas críticas deben aplicarse con Supabase RLS.
- No debe usarse `service_role` en el frontend.
- Las claves públicas deben cargarse como variables `VITE_*`.
- Los invitados no deben poder crear ni editar comentarios desde frontend ni base de datos.

## Rendimiento

- El tablero debe cargar rápido con una cantidad moderada de tareas.
- Las operaciones de drag & drop deben sentirse fluidas.
- Se deben usar actualizaciones optimistas con rollback cuando aplique.

## Mantenibilidad

- TypeScript debe usarse para reducir errores de datos.
- Las reglas de negocio deben documentarse antes de implementarse.
- Los nombres internos deben estar normalizados y sin ambigüedad.

## Accesibilidad

- El tablero debe tener contraste suficiente.
- Los botones deben tener labels claros.
- Drag & drop debe considerar teclado si la librería lo permite.
