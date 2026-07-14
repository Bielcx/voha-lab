# Arquitetura do Voha

## Responsabilidades

```text
Next.js na Vercel
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

O PostgreSQL guarda metadados; o binário fica no R2. O fluxo planejado é:

1. O navegador solicita autorização ao backend.
2. O backend valida usuário, workspace, MIME e tamanho.
3. O backend cria uma chave em `workspaces/{workspaceId}/media/...`.
4. O navegador envia o arquivo diretamente ao R2 usando uma URL PUT de curta duração.
5. O backend confirma o objeto e marca `media_assets.status = 'ready'`.

As chaves R2 nunca chegam ao navegador. URLs assinadas devem ser tratadas como bearer tokens.

## Datas

Datas são persistidas como `timestamptz` em UTC. O workspace começa com `America/Sao_Paulo` e a interface converte para o fuso escolhido.

## Publicações

O estado atual fica em `posts.status`, enquanto cada transição é registrada automaticamente em `post_status_events`.

```text
draft → pending_approval → scheduled → publishing → published
                                        └──────────→ failed
```

`publication_attempts` registra cada chamada futura à Meta API. Tokens do Instagram ficam separados em `instagram_credentials`, sem acesso pelas roles `anon` e `authenticated`.

## Próximas integrações

1. Conectar o projeto Supabase e aplicar a migration.
2. Implementar login e criação inicial do workspace.
3. Trocar clientes e calendário fictícios por queries reais.
4. Implementar upload direto para R2.
5. Adicionar aprovação externa.
6. Integrar Meta API e processamento agendado.
