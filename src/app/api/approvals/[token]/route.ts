import { NextResponse } from "next/server";

import { respondApprovalSchema } from "@/lib/approvals/policy";
import { respondToApproval } from "@/lib/approvals/service";

export const dynamic = "force-dynamic";

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/approvals/[token]">,
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Origem da solicitação inválida." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }

  const { token } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = respondApprovalSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Revise sua resposta.";
    return NextResponse.json(
      { error: message },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const result = await respondToApproval(token, parsed.data);
  if (!result) {
    return NextResponse.json(
      { error: "Este link expirou, foi substituído ou já recebeu uma resposta." },
      { status: 410, headers: { "cache-control": "no-store" } },
    );
  }

  return NextResponse.json(result, {
    headers: { "cache-control": "no-store" },
  });
}
