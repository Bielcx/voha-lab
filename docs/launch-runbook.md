# Runbook de lançamento e rollback

Última revisão: 24 de julho de 2026.

## Antes do deploy

1. confirmar que a branch pertence a uma issue e que o PR descreve o impacto;
2. revisar migrations e executar `npx supabase db push --dry-run`;
3. criar backup lógico antes de qualquer mudança destrutiva;
4. executar `npm run lint`, `npm test` e `npm run build`;
5. confirmar que nenhum `.env`, token, log ou credencial está rastreado;
6. revisar variáveis e bindings no Worker sem revelar valores;
7. conferir o checklist em `docs/security-checklist.md`.

## Ordem de lançamento

1. aplicar migrations compatíveis com a versão anterior do código;
2. fazer merge do PR em `main`;
3. aguardar o deploy automático do Cloudflare;
4. conferir a versão em **Workers & Pages → voha-lab → Deployments**;
5. executar smoke test público e autenticado;
6. monitorar logs por pelo menos 15 minutos.

Migrations devem ser expansivas sempre que possível: adicionar antes de usar,
deixar o código antigo funcionando e remover estruturas somente em uma entrega
posterior.

## Smoke test

- `GET /login`, `/privacidade` e `/exclusao-de-dados` retornam `200`;
- `POST /api/internal/publications/run` sem segredo retorna `401`;
- login da Larissa carrega clientes, calendário e uso real de armazenamento;
- upload pequeno conclui e pode ser excluído;
- rascunho pode ser salvo, aberto e excluído;
- conexão do Instagram aparece ativa;
- um post descartável pode ser agendado sem duplicação;
- sino e e-mail exibem um alerta controlado.

Não publique conteúdo real apenas para testar um deploy. Use mídia e conta de
teste aprovadas para esse fim.

## Rollback de código

1. abra **Cloudflare → Workers & Pages → voha-lab → Deployments**;
2. identifique o último deployment saudável;
3. use **Rollback** para promover a versão anterior;
4. confirme `/login` e o endpoint interno;
5. registre horário, versão e motivo na issue;
6. investigue na branch sem alterar dados reais.

Não reverta uma migration automaticamente. Se o código anterior não for compatível
com o banco atual, publique uma correção compatível ou uma migration de avanço.

## Incidentes

### Login ou banco

Conferir status do Supabase, pausa do projeto, códigos `402`, `540`, `544` e
`546`, variáveis públicas e políticas RLS. Não contornar RLS usando chave
administrativa no navegador.

### Upload ou mídia

Conferir R2, CORS, credenciais, limite interno de 8 GB e linhas `uploading` com
mais de 24 horas. A manutenção diária tenta remover objetos abandonados.

### Publicação

Filtrar `instagram_publication_failed` pelo `postId` e `attemptId`. Se
`publish_dispatched` já ocorreu, verificar primeiro o Instagram: repetir a chamada
pode duplicar o post.

### Cron ou e-mail

Filtrar `operational_cron_failed`, `operational_scheduled_handler_failed` e
`notification_email_failed`. Conferir `VOHA_CRON_SECRET`, binding `EMAIL`,
remetente e destino verificado.

### Credencial exposta

Revogar no provedor, atualizar o Worker, validar o deploy e revisar logs. Para a
chave de criptografia da Meta, desconectar e reconectar todas as contas.

## Pós-lançamento

- revisar erros e consumo diariamente na primeira semana;
- conferir Supabase, Workers e R2 semanalmente no primeiro mês;
- testar restauração de backup antes de depender dele;
- revisar permissões Meta e vencimento de tokens;
- atualizar custos, limites e este runbook após todo incidente.
