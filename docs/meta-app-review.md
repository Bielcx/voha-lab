# Preparação do App Review da Meta

Última revisão: 24 de julho de 2026.

Este documento não contém senhas, tokens nem dados de clientes. Credenciais de
revisão devem ser temporárias, armazenadas fora do Git e revogadas após a análise.

## Pré-requisitos externos

- [ ] Criar um portfólio empresarial chamado **Voha**.
- [ ] Associar o app Voha a esse portfólio.
- [ ] Adicionar Gabriel como administrador e Larissa somente com o acesso necessário.
- [ ] Configurar `voha-lab.com.br` como domínio do app.
- [ ] Concluir Business Verification quando o painel liberar a ação.
- [ ] Concluir Access Verification como Tech Provider, se o painel exigir.
- [ ] Manter o app em desenvolvimento até o pacote de revisão estar completo.

A verificação pode exigir empresa legalmente registrada, domínio, telefone,
endereço e documentos consistentes. Se o Voha ainda não possuir entidade jurídica,
confirmar no painel quais alternativas são oferecidas antes de enviar documentos
de outra empresa.

## URLs do app

```text
Aplicativo:
https://voha-lab.com.br

OAuth callback:
https://voha-lab.com.br/api/instagram/callback

Política de privacidade:
https://voha-lab.com.br/privacidade

Desautorização:
https://voha-lab.com.br/api/instagram/deauthorize

Exclusão de dados:
https://voha-lab.com.br/exclusao-de-dados
```

## Permissões solicitadas

### `instagram_business_basic`

Uso: identificar a conta profissional autorizada, exibir o usuário conectado e
associá-lo ao cliente correto no workspace.

Texto sugerido para o revisor:

> Voha uses `instagram_business_basic` to identify the professional Instagram
> account explicitly authorized by the user, display its username and associate
> it with the selected client workspace. The data is not sold or used for ads.

### `instagram_business_content_publish`

Uso: criar containers e publicar imagens, carrosséis e Reels preparados e
agendados pelo usuário.

Texto sugerido para o revisor:

> Voha uses `instagram_business_content_publish` so an authorized social media
> manager can publish or schedule organic images, carousels and Reels for the
> professional Instagram account they connected. Every publication is created
> and confirmed by the user inside Voha.

Não solicitar mensagens, comentários, insights ou webhooks enquanto não houver
uma funcionalidade real que dependa deles.

## Conta e dados de demonstração

- criar uma conta profissional pública exclusiva para revisão;
- adicionar imagens e vídeo sem direitos de terceiros;
- não usar conta, senha, mídia ou cliente real;
- criar um usuário Voha temporário com acesso somente ao workspace de revisão;
- deixar três clientes fictícios e um rascunho por formato;
- testar as credenciais em janela anônima antes do envio;
- guardar credenciais no campo privado da submissão, nunca neste arquivo.

## Roteiro do vídeo

Gravar uma única captura, sem cortes que escondam etapas:

1. abrir `voha-lab.com.br` e fazer login;
2. abrir **Clientes** e escolher o cliente de demonstração;
3. tocar em **Conectar Instagram**;
4. mostrar a tela da Meta, a conta selecionada e a autorização;
5. voltar ao Voha e mostrar o `@usuario` conectado;
6. abrir **Criar conteúdo**, selecionar imagem, escrever legenda e visualizar;
7. agendar e mostrar o post no calendário;
8. repetir de forma curta para carrossel e Reel;
9. mostrar histórico/publicação concluída na conta de demonstração;
10. voltar a Clientes e mostrar **Desconectar**;
11. abrir as páginas de privacidade e exclusão de dados.

O vídeo deve mostrar visualmente onde cada permissão é utilizada. Evitar música,
efeitos, informações pessoais, notificações do sistema e abas não relacionadas.

## Instruções para o revisor

1. acessar a URL do aplicativo;
2. entrar com o usuário temporário fornecido no campo privado;
3. abrir Clientes e selecionar **Cliente de revisão**;
4. conectar a conta profissional fornecida;
5. criar uma publicação de imagem com o texto indicado;
6. escolher **Publicar agora**;
7. confirmar o estado **Publicado** e conferir o Instagram;
8. desconectar a conta ao terminar.

Informar o fuso `America/Sao_Paulo` e avisar que o cron processa itens devidos a
cada minuto.

## Depois da aprovação

- testar uma conta profissional que não seja tester do app;
- confirmar conexão, publicação e desconexão;
- remover o usuário e as credenciais temporárias do revisor;
- registrar permissões, data de aprovação e observações na issue;
- revisar mensalmente falhas, rate limits e tokens próximos do vencimento;
- repetir App Review antes de adicionar novos casos de uso.
