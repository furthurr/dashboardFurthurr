# 01 - Producto

Estado: `borrador`

## Visión

Construir una aplicación web de gestión de tareas casi idéntica en experiencia a Trello, basada en tableros Kanban con cards arrastrables, usuarios autenticados, roles, comentarios, prioridad y adjuntos ligeros.

## Usuarios Objetivo

- Administradores que gestionan usuarios, tareas y permisos.
- Usuarios internos que crean, editan y comentan tareas.
- Invitados que consultan información con permisos limitados.

## Propuesta De Valor

Centralizar el seguimiento de tareas en un tablero visual, fácil de usar y accesible desde GitHub Pages, con datos persistidos en Supabase.

## Alcance Inicial

- Login y registro.
- Perfil de usuario.
- Roles: admin, usuario e invitado.
- Tablero Kanban con cinco estados.
- Tareas como cards.
- Drag & drop para cambiar estado.
- Asignación a uno o varios usuarios.
- Prioridades.
- Comentarios con permisos.
- Anotaciones especiales.
- Adjuntos de máximo 5 MB.
- Deploy en GitHub Pages.

## No Objetivos Iniciales

- No app móvil nativa.
- No backend propio.
- No multi-workspace avanzado en primera versión.
- No integración con calendario en primera versión.
- No notificaciones push en primera versión.
