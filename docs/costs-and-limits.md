# Custos, limites e continuidade do Voha

> Documento vivo. Última revisão: 23 de julho de 2026. Valores em USD, antes de impostos e variação cambial. Sempre conferir as fontes oficiais antes de alterar um plano.

## Objetivo

Evitar dois tipos de surpresa:

1. cobrança automática ou acima do orçamento;
2. publicação, login ou upload parando por limite, inatividade, credencial ou pagamento.

Nenhum serviço deve ser atualizado para um plano pago ou ter o limite de gastos ampliado sem aprovação explícita do proprietário do Voha.

## Resumo executivo

| Momento | Estimativa mensal | Observação |
| --- | ---: | --- |
| Desenvolvimento e testes | **US$ 0** | Cloudflare Workers Free, Supabase Free, franquia do R2 e e-mail apenas para destino verificado. |
| Uso profissional confiável | **a partir de US$ 25** | Supabase Pro; Workers Paid adiciona US$ 5 quando necessário. R2 tende a permanecer gratuito no volume inicial. |
| Opcionais | variável | Domínio, e-mail transacional, monitoramento, backups avançados e assentos adicionais. |

A aplicação principal foi migrada para Cloudflare Workers. A seção da Vercel
abaixo permanece somente como histórico/fallback e não deve orientar o custo
atual do Voha.

## Serviços atuais

### Vercel — deployment legado/fallback

O Voha não depende mais da Vercel para produção. Não contratar ou ampliar plano
nesse serviço sem uma decisão explícita de retorno.

**Durante o desenvolvimento:** Hobby, desde que o uso continue pessoal e não comercial.

Principais franquias Hobby atuais:

- 1 milhão de Edge Requests por mês;
- 100 GB de Fast Data Transfer por mês;
- 1 milhão de invocações de Functions;
- 4 horas de CPU ativa e 360 GB-horas de memória provisionada;
- 6.000 minutos de build;
- duração máxima configurável de Function de 60 segundos.

Ao atingir o limite Hobby, não há compra automática de excedente; o recurso pode ficar indisponível até a renovação da janela de uso. No Pro há cobrança sob demanda acima dos créditos incluídos. Equipes novas podem receber orçamento sob demanda padrão de US$ 200, portanto esse valor deve ser reduzido e protegido por hard limit antes do lançamento. [Limites Hobby](https://vercel.com/docs/plans/hobby), [gestão de uso](https://vercel.com/docs/pricing/manage-and-optimize-usage).

**Configuração obrigatória antes do lançamento:**

- confirmar que o time está no plano correto para uso comercial;
- ativar notificações de uso;
- no Pro, configurar orçamento adicional baixo, inicialmente US$ 5, com avisos e hard limit;
- manter apenas um membro pago se Larissa não precisar acessar o dashboard da Vercel;
- revisar Edge Requests, transferência, CPU, memória e invocações semanalmente no primeiro mês.

**Se parar:** consultar `vercel list`, `vercel inspect <deployment>` e `vercel logs`; depois verificar Usage e Billing no dashboard.

### Supabase — login, banco e RLS

Plano Free atual:

- até dois projetos ativos;
- 500 MB de banco por projeto;
- 50.000 usuários ativos mensais;
- 5 GB de egress não armazenado em cache e 5 GB em cache;
- projeto com baixa atividade pode ser pausado após aproximadamente sete dias;
- projeto pausado pode ser restaurado pelo dashboard por 90 dias.

O Free não gera cobrança de excedente, mas pode restringir ou pausar o serviço. Respostas `402` com códigos `exceeded_*` indicam cota excedida; `540` indica projeto pausado. Isso pode aparecer no Voha como falha de login, calendário vazio ou erro ao salvar. [Billing do Supabase](https://supabase.com/docs/guides/platform/billing-on-supabase), [pausa de projetos](https://supabase.com/docs/guides/platform/free-project-pausing), [códigos HTTP](https://supabase.com/docs/guides/troubleshooting/http-status-codes).

O Pro começa em US$ 25/mês, inclui o primeiro projeto Micro, 8 GB de banco, 250 GB de egress e backups diários por sete dias. O Spend Cap vem habilitado por padrão e deve permanecer assim até decisão explícita. [Preços do Supabase](https://supabase.com/pricing), [controle de custos](https://supabase.com/docs/guides/platform/cost-control).

**Configuração obrigatória antes do lançamento:**

- manter o Spend Cap ligado se migrarmos para Pro;
- verificar se o e-mail do proprietário recebe avisos de pausa e cobrança;
- criar backup lógico periódico antes de armazenar dados reais;
- alertar em 70%, 85% e 95% de banco e egress;
- monitorar os códigos `402`, `540`, `544` e `546` nos logs.

### Cloudflare Workers — aplicação, cron e alertas

O plano Free inclui 100.000 requisições por dia e 10 ms de CPU por invocação. O
Cron Trigger pode executar por até 15 minutos. O plano Workers Paid possui mínimo
de US$ 5/mês, inclui 10 milhões de requisições e 30 milhões de CPU-ms por mês;
excedentes são cobrados. [Preços oficiais do Workers](https://developers.cloudflare.com/workers/platform/pricing/).

O Cloudflare Email Service pode enviar gratuitamente para endereços de destino
verificados, inclusive no uso inicial. Envio para destinatários arbitrários exige
Workers Paid; o plano inclui 3.000 e-mails/mês e cobra US$ 0,35 por mil e-mails
adicionais. [Preços oficiais de e-mail](https://developers.cloudflare.com/email-service/platform/pricing/).

Para Larissa, manter somente o endereço verificado e não ativar Workers Paid sem
aprovação. Os alertas dentro do Voha não dependem do envio de e-mail.

**Se parar:** filtre `operational_cron_failed` nos Workers Logs, confira o último
`runId`, os Cron Events, o binding `EMAIL` e as variáveis do Worker. O procedimento
completo está em `docs/operations.md`.

### Cloudflare R2 — imagens e Reels

Usaremos somente a classe **Standard**. A franquia mensal atual é:

- 10 GB-mês armazenados;
- 1 milhão de operações Classe A, como uploads e listagens;
- 10 milhões de operações Classe B, como leituras e consultas;
- egress direto do R2 gratuito.

Acima da franquia: US$ 0,015/GB-mês, US$ 4,50 por milhão de operações Classe A e US$ 0,36 por milhão de Classe B. A Cloudflare arredonda o consumo faturável para a próxima unidade, então pequenas ultrapassagens podem cobrar uma unidade inteira. [Preços oficiais do R2](https://developers.cloudflare.com/r2/pricing/).

O R2 é hoje o maior risco de cobrança automática porque já possui cartão e aceita excedente. A proteção principal será também feita dentro do Voha:

- bloquear novos uploads quando o workspace chegar a 8 GB;
- alertar em 7 GB, 8,5 GB e 9,5 GB;
- limitar tamanho por imagem, vídeo e Reel;
- impedir uploads duplicados por checksum;
- excluir uploads incompletos e mídias removidas após período de segurança;
- monitorar operações A/B para detectar loops de upload ou leitura;
- conferir mensalmente Billing e R2 Usage no painel Cloudflare.

**Se parar:** verificar credenciais e permissões do token, CORS, Billing e métricas do bucket. `403` normalmente indica credencial/permissão; falhas repetidas de upload devem gerar alerta interno e nunca iniciar tentativas infinitas.

### Meta / Instagram

Não há hoje um custo de infraestrutura do Voha registrado por chamada à API de publicação. O risco principal é operacional:

- expiração ou revogação do token;
- conta deixando de ser profissional;
- permissões removidas;
- limite de publicação ou rate limit;
- aplicativo sem aprovação ou verificação necessária;
- mudança de versão da Graph API.

Antes do lançamento documentaremos a versão utilizada, permissões, limites, processo de App Review, renovação de tokens e códigos de erro. `token_expires_at`, tentativas e resposta da Meta já possuem lugar previsto no banco. Fonte de referência: [documentação da plataforma Instagram](https://developers.facebook.com/docs/instagram-platform/).

### Serviços ainda não escolhidos

| Serviço | Possível custo | Decisão necessária |
| --- | --- | --- |
| Domínio próprio | renovação anual e possível transferência | Comparar registrador antes da compra. |
| E-mail transacional | gratuito para destino verificado; Workers Paid para arbitrários | Cloudflare Email Service escolhido; falta configurar domínio e remetente. |
| Monitoramento de erros | plano mensal ou excedente de eventos | Avaliar Sentry/alternativa somente após logs internos. |
| Backups avançados | Supabase Pro/PITR ou armazenamento externo | Definir antes de clientes reais. |
| Assentos de equipe | Vercel cobra por membro no Pro | Evitar adicionar Larissa ao time técnico sem necessidade. |

## Política de alertas do Voha

Os alertas devem seguir três níveis:

| Nível | Limite | Ação |
| --- | ---: | --- |
| Atenção | 70% | aviso interno e e-mail ao proprietário; investigar tendência. |
| Alto | 85% | reduzir consumo, impedir operações dispensáveis e revisar painel do fornecedor. |
| Crítico | 95% | bloquear uploads ou ações que aumentem custo; exigir decisão manual. |

Nunca criar retry infinito. Toda operação externa deve ter número máximo de tentativas, backoff e registro do erro final.

## Checklist mensal

- [ ] Conferir plano, requisições, CPU, Cron Events e e-mails da Cloudflare.
- [ ] Conferir banco, egress, MAU e estado do projeto Supabase.
- [ ] Conferir armazenamento e operações A/B do R2.
- [ ] Conferir tokens próximos da expiração e falhas da Meta.
- [ ] Validar que os destinatários dos alertas continuam corretos.
- [ ] Revisar erros `402`, `429`, `5xx`, `540`, `544` e `546`.
- [ ] Registrar valores e incidentes neste documento.
- [ ] Fazer backup antes de mudanças de plano ou migrations importantes.

## Checklist antes de clientes reais

- [ ] Confirmar que Workers Free atende ao volume ou aprovar explicitamente Workers Paid.
- [ ] Decidir Supabase Free versus Pro considerando pausa e ausência de backup automático.
- [ ] Configurar limites financeiros nos três provedores.
- [ ] Implementar painel interno de consumo do R2.
- [ ] Implementar alertas de cota, falha de publicação e token expirando.
- [ ] Testar o comportamento quando cada fornecedor retorna limite ou indisponibilidade.
- [ ] Documentar responsáveis, cartões, datas de renovação e procedimento de cancelamento.
- [ ] Revisar preços oficiais e atualizar a data no topo deste arquivo.
