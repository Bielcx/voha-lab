// The OpenNext worker is generated before Wrangler bundles this entrypoint.
// @ts-expect-error Generated module is unavailable during the Next.js typecheck.
import handler from "./.open-next/worker.js";

type VohaCloudflareEnv = CloudflareEnv & {
  VOHA_CRON_SECRET: string;
};

export default {
  fetch: handler.fetch,

  async scheduled(
    _controller: ScheduledController,
    env: VohaCloudflareEnv,
    ctx: ExecutionContext,
  ) {
    const response = await handler.fetch(
      new Request("https://voha.internal/api/internal/publications/run", {
        method: "POST",
        headers: { "x-voha-cron-secret": env.VOHA_CRON_SECRET },
      }),
      env,
      ctx,
    );

    if (!response.ok) {
      console.error(JSON.stringify({
        event: "publication_scheduled_handler_failed",
        status: response.status,
      }));
      throw new Error("publication_scheduled_handler_failed");
    }
  },
} satisfies ExportedHandler<VohaCloudflareEnv>;
