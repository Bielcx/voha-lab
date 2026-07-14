# Custos, limites e continuidade do Voha

> Documento vivo. Última revisão: 14 de julho de 2026. Valores em USD, antes de impostos e variação cambial. Sempre conferir as fontes oficiais antes de alterar um plano.

## Objetivo

Evitar dois tipos de surpresa:

1. cobrança automática ou acima do orçamento;
2. publicação, login ou upload parando por limite, inatividade, credencial ou pagamento.

Nenhum serviço deve ser atualizado para um plano pago ou ter o limite de gastos ampliado sem aprovação explícita do proprietário do Voha.

## Resumo executivo

| Momento | Estimativa mensal | Observação |
| --- | ---: | --- |
| Desenvolvimento e testes | **US$ 0** | Vercel Hobby, Supabase Free e franquia gratuita do R2, respeitando limites e termos. |
| Uso profissional confiável | **a partir de US$ 45** | Vercel Pro (US$ 20) + Supabase Pro (US$ 25). R2 tende a permanecer gratuito no volume inicial. |
| Opcionais | variável | Domínio, e-mail transacional, monitoramento, backups avançados e assentos adicionais. |

O plano Hobby da Vercel é restrito a uso pessoal e não comercial. Quando Larissa começar a usar o Voha efetivamente no trabalho, devemos planejar a migração para Pro, atualmente em US$ 20/mês. A Vercel informa que cada membro adicional do time também pode gerar cobrança de US$ 20/mês. [Vercel Hobby](https://vercel.com/docs/plans/hobby) e [preços da Vercel](https://vercel.com/pricing).

## Serviços atuais

### Vercel — aplicação, API e deployments

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
| E-mail transacional | excedente por e-mail ou plano mensal | Escolher provedor quando alertas externos forem implementados. |
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

- [ ] Conferir plano, fatura e uso da Vercel.
- [ ] Conferir banco, egress, MAU e estado do projeto Supabase.
- [ ] Conferir armazenamento e operações A/B do R2.
- [ ] Conferir tokens próximos da expiração e falhas da Meta.
- [ ] Validar que os destinatários dos alertas continuam corretos.
- [ ] Revisar erros `402`, `429`, `5xx`, `540`, `544` e `546`.
- [ ] Registrar valores e incidentes neste documento.
- [ ] Fazer backup antes de mudanças de plano ou migrations importantes.

## Checklist antes de clientes reais

- [ ] Confirmar Vercel Pro ou outra hospedagem autorizada para uso comercial.
- [ ] Decidir Supabase Free versus Pro considerando pausa e ausência de backup automático.
- [ ] Configurar limites financeiros nos três provedores.
- [ ] Implementar painel interno de consumo do R2.
- [ ] Implementar alertas de cota, falha de publicação e token expirando.
- [ ] Testar o comportamento quando cada fornecedor retorna limite ou indisponibilidade.
- [ ] Documentar responsáveis, cartões, datas de renovação e procedimento de cancelamento.
- [ ] Revisar preços oficiais e atualizar a data no topo deste arquivo.

