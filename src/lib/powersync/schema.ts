import { column, Schema, Table } from "@powersync/web";

/**
 * Esquema de la base local SQLite del técnico (PowerSync).
 *
 * Alcance acotado al flujo de campo (skill offline-powersync): turnos del
 * técnico, clientes/equipos relacionados y las órdenes que carga. Nada de
 * dashboard, cuenta corriente ni administración.
 *
 * Nota: `appointment_technicians` NO se sincroniza como tabla. Es una tabla
 * N:N con PK compuesta y PowerSync exige PK `id` de texto; el filtro por
 * técnico se hace server-side en los Sync Streams (JOIN), y localmente solo
 * llegan los turnos ya asignados al técnico.
 */
export const AppSchema = new Schema({
  appointments: new Table({
    id: column.text,
    company_id: column.text,
    branch_id: column.text,
    client_id: column.text,
    equipment_id: column.text,
    scheduled_at: column.text,
    status: column.text,
    notes: column.text,
    created_at: column.text,
  }),
  clients: new Table({
    id: column.text,
    company_id: column.text,
    name: column.text,
  }),
  client_addresses: new Table({
    id: column.text,
    client_id: column.text,
    label: column.text,
    address: column.text,
    is_primary: column.integer,
  }),
  equipment: new Table({
    id: column.text,
    company_id: column.text,
    client_id: column.text,
    address_id: column.text,
    equipment_type: column.text,
    brand: column.text,
    model: column.text,
    serial_number: column.text,
    qr_token: column.text,
    location_label: column.text,
  }),
  work_orders: new Table({
    id: column.text,
    company_id: column.text,
    equipment_id: column.text,
    created_by: column.text,
    visit_type: column.text,
    diagnosis_notes: column.text,
    measurements: column.text,
    fault_found: column.text,
    fault_type_id: column.text,
    actual_start_at: column.text,
    actual_end_at: column.text,
    signature_image: column.text,
    status: column.text,
    warranty_days: column.integer,
    warranty_until: column.text,
    doc_number: column.integer,
    created_at: column.text,
  }),
  work_order_materials: new Table({
    id: column.text,
    work_order_id: column.text,
    description: column.text,
    quantity: column.real,
    unit_cost: column.real,
    subtotal: column.real,
  }),
  work_order_photos: new Table({
    id: column.text,
    work_order_id: column.text,
    storage_path: column.text,
    photo_type: column.text,
  }),
});

export type Database = (typeof AppSchema)["types"];