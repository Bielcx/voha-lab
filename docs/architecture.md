# Arquitetura do Voha

## Responsabilidades

```text
Next.js no Cloudflare Workers via OpenNext
├── interface e Server Actions
├── rotas de upload e publicação
├── sessão SSR do Supabase
└── geração de URLs assinadas do R2

Supabase
├── Auth
├── PostgreSQL
├── Row Level Security
└── histórico e auditoria

Cloudflare R2
├── imagens
├── vídeos e Reels
├── thumbnails
└── uploads diretos por URL assinada
```

## Isolamento de dados

Todo dado de negócio pertence a um `workspace`. As políticas RLS consultam `workspace_members` e distinguem três papéis:

- `owner`: administra workspace e membros.
- `editor`: cria clientes, mídias e conteúdos.
- `approver`: acesso de leitura e aprovação quando possuir uma conta.

A aprovação externa sem conta será feita por endpoint de servidor usando um token aleatório armazenado somente como hash.

## Mídias

O PostgreSQL guarda metadados; o binário fica no R2. O fluxo implementado é:

1. O navegador solicita autorização ao backend.
2. O backend valida usuário, workspace, MIME e tamanho.
3. O backend cria uma chave em `workspaces/{workspaceId}/media/...`.
4. O navegador envia o arquivo diretamente ao R2 usando uma URL PUT de curta duração.
5. O backend confirma o objeto e marca `media_assets.status = 'ready'`.

As credenciais R2 nunca chegam ao navegador. A chave do objeto aparece apenas nas
rotas de servidor e no banco; o navegador recebe uma URL assinada temporária, que
deve ser tratada como bearer token.

O bucket privado aceita JPEG, PNG e WebP de até 25 MB e MP4 de até 200 MB. O CORS
permite `PUT`, `GET` e `HEAD` somente para as origens local e de produção. Depois do
upload, o servidor consulta os metadados no R2 antes de marcar o ativo como `ready`.

## Datas

Datas são persistidas como `timestamptz` em UTC. O workspace começa com `America/Sao_Paulo` e a interface converte para o fuso escolhido.

## Publicações

O estado atual fica em `posts.status`, enquanto cada transição é registrada automaticamente em `post_status_events`.

```text
draft → pending_approval → scheduled → publishing → published
                                        └──────────→ failed
```

`publication_attempts` registra cada chamada futura à Meta API. Tokens do Instagram ficam separados em `instagram_credentials`, sem acesso pelas roles `anon` e `authenticated`.

O Worker possui um Cron Trigger a cada minuto. Cada execução chama internamente a
rota de publicação usando `VOHA_CRON_SECRET`, reivindica no máximo três posts com
`FOR UPDATE SKIP LOCKED` e registra a tentativa antes de acessar a Meta. Uma
tentativa abandonada antes de `media_publish` pode ser repetida; depois que a
chamada final foi despachada, o Voha exige conferência manual para não duplicar o
post caso a resposta tenha se perdido.

## Alertas e observabilidade

Falhas finais de publicação geram uma linha RLS-protegida em `notifications` na
mesma transação do estado `failed`. O Cron também deduplica alertas de conexão
expirando e processa uma outbox de e-mails críticos com até três tentativas.

A interface consulta somente as notificações do usuário autenticado. O envio
externo usa o binding `EMAIL` da Cloudflare e fica desabilitado enquanto
`ALERT_EMAIL_FROM` não estiver configurado. Logs estruturados correlacionam Cron,
tentativa de publicação e e-mail por IDs internos, sem registrar credenciais.

## Próximas integrações

1. Concluir alertas e observabilidade (#10).
2. Adicionar aprovação externa (#11).
3. Executar hardening e lançar o MVP (#8).
