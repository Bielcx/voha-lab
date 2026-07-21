import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeInstagramHandle, createClientSlug } from "@/lib/clients/form";
import {
  toWorkspaceClientSummary,
  type ClientSummaryRow,
} from "@/lib/clients/summary";
import { requireWorkspaceAccess } from "@/lib/media/access";
import type { WorkspaceClientSummary } from "@/lib/types/workspace";

export const dynamic = "force-dynamic";

const colorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .nullable()
  .optional();

const optionalText = z.string().trim().max(120).nullable().optional();
const optionalEmail = z.string().trim().email().max(160).nullable().optional();
const optionalHandle = z
  .string()
  .trim()
  .max(31)
  .regex(/^@?[a-zA-Z0-9._]+$/)
  .nullable()
  .optional();

export const createClientSchema = z.object({
  name: z.string().trim().min(2).max(80),
  instagramHandle: optionalHandle,
  contactName: optionalText,
  contactEmail: optionalEmail,
  brandColor: colorSchema,
});

const querySchema = z.object({
  includeArchived: z.enum(["true", "false"]).optional(),
});

type PostCountRow = {
  client_id: string;
  status: "draft" | "pending_approval" | "scheduled" | "publishing" | "published" | "failed";
};

function getClientCounts(posts: PostCountRow[]) {
  const counts = new Map<string, { posts: number; published: number }>();

  for (const post of posts) {
    const current = counts.get(post.client_id) ?? { posts: 0, published: 0 };
    if (post.status === "published") current.published += 1;
    if (post.status === "scheduled" || post.status === "publishing") current.posts += 1;
    counts.set(post.client_id, current);
  }

  return counts;
}

export async function listWorkspaceClients(options?: { includeArchived?: boolean }) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access;

  let clientsQuery = access.supabase
    .from("clients")
    .select("id, name, instagram_handle, brand_color, status, contact_name, contact_email, instagram_accounts(connection_status, token_expires_at)")
    .eq("workspace_id", access.workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (!options?.includeArchived) clientsQuery = clientsQuery.neq("status", "archived");

  const [clientsResult, postsResult] = await Promise.all([
    clientsQuery,
    access.supabase
      .from("posts")
      .select("client_id, status")
      .eq("workspace_id", access.workspaceId)
      .is("deleted_at", null),
  ]);

  if (clientsResult.error || postsResult.error) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Não foi possível carregar seus clientes." },
        { status: 500 },
      ),
    };
  }

  const counts = getClientCounts((postsResult.data ?? []) as PostCountRow[]);
  const clients = ((clientsResult.data ?? []) as ClientSummaryRow[]).map((row) =>
    toWorkspaceClientSummary(row, counts.get(row.id)),
  );

  return { ok: true as const, access, clients };
}

export async function GET(request: Request) {
  const parsed = querySchema.safeParse({
    includeArchived: new URL(request.url).searchParams.get("includeArchived") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "O filtro informado é inválido." }, { status: 400 });
  }

  const result = await listWorkspaceClients({
    includeArchived: parsed.data.includeArchived === "true",
  });
  if (!result.ok) return result.response;
  return NextResponse.json({ clients: result.clients });
}

export async function POST(request: Request) {
  const access = await requireWorkspaceAccess({ editor: true });
  if (!access.ok) return access.response;

  const parsed = createClientSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revise os dados do cliente antes de salvar." },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const slug = `${createClientSlug(data.name)}-${crypto.randomUUID().slice(0, 8)}`;
  const { data: client, error } = await access.supabase
    .from("clients")
    .insert({
      workspace_id: access.workspaceId,
      created_by: access.user.id,
      name: data.name,
      slug,
      instagram_handle: normalizeInstagramHandle(data.instagramHandle),
      contact_name: data.contactName || null,
      contact_email: data.contactEmail || null,
      brand_color: data.brandColor || null,
    })
    .select("id, name, instagram_handle, brand_color, status, contact_name, contact_email, instagram_accounts(connection_status, token_expires_at)")
    .single();

  if (error || !client) {
    return NextResponse.json(
      { error: "Não foi possível criar este cliente." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { client: toWorkspaceClientSummary(client as ClientSummaryRow) satisfies WorkspaceClientSummary },
    { status: 201 },
  );
}
