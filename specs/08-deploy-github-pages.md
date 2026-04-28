# 08 - Deploy En GitHub Pages

Estado: `borrador`

## Estrategia

La app se compilará como sitio estático y se desplegará mediante GitHub Actions a GitHub Pages.

## Compatibilidad

Vite genera archivos estáticos en `dist`. GitHub Pages puede servir esa carpeta después del build.

## Routing

Se recomienda `HashRouter` para evitar 404 al refrescar rutas internas.

Ejemplo:

```txt
https://usuario.github.io/dashboardFurthurr/#/board
```

## Variables De Entorno

Variables públicas esperadas:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

No usar:

- `SUPABASE_SERVICE_ROLE_KEY`
- Cualquier clave secreta de backend.

## Workflow Previsto

Cuando exista el proyecto Vite, se creará `.github/workflows/deploy.yml` con pasos:

- Checkout.
- Setup Node.
- Install dependencies.
- Build.
- Upload artifact.
- Deploy to Pages.

## Pendientes

- Confirmar nombre final del repositorio.
- Confirmar si se usará dominio propio.
- Definir valor final de `base` en Vite.
