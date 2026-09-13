---
name: qr-equipo-seguridad
description: Reglas de seguridad y contenido de las dos vistas del QR por equipo (pública sin login, privada para técnico logueado), whitelist de campos permitidos, y el flujo de consultas externas y auditoría de accesos. Usar al implementar el endpoint/página del QR, la generación del token, o cualquier query que sirva datos de un equipo sin autenticación.
license: Proprietary
compatibility: opencode
metadata:
  project: aire-acondicionado
  fase: "4"
---

## Dos vistas, una sola fuente

- **Vista pública** (sin login, accedida por `qr_token`): se sirve desde una función/RPC de solo lectura que devuelve una **whitelist explícita** de campos. Nunca sirvas el registro completo de `equipment`/`work_orders` con algunos campos "ocultos a mano" en el frontend — un campo nuevo agregado a futuro por error quedaría expuesto si el filtro es una blacklist en vez de whitelist.
- **Vista técnico** (con login, mismo `qr_token` pero usuario autenticado de la empresa dueña del equipo): formulario completo de nueva visita, historial completo, toda la info.

## Whitelist exacta para la vista pública

Permitido:
- Marca, modelo, tipo de equipo, fecha de instalación.
- Historial de visitas: solo `visit_type` y fecha (ej. "10/09/26 — Instalación"). Nunca el detalle.
- Botón "Solicitar servicio" → crea un `service_request` nuevo con `origin = 'qr_publico'`.
- Formulario de observación/consulta (nombre + contacto + mensaje) → va a `qr_inquiries`.

Prohibido, nunca en la respuesta pública:
- Precios y costos de cualquier tipo (`quote.total`, `quote_items`, `work_order_materials.unit_cost`, cualquier campo de `account_charges`/`payments`).
- Teléfono, email o cualquier dato de contacto del cliente.
- Dirección completa (a lo sumo localidad/barrio, si el negocio lo pide explícitamente — por defecto, ni eso).
- `diagnosis_notes`, `measurements`, `fault_found` — el diagnóstico técnico detallado es información interna.
- Cualquier dato de otro cliente, otro equipo o otra empresa.

## Consultas externas (alguien sin cuenta o de otra empresa)

Al escanear sin sesión (o con sesión de otra empresa — igual se trata como visitante externo respecto a este equipo):
- Puede ver la vista pública.
- Puede dejar una consulta: nombre + teléfono/email (obligatorios) + mensaje → `qr_inquiries`, estado inicial `nuevo`.
- Visible para Dueño y Administrativo de la empresa dueña del equipo — nunca para el visitante ni para otras empresas.
- No obtiene ningún acceso al sistema interno; esto no crea una cuenta ni una sesión.

## Edición del historial (con login)

Cualquier técnico de la empresa que visitó el equipo puede agregar una `work_order` nueva — no está restringido al técnico originalmente asignado al turno (coherente con `flujo-orden-trabajo`). El historial es **acumulativo**, nunca se pisa ni se edita una entrada previa una vez guardada — si hubo un error, se agrega una entrada de corrección, no se modifica la original (esto también facilita la auditoría).

## Auditoría obligatoria (`qr_access_audit`)

Registrar, para cada acceso al QR:
- `actor_type`: usuario logueado / anónimo.
- `user_id`: si aplica.
- `action`: view / edit_attempt / edit_success / login_fail.
- `ip_hash`, `created_at`.

Esto incluye intentos fallidos de acceder a la vista privada sin las credenciales correctas — no solo los accesos exitosos.

## Errores comunes a evitar

- Servir el registro completo de `equipment` y ocultar campos en el componente de frontend (blacklist implícita) en vez de una función/RPC con whitelist explícita en el backend.
- Permitir que la vista pública muestre el detalle de una `work_order` en vez de solo tipo+fecha.
- No auditar los intentos fallidos de login/edición, solo los exitosos.
- Restringir la carga de una `work_order` nueva solo al técnico originalmente asignado.
