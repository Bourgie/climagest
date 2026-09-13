import type {
  CommonPowerSyncDatabase,
  PowerSyncBackendConnector,
} from "@powersync/web";
import { createClient } from "@/lib/supabase/client";

/**
 * Conector de PowerSync para el navegador.
 *
 * - `fetchCredentials`: usa el JWT de la sesión de Supabase (login de 3
 *   factores, skill gestion-usuarios-auth) para autenticar contra PowerSync.
 *   No hay secret aparte de PowerSync en V1.
 * - `uploadData`: sube la cola de escrituras offline a
 *   `/api/powersync/upload`. 400 = error permanente (se descarta la cola para
 *   no trabarla); cualquier otro fallo = transitorio (reintenta).
 */
export class BackendConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return null;
    }

    const endpoint = process.env.NEXT_PUBLIC_POWER_SYNC_URL;
    if (!endpoint) {
      throw new Error("Falta NEXT_PUBLIC_POWER_SYNC_URL. Verificá el .env.local.");
    }

    return {
      endpoint,
      token: session.access_token,
      expiresAt: new Date((session.expires_at ?? 0) * 1000),
    };
  }

  async uploadData(database: CommonPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) {
      return;
    }

    let response: Response;
    try {
      response = await fetch("/api/powersync/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crud: transaction.crud }),
      });
    } catch (e) {
      // Sin red u otro fallo transitorio: no marcar completo → reintenta.
      console.error("upload transitorio, reintenta:", e);
      return;
    }

    if (response.status === 400) {
      const body = await response.json().catch(() => ({}));
      console.error("upload rechazado (permanente), se descarta:", body);
      await transaction.complete();
      return;
    }

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    const body = await response.json().catch(() => ({}));
    if (!body?.ok) {
      console.error("upload rechazado (permanente), se descarta:", body);
      await transaction.complete();
      return;
    }

    await transaction.complete();
  }
}
