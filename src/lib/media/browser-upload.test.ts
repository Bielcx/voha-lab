import assert from "node:assert/strict";
import test from "node:test";

import { inferMediaContentType } from "@/lib/media/browser-upload";

test("preserva o MIME informado pelo navegador", () => {
  assert.equal(
    inferMediaContentType("foto.jpg", "image/jpeg"),
    "image/jpeg",
  );
});

test("infere o MIME quando o navegador mobile envia o tipo vazio", () => {
  assert.equal(inferMediaContentType("foto.JPEG", ""), "image/jpeg");
  assert.equal(inferMediaContentType("arte.webp", ""), "image/webp");
  assert.equal(inferMediaContentType("reel.mp4", ""), "video/mp4");
});

test("não inventa MIME para uma extensão desconhecida", () => {
  assert.equal(inferMediaContentType("arquivo.bin", ""), "");
});
