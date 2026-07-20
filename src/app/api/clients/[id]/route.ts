import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeInstagramHandle } from "@/lib/clients/form";
import { toWorkspaceClientSummary, type ClientSummaryRow } from "@/lib/clients/summary";
import { requireWorkspaceAccess } from "@/lib/media/access";

export const dynamic = "force-dynamic";

const idSchema = z.uuid();
const colorSchema = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional();
const optionalText = z.string().trim().max(120).nullable().optional();
const optionalEmail = z.string().trim().email().max(160).nullable().optional();
const optionalHandle = z.string().trim().max(31).regex(/^@?[a-zA-Z0-9._]+$/).nullable().optional();

const updateSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    instagramHandle: optionalHandle,
    contactName: optionalText,
    contactEmail: optionalEmail,
    brandColor: colorSchema,
    status: z.enum(["active", "paused"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

type RouteContext = { params: Promise<{ id: string }> };

async function getClientId(context: RouteContext) {
  const { id } = await context.params;
  return idSchema.safeParse(id);
}

export async function PATCH(request: Request, context: RouteContext) {
  const idResult = await getClientId(context);
  const payload = updateSchema.safeParse(await request.json().catch(() => null));
  if (!idResult.success || !payload.success) {
    return NextResponse.json({ error: "Os dados do cliente são inválidos." }, { status: 400 });
  }

  const access = await requireWorkspaceAccess({ editor: true });
  if (!access.ok) return access.response;

  const values = payload.data;
  const update: Record<string, string | null> = {};
  if (values.name !== undefined) update.name = values.name;
  if (values.instagramHandle !== undefined) update.instagram_handle = normalizeInstagramHandle(values.instagramHandle);
  if (values.contactName !== undefined) update.contact_name = values.contactName || null;
  if (values.contactEmail !== undefined) update.contact_email = values.contactEmail || null;
  if (values.brandColor !== undefined) update.brand_color = values.brandColor || null;
  if (values.status !== undefined) update.status = values.status;

  const { data: client, error } = await access.supabase
    .from("clients")
    .update(update)
    .eq("id", idResult.data)
    .eq("workspace_id", access.workspaceId)
    .is("deleted_at", null)
    .select("id, name, instagram_handle, brand_color, status, contact_name, contact_email, instagram_accounts(connection_status)")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Não foi possível salvar as alterações." }, { status: 500 });
  }
  if (!client) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ client: toWorkspaceClientSummary(client as ClientSummaryRow) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const idResult = await getClientId(context);
  if (!idResult.success) {
    return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  }

  const access = await requireWorkspaceAccess({ editor: true });
  if (!access.ok) return access.response;

  const { data: client, error } = await access.supabase
    .from("clients")
    .update({ status: "archived", deleted_at: new Date().toISOString() })
    .eq("id", idResult.data)
    .eq("workspace_id", access.workspaceId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Não foi possível arquivar este cliente." }, { status: 500 });
  }
  if (!client) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
