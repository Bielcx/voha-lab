# Checklist de segurança do Voha

Última revisão: 24 de julho de 2026.

Use este documento antes de cada lançamento relevante e imediatamente após um
incidente. Nunca copie valores de segredo para issues, commits, logs ou chat.

## Estado atual

- [x] RLS habilitado nas tabelas com dados de usuário e workspace.
- [x] Credenciais do Instagram sem política de leitura para usuários autenticados.
- [x] Funções `security definer` com `search_path` fixo e permissões mínimas.
- [x] Tokens do Instagram criptografados com AES-256-GCM.
- [x] OAuth protegido por `state`, cookie `HttpOnly`, `SameSite=Lax` e expiração.
- [x] Callback de desautorização da Meta valida HMAC-SHA256 antes de alterar dados.
- [x] Endpoints internos protegidos por segredo comparado em tempo constante.
- [x] Uploads limitados por MIME, extensão, tamanho, workspace e prefixo do objeto.
- [x] Limite interno de mídia em 8 GB, abaixo da franquia de 10 GB do R2.
- [x] Uploads incompletos removidos após 24 horas.
- [x] CSP, HSTS, proteção contra iframe, MIME sniffing e vazamento de referrer.
- [x] Cabeçalho `x-powered-by` removido.
- [x] `.env*`, `AGENTS.md`, `CLAUDE.md` e logs locais fora do Git.
- [x] Dependências diretas atualizadas para as versões estáveis disponíveis.
- [ ] Validar MFA na conta Cloudflare, Supabase, GitHub e Meta dos administradores.
- [ ] Confirmar alertas de login e recuperação de conta em todos os provedores.
- [ ] Executar o teste autenticado completo no domínio de produção.
- [ ] Revisar este checklist com uma segunda pessoa antes de abrir o acesso público.

## Segredos e rotação

Inventário de segredos de produção:

- `SUPABASE_SECRET_KEY`;
- `R2_ACCESS_KEY_ID` e `R2_SECRET_ACCESS_KEY`;
- `META_INSTAGRAM_APP_SECRET`;
- `META_TOKEN_ENCRYPTION_KEY`;
- `VOHA_CRON_SECRET`.

Regras:

1. armazenar os valores somente no gerenciador de segredos e no runtime;
2. usar tokens com o menor escopo possível;
3. rotacionar imediatamente após suspeita de exposição;
4. remover o valor anterior depois de validar o novo deploy;
5. registrar data, responsável e motivo sem registrar o valor.

Ordem segura:

1. criar o novo segredo no provedor;
2. atualizar o Worker;
3. publicar e executar smoke test;
4. revogar o segredo anterior;
5. confirmar logs e alertas.

`META_TOKEN_ENCRYPTION_KEY` é uma exceção: trocar a chave sem migração torna os
tokens atuais ilegíveis. Para o MVP, desconecte as contas, troque a chave e conecte
novamente. Não apague a chave antiga antes de confirmar a reconexão.

## Banco e RLS

- [ ] Rodar `npx supabase migration list` e confirmar local = remoto.
- [ ] Testar que um usuário não acessa workspace, cliente, mídia ou post de outro.
- [ ] Confirmar que `anon` não executa RPCs administrativas.
- [ ] Conferir índices e crescimento do banco mensalmente.
- [ ] Exportar backup lógico antes de migrations destrutivas.
- [ ] Em Supabase Pro, manter backups diários e Spend Cap habilitado.

No plano Free não há garantia equivalente de backup diário. Antes de armazenar
dados de clientes reais, criar uma rotina externa de backup ou aprovar o Pro.

## Dependências

Em 24 de julho de 2026, `npm audit --omit=dev` ainda sinaliza cinco avisos altos
na árvore do Next.js relacionados ao PostCSS e ao Sharp. A versão estável mais
recente (`16.2.11`) continua dentro da faixa reportada e o autofix propõe um
downgrade quebrador para Next 14. Não usar `npm audit fix --force`.

Mitigações atuais:

- uploads não aceitam SVG ou CSS fornecido pelo usuário;
- imagens aceitas são JPEG, PNG e WebP com tamanho limitado;
- CSP e `nosniff` estão ativos;
- o app não usa Server Actions nem rewrites controlados pelo usuário;
- acompanhar uma versão corrigida do Next e atualizar assim que publicada.

Não há vulnerabilidade de severidade crítica conhecida na auditoria atual.

## Teste de lançamento

- [ ] Login, logout e expiração de sessão.
- [ ] Criar, editar, pausar e arquivar cliente.
- [ ] Conectar, renovar e desconectar Instagram.
- [ ] Upload JPEG, PNG, WebP e MP4; rejeitar tipo e tamanho inválidos.
- [ ] Criar imagem, carrossel e Reel.
- [ ] Aprovar e solicitar alteração em link público.
- [ ] Publicar agora e agendar.
- [ ] Confirmar sucesso, falha, retry, sino e e-mail.
- [ ] Repetir os fluxos principais em celular real.
- [ ] Conferir páginas `/privacidade` e `/exclusao-de-dados`.
- [ ] Confirmar `401` no cron sem segredo e no callback Meta com assinatura falsa.
