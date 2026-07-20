export function normalizeInstagramHandle(value: string | null | undefined) {
  const username = value?.trim().replace(/^@+/, "") ?? "";
  return username ? `@${username}` : null;
}

export function createClientSlug(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return normalized || "cliente";
}
