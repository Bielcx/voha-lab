import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { WorkspaceClientSummary } from "@/lib/types/workspace";

const DEMO_CLIENTS = [
  {
    slug: "demo-alba-cafe",
    name: "Alba Café",
    instagram_handle: "@albacafe",
    brand_color: "#B66A3C",
    posts: 8,
    published: 24,
  },
  {
    slug: "demo-flora-studio",
    name: "Flora Studio",
    instagram_handle: "@florastudio",
    brand_color: "#64825C",
    posts: 5,
    published: 18,
  },
  {
    slug: "demo-noma-skin",
    name: "Noma Skin",
    instagram_handle: "@nomaskin",
    brand_color: "#B87C7C",
    posts: 4,
    published: 15,
  },
  {
    slug: "demo-sopro-yoga",
    name: "Sopro Yoga",
    instagram_handle: "@soproyoga",
    brand_color: "#7F77A8",
    posts: 3,
    published: 11,
  },
] as const;

type DemoClientRow = {
  id: string;
  slug: string;
  name: string;
  instagram_handle: string | null;
  brand_color: string | null;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function toSummary(row: DemoClientRow): WorkspaceClientSummary {
  const fixture = DEMO_CLIENTS.find((client) => client.slug === row.slug);

  return {
    id: row.id,
    name: row.name,
    handle: row.instagram_handle ?? "@perfil_demo",
    initials: getInitials(row.name),
    color: row.brand_color ?? "#7568A8",
    posts: fixture?.posts ?? 0,
    published: fixture?.published ?? 0,
    status: "Demo",
  };
}

export async function ensureDemoClients(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
) {
  const demoSlugs = DEMO_CLIENTS.map((client) => client.slug);
  const { data: existingClients, error: selectError } = await supabase
    .from("clients")
    .select("id, slug, name, instagram_handle, brand_color")
    .eq("workspace_id", workspaceId)
    .in("slug", demoSlugs);

  if (selectError) {
    throw new Error("Não foi possível consultar os clientes de demonstração.");
  }

  const existingSlugs = new Set(
    (existingClients as DemoClientRow[] | null)?.map((client) => client.slug),
  );
  const missingClients = DEMO_CLIENTS.filter(
    (client) => !existingSlugs.has(client.slug),
  );

  if (missingClients.length > 0) {
    const { error: insertError } = await supabase.from("clients").insert(
      missingClients.map((client) => ({
        slug: client.slug,
        name: client.name,
        instagram_handle: client.instagram_handle,
        brand_color: client.brand_color,
        workspace_id: workspaceId,
        created_by: userId,
        contact_name: "Cliente de demonstração",
      })),
    );

    if (insertError && insertError.code !== "23505") {
      throw new Error("Não foi possível criar os clientes de demonstração.");
    }
  }

  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("id, slug, name, instagram_handle, brand_color")
    .eq("workspace_id", workspaceId)
    .in("slug", demoSlugs)
    .order("created_at", { ascending: true });

  if (clientsError) {
    throw new Error("Não foi possível carregar os clientes de demonstração.");
  }

  return (clients as DemoClientRow[]).map(toSummary);
}
