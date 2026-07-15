# Deploy paralelo na Cloudflare

> Estado em 15 de julho de 2026: Worker paralelo publicado e validado pela Larissa com login, sessão, workspace e clientes do Supabase. A Vercel permanece ativa como retorno seguro durante a conclusão do CI/CD e da integração à `main`.

URL paralela: [voha-lab.biel-cavalcanti1.workers.dev](https://voha-lab.biel-cavalcanti1.workers.dev)

## Arquitetura

- Next.js 16 executado no Cloudflare Workers por `@opennextjs/cloudflare`.
- Supabase permanece responsável por autenticação e PostgreSQL.
- Cloudflare R2 permanece responsável pelas mídias.
- A Vercel não deve ser removida antes da validação do ambiente paralelo.

O Worker validado possui aproximadamente **2.022 KiB gzip**, abaixo do limite de 3 MiB do Workers Free.

## Comandos

```bash
npm run build:cloudflare
npm run preview:cloudflare
npm run deploy:cloudflare
```

## Deploy automático

O Worker usa o **Cloudflare Workers Builds**, conectado ao repositório GitHub. A configuração esperada é:

- branch de produção: `main`;
- comando de build: `npm run build:cloudflare`;
- comando de deploy: `npx wrangler deploy`;
- comando de preview: `npx wrangler versions upload`;
- builds de branches não produtivas habilitados para validar pull requests.

As variáveis usadas pelo Next.js também precisam existir em **Build Variables and secrets**. Os segredos de runtime continuam configurados no Worker e nunca devem ser gravados no repositório.

O OpenNext recomenda Linux ou WSL. No Windows, o build pode ser validado em um contêiner Linux:

```powershell
docker run --rm -v "${PWD}:/app" -v voha-cloudflare-node-modules:/app/node_modules -w /app node:22-bookworm-slim sh -lc "npm ci && npm run build:cloudflare"
```

## Primeiro acesso

1. Execute `npx wrangler login` e autorize a conta Cloudflare no navegador.
2. Configure as variáveis e os segredos no Worker sem enviá-los por chat ou Git.
3. Gere o build em Linux e execute o deploy.
4. Abra o endereço `workers.dev` gerado e valide o checklist abaixo.

## Variáveis obrigatórias

Variáveis públicas, necessárias no build e no runtime:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Segredos somente de runtime:

- `SUPABASE_SECRET_KEY`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_BASE_URL`, quando utilizado

Nunca copiar `VERCEL_OIDC_TOKEN` para a Cloudflare. Nunca enviar `.env.local`, `.dev.vars` ou os valores dos segredos ao Git.

## Checklist de validação

- [x] Login com a usuária da Larissa.
- [x] Redirecionamento para login quando não autenticada.
- [x] Criação ou leitura do workspace existente.
- [x] Clientes fictícios carregados do Supabase.
- [ ] Logout removendo a sessão.
- [ ] Dashboard e calendário em tela pequena após login.
- [ ] Modo claro e escuro.
- [x] Tela de login e identidade visual carregando em viewport mobile.
- [x] API sem sessão retornando `401`.
- [ ] Logs sem segredos ou erros recorrentes.

## Retorno seguro

Se algum teste falhar, a URL da Vercel permanece ativa. Nenhum DNS ou domínio deve ser alterado durante o primeiro deploy paralelo.
