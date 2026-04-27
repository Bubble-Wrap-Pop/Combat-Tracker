import { createClient } from "@supabase/supabase-js";
import { NonRetriableError, cron } from "inngest";
import type { Database } from "@/lib/supabase-database";
import { inngest } from "@/lib/inngest/client";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Deletes `sessions` rows older than 24 hours (cascades to `combatants`, `session_players`).
 * Runs daily at 03:00 UTC. Uses the Supabase service role to bypass RLS.
 */
export const cleanupStaleCombatSessions = inngest.createFunction(
  {
    id: "cleanup-stale-combat-sessions",
    name: "Cleanup stale combat sessions",
    triggers: [cron("0 3 * * *")],
  },
  async ({ step, logger }) => {
    const result = await step.run("delete-sessions-older-than-24h", async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !serviceKey) {
        throw new NonRetriableError(
          "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY; cannot run cleanup."
        );
      }

      const admin = createClient<Database>(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const cutoffIso = new Date(Date.now() - MS_PER_DAY).toISOString();

      const { data, error } = await admin.from("sessions").delete().lt("created_at", cutoffIso).select("id");

      if (error) {
        throw new Error(`Supabase delete failed: ${error.message}`);
      }

      return { deletedCount: data?.length ?? 0, cutoffIso };
    });

    logger.info("Stale combat session cleanup finished", result);
    return result;
  }
);
