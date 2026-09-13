# Política Legal y Retención de Datos

## Aplicación de Gestión para Empresas de Aire Acondicionado

**Versión:** 1.0  
**Fecha:** 2026-09-13  
**Responsable:** Dueño de la empresa (Data Controller)

---

## 1. Datos Personales Recopilados

### Clientes
| Dato | Finalidad | Base Legal | Retención |
|------|-----------|------------|-----------|
| Nombre / Razón social | Identificación, facturación, contacto | Contrato / Interés legítimo | 10 años desde última operación (Art. 30 Ley 11.683 AR) |
| CUIT / DNI | Facturación AFIP, identificación fiscal | Obligación legal (AFIP) | 10 años |
| Teléfono / Email | Contacto operativo, notificaciones | Contrato / Consentimiento | 2 años sin actividad |
| Direcciones (N) | Geolocalización equipo, planificación visitas | Contrato | 2 años sin actividad |
| Contactos alternativos (N) | Gestión de visitas cuando titular no está | Contrato | 2 años sin actividad |

### Equipos
| Dato | Finalidad | Base Legal | Retención |
|------|-----------|------------|-----------|
| Marca, modelo, tipo, BTU, refrigerante | Especificaciones técnicas, diagnóstico | Contrato | Vida útil del equipo + 2 años |
| Número de serie | Identificación única, garantía fabricante | Contrato | Vida útil del equipo + 2 años |
| Fecha instalación, garantía | Cálculo garantía, alertas | Contrato | Vida útil del equipo + 2 años |
| QR token (192 bits) | Acceso público sin login, consultas | Interés legítimo | Vitalicia (inalterable) |
| Ubicación/etiqueta | Localización física en visita | Contrato | 2 años sin actividad |

### Órdenes de Trabajo / Visitas
| Dato | Finalidad | Base Legal | Retención |
|------|-----------|------------|-----------|
| Diagnóstico, falla encontrada | Historial técnico, garantía | Contrato | 10 años (garantía extendida) |
| Mediciones (presión, temp, amperaje) | Registro técnico, evidencia | Contrato | 5 años |
| Materiales utilizados | Control stock, facturación, costos | Contrato / Legal | 10 años |
| Firma digital (base64 PNG/JPEG) | Aceptación cliente, evidencia legal | Contrato | 10 años |
| Horas reales (inicio/fin) | Rendimiento técnico, facturación | Contrato | 5 años |
| Fotos (storage path) | Evidencia visual, diagnóstico | Contrato | 2 años |

### Cuenta Corriente
| Dato | Finalidad | Base Legal | Retención |
|------|-----------|------------|-----------|
| Cargos, pagos, aplicaciones | Contabilidad, AFIP, conciliación | Obligación legal (Ley 11.683) | 10 años |
| Recargos por mora | Cobranza, intereses | Contrato | 10 años |
| Estado de cuenta (PDF/Excel) | Entrega cliente, auditoría | Contrato | 5 años |

### Usuarios / Empleados
| Dato | Finalidad | Base Legal | Retención |
|------|-----------|------------|-----------|
| Nombre, username, email interno | Autenticación, auditoría | Contrato laboral | Duración empleo + 5 años |
| Hash contraseña (Supabase Auth) | Autenticación | Contrato laboral | Duración empleo + 2 años |
| Rol (owner/admin/technician) | Permisos, segregación de funciones | Contrato laboral | Duración empleo + 5 años |
| Logs de auditoría (acciones) | Trazabilidad, compliance | Interés legítimo | 5 años |

### Auditoría QR Público
| Dato | Finalidad | Base Legal | Retención |
|------|-----------|------------|-----------|
| IP hash, timestamp, acción | Prevención fuerza bruta, trazabilidad | Interés legítimo / Seguridad | 2 años |

---

## 2. Derechos del Titular (Ley 25.326 - Argentina)

| Derecho | Canal de ejercicio | Plazo respuesta |
|---------|-------------------|-----------------|
| Acceso | Solicitud por email a Dueño | 10 días hábiles |
| Rectificación | Solicitud por email / panel cliente | 5 días hábiles |
| Supresión (*) | Solicitud por email | 10 días hábiles |
| Oposición | Solicitud por email | 10 días hábiles |
| Portabilidad | Exportación CSV/PDF desde panel | Inmediato |

(*) Supresión sujeta a obligaciones legales de retención (AFIP, garantías, contabilidad).

---

## 3. Seguridad Técnica

- **Cifrado en tránsito:** TLS 1.2+ (HTTPS forzado)
- **Cifrado en reposo:** Supabase (AES-256 managed)
- **Aislamiento multi-tenant:** RLS (Row Level Security) en todas las tablas
- **Permisos granulares:** `role_permissions` por acción sensible (ver `permisos-granulares.md`)
- **Autenticación:** 3 factores (código empresa + usuario + contraseña) + email sintético
- **Session management:** `@supabase/ssr` con cookies httpOnly, secure, sameSite=lax
- **Headers seguridad:** CSP, X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy
- **Rate limiting:** Supabase Auth (login) + middleware proxy

---

## 4. Subprocesadores / Terceros

| Proveedor | Finalidad | Ubicación datos | DPA/SCC |
|-----------|-----------|-----------------|---------|
| Supabase (PostgreSQL) | Base de datos, Auth, Storage | Región elegida (us-west-2) | Sí (DPA estándar) |
| PowerSync (JourneyApps) | Sincronización offline SQLite | Mismo región que Supabase | Sí |
| Vercel (hosting) | Edge functions, static assets | Global (edge) | Sí |

---

## 5. Brecha de Seguridad (Data Breach)

1. **Detección:** Logs Supabase + auditoría interna
2. **Contención:** Revocar tokens, rotar claves, aislar tenant afectado
3. **Notificación:** A Autoridad de Control (AAIP Argentina) < 72hs si riesgo alto
4. **Comunicación:** A titulares afectados si riesgo alto para derechos
5. **Registro:** En `audit_logs` + incidente interno

---

## 6. Eliminación Automatizada

| Dato | Trigger | Acción |
|------|---------|--------|
| Consultas QR público (`qr_inquiries`) | > 2 años | `DELETE` batch mensual |
| Auditoría QR (`qr_access_audit`) | > 2 años | `DELETE` batch mensual |
| Sesiones expiradas (Supabase) | Automático | Supabase gestiona |
| Archivos Storage (`work_order_photos`) | > 2 años sin OT asociada | Revisión manual + `DELETE` |

---

## 7. Contacto

**Data Protection Officer (DPO):** Dueño de la empresa  
**Email:** (configurar en `.env.local`)  
**Domicilio legal:** (domicilio fiscal de la empresa)

---

*Este documento debe revisarse anualmente o ante cambios normativos.*