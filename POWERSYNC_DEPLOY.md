# PowerSync Cloud Deploy Guide

## Prerrequisitos

1. **Credenciales Supabase rotadas** (10-sep-2026):
   - Service Role Key (nueva)
   - Database Password (nueva)
   - Project Ref: `jnbcnhdalkbazoapatoo`
   - Region: `us-west-2`

2. **Cuenta PowerSync Cloud** activa

---

## Paso 1: Actualizar conexión Supabase en PowerSync Cloud

1. Entrar a [console.powersync.com](https://console.powersync.com)
2. Seleccionar tu proyecto / instancia
3. Ir a **Settings → Data Source**
4. Actualizar:
   ```
   Host: aws-0-us-west-2.pooler.supabase.com
   Port: 6543
   Database: postgres
   User: postgres.jnbcnhdalkbazoapatoo
   Password: [NUEVA_DB_PASSWORD]
   ```
5. **Test Connection** → debe dar verde
6. **Save**

> ⚠️ Sin esto, la replicación (CDC) queda cortada y no llegan cambios a los clientes offline.

---

## Paso 2: Configurar Auth (Supabase JWT)

1. En la misma instancia → **Settings → Auth**
2. **Provider**: Supabase Auth
3. **JWKS URL**: `https://jnbcnhdalkbazoapatoo.supabase.co/auth/v1/.well-known/jwks.json`
4. **Audience**: `supabase`
5. **Issuer**: `https://jnbcnhdalkbazoapatoo.supabase.co/auth/v1`
6. **Save**

> Esto permite que los JWT del login de 3 factores validen `auth.user_id()` en los Sync Streams.

---

## Paso 3: Deploy Sync Streams

### Opción A: Dashboard (recomendado)

1. Ir a **Sync Streams** en el dashboard
2. Click **New Stream Set** / **Edit**
3. Pegar el contenido completo de `powersync/sync-streams.yaml`
4. Click **Validate** → debe pasar sin errores
5. Click **Deploy**

### Opción B: CLI

```bash
npm i -g @powersync/cli
powersync login
powersync deploy ./powersync/sync-streams.yaml
```

---

## Paso 4: Verificar deploy

1. En **Sync Streams**, cada stream debe mostrar:
   - Status: `Active`
   - Subscribers: `0` (hasta que técnicos logueen)
   - Last synced: `never` (inicial)

2. Revisar logs: **Logs → Replication** → debe mostrar "CDC started" sin errores

---

## Paso 5: Test de campo (Criterio de cierre Fase 8)

### Setup
- 2 técnicos de **Empresa A** (`techA1`, `techA2`)
- 1 técnico de **Empresa B** (`techB1`)
- Cada uno con app instalada (PWA) y logueado

### Verificaciones

| Técnico | Debe ver | NO debe ver |
|---------|----------|-------------|
| `techA1` | Sus turnos, clientes/equipos de sus turnos, sus OTs | Turnos de `techA2`, datos Empresa B |
| `techA2` | Sus turnos, clientes/equipos de sus turnos, sus OTs | Turnos de `techA1`, datos Empresa B |
| `techB1` | Sus turnos, clientes/equipos de sus turnos, sus OTs | Todos datos Empresa A |

### Test offline
1. Desconectar red en celular
2. Crear OT nueva → queda en cola local
3. Reconectar → sync automático en < 5s
4. Verificar en Supabase: OT creada con `created_by = techA1.id`

---

## Troubleshooting

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| "CDC connection failed" | Credenciales viejas | Paso 1 |
| "JWT validation failed" | Auth mal configurado | Paso 2 |
| Stream "validation error" | YAML syntax / columnas | Verificar `powersync/sync-streams.yaml` vs `src/lib/powersync/schema.ts` |
| Técnico ve datos ajenos | `auth.user_id()` mismatch | Verificar que `memberships.user_id = auth.users.id` |
| Sync no inicia | `auto_subscribe: false` | Poner `true` en streams |

---

## Archivos de referencia

- `powersync/sync-streams.yaml` — 7 streams definidos
- `src/lib/powersync/schema.ts` — AppSchema local (7 tablas)
- `src/app/api/powersync/upload/route.ts` — Endpoint subida cola offline
- `docs/decisiones-arquitectura.md` — D25 a D28

---

## Checklist post-deploy

- [ ] Conexión Supabase actualizada
- [ ] Auth (JWKS) configurado
- [ ] Sync Streams deployed sin errores
- [ ] Replicación CDC activa (logs)
- [ ] Test de campo: 3 técnicos, 2 empresas → aislamiento OK
- [ ] Test offline → cola sube al reconectar
- [ ] Documentado en `docs/decisiones-arquitectura.md` (D28)