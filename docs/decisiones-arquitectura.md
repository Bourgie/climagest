# Decisiones de arquitectura

Registro de decisiones relevantes tomadas durante el desarrollo, por fase.
Fuente de verdad del proyecto: `Plan_Completo_V1_AireAcondicionado.pdf`.

## Fase 0 — Foundation

### D1. Next.js 16: `proxy.ts` reemplaza a `middleware.ts`
Next 16 renombró Middleware a **Proxy** (misma función, nuevo nombre). El archivo
de refresh de sesión de Supabase vive en `src/proxy.ts` (exporta `proxy`, no
`middleware`). Referencia: `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.

### D2. `@supabase/ssr` 0.12.x ya no exporta `updateSession`
En esta versión se eliminó el helper `updateSession`. El refresh de sesión se
escribe manualmente en `src/proxy.ts` con `createServerClient` usando
`getAll`/`setAll` (cookies), seguido de `supabase.auth.getUser()` para forzar el
refresh del token. Usar los métodos `getAll`/`setAll` (los `get`/`set`/`remove`
están deprecados y se eliminarán en la próxima major).

### D3. Claves de Supabase: formato nuevo `sb_publishable_` / `sb_secret_`
Supabase emite ahora "publishable key" (equivalente a la vieja anon key, para el
browser) y "secret key" (equivalente a service_role, solo servidor). Ambas se
validaron contra el proyecto real (`mis_instalaciones_app`):
- anon/publishable → `/auth/v1/health` 200
- secret/service_role → `/auth/v1/admin/users` 200
- access token → management API lista el proyecto 200

### D4. PowerSync: SDK instalado, conexión diferida a Fase 8
Se instala `@journeyapps/powersync-sdk-web` + `@journeyapps/powersync-react`.
En Fase 0 solo queda el esqueleto (`src/lib/powersync/`): `AppSchema` vacío,
`connector` (usa el JWT de Supabase, sin secret aparte de PowerSync en V1) y
`createPowerSyncDatabase()` (WASM SQLite). No se instancia ni se monta el
provider hasta Fase 8, cuando existan tablas y Sync Rules. Ver skill
`offline-powersync`.

### D5. Migraciones: `supabase link` roto → directo a Postgres con `--db-url`
`supabase link` falla con `LegacyLinkAuthTokenError` + "necessary privileges"
también con el CLI clavado en `@2.111.0`, pese a que el access token funciona en
la management API (es un bug del flujo legacy del CLI con el nuevo formato de
token). Decisión: **no usar `link`**. Las migraciones se aplican directo a
Postgres con `supabase db push --db-url "$SUPABASE_DB_URL"`.

Detalle técnico del connection string (verificado con `pg`, `SELECT version()`
→ PostgreSQL 17.6):
- Host: **pooler IPv4** `aws-0-<region>.pooler.supabase.com` (el host directo
  `db.<ref>.supabase.co` resuelve solo IPv6 y da `getaddrinfo ENOTFOUND` en
  Windows).
- Usuario: `postgres.<project_ref>` (nunca `postgres`).
- Puerto: 6543 (modo transacción). El valor completo vive en `.env.local`
  (`SUPABASE_DB_URL`), nunca commiteado.

### D6. Variables de entorno
Ver `.env.example`. `.env.local` (valores reales) queda excluido de git desde
el primer commit (checklist de seguridad, punto 2).

## Pendientes operativos

- **Actualizar PowerSync Cloud** con la secret key y la db password nuevas
  (rotadas el 10-sep-2026). Hasta no hacerlo, la replicación de PowerSync
  queda cortada. Solo impacta en Fase 8 (offline). Lo hace el usuario en
  console.powersync.com.

## Fase 1 — Plataforma y tenancy

### D7. Representación de roles
- `memberships.role` ∈ {`owner`, `admin`, `technician`} (Dueño / Administrativo
  / Técnico). Un usuario pertenece a UNA sola empresa (`memberships.user_id
  UNIQUE`).
- El Superusuario NO es un rol de membership: se marca con `profiles.is_superuser
  = true` y no tiene membership a ninguna empresa.

### D8. Login de 3 factores → email sintético determinístico
`internal_email = {username}+{company_code}@internal.app` (ver
`src/lib/internal-email.ts`). No se guarda `username` en otra tabla; la unicidad
de username por empresa la garantiza el `UNIQUE` de `profiles.internal_email`
(mismo username + misma empresa → mismo email → colisión). El login resuelve el
email determinísticamente y hace `signInWithPassword`; `company_code` se fuerza
UPPERCASE (constraint en 0003) y username lowercase, para que no haya dos
empresas con distinto case produciendo el mismo email.

### D9. Dos capas: RLS (aislamiento) + Server Actions (permisos de negocio)
- RLS solo aísla por `company_id`. Las tablas sensibles (`companies`,
  `company_modules`, `profiles`, `memberships`, `role_permissions`) NO tienen
  políticas de escritura para usuarios finales: sus mutaciones pasan por Server
  Actions usando el admin client (service_role, que bypass RLS).
- `hasPermission(user, key)` (src/server/auth.ts) consulta `role_permissions`
  con el server client del usuario (RLS garantiza el scope) y delega la decisión
  final en `resolvePermission` (src/lib/auth-logic.ts), puro y testeable.
- Helper RLS `SECURITY DEFINER` (`is_superuser`, `current_company_id`,
  `current_role`, `is_company_member`). `seed_default_role_permissions` se
  revocó de PUBLIC (quedó solo para service_role) — 0002.

### D10. Migraciones aplicadas directo a Postgres
`supabase db push --db-url "$SUPABASE_DB_URL"` (sin `supabase link`, ver D5).

### Pendientes Fase 2+ (no bloquean Fase 1)
- Login/panel del Superusuario: hoy el seed crea `superadmin@internal.app` pero
  el login de 3 factores no lo contempla (se resuelve en Fase 2).
- Alta de usuarios (Dueño crea Admin/Técnico): validar username único por
  empresa en el Server Action (no está en constraint).
- Rate limiting del login + auditoría de intentos fallidos (checklist puntos 11-12).
- Re-chequeo de `companies.status` post-login para sesiones ya activas.
- Tipos generados de Supabase (`supabase gen types`) para queries tipadas.

## Fase 2 — Administración y permisos

### D11. Login dedicado del Superusuario
El Superusuario (sin empresa) entra por `/superadmin/login` con email +
contraseña, y tras el signIn se verifica `profiles.is_superuser` (si no, se
cierra la sesión). El login de 3 factores sigue siendo exclusivo de usuarios de
empresa (no se mezclan).

### D12. Capa de servicios inyectable (testeable)
La lógica de negocio (altas/bajas de usuarios, reseteo, configuración de
permisos, alta de empresa) vive en `src/server/services/*` como funciones puras
que reciben el `admin` client (service_role) + los flags de permiso (`canCreate`,
`canUpdate`, …) ya resueltos. Las Server Actions (`src/server/actions/*`) son
wrappers finos: `requireUser()`/`requireSuperuser()` + `hasPermission()` +
`createAdminClient()` + llamada al servicio + `revalidatePath`. Así los servicios
se testean de integración sin el runtime de Next.

### D13. Auditoría (audit_logs)
Tabla append-only; escrituras SOLO desde Server Actions vía admin client (nunca
el client del usuario). `company_id` nullable (acciones de plataforma) y `on
delete set null` (borrar una empresa no borra su historial). Permiso nuevo
`users.reset_password` (jerarquía: Dueño→Admin/Técnico, Superusuario→Dueño).

### D14. Módulos activables
Catálogo de módulos en código (`src/lib/modules.ts`) con presets por plan
(básico/profesional/premium). El Superusuario los activa por empresa en
`company_modules` (gate de negocio, no de RLS — patrón saas-feature).

## Fase 3 — Clientes

### D15. Clientes con N direcciones y N contactos
`clients` (sin columnas de domicilio) + `client_addresses` + `client_contacts`.
RLS de las hijas resuelve la empresa vía el helper `client_company_id(client_id)`
(SECURITY DEFINER, evita recursión sobre `clients`). A lo sumo una dirección
primaria (normalización en servicio + índice parcial único). Escrituras solo vía
Server Actions/admin client con permisos `clients.create/update/delete/view`.

## Fase 4 — Equipos y QR

### D16. QR público: whitelist explícita en RPC SECURITY DEFINER
`get_equipment_public(p_token, p_ip_hash)` es la única vía de lectura pública:
devuelve SOLO `brand/model/equipment_type/install_date/history` (nunca
serial_number, location_label, contacto, costos ni diagnóstico) y además registra
el acceso en `qr_access_audit` (action='view', actor_type derivado de
`auth.uid()`). Requiere `qr_token` válido (secreto); sin él devuelve `found=false`.
Expuesta a anon a propósito (es el endpoint público), con grant explícito (0010).

### D17. `qr_token` con entropía criptográfica
Se genera en el servicio con `crypto.randomBytes(24).toString('base64url')`
(192 bits), no adivinable ni secuencial (el token es lo único que protege la
vista pública). El token es inmutable (el QR impreso no se invalida al editar).

### D18. Consultas externas y auditoría
`qr_inquiries` (consulta del visitante) y `qr_access_audit` (accesos) con RLS de
solo lectura por empresa (helper `equipment_company_id`). La consulta del
visitante entra por una Server Action pública que resuelve el token server-side
(nunca un INSERT directo de anon). El "Solicitar servicio" que crea
`service_request` (origin=qr_publico) se implementa en Fase 5.

Nota de auditoría: `qr_access_audit.action` (view/edit_attempt/edit_success/
login_fail) según el plan. En Fase 4 (solo vista pública) se registra `view`.
Las acciones `login_fail` (acceder a la vista privada sin credenciales) y
`edit_attempt`/`edit_success` (edición del historial) se registran en Fase 7,
cuando existan la vista privada y las work_orders. La mitigación de fuerza
bruta sobre `qr_token` es rate limiting (checklist punto 11), no el audit.

## Fase 5 — Pedido y Presupuesto

### D19. Flujo Pedido → Presupuesto y cálculo de totales
`service_requests` (recibido→presupuestado→agendado→en_curso→resuelto/cancelado)
+ `quotes` (draft→enviado→aceptado/rechazado/vencido) + `quote_items` +
`quote_acceptance_tokens`. Los totales (`subtotal` = Σ items, `labor_amount` =
Σ items mano_obra, `total` = subtotal − descuento) se calculan **en el servicio**,
nunca se confía el total que manda el cliente. Al crear un presupuesto desde un
pedido, el pedido pasa a `presupuestado`.

### D20. Aceptación por link público (sin cuenta)
`quote_acceptance_tokens.token` (crypto, 192 bits) con `expires_at`. La página
pública `/presupuesto/[token]` resuelve el token vía admin client (whitelist de
campos para el cliente: items + totales + condiciones, sin datos internos) y
`respondToQuoteByToken` valida: token válido, no expirado, status='enviado'
(no doble respuesta). Ambos caminos (token y manual) registran `accepted_at` y
`audit_logs`.

### D21. QR "Solicitar servicio"
`createServiceRequestFromQr` crea un `service_request` (origin=qr_publico) con
el cliente/equipo resueltos del token, + una `qr_inquiry` con el contacto del
visitante. PDF del presupuesto vía `pdfkit` en `/api/presupuestos/[id]/pdf`.

## Fase 6 — Agenda

### D22. Turnos con múltiples técnicos
`appointments` + `appointment_technicians` (N:N, PK compuesta). Los técnicos
asignados se validan en el servicio contra `memberships` (misma empresa, rol
technician, activo) — la integridad cross-empresa no la puede garantizar una FK
simple. `branch_id` queda reservado (nullable, sin FK): V1 no define sucursales.
El scope "técnico ve solo sus turnos" se aplica en capa de aplicación (y en las
Sync Rules de Fase 8), no en RLS (que sigue aislando solo por empresa).

## Fase 7 — Orden de Trabajo

### D23. Orden de Trabajo y mediciones opcionales
`work_orders` + `work_order_materials` + `work_order_photos`. `measurements` es
JSONB nullable (el formulario técnico es siempre opcional, se sanitizan los
nulos). `actual_start_at`/`actual_end_at` se graban en start/finish (distintos de
`created_at`), de ahí salen las horas trabajadas. `warranty_days` → `warranty_until`
calculado al finalizar. Firma digital como base64 PNG/JPEG (validada tamaño+MIME).
Cualquier técnico de la empresa puede cargar una OT sobre cualquier equipo de la
empresa (no restringido al asignado).

### D24. Historial del QR y vista privada
`get_equipment_public` devuelve `history` solo de work_orders `completado`
(visit_type + fecha, sin hora, sin diagnóstico/costos/mediciones). La vista
privada (`/q/[token]` con usuario miembro de la empresa) muestra el equipo
completo + historial + "Registrar nueva visita". Auditoría: `view` (RPC),
`edit_attempt`/`edit_success` (createWorkOrder).

### Pendientes (no bloquean Fase 7)
- Subida de fotos a Storage (`work_order_photos`): la tabla existe, falta el
  flujo de upload. La firma ya funciona (base64 inline).
- Alerta de garantía vigente al crear un `service_request` sobre un equipo con
  work_order en garantía (Fase 10).
- `account_charge` automático al finalizar una OT (Fase 9).

## Fase 8 — Offline / PowerSync

### D25. SDK: `@powersync/web` + `@powersync/react` (namespace actual)
Se migró de `@journeyapps/*` (Fase 0) al namespace vigente. Worker
pre-bundeado en `public/@powersync/` vía `postinstall` (requerido por
Turbopack); esos assets generados están en `.gitignore` y excluidos de ESLint.

### D26. Alcance local acotado al flujo del técnico
AppSchema con 7 tablas: turnos, clientes, direcciones, equipos, órdenes,
materiales y fotos. `appointment_technicians` NO se sincroniza (tiene PK
compuesta y PowerSync exige PK `id` de texto): el filtro por técnico se hace
server-side en los Sync Streams, y localmente solo llegan sus turnos.

### D27. Subida con validación server-side (`/api/powersync/upload`)
La cola offline se aplica contra Supabase solo por este endpoint. Valida:
tabla dentro de la whitelist (solo OTs + hijas), `company_id` derivado de la
sesión (nunca del body), permiso granular (`work_orders.create/update/delete`),
equipo/OT padre de la misma empresa y, para técnicos, que la OT sea propia.
400 = error permanente (el cliente descarta la cola); 401/500 = transitorio
(reintenta). Los JWT de sesión salen del login de 3 factores (sin secret
aparte de PowerSync).

### D28. Sync Streams (no legacy Sync Rules)
`powersync/sync-streams.yaml` con 7 streams `auto_subscribe` que replican el
scope de RLS: turnos del técnico (JOIN a `appointment_technicians` por
`auth.user_id()`), clientes/equipos relacionados y OTs creadas por él. Columnas
explícitas 1:1 con el AppSchema.

### Pendientes del lado de PowerSync Cloud (los hace el usuario)
1. Actualizar la conexión a Supabase con las credenciales rotadas
   (service_role + db password) o la replicación queda cortada.
2. Pegar `powersync/sync-streams.yaml` en Dashboard → Sync Streams → Deploy.
3. Prueba de campo (criterio de cierre de Fase 8): 2 técnicos de la misma
   empresa + 1 de otra empresa verifican que nadie recibe datos ajenos.
