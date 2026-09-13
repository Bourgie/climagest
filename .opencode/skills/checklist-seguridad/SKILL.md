---
name: checklist-seguridad
description: Checklist de 25 puntos de seguridad y escalabilidad (los 22 generales de cualquier proyecto Next.js+Supabase, más 3 específicos de este proyecto — QR público, permisos granulares, Sync Rules de PowerSync). Usar antes de cualquier deploy a producción y al cerrar cualquier fase que toque autenticación, permisos, QR público o sincronización offline.
license: Proprietary
compatibility: opencode
metadata:
  project: aire-acondicionado
  fase: "0,1,14"
---

## Los 22 puntos generales (mismo criterio en cualquier proyecto Next.js + Supabase)

1. **Oculta las claves API** — variables de entorno, nunca hardcodeadas.
2. **Elimina secretos de Git** — `.gitignore` desde Fase 0; rotar cualquier clave que se haya filtrado.
3. **Usa una clave pública de DB** — publishable/anon key en frontend, secret/service_role solo en servidor.
4. **Activa RLS** — obligatorio en toda tabla de negocio, sin excepción.
5. **Cifra datos sensibles** — cifrado de infraestructura de Supabase + RLS + HTTPS alcanza para V1.
6. **Fuerza autenticación del servidor** — validación de sesión siempre en Server Actions, nunca solo en cliente.
7. **Restringe acceso a registros** — RLS (aislamiento) + `role_permissions` (permisos de negocio, ver skill `permisos-granulares`).
8. **Bloquea manipulación de campos** — `company_id`/`role`/`status` nunca vienen del body del request sin derivar de la sesión.
9. **Protege cookies de sesión** — httpOnly, secure, sameSite vía `@supabase/ssr`.
10. **Hashea contraseñas** — lo maneja Supabase Auth, no reimplementar.
11. **Limita intentos de inicio** — rate limiting de Supabase Auth; el login de 3 factores no debe revelar si el código de empresa existe (ver skill `gestion-usuarios-auth`).
12. **Añade protección contra bots** — captcha en login si se detectan intentos automatizados.
13. **Monitoriza consultas de DB** — dashboard de Supabase (Query Performance/Logs), prestando atención especial a las queries del dashboard agregado y del panel de rendimiento por técnico.
14. **Valida todas las entradas** — schema de validación (zod) en todo input de servidor, incluidos los formularios de `work_orders` con campos opcionales.
15. **Escapa contenido del usuario** — evitar `dangerouslySetInnerHTML`; cuidado en el generador de PDF de presupuestos.
16. **Restringe subida de archivos** — validar tamaño, MIME y extensión real en fotos de `work_order_photos` y firma digital.
17. **Limita respuestas de API** — paginación server-side en listados de clientes, equipos, work_orders.
18. **Añade cabeceras de seguridad** — CSP, X-Frame-Options, HSTS, etc.
19. **Fuerza HTTPS** — sin URLs http hardcodeadas, incluidos los enlaces `wa.me`.
20. **Escanea dependencias** — npm audit en CI, o Dependabot/Snyk (atención particular al SDK de PowerSync por ser una dependencia crítica de sincronización).
21. **Cookies y datos personales** — documentar retención de datos de cliente (nombre, contacto, direcciones).
22. **Escalabilidad de BD** — índices en `work_orders(company_id, equipment_id, created_at)`, `appointments(company_id, scheduled_at)`, `account_charges(company_id, client_id, status)`; connection pooler de Supabase.

## Los 3 puntos específicos de este proyecto

23. **La vista pública del QR nunca expone datos sensibles** — verificar que se sirve desde una función/RPC con whitelist explícita (ver skill `qr-equipo-seguridad`), nunca un endpoint que devuelva el registro completo con campos "ocultos" en el frontend.
24. **Los permisos granulares se validan en cada Server Action sensible** — no alcanza con ocultar el botón en la UI; verificar que exista el chequeo `hasPermission()` antes de cada acción de eliminar/ver costos/modificar pagos (ver skill `permisos-granulares`).
25. **Las Sync Rules de PowerSync están alineadas con RLS** — un técnico no debe recibir en su base SQLite local datos de otro técnico o de otra empresa; probar explícitamente con múltiples técnicos antes de cerrar la Fase 8 (ver skill `offline-powersync`).

## Cuándo aplicar este checklist

- Puntos 1-11: al cerrar Fase 1 (Plataforma y tenancy).
- Punto 24: al cerrar Fase 2 (Administración y permisos).
- Punto 23: al cerrar Fase 4 (Equipos y QR).
- Punto 25: al cerrar Fase 8 (Offline/PowerSync).
- Checklist completo, los 25 puntos: antes de cualquier deploy a producción (Fase 14).
