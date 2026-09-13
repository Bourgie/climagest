---
name: cuenta-corriente-garantias
description: Reglas de cuenta corriente (cargos, pagos parciales con aplicación manual, recargo por mora opcional, estado de cuenta) y del sistema de garantías por trabajo con alerta de reingreso. Usar al implementar cualquier módulo de pagos, cargos, estado de cuenta o garantías.
license: Proprietary
compatibility: opencode
metadata:
  project: aire-acondicionado
  fase: "9,10"
---

## Cuenta corriente

- `account_charges`: un cargo pendiente, típicamente generado al finalizar una `work_order` (por el total del `quote` asociado, o un monto manual si no hubo presupuesto).
- `payments`: un pago registrado por el cliente — método (efectivo/transferencia/débito/crédito/mercadopago/otro), monto, fecha, quién lo registró.
- `payment_applications`: la aplicación de un pago a uno o más cargos específicos.

## Regla de aplicación de pagos — manual, siempre

Un pago parcial **nunca se aplica automáticamente** a la deuda más antigua. El usuario (Administrativo o Dueño) elige explícitamente a qué `account_charge`(s) se aplica cada `payment`, pudiendo repartir un mismo pago entre varios cargos via `payment_applications`. No implementes lógica de "FIFO" ni de aplicación automática aunque parezca más simple — es una decisión de producto explícita, no un descuido.

## Recargo por mora — nunca automático

`account_charges.late_fee_applied` y `late_fee_amount` se cargan manualmente por el Dueño, caso por caso, sobre un cargo vencido. No calcules un recargo automático por días de atraso ni lo apliques sin una acción explícita del Dueño — cada cliente puede merecer un trato distinto y eso lo decide el negocio, no el sistema.

## Estado de cuenta

Vista tipo libro mayor (Debe/Haber/Saldo) sobre `account_charges` + `payments` de un cliente, ordenada cronológicamente. Debe ser exportable (Excel/PDF) para enviar al cliente — reutilizar el generador de PDF ya definido para presupuestos.

## Garantías

- `work_orders.warranty_days` y `warranty_until` (calculado).
- Al crear un `service_request` nuevo sobre el mismo `equipment_id`, verificar si existe una `work_order` previa con `warranty_until >= hoy` y mostrar una alerta — no bloquear, solo informar antes de presupuestar de nuevo (evita cobrar mano de obra que debería estar cubierta).
- La garantía es por trabajo realizado (`work_order`), distinta de `equipment.warranty_until` que es la garantía del equipo en sí (del fabricante/instalación original) — no confundir ambos campos.

## Errores comunes a evitar

- Aplicar pagos automáticamente a la deuda más vieja.
- Calcular o aplicar recargos por mora sin acción explícita del Dueño.
- Confundir garantía del equipo (`equipment.warranty_until`) con garantía del trabajo (`work_orders.warranty_until`).
- No alertar sobre garantía vigente antes de generar un nuevo presupuesto sobre el mismo equipo.
