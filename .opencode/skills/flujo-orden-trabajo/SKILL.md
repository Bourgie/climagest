---
name: flujo-orden-trabajo
description: Máquina de estados completa del flujo operativo — service_requests, quotes, appointments, work_orders — y las reglas de negocio de cada transición, incluida la garantía y el registro de horas reales. Usar al implementar o modificar cualquier lógica que cree, actualice o cierre un pedido, presupuesto, turno u orden de trabajo.
license: Proprietary
compatibility: opencode
metadata:
  project: aire-acondicionado
  fase: "5,6,7,10"
---

## Las 4 entidades del flujo y su rol

1. **service_request** (Pedido) — por qué se inicia todo. Origen: llamada, whatsapp, qr_publico, presencial. Estados: recibido → presupuestado → agendado → en_curso → resuelto / cancelado.
2. **quote** (Presupuesto) — cuánto cuesta. Con líneas en `quote_items` (mano_obra/material/repuesto). Estados: draft → enviado → aceptado / rechazado / vencido.
3. **appointment** (Turno) — cuándo se hace. Puede tener varios técnicos (`appointment_technicians`).
4. **work_order** (Orden de Trabajo) — qué se hizo realmente. Es el registro que también alimenta el historial del QR.

## Reglas de transición

- Un `service_request` puede pasar directo a `appointment` sin presupuesto previo (ej. urgencia simple) — el presupuesto no es obligatorio en el flujo, es condicional.
- Un `quote` se acepta o rechaza de dos formas: por el cliente vía `quote_acceptance_tokens` (link público, sin cuenta) o manualmente por un usuario interno. Ambas vías deben registrar `accepted_at` y quedar en `audit_logs`.
- Al aceptar un presupuesto, el sistema **sugiere** crear el `appointment` correspondiente — no lo crea automáticamente. El Administrativo confirma la fecha real con el cliente.
- `work_order.actual_start_at` se graba cuando el técnico inicia la visita (no cuando se creó el registro); `actual_end_at` cuando la finaliza. De ahí sale el cálculo de horas trabajadas para el dashboard de rendimiento — no uses `created_at`/`updated_at` para eso.
- El formulario técnico estructurado de `work_order.measurements` (presión baja/alta, temperaturas, amperaje, tensión, superheat, subcooling) es **siempre opcional**. No lo marques NOT NULL ni fuerces su llenado en el formulario — una visita de limpieza simple no lo necesita.
- Al finalizar una `work_order`, se puede generar un `account_charge` automáticamente por el total del `quote` asociado, o por un monto manual si no hubo presupuesto previo.
- **Garantía**: cada `work_order` puede tener `warranty_days`. Al crear un `service_request` nuevo sobre el mismo `equipment_id`, antes de continuar el flujo hay que chequear si existe una `work_order` previa con garantía vigente (`warranty_until >= hoy`) y mostrar una alerta al Administrativo/Dueño — no bloquear la creación, solo advertir.
- Cualquier técnico que visitó un equipo puede agregar una `work_order` nueva sobre ese equipo, no solo el técnico asignado al turno original (coherente con el skill `qr-equipo-seguridad`).

## Errores comunes a evitar

- Confundir `created_at` con el momento real de inicio/fin de la visita — son conceptos distintos y ambos importan (uno es auditoría, el otro es para medir horas trabajadas).
- Forzar el llenado del formulario técnico estructurado en visitas que no lo necesitan.
- Generar el `appointment` automáticamente al aceptar un presupuesto sin confirmación humana de fecha.
- Bloquear la creación de un `service_request` por garantía vigente en vez de solo alertar — es información para decidir, no una restricción dura.
