import { createClient } from "@supabase/supabase-js";

if (!process.argv.includes("--allow-remote")) {
  console.error("Use --allow-remote para confirmar o teste temporário no Supabase remoto.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  console.error("NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY são obrigatórios.");
  process.exit(1);
}

const supabase = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let postId;
let notificationId;

try {
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, owner_id")
    .limit(1)
    .single();
  if (workspaceError) throw workspaceError;

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, name")
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .limit(1)
    .single();
  if (clientError) throw clientError;

  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert({
      workspace_id: workspace.id,
      client_id: client.id,
      format: "image",
      status: "draft",
      caption: "[smoke-test] alerta operacional temporário",
    })
    .select("id")
    .single();
  if (postError) throw postError;
  postId = post.id;

  const scheduledFor = new Date(Date.now() + 60_000).toISOString();
  const transitions = [
    { status: "scheduled", scheduled_for: scheduledFor },
    { status: "publishing" },
    {
      status: "failed",
      failure_code: "smoke_test_failure",
      failure_message: "Falha controlada do smoke test.",
      next_retry_at: null,
    },
  ];

  for (const transition of transitions) {
    const { error } = await supabase.from("posts").update(transition).eq("id", postId);
    if (error) throw error;
  }

  const dedupeKey = `publication_failed:${postId}:1`;
  const { data: firstAlert, error: firstAlertError } = await supabase
    .from("notifications")
    .select("id, title, body, metadata, severity, email_status")
    .eq("workspace_id", workspace.id)
    .eq("dedupe_key", dedupeKey)
    .single();
  if (firstAlertError) throw firstAlertError;
  notificationId = firstAlert.id;

  if (firstAlert.severity !== "critical" || firstAlert.email_status !== "pending") {
    throw new Error("O alerta não recebeu severidade/status de e-mail esperados.");
  }
  if (
    !firstAlert.title.includes(client.name)
    || !firstAlert.body.includes("[smoke-test]")
    || firstAlert.metadata?.postId !== postId
  ) {
    throw new Error("O alerta não identifica cliente, post e ação recomendada.");
  }

  const { error: duplicateAttemptError } = await supabase
    .from("posts")
    .update({
      status: "failed",
      failure_code: "smoke_test_failure_repeated",
      failure_message: "Falha controlada repetida.",
    })
    .eq("id", postId);
  if (duplicateAttemptError) throw duplicateAttemptError;

  const { count, error: countError } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace.id)
    .eq("dedupe_key", dedupeKey);
  if (countError) throw countError;
  if (count !== 1) throw new Error(`Deduplicação inválida: ${count ?? 0} alertas encontrados.`);

  console.log("Smoke test concluído: alerta crítico criado, enfileirado e deduplicado.");
} finally {
  if (notificationId) {
    const { error } = await supabase.from("notifications").delete().eq("id", notificationId);
    if (error) console.error("Falha ao remover o alerta temporário.");
  }
  if (postId) {
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) console.error("Falha ao remover o post temporário.");
  }
}
