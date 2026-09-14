# ClimaGest — SaaS multiempresa para empresas de aire acondicionado

Gestión de clientes, equipos (QR), pedidos → presupuestos → agenda → órdenes
de trabajo, cuenta corriente y garantías. Offline-first para el técnico
(PowerSync), login de 3 factores (código de empresa + usuario + contraseña).

Fuente de verdad funcional: `Plan_Completo_V1_AireAcondicionado.pdf`.
Decisiones tomadas durante el desarrollo: `docs/decisiones-arquitectura.md`.

## Stack

Next.js 16 + TypeScript + Tailwind · Supabase (Postgres 17 + Auth + Storage) ·
PowerSync (offline) · pdfkit + qrcode · zod · vitest.

Dos capas de seguridad: **RLS** (solo aislamiento por `company_id`) +
**Server Actions** (permisos granulares de negocio contra `role_permissions`).

## Estado (verificado 2026-09-14)

| Fase | Alcance | Estado |
|---|---|---|
| 0 | Foundation (Next, Supabase, PowerSync esqueleto) | ✅ |
| 1 | Plataforma y tenancy (empresas, roles, permisos) | ✅ |
| 2 | Administración (usuarios, reseteo, módulos, auditoría) | ✅ |
| 3 | Clientes (N direcciones, N contactos) | ✅ |
| 4 | Equipos + QR público (whitelist) / privado | ✅ |
| 5 | Pedidos + presupuestos + aceptación por link + PDF | ✅ |
| 6 | Agenda (turnos multi-técnico) | ✅ |
| 7 | Órdenes de trabajo (materiales, fotos, firma, horas) | ✅ |
| 8 | Offline PowerSync (AppSchema + upload + Sync Streams) | ✅ código, ⏳ falta deploy en PowerSync Cloud |
| 9 | Cuenta corriente (cargos, pagos, aplicación, PDF/Excel) | ✅ |
| 10 | Garantías (`warranty_days` → `warranty_until`) | ✅ parcial |
| 1b–1f | Fundaciones V1.1: sucursales, `fault_types`, mantenimiento, `company_settings`, numeración humana, notificaciones, `job_runs` | ✅ migraciones aplicadas |

Tests: 57 integración + 13 unitarios. Migraciones: `0001–0027` aplicadas
(falta la `0019`, que nunca existió — hueco histórico sin efecto).

## Puesta en marcha

```bash
npm install
# .env.local con NEXT_PUBLIC_SUPABASE_URL, claves anon/service_role,
# SUPABASE_DB_URL (pooler IPv4, usuario postgres.<ref>, puerto 6543),
# NEXT_PUBLIC_POWER_SYNC_URL y NEXT_PUBLIC_APP_URL (.env.example de referencia)

node --env-file=.env.local scripts/apply-pending-migrations.mjs  # solo pendientes
node --env-file=.env.local scripts/seed-dev.mjs                  # seed SOLO dev
npm run dev
```

Las migraciones se aplican directo a Postgres con `--db-url` (`supabase link`
está roto con el formato nuevo de tokens — ver D5). El script
`apply-pending-migrations.mjs` hace lo mismo sin el CLI y registra en
`supabase_migrations.schema_migrations`.

## Accesos (tras el seed dev)

| Quién | Dónde | Credenciales default |
|---|---|---|
| Superusuario | `/superadmin/login` | `superadmin@internal.app` / `SuperAdmin123!` (o `SEED_SUPERUSER_PASSWORD`) |
| Dueño demo | `/login`, empresa `DEMO`, usuario `demo` | `Demo1234!` (o `SEED_DEMO_PASSWORD`) |
| Admin demo | idem, usuario `admin` | idem |
| Técnico demo | idem, usuario `tecnico` | idem |

El Superusuario crea empresas desde `/superadmin` (activa módulos por plan:
básico/profesional/premium). Cada empresa nueva recibe `company_settings`,
contadores de documentos y tipos de falla por defecto.

## Estructura

- `src/app/` — rutas (empresa) + `/superadmin` (plataforma) + `/api` (PDFs, upload PowerSync)
- `src/server/services/` — lógica de negocio pura (testeable, recibe admin client)
- `src/server/actions/` — wrappers finos: auth + permiso + servicio + revalidate
- `supabase/migrations/` — `0001–0027`, solo aislamiento en RLS
- `powersync/sync-streams.yaml` — 7 streams (pendiente pegar en PowerSync Cloud)
- `scripts/` — `seed-dev.mjs`, `apply-pending-migrations.mjs`
- `tests/` — integración + unitarios (`npm run test:integration`)

## Pendientes conocidos

1. **PowerSync Cloud**: actualizar conexión (service_role + db password rotadas) y
   pegar `powersync/sync-streams.yaml`; prueba de campo con 3 técnicos (D28).
2. Fase 10: alerta de garantía vigente al crear pedido + cargo automático al
   cerrar OT.
3. Cablear fundaciones 1b–1f en UI/servicios (sucursal en alta de usuarios,
   `doc_number` al crear documentos, campana de notificaciones, cron de
   recordatorios).

## Agentes y skills (OpenCode)

En `.opencode/`: `rls-auditor`, `db-schema-reviewer`, `code-reviewer`,
`qa-tester`, `security-checklist` (los tres primeros solo lectura) y skills
`flujo-orden-trabajo`, `permisos-granulares`, `offline-powersync`,
`qr-equipo-seguridad`, `cuenta-corriente-garantias`, `gestion-usuarios-auth`,
`dashboard-rendimiento`, `checklist-seguridad`. Son la fuente operativa que
OpenCode sigue; si el plan cambia, actualizar el skill correspondiente.
