---
name: permisos-granulares
description: Cómo implementar y consultar el sistema de permisos configurables por el Dueño (permissions + role_permissions), y la separación estricta con RLS. Usar al implementar cualquier Server Action que module acciones sensibles (eliminar, ver costos, modificar pagos, etc.) o la pantalla de configuración de permisos del Dueño.
license: Proprietary
compatibility: opencode
metadata:
  project: aire-acondicionado
  fase: "2"
---

## Las dos tablas

- `permissions`: catálogo fijo de capacidades del sistema (ej. `clients.delete`, `payments.delete`, `costs.view`, `quotes.create`). Es parte del código, no lo edita nadie desde la UI — se agrega una fila nueva cuando se agrega una capacidad nueva al sistema, vía migración.
- `role_permissions`: (company_id, role, permission_key, allowed BOOLEAN). Esto sí lo edita el Dueño desde una pantalla de configuración, por empresa.

## Regla de arquitectura no negociable

**RLS resuelve únicamente el aislamiento multiempresa/sucursal** — qué filas de qué empresa puede tocar un usuario. Nunca metas lógica de `role_permissions` dentro de una política RLS.

**Los permisos granulares de negocio se validan en la capa de aplicación** (Server Actions), consultando `role_permissions` antes de ejecutar la acción. Ejemplo del patrón esperado:

```typescript
async function deleteClient(clientId: string) {
  const session = await getSession();
  const allowed = await hasPermission(session, 'clients.delete');
  if (!allowed) throw new ForbiddenError();
  // recién acá, la query a Supabase, que además está protegida por RLS
  // para el aislamiento multiempresa
}
```

Mezclar ambas capas en RLS las vuelve imposibles de mantener y de auditar — si un permiso falla, tiene que quedar claro si fue por aislamiento (bug de seguridad grave) o por configuración de negocio (comportamiento esperado).

## Al construir la pantalla de configuración del Dueño

- Agrupar los `permissions` por categoría (clientes, pagos, presupuestos, costos, usuarios) para que la UI no sea una lista plana de 40 checkboxes.
- Al crear una empresa nueva, sembrar `role_permissions` con valores por defecto razonables (ej. Administrativo: `clients.create`=true, `clients.delete`=false, `payments.register`=true, `payments.delete`=false, `costs.view`=false) — el Dueño parte de un estado sensato, no de todo en false.
- Técnico tiene un set de permisos más acotado por defecto y generalmente no necesita pantalla de configuración tan granular como Administrativo — pero la tabla soporta ambos igual.
- Cambios en `role_permissions` van a `audit_logs` (quién cambió qué permiso, para qué rol, cuándo).

## Helper esperado

Definir un único helper `hasPermission(session, permissionKey)` reutilizado en todo Server Action sensible — no reimplementar la consulta a `role_permissions` en cada archivo.
