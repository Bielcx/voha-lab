import "server-only";

import { isWorkspaceMediaKey } from "@/lib/media/policy";
import { mediaStorage } from "@/lib/storage/r2";
import { createAdminClient } from "@/lib/supabase/admin";

const STALE_UPLOAD_AGE_MS = 24 * 60 * 60 * 1000;

type StaleMediaAsset = {
  id: string;
  workspace_id: string;
  storage_key: string;
};

export async function runOperationalMaintenance() {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - STALE_UPLOAD_AGE_MS).toISOString();
  const { data, error } = await admin
    .from("media_assets")
    .select("id, workspace_id, storage_key")
    .eq("status", "uploading")
    .is("deleted_at", null)
    .lt("created_at", cutoff)
    .limit(25);

  if (error) throw new Error("stale_media_lookup_failed");

  let staleMediaDeleted = 0;
  let staleMediaFailed = 0;
  for (const asset of (data ?? []) as StaleMediaAsset[]) {
    try {
      if (isWorkspaceMediaKey(asset.storage_key, asset.workspace_id)) {
        await mediaStorage.delete(asset.storage_key);
      }
      const { error: updateError } = await admin
        .from("media_assets")
        .update({
          status: "failed",
          deleted_at: new Date().toISOString(),
        })
        .eq("id", asset.id)
        .eq("status", "uploading");
      if (updateError) throw updateError;
      staleMediaDeleted += 1;
    } catch {
      staleMediaFailed += 1;
      console.error(JSON.stringify({
        event: "stale_media_cleanup_failed",
        mediaAssetId: asset.id,
      }));
    }
  }

  const { data: notificationsDeleted, error: pruneError } = await admin.rpc(
    "prune_operational_notifications",
    { retention_days: 90 },
  );
  if (pruneError) throw new Error("notification_retention_failed");

  return {
    staleMediaFound: data?.length ?? 0,
    staleMediaDeleted,
    staleMediaFailed,
    notificationsDeleted:
      typeof notificationsDeleted === "number" ? notificationsDeleted : 0,
  };
}
