# Specs - Fuente De Verdad SDD

Esta carpeta contiene las especificaciones del proyecto. Se usará como fuente de verdad para planear, implementar, revisar y ajustar el sistema.

## Método SDD

SDD significa Specification Driven Development. En este proyecto significa:

- Primero se define la especificación.
- Después se implementa lo especificado.
- Si cambia el producto, primero cambia la documentación.
- Cada decisión importante queda registrada.
- El progreso se mide contra las specs, no contra ideas sueltas.

## Orden De Lectura

1. [`00-init.md`](./00-init.md)
2. [`01-producto.md`](./01-producto.md)
3. [`02-requisitos-funcionales.md`](./02-requisitos-funcionales.md)
4. [`03-requisitos-no-funcionales.md`](./03-requisitos-no-funcionales.md)
5. [`04-modelo-datos.md`](./04-modelo-datos.md)
6. [`05-auth-roles-permisos.md`](./05-auth-roles-permisos.md)
7. [`06-ui-ux-diseno.md`](./06-ui-ux-diseno.md)
8. [`07-kanban-drag-drop.md`](./07-kanban-drag-drop.md)
9. [`08-deploy-github-pages.md`](./08-deploy-github-pages.md)
10. [`09-backlog-sdd.md`](./09-backlog-sdd.md)
11. [`10-decisiones.md`](./10-decisiones.md)
12. [`11-progreso.md`](./11-progreso.md)

## Estados De Una Spec

- `borrador`: propuesta inicial.
- `aprobada`: lista para implementar.
- `en-desarrollo`: se está implementando.
- `implementada`: ya existe en el proyecto.
- `cambiada`: fue modificada después de implementación.
- `descartada`: ya no aplica.

## Regla Principal

Ninguna funcionalidad debe implementarse si no existe primero en una spec aprobada o explícitamente aceptada durante la conversación.
