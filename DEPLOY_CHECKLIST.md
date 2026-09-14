# ✅ Checklist de Deploy a Producción — ClimaGest

**Versión:** 1.0 (todas las Fases 0–3 completadas)
**Fecha:** 2026-09-14
**Migraciones aplicadas:** 0001–0031 (31 migraciones)
**Tests:** 13 unit + 57 integration passing
**Build:** ✅ TypeScript + Next.js 16

---

## 1. Infraestructura Supabase

- [ ] **Proyecto Supabase creado** (plan Pro/Enterprise para PITR + 30d retention)
- [ ] **PITR habilitado** (Database → Backups → Point-in-Time Recovery: ON)
- [ ] **Connection pooler IPv4** configurado (Host: `aws-0-<region>.pooler.supabase.com`, Port: 6543, User: `postgres.<ref>`)
- [ ] **RLS activado** en todas las tablas de negocio (31 tablas, ver `0001–0031`)
- [ ] **Storage buckets** creados: `work-order-photos`, `signatures`, `pdfs` (versioning ON)
- [ ] **CORS** configurado para `NEXT_PUBLIC_APP_URL` (Auth → URL Configuration)

---

## 2. Variables de Entorno (Vercel)

Copiar `.env.example` → `.env.local` → agregar a Vercel (Environment Variables):

| Variable | Requerida | Dónde |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Vercel + `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Vercel + `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **Solo Vercel (Secret)** |
| `NEXT_PUBLIC_POWER_SYNC_URL` | ✅ | Vercel + `.env.local` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Vercel + `.env.local` |
| `CRON_SECRET` | ✅ | **Solo Vercel (Secret)** — generar: `openssl rand -hex 32` |
| `SUPABASE_DB_URL` | Solo migraciones | Local / CI (no en runtime) |
| `SEED_SUPERUSER_PASSWORD` | Solo dev | Local (no en prod) |
| `SEED_DEMO_PASSWORD` | Solo dev | Local (no en prod) |

---

## 3. PowerSync Cloud (Fase 8 — Offline)

- [ ] **Instancia PowerSync creada** (mismo region que Supabase)
- [ ] **Conexión Supabase configurada** con `service_role` + `db_password` (rotadas 10-sep-2026)
- [ ] **Sync Streams deployados** — pegar contenido de `powersync/sync-streams.yaml` en Dashboard → Sync Streams → Deploy
- [ ] **Prueba de campo** (criterio de cierre Fase 8):
  - 2 técnicos de la misma empresa + 1 de otra empresa
  - Verificar aislamiento: nadie recibe datos ajenos
  - Verificar upload fotos/firma offline → online sync

---

## 4. Superusuario y Primera Empresa

```bash
# Local (con .env.local real):
node --env-file=.env.local scripts/apply-pending-migrations.mjs
node --env-file=.env.local scripts/seed-dev.mjs
```

- [ ] **Superadmin login** → `/superadmin/login`
  - Email: `superadmin@internal.app`
  - Password: `SEED_SUPERUSER_PASSWORD` (o `SuperAdmin123!`)
- [ ] **Crear empresa real** desde `/superadmin`
  - Nombre, `company_code` único, plan (basico/profesional/premium)
  - Activar módulos según plan
- [ ] **Crear Dueño** de la empresa (desde `/config/usuarios` o panel superadmin)
  - Dueño configura permisos en `/config/permisos`
  - Dueño completa `/config` → Company Settings (logo, CUIT, condiciones IVA, términos de presupuesto, garantía default, etc.)

---

## 5. Verificaciones de Seguridad (25 puntos)

| # | Check | Estado | Cómo verificar |
|---|---|---|---|
| 1 | Claves en .env, no hardcodeadas | ✅ | `grep -r "supabase" src/ --include="*.ts" | grep -v "process.env"` |
| 2 | `.gitignore` excluye `.env.local` | ✅ | `cat .gitignore \| grep env.local` |
| 3 | Anon key en frontend, service_role solo server | ✅ | `src/lib/supabase/client.ts` vs `admin.ts` |
| 4 | RLS en todas las tablas | ✅ | Migraciones 0001–0031 |
| 5 | Cifrado infra Supabase + HTTPS | ✅ | Supabase managed |
| 6 | Auth validada en Server Actions | ✅ | `requireUser()` / `requireSuperuser()` en todas |
| 7 | RLS + `role_permissions` (2 capas) | ✅ | `hasPermission()` en cada action sensible |
| 8 | `company_id` derivado de sesión, no del body | ✅ | Servicios usan `user.companyId` |
| 9 | Cookies httpOnly/secure/sameSite | ✅ | `@supabase/ssr` en `proxy.ts` |
| 10 | Hash contraseñas (Supabase Auth) | ✅ | No reimplementado |
| 11 | Rate limit login (Supabase Auth) | ✅ | Configurado en Supabase Dashboard |
| 12 | Captcha si bots detectados | ⚠️ | Pendiente: agregar si se detectan ataques |
| 13 | Monitoreo queries (Supabase Dashboard) | ✅ | Query Performance habilitado |
| 14 | Validación Zod en todo input | ✅ | Schemas en cada Server Action |
| 15 | Sin `dangerouslySetInnerHTML` | ✅ | Revisar componentes |
| 16 | Validación archivos (tamaño/MIME/ext) | ⚠️ | Pendiente: endpoint upload fotos OT |
| 17 | Paginación server-side en listados | ✅ | `.limit()` + cursor/offset en queries |
| 18 | Headers seguridad (CSP, X-Frame, HSTS) | ✅ | `proxy.ts` + `next.config.ts` |
| 19 | Solo HTTPS (links `wa.me` con https) | ✅ | Revisar templates |
| 20 | `npm audit` / Dependabot en CI | ⚠️ | Configurar GitHub Actions |
| 21 | Retención datos personales documentada | ✅ | `docs/backups-recovery.md` §8 |
| 22 | Índices críticos + pooler | ✅ | Migraciones + pooler IPv4 |
| 23 | **QR público: whitelist explícita** | ✅ | `get_equipment_public` RPC (solo brand/model/type/install_date/history) |
| 24 | **Permisos granulares en Server Actions** | ✅ | `hasPermission()` antes de delete/costos/pagos |
| 25 | **PowerSync Sync Rules = RLS scope** | ⚠️ | **Pendiente test de campo** (ver §3) |

---

## 6. Tests y Calidad

```bash
npm run typecheck    # ✅ 0 errores
npm run build        # ✅ 27 rutas compiladas
npm run test         # ✅ 13 unit tests
npm run test:integration  # ✅ 57 integration tests (aislamiento, flujo, permisos)
```

---

## 7. Documentación Entregada

- `README.md` — Estado, accesos, estructura, pendientes
- `docs/decisiones-arquitectura.md` — D1–D32 (todas las decisiones técnicas)
- `docs/backups-recovery.md` — Estrategia completa (PITR, runbooks, retención legal AR)
- `POWERSYNC_DEPLOY.md` — Guía paso a paso PowerSync Cloud
- `LEGAL.md` — Retención de datos, compliance Argentina
- `supabase/migrations/0001–0031` — Esquema completo versionado

---

## 8. Go/No-Go para Deploy

| Criterio | Estado |
|---|---|
| Migraciones aplicadas en prod | ⬜ (ejecutar `apply-pending-migrations.mjs` contra prod DB) |
| Variables Vercel configuradas | ⬜ |
| PowerSync Cloud conectado + Sync Streams | ⬜ |
| Superadmin crea empresa real | ⬜ |
| Dueño configura company_settings | ⬜ |
| Test de campo PowerSync (3 técnicos) | ⬜ |
| `npm audit` clean / Dependabot ON | ⚠️ Configurar CI |
| Subida fotos/firma OT validada | ⚠️ Implementar endpoint `/api/work-orders/[id]/photos` |
| Captcha login si necesario | ⚠️ Evaluar tras 1 semana |

---

## 9. Post-Deploy (Día 1)

1. Monitorear `error_logs` + `request_logs` (Supabase Dashboard)
2. Verificar `job_runs` → cron `daily_reminders` ejecutó OK
3. Probar flujo completo: Pedido → Presupuesto → Turno → OT → Cobro → Garantía
4. Verificar PDF presupuesto con logo/CUIT/condiciones de la empresa real
5. Confirmar notificaciones llegan (turnos, pagos vencidos, QR, garantías)

---

## 10. Contactos de Escalación

| Área | Contacto |
|---|---|
| Supabase (DB/Auth/Storage) | Dashboard → Support |
| PowerSync (sync offline) | `support@powersync.com` / Enterprise Slack |
| Vercel (deploy/edge) | Dashboard → Support |
| Seguridad (incidente) | Rotar claves inmediata + `supabase auth admin logout --all` |

---

**Firmado:** _________________ **Fecha:** _________________