# Estrategia de Backups y Recuperación (Phase 3)

## Resumen

Este documento define la estrategia de backup y disaster recovery para ClimaGest en producción.

---

## 1. Backups de Supabase (PostgreSQL)

### Automáticos (gestionados por Supabase)
- **Point-in-Time Recovery (PITR)**: Habilitado por defecto en proyectos Pro/Enterprise. Permite restaurar a cualquier segundo de los últimos 7-30 días.
- **Backups diarios completos**: Retención 7 días (plan Pro) / 30 días (Enterprise).
- **WAL archiving**: Continuo, para PITR.

### Configuración recomendada
```bash
# En Supabase Dashboard → Database → Backups:
# - PITR: ON
# - Backup frequency: Daily
# - Retention: 30 días (plan Enterprise)
```

### Restore procedure
1. Supabase Dashboard → Database → Backups → "Restore"
2. Seleccionar timestamp objetivo
3. Nueva base de datos se crea como `restored_<timestamp>`
4. Verificar datos → Renombrar/Intercambiar connection strings

---

## 2. Backups de Storage (archivos PDF, fotos, firmas)

### Supabase Storage
- **Bucket versioning**: Habilitado en buckets críticos (`pdfs`, `work-order-photos`, `signatures`)
- **Cross-region replication**: Configurar a región secundaria (ej. `sa-east-1` → `us-east-1`)

### Manual (semanal)
```bash
# Descargar bucket completo
supabase storage cp -r s3://bucket-name ./local-backup/storage-$(date +%Y%m%d)
# Subir a S3/GCS propio con retención 90 días
aws s3 sync ./local-backup s3://mi-backup-bucket/climagest/storage/
```

---

## 3. Backups de Configuración y Código

### Git (GitHub)
- **Main branch**: Protegida, requería PR + CI pass
- **Tags de release**: `v1.0.0`, `v1.1.0`, etc. → deploy automático a Vercel
- **Backup de repositorio**: GitHub tiene redundancia interna; opcional mirror a GitLab/Bitbucket

### Variables de entorno
- **Vercel**: Environment Variables en proyecto (encrypted at rest)
- **Backup manual**: Exportar `.env.production` (sin secrets rotativos) a 1Password / Bitwarden
- **Rotación**: Secrets (service_role, db password) rotados cada 90 días → actualizar en Vercel + Supabase + PowerSync Cloud

---

## 4. PowerSync Cloud

### Configuración
- **Sync Rules**: `powersync/sync-streams.yaml` versionado en repo
- **Credenciales**: Service Role Key + DB Password en PowerSync Dashboard
- **Backup**: Exportar configuración (JSON) desde Dashboard → guardar en repo `/docs/powersync-config-<fecha>.json`

### Recovery
1. Nuevo proyecto PowerSync → pegar Sync Rules
2. Configurar conexión Supabase (nuevas credenciales si rotaron)
3. Deploy → probar con 2-3 usuarios técnicos

---

## 5. Runbooks de Recuperación

### Escenario A: Corrupción de datos puntual (ej. DELETE masivo accidental)
1. Identificar timestamp previo al incidente
2. Supabase PITR → restaurar a `restored_<ts>`
3. Exportar tablas afectadas (`COPY TO` o `pg_dump -t`)
4. Importar en producción (`COPY FROM` o `pg_restore`)
5. Verificar integridad referencial

### Escenario B: Caída total de región Supabase
1. Verificar status.supabase.com
2. Si confirmado: activar DR plan
3. Restaurar último backup en región alternativa
4. Actualizar DNS / Vercel env vars (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_DB_URL`)
5. Reconfigurar PowerSync Cloud con nueva URL
6. Comunicar a usuarios (downtime estimado: 30-60 min)

### Escenario C: Compromiso de credenciales (service_role, JWT secret)
1. Rotar inmediatamente en Supabase Dashboard
2. Actualizar Vercel Environment Variables
3. Rotar en PowerSync Cloud
4. Invalidar todas las sesiones: `supabase auth admin logout --all` (via CLI)
5. Auditar `audit_logs` y `error_logs` para acceso anómalo

---

## 6. Métricas y Alertas (Observabilidad)

### Alertas críticas (PagerDuty / OpsGenie / Slack webhook)
| Métrica | Umbral | Acción |
|---|---|---|
| Error rate > 5% / 5min | `error_logs` count | Alert on-call |
| Cron job `daily_reminders` status = error | `job_runs` | Alert on-call |
| PowerSync sync lag > 10 min | `powersync_sync_logs` | Alert dev |
| Storage usage > 80% | Supabase metric | Plan capacity |
| DB connections > 80% pool | Supabase metric | Scale pooler |

### Dashboards (Grafana / Supabase built-in)
- Request latency (p50, p95, p99)
- Error rate by route
- Active users / company
- Sync success rate (PowerSync)

---

## 7. Testing de Recovery (Game Days)

### Frecuencia: Trimestral
1. **Backup restore test**: Restaurar backup de ayer en staging → validar 10 queries críticas
2. **PITR drill**: Restaurar a punto específico → verificar integridad
3. **Credential rotation drill**: Rotar service_role en staging → deploy → smoke test
4. **PowerSync re-sync**: Desconectar 1 técnico offline 24h → reconectar → verificar sync

### Checklist post-drill
- [ ] Tiempo de recuperación (RTO) < 30 min
- [ ] Pérdida de datos (RPO) < 1 hora
- [ ] Documentación actualizada
- [ ] Runbook mejorado

---

## 8. Retención Legal (Argentina)

| Tipo de dato | Retención mínima | Base legal |
|---|---|---|
| Facturas / comprobantes | 10 años | RG AFIP |
| Libro IVA / ventas | 10 años | RG AFIP |
| Contratos / presupuestos firmados | 10 años | CCyC Art. 2560 |
| Datos personales (clientes) | Mientras dure la relación + 2 años | Ley 25.326 |
| Logs de auditoría | 3 años | Buena práctica / compliance |
| Fotos / firmas OT | 10 años | Comprobante de trabajo |

> **Nota**: El soft delete (`deleted_at`) NO sustituye retención legal. Los registros marcados como borrados deben persistir en backups por el período legal.

---

## 9. Contactos de Emergencia

| Rol | Nombre | Contacto |
|---|---|---|
| Tech Lead | — | — |
| DBA / Supabase Admin | — | — |
| Vercel Account Owner | — | — |
| PowerSync Support | support@powersync.com | Enterprise Slack |

---

*Documento vivo — actualizar tras cada Game Day o cambio de arquitectura.*