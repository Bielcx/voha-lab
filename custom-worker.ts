// The OpenNext worker is generated before Wrangler bundles this entrypoint.
// @ts-expect-error Generated module is unavailable during the Next.js typecheck.
import handler from "./.open-next/worker.js";

type VohaCloudflareEnv = CloudflareEnv & {
  VOHA_CRON_SECRET: string;
};

export default {
  fetch: handler.fetch,

  async scheduled(
    controller: ScheduledController,
    env: VohaCloudflareEnv,
    ctx: ExecutionContext,
  ) {
    const scheduledAt = new Date(controller.scheduledTime);
    const maintenance =
      scheduledAt.getUTCHours() === 3 && scheduledAt.getUTCMinutes() === 17;
    const response = await handler.fetch(
      new Request(`https://voha.internal/api/internal/publications/run${maintenance ? "?maintenance=1" : ""}`, {
        method: "POST",
        headers: { "x-voha-cron-secret": env.VOHA_CRON_SECRET },
      }),
      env,
      ctx,
    );

    if (!response.ok) {
      console.error(JSON.stringify({
        event: "operational_scheduled_handler_failed",
        status: response.status,
        maintenance,
      }));
      throw new Error("operational_scheduled_handler_failed");
    }
  },
} satisfies ExportedHandler<VohaCloudflareEnv>;
