import assert from "node:assert/strict";
import test from "node:test";

import { createClientSlug, normalizeInstagramHandle } from "@/lib/clients/form";
import { toWorkspaceClientSummary } from "@/lib/clients/summary";

test("normaliza o identificador do Instagram", () => {
  assert.equal(normalizeInstagramHandle("  @@aurora.studio  "), "@aurora.studio");
  assert.equal(normalizeInstagramHandle(""), null);
});

test("gera um slug estável para o cliente", () => {
  assert.equal(createClientSlug("Estúdio Aurora & Co."), "estudio-aurora-co");
  assert.equal(createClientSlug("---"), "cliente");
});

test("resume cliente pausado sem conexão como pausado", () => {
  const client = toWorkspaceClientSummary({
    id: "client-id",
    name: "Estúdio Aurora",
    instagram_handle: null,
    brand_color: null,
    status: "paused",
    contact_name: null,
    contact_email: null,
    instagram_accounts: [],
  });

  assert.equal(client.status, "Pausado");
  assert.equal(client.handle, "Sem Instagram conectado");
  assert.equal(client.initials, "EA");
});
