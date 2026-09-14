# PowerSync Field Test - Quick Reference

## Antes de ejecutar el seed

```bash
# 1. Obtener UUIDs reales de Auth
# En Supabase Dashboard → Authentication → Users
# Copiar los 3 IDs de: techA1, techA2, techB1
```

```sql
-- 2. Obtener company_id reales
SELECT id, company_code FROM companies WHERE status = 'active';
```

## Editar el seed

Reemplazar en `tests/powersync-field-test-seed.sql`:

```sql
-- EMPRESAS (usar los UUIDs reales de tu DB)
v_company_a uuid := 'TU_UUID_EMPRESA_A';
v_company_b uuid := 'TU_UUID_EMPRESA_B';

-- TÉCNICOS (usar auth.users.id reales)
v_tech_a1 uuid := 'UUID_DE_TECH_A1_DE_AUTH';
v_tech_a2 uuid := 'UUID_DE_TECH_A2_DE_AUTH';
v_tech_b1 uuid := 'UUID_DE_TECH_B1_DE_AUTH';
```

## Ejecutar

```bash
# En Supabase SQL Editor → pegar todo el contenido → Run
# Verificar en Logs: "=== RESUMEN TEST DATA ==="
```

## Verificación post-seed

```sql
-- Verificar aislamiento: techA1 ve 2 turnos, techA2 ve 1, techB1 ve 1
SELECT 
    at.technician_id,
    COUNT(a.id) as turnos,
    COUNT(DISTINCT a.client_id) as clientes,
    COUNT(DISTINCT a.equipment_id) as equipos
FROM appointments a
JOIN appointment_technicians at ON at.appointment_id = a.id
GROUP BY at.technician_id;
```

**Resultado esperado:**
| technician_id | turnos | clientes | equipos |
|--------------|--------|----------|---------|
| techA1       | 2      | 2        | 2       |
| techA2       | 1      | 1        | 1       |
| techB1       | 1      | 1        | 1       |

## Test en app (3 celulares)

| Celular | Login | Debe ver | NO debe ver |
|---------|-------|----------|-------------|
| 1 | techA1+CODA | 2 turnos, 2 clientes, 2 equipos | Turnos techA2, datos Empresa B |
| 2 | techA2+CODA | 1 turno, 1 cliente, 1 equipo | Turnos techA1, datos Empresa B |
| 3 | techB1+CODB | 1 turno, 1 cliente, 1 equipo | Todos datos Empresa A |

## Test Offline

1. Celular 1 (techA1) → Modo avión
2. Entrar a turno → Iniciar → Completar → Finalizar
3. Badge "Sync pending" ✅
4. Quitar modo avión → esperar 10s
4. Verificar en Supabase:
```sql
SELECT * FROM work_orders WHERE created_by = 'UUID_TECH_A1' ORDER BY created_at DESC LIMIT 1;
```

## Cleanup (opcional)

```sql
-- Borrar datos de test
DELETE FROM appointment_technicians WHERE appointment_id IN (SELECT id FROM appointments WHERE company_id IN (v_company_a, v_company_b));
DELETE FROM appointments WHERE company_id IN (v_company_a, v_company_b);
DELETE FROM equipment WHERE company_id IN (v_company_a, v_company_b);
DELETE FROM client_contacts WHERE client_id IN (SELECT id FROM clients WHERE company_id IN (v_company_a, v_company_b));
DELETE FROM client_addresses WHERE client_id IN (SELECT id FROM clients WHERE company_id IN (v_company_a, v_company_b));
DELETE FROM clients WHERE company_id IN (v_company_a, v_company_b);
DELETE FROM memberships WHERE user_id IN (v_tech_a1, v_tech_a2, v_tech_b1);
```