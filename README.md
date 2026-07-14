# Voha

Plataforma mobile-first de planejamento, aprovação e agendamento de conteúdo para Instagram.

O frontend atual funciona com dados fictícios. A fundação de backend está preparada para:

- Vercel: aplicação Next.js e rotas de servidor.
- Supabase: autenticação, PostgreSQL e Row Level Security.
- Cloudflare R2: imagens, carrosséis e Reels via URLs assinadas.

## Desenvolvimento

```bash
npm install
copy .env.example .env.local
npm run dev
```

Acesse `http://localhost:3000`. Sem credenciais, o protótipo continua funcionando com os mocks atuais.

## Configuração dos serviços

1. Crie um projeto no Supabase.
2. Copie a URL, a chave publicável e a chave secreta para `.env.local`.
3. Execute a migration em `supabase/migrations` pelo SQL Editor ou pela Supabase CLI.
4. Crie um bucket privado `voha-media` no Cloudflare R2.
5. Crie um token R2 limitado a esse bucket e preencha as variáveis restantes.
6. Configure o CORS do bucket para os domínios local e de produção.
7. Repita as variáveis no projeto da Vercel.

Nunca exponha `SUPABASE_SECRET_KEY` ou as credenciais `R2_*` no navegador.

## Verificações

```bash
npm run lint
npm run build
```

## Documentação

- [Arquitetura e modelo de dados](docs/architecture.md)
- [Custos, limites, alertas e continuidade](docs/costs-and-limits.md)
