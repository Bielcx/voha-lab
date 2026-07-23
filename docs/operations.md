# Operação, alertas e diagnóstico

Última revisão: 23 de julho de 2026.

## Fluxo operacional

O Cron Trigger executa a cada minuto e, na mesma chamada autenticada:

1. processa publicações devidas;
2. cria alertas deduplicados para conexões que expiram em até sete dias;
3. busca até três e-mails críticos pendentes;
4. envia pelo binding nativo `EMAIL` da Cloudflare;
5. registra métricas estruturadas sem tokens, URLs assinadas ou mensagens brutas de provedores.

Uma falha final de publicação cria a notificação na mesma transação que altera o
post para `failed`. Falhas intermediárias com retry agendado não geram alerta para
evitar ruído. Cada ciclo de publicação pode gerar no máximo um alerta.

O e-mail é complementar. A central dentro do Voha continua funcionando se o
serviço de e-mail estiver desabilitado ou indisponível.

## Configurar e-mail sem custo no uso inicial

O Voha usa o Cloudflare Email Service por binding, sem API key adicional. Para o
uso apenas pela Larissa, mantenha o destino como endereço verificado na conta:

1. adicione um domínio gerenciado pelo Cloudflare DNS em **Email Service**;
2. habilite **Email Routing** para esse domínio;
3. adicione o e-mail da Larissa em **Destination Addresses** e confirme o link;
4. use um remetente do domínio, como `alertas@seudominio.com`;
5. configure `ALERT_EMAIL_FROM` nas variáveis do Worker;
6. faça novo deploy e simule uma falha controlada.

O binding está em `wrangler.jsonc` como `EMAIL`. Sem `ALERT_EMAIL_FROM`, o Cron
não reivindica a fila de e-mails e registra `emailEnabled: false`. Não coloque
tokens ou senhas de e-mail no repositório.

O comando `npx wrangler email sending list` exige que a sessão do Wrangler tenha
permissão para Email Sending. Um erro `2036 Unauthorized` nessa consulta indica
escopo insuficiente da sessão, não necessariamente falha do Worker.

## Eventos estruturados

Procure estes eventos em **Workers > Observability > Logs**:

| Evento | Significado | Campos úteis |
| --- | --- | --- |
| `operational_cron_completed` | ciclo concluído | `runId`, duração, publicações, notificações e e-mails |
| `operational_cron_failed` | ciclo interrompido | `runId`, duração |
| `operational_scheduled_handler_failed` | endpoint interno recusou o Cron | status HTTP |
| `instagram_publication_succeeded` | publicação confirmada | `postId`, `attemptId`, tentativa, duração |
| `instagram_publication_failed` | tentativa encerrada | `postId`, `attemptId`, código, retry |
| `notification_email_sent` | e-mail aceito | `notificationId`, tentativa |
| `notification_email_failed` | envio recusado | `notificationId`, código sanitizado, retry |

Use `runId`, `postId`, `attemptId` ou `notificationId` para correlacionar eventos.
Os logs nunca devem incluir `access_token`, App Secret, chave R2, endereço de
destino ou URL assinada.

## Teste controlado

O smoke test automatizado cria e remove dados técnicos temporários no Supabase remoto:

```bash
npm run test:notifications:remote
```

Ele valida a criação, a fila de e-mail e a deduplicação do alerta. Para um teste visual manual:

1. crie um rascunho descartável no Voha e copie seu UUID;
2. no SQL Editor do Supabase, faça somente esse rascunho percorrer as transições
   válidas `scheduled`, `publishing` e `failed`, usando `failure_code =
   'test_notification'`, uma mensagem sem dados pessoais e `next_retry_at = null`;
3. abra o sino do Voha e confirme o alerta crítico;
4. clique no alerta, confirme a navegação ao calendário e o estado lido;
5. aguarde o Cron e verifique o e-mail, se configurado;
6. edite o post de teste para transformá-lo novamente em rascunho ou exclua-o.

Nunca simule falha alterando uma publicação real ou já publicada.

## Diagnóstico rápido

- **Alerta não apareceu:** confira se a falha é final (`next_retry_at` nulo), a
  migration está aplicada e o usuário é proprietário do workspace.
- **Badge não atualizou:** abra novamente a central, confira `/api/notifications`
  e a sessão Supabase.
- **E-mail não saiu:** verifique `ALERT_EMAIL_FROM`, domínio, destino verificado,
  binding `EMAIL` e `email_error_code` no registro da notificação.
- **Cron falhou:** filtre `operational_cron_failed` pelo `runId` e confira o evento
  imediatamente anterior.
- **Muitos alertas:** verifique `dedupe_key` e se algum processo está iniciando
  novos ciclos de publicação indevidamente.

## Retenção e retry

- publicação: até três tentativas automáticas;
- e-mail: até três tentativas com backoff;
- falhas permanentes de e-mail não são tentadas novamente;
- envio interrompido há mais de 15 minutos pode ser retomado e, raramente, gerar
  um e-mail duplicado;
- notificações permanecem no banco até definirmos a política de retenção no
  hardening do MVP.

Referências: [Email Service](https://developers.cloudflare.com/email-service/),
[preços de e-mail](https://developers.cloudflare.com/email-service/platform/pricing/)
e [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/).
