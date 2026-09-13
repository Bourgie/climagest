export type ServiceResult =
  | { ok: true; userId?: string; provisionalPassword?: string; appointmentId?: string; chargeId?: string; paymentId?: string; workOrderId?: string; quoteId?: string; clientId?: string; equipmentId?: string; serviceRequestId?: string }
  | { ok: false; error: string };
