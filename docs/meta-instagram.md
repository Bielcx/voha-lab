# Instagram API no Voha

O Voha usa **Instagram API with Instagram Login**. Esse fluxo conecta diretamente
uma conta profissional (Empresa ou Criador) e não exige uma Página do Facebook.

## Fluxo implementado

1. A Larissa escolhe um cliente e toca em **Conectar**.
2. O servidor valida sessão, permissão de edição, workspace e cliente.
3. O navegador é enviado ao Instagram com um `state` aleatório protegido em cookie
   `HttpOnly`, `SameSite=Lax` e de curta duração.
4. O callback troca o código por um token curto somente no servidor.
5. O servidor converte o token para longa duração, lê o perfil profissional e
   criptografa o token com AES-256-GCM.
6. O Supabase recebe apenas o token criptografado em `instagram_credentials`.
7. A interface mostra conectado, expirando, expirado ou erro e permite renovar,
   reconectar e desconectar.

Tokens, segredo do app e chave de criptografia nunca são enviados ao navegador,
incluídos em URLs do Voha ou gravados em logs.

## Permissões do MVP

- `instagram_business_basic`: identifica a conta profissional conectada.
- `instagram_business_content_publish`: necessária para publicar imagens,
  carrosséis e Reels na próxima etapa do MVP.

Os nomes antigos sem o prefixo `instagram_` foram descontinuados pela Meta em
27 de janeiro de 2025. A coleção oficial da Meta no Postman documenta os nomes
atuais e confirma que o fluxo com Instagram Login não exige Página do Facebook:
[Instagram API with Instagram Login](https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login).

## Variáveis

Adicione em `.env.local` para desenvolvimento e como segredos de runtime do Worker:

```dotenv
META_INSTAGRAM_APP_ID=
META_INSTAGRAM_APP_SECRET=
META_TOKEN_ENCRYPTION_KEY=
```

O App ID e o App Secret ficam em **Meta for Developers → Voha → Casos de uso →
API do Instagram**. Não envie nenhum desses valores por chat nem faça commit de
`.env.local`.

`META_TOKEN_ENCRYPTION_KEY` deve conter exatamente 32 bytes em Base64. Gere uma
chave nova no PowerShell:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

Guarde uma cópia da chave em um gerenciador de senhas. Perder ou trocar essa chave
sem um processo de rotação torna os tokens existentes ilegíveis e exige reconectar
as contas.

## Redirect URI

Em **Configuração da API com login do Instagram → Configurar o login da empresa no
Instagram**, cadastre exatamente:

```text
https://voha-lab.biel-cavalcanti1.workers.dev/api/instagram/callback
```

Para testar localmente, adicione também a URL equivalente ao valor usado em
`NEXT_PUBLIC_APP_URL`, por exemplo:

```text
http://localhost:3000/api/instagram/callback
```

O protocolo, domínio, porta, caminho e barra final precisam coincidir com a URL
enviada pelo Voha. Cada ambiente deve ter seu próprio `NEXT_PUBLIC_APP_URL`.

## Cloudflare

Cadastre os três valores Meta em **Workers & Pages → voha-lab → Settings →
Variables and Secrets** como `Secret` de runtime. Depois de alterar segredos, gere
um novo deploy.

## Teste antes da análise da Meta

Com Standard Access, somente contas profissionais adicionadas como testadoras no
App Dashboard podem autorizar. A conta da Larissa já deve aparecer com o convite
aceito em **Funções → Testadores do Instagram**.

Checklist:

- [ ] Aplicar a migration `202607200001_instagram_account_per_client.sql`.
- [ ] Preencher as três variáveis localmente, sem compartilhar os valores.
- [ ] Cadastrar as redirect URIs local e de produção na Meta.
- [ ] Conectar a conta da Larissa a um cliente pelo botão do Voha.
- [ ] Confirmar que o card mostra o `@usuario` e o estado **Instagram conectado**.
- [ ] Renovar a conexão e confirmar que ela continua conectada.
- [ ] Desconectar, confirmar o estado, e conectar novamente.
- [ ] Verificar que respostas e logs não contêm `access_token`, App Secret ou chave.

## Publicação e App Review

Para contas que não pertencem aos administradores/desenvolvedores/testadores do
app, a Meta exige Advanced Access e análise do app. Antes de enviar:

- configurar domínio, política de privacidade e URL de exclusão de dados;
- gravar um vídeo mostrando login, escolha do cliente e publicação;
- explicar de forma objetiva por que cada permissão é necessária;
- fornecer credenciais e instruções reproduzíveis para o revisor;
- concluir a verificação empresarial quando a Meta solicitar;
- manter na interface desconexão e informação clara sobre o uso dos dados.

Webhooks e permissões de mensagens/comentários não fazem parte desta issue. Eles só
devem ser adicionados quando uma funcionalidade do produto realmente precisar deles.
