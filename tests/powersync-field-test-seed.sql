-- ════════════════════════════════════════════════════════════════
-- TEST DATA PARA POWER SYNC FIELD TEST
-- 2 empresas × 3 técnicos (2 en A, 1 en B)
-- Ejecutar en Supabase SQL Editor DESPUÉS de crear usuarios en Auth
-- ════════════════════════════════════════════════════════════════

-- ⚠️ REEMPLAZAR ESTOS UUIDs con los reales de auth.users
-- Obtener con: SELECT id, email FROM auth.users WHERE email LIKE '%tech%';
DO $$
DECLARE
    -- Empresas
    v_company_a uuid := '11111111-1111-1111-1111-111111111111'; -- REEMPLAZAR
    v_company_b uuid := '22222222-2222-2222-2222-222222222222'; -- REEMPLAZAR
    
    -- Técnicos (auth.users.id)
    v_tech_a1 uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'; -- techA1
    v_tech_a2 uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'; -- techA2
    v_tech_b1 uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'; -- techB1
    
    -- Perfiles (se crean automáticamente al hacer login, pero podemos pre-crear)
    v_profile_a1 uuid := v_tech_a1;
    v_profile_a2 uuid := v_tech_a2;
    v_profile_b1 uuid := v_tech_b1;
    
    -- Clientes
    v_client_a1 uuid;
    v_client_a2 uuid;
    v_client_b1 uuid;
    
    -- Direcciones
    v_addr_a1 uuid;
    v_addr_a2 uuid;
    v_addr_b1 uuid;
    
    -- Equipos
    v_eq_a1 uuid;
    v_eq_a2 uuid;
    v_eq_b1 uuid;
    
    -- Turnos
    v_appt_a1 uuid;
    v_appt_a2 uuid;
    v_appt_a3 uuid;
    v_appt_b1 uuid;
    
BEGIN
    RAISE NOTICE '=== INICIANDO SEED TEST DATA ===';
    RAISE NOTICE 'Empresa A: %', v_company_a;
    RAISE NOTICE 'Empresa B: %', v_company_b;
    
    -- ═══════════════════════════════════════════════════════
    -- 1. MEMBERSHIPS (si no existen)
    -- ═══════════════════════════════════════════════════════
    INSERT INTO memberships (user_id, company_id, role, status)
    VALUES 
        (v_tech_a1, v_company_a, 'technician', 'active'),
        (v_tech_a2, v_company_a, 'technician', 'active'),
        (v_tech_b1, v_company_b, 'technician', 'active')
    ON CONFLICT (user_id) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        role = EXCLUDED.role,
        status = EXCLUDED.status;
    RAISE NOTICE 'Memberships OK';
    
    -- ═══════════════════════════════════════════════════════
    -- 2. PERFILES (opcional, se crean en primer login)
    -- ═══════════════════════════════════════════════════════
    INSERT INTO profiles (id, full_name, username, internal_email, is_superuser, force_password_change)
    VALUES 
        (v_tech_a1, 'Técnico A1', 'techa1', 'techa1+coda@internal.app', false, false),
        (v_tech_a2, 'Técnico A2', 'techa2', 'techa2+coda@internal.app', false, false),
        (v_tech_b1, 'Técnico B1', 'techb1', 'techb1+codb@internal.app', false, false)
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        username = EXCLUDED.username,
        internal_email = EXCLUDED.internal_email;
    RAISE NOTICE 'Perfiles OK';
    
    -- ═══════════════════════════════════════════════════════
    -- 3. CLIENTES EMPRESA A
    -- ═══════════════════════════════════════════════════════
    INSERT INTO clients (company_id, name)
    VALUES (v_company_a, 'Cliente A1 - Edificio Norte')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_client_a1;
    
    IF v_client_a1 IS NULL THEN
        SELECT id INTO v_client_a1 FROM clients WHERE company_id = v_company_a AND name = 'Cliente A1 - Edificio Norte' LIMIT 1;
    END IF;
    
    INSERT INTO clients (company_id, name)
    VALUES (v_company_a, 'Cliente A2 - Casa Quinta')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_client_a2;
    
    IF v_client_a2 IS NULL THEN
        SELECT id INTO v_client_a2 FROM clients WHERE company_id = v_company_a AND name = 'Cliente A2 - Casa Quinta' LIMIT 1;
    END IF;
    
    -- Direcciones A1
    INSERT INTO client_addresses (client_id, label, address, is_primary)
    VALUES (v_client_a1, 'Oficina Central', 'Av. Corrientes 1234, CABA', true)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_addr_a1;
    
    IF v_addr_a1 IS NULL THEN
        SELECT id INTO v_addr_a1 FROM client_addresses WHERE client_id = v_client_a1 AND is_primary LIMIT 1;
    END IF;
    
    -- Direcciones A2
    INSERT INTO client_addresses (client_id, label, address, is_primary)
    VALUES (v_client_a2, 'Casa Principal', 'Calle Falsa 456, Tigre', true)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_addr_a2;
    
    IF v_addr_a2 IS NULL THEN
        SELECT id INTO v_addr_a2 FROM client_addresses WHERE client_id = v_client_a2 AND is_primary LIMIT 1;
    END IF;
    
    -- Contactos A1
    INSERT INTO client_contacts (client_id, name, phone, email, role)
    VALUES (v_client_a1, 'Juan Pérez', '+5491155551111', 'juan@clientea1.com', 'Encargado')
    ON CONFLICT DO NOTHING;
    
    INSERT INTO client_contacts (client_id, name, phone, email, role)
    VALUES (v_client_a2, 'María González', '+5491155552222', 'maria@clientea2.com', 'Dueña')
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Clientes Empresa A OK: %', v_client_a1;
    
    -- ═══════════════════════════════════════════════════════
    -- 4. CLIENTE EMPRESA B
    -- ═══════════════════════════════════════════════════════
    INSERT INTO clients (company_id, name)
    VALUES (v_company_b, 'Cliente B1 - Fábrica Sur')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_client_b1;
    
    IF v_client_b1 IS NULL THEN
        SELECT id INTO v_client_b1 FROM clients WHERE company_id = v_company_b AND name = 'Cliente B1 - Fábrica Sur' LIMIT 1;
    END IF;
    
    INSERT INTO client_addresses (client_id, label, address, is_primary)
    VALUES (v_client_b1, 'Planta Industrial', 'Ruta 2 Km 32, La Plata', true)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_addr_b1;
    
    IF v_addr_b1 IS NULL THEN
        SELECT id INTO v_addr_b1 FROM client_addresses WHERE client_id = v_client_b1 AND is_primary LIMIT 1;
    END IF;
    
    INSERT INTO client_contacts (client_id, name, phone, email, role)
    VALUES (v_client_b1, 'Carlos Ruiz', '+5491155553333', 'carlos@clienteb1.com', 'Jefe Mantenimiento')
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Cliente Empresa B OK: %', v_client_b1;
    
    -- ═══════════════════════════════════════════════════════
    -- 5. EQUIPOS
    -- ═══════════════════════════════════════════════════════
    -- Equipo A1 (Cliente A1)
    INSERT INTO equipment (company_id, client_id, address_id, equipment_type, brand, model, serial_number, btu, refrigerant_type, install_date, warranty_until, condition_status, location_label, qr_token)
    VALUES (v_company_a, v_client_a1, v_addr_a1, 'split', 'Daikin', 'FTXS35K', 'SN-A1-001', 12000, 'R32', '2024-01-15', '2026-01-15', 'activo', 'Oficina 1er piso - Sala reuniones', encode(gen_random_bytes(24), 'base64'))
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_eq_a1;
    
    IF v_eq_a1 IS NULL THEN
        SELECT id INTO v_eq_a1 FROM equipment WHERE company_id = v_company_a AND serial_number = 'SN-A1-001' LIMIT 1;
    END IF;
    
    -- Equipo A2 (Cliente A2)
    INSERT INTO equipment (company_id, client_id, address_id, equipment_type, brand, model, serial_number, btu, refrigerant_type, install_date, warranty_until, condition_status, location_label, qr_token)
    VALUES (v_company_a, v_client_a2, v_addr_a2, 'split', 'LG', 'S3-Q12JA3WA', 'SN-A2-002', 9000, 'R410A', '2023-11-20', '2025-11-20', 'activo', 'Dormitorio principal', encode(gen_random_bytes(24), 'base64'))
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_eq_a2;
    
    IF v_eq_a2 IS NULL THEN
        SELECT id INTO v_eq_a2 FROM equipment WHERE company_id = v_company_a AND serial_number = 'SN-A2-002' LIMIT 1;
    END IF;
    
    -- Equipo B1 (Cliente B1)
    INSERT INTO equipment (company_id, client_id, address_id, equipment_type, brand, model, serial_number, btu, refrigerant_type, install_date, warranty_until, condition_status, location_label, qr_token)
    VALUES (v_company_b, v_client_b1, v_addr_b1, 'cassette', 'Samsung', 'AC100RN4DKG', 'SN-B1-001', 36000, 'R32', '2024-03-10', '2027-03-10', 'activo', 'Nave producción - Sector A', encode(gen_random_bytes(24), 'base64'))
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_eq_b1;
    
    IF v_eq_b1 IS NULL THEN
        SELECT id INTO v_eq_b1 FROM equipment WHERE company_id = v_company_b AND serial_number = 'SN-B1-001' LIMIT 1;
    END IF;
    
    RAISE NOTICE 'Equipos OK: A1=%, A2=%, B1=%', v_eq_a1, v_eq_a2, v_eq_b1;
    
    -- ═══════════════════════════════════════════════════════
    -- 6. TURNOS (APPOINTMENTS) - con appointment_technicians
    -- ═══════════════════════════════════════════════════════
    -- Turno 1: techA1 - Equipo A1 - Mañana
    INSERT INTO appointments (company_id, client_id, equipment_id, appointment_type, scheduled_at, estimated_duration, status, notes, created_by, origin)
    VALUES (v_company_a, v_client_a1, v_eq_a1, 'mantenimiento', (CURRENT_DATE + INTERVAL '1 day') + TIME '09:00', 60, 'programado', 'Mantenimiento preventivo trimestral', v_tech_a1, 'llamada')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_appt_a1;
    
    IF v_appt_a1 IS NULL THEN
        SELECT id INTO v_appt_a1 FROM appointments WHERE company_id = v_company_a AND equipment_id = v_eq_a1 AND scheduled_at = (CURRENT_DATE + INTERVAL '1 day') + TIME '09:00' LIMIT 1;
    END IF;
    
    INSERT INTO appointment_technicians (appointment_id, technician_id)
    VALUES (v_appt_a1, v_tech_a1)
    ON CONFLICT DO NOTHING;
    
    -- Turno 2: techA1 - Equipo A2 - Tarde
    INSERT INTO appointments (company_id, client_id, equipment_id, appointment_type, scheduled_at, estimated_duration, status, notes, created_by, origin)
    VALUES (v_company_a, v_client_a2, v_eq_a2, 'reparacion', (CURRENT_DATE + INTERVAL '2 day') + TIME '14:00', 90, 'programado', 'Falla compresor - revisar', v_tech_a1, 'llamada')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_appt_a2;
    
    IF v_appt_a2 IS NULL THEN
        SELECT id INTO v_appt_a2 FROM appointments WHERE company_id = v_company_a AND equipment_id = v_eq_a2 AND scheduled_at = (CURRENT_DATE + INTERVAL '2 day') + TIME '14:00' LIMIT 1;
    END IF;
    
    INSERT INTO appointment_technicians (appointment_id, technician_id)
    VALUES (v_appt_a2, v_tech_a1)
    ON CONFLICT DO NOTHING;
    
    -- Turno 3: techA2 - Equipo A1 - Mañana
    INSERT INTO appointments (company_id, client_id, equipment_id, appointment_type, scheduled_at, estimated_duration, status, notes, created_by, origin)
    VALUES (v_company_a, v_client_a1, v_eq_a1, 'instalacion', (CURRENT_DATE + INTERVAL '3 day') + TIME '08:30', 120, 'programado', 'Instalación nueva unidad split', v_tech_a2, 'web')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_appt_a3;
    
    IF v_appt_a3 IS NULL THEN
        SELECT id INTO v_appt_a3 FROM appointments WHERE company_id = v_company_a AND equipment_id = v_eq_a1 AND scheduled_at = (CURRENT_DATE + INTERVAL '3 day') + TIME '08:30' LIMIT 1;
    END IF;
    
    INSERT INTO appointment_technicians (appointment_id, technician_id)
    VALUES (v_appt_a3, v_tech_a2)
    ON CONFLICT DO NOTHING;
    
    -- Turno 4: techB1 - Equipo B1 - Mañana
    INSERT INTO appointments (company_id, client_id, equipment_id, appointment_type, scheduled_at, estimated_duration, status, notes, created_by, origin)
    VALUES (v_company_b, v_client_b1, v_eq_b1, 'mantenimiento', (CURRENT_DATE + INTERVAL '1 day') + TIME '10:00', 120, 'programado', 'Mantenimiento cassette nave producción', v_tech_b1, 'email')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_appt_b1;
    
    IF v_appt_b1 IS NULL THEN
        SELECT id INTO v_appt_b1 FROM appointments WHERE company_id = v_company_b AND equipment_id = v_eq_b1 AND scheduled_at = (CURRENT_DATE + INTERVAL '1 day') + TIME '10:00' LIMIT 1;
    END IF;
    
    INSERT INTO appointment_technicians (appointment_id, technician_id)
    VALUES (v_appt_b1, v_tech_b1)
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Turnos OK: A1=%, A2=%, A3=%, B1=%', v_appt_a1, v_appt_a2, v_appt_a3, v_appt_b1;
    
    -- ═══════════════════════════════════════════════════════
    -- 7. VERIFICACIÓN FINAL
    -- ═══════════════════════════════════════════════════════
    RAISE NOTICE '';
    RAISE NOTICE '=== RESUMEN TEST DATA ===';
    RAISE NOTICE 'Empresa A: %', v_company_a;
    RAISE NOTICE '  Técnicos: techA1 (%), techA2 (%)', v_tech_a1, v_tech_a2;
    RAISE NOTICE '  Clientes: %, %', v_client_a1, v_client_a2;
    RAISE NOTICE '  Equipos: %, %', v_eq_a1, v_eq_a2;
    RAISE NOTICE '  Turnos techA1: %, %', v_appt_a1, v_appt_a2;
    RAISE NOTICE '  Turnos techA2: %', v_appt_a3;
    RAISE NOTICE '';
    RAISE NOTICE 'Empresa B: %', v_company_b;
    RAISE NOTICE '  Técnico: techB1 (%)', v_tech_b1;
    RAISE NOTICE '  Cliente: %', v_client_b1;
    RAISE NOTICE '  Equipo: %', v_eq_b1;
    RAISE NOTICE '  Turno techB1: %', v_appt_b1;
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ ANTES DE EJECUTAR: Reemplazar UUIDs de empresas y técnicos por los reales';
    RAISE NOTICE '   Obtener con: SELECT id, email FROM auth.users WHERE email LIKE ''%tech%'';';
    
END $$;