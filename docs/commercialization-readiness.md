# Preparação do Voha para comercialização

> Documento vivo. Última revisão: 14 de julho de 2026. Este material organiza decisões de produto e operação; não substitui orientação jurídica, contábil ou tributária profissional.

## Estado atual

O Voha está em desenvolvimento para uso privado da Larissa e **ainda não está autorizado para venda**.

A arquitetura baseada em `workspace_id`, membros e Row Level Security é uma boa fundação para SaaS, mas ainda existem comportamentos específicos do workspace da Larissa, dados demo, ausência de cobrança e integração com a Meta não concluída.

## Regra de lançamento

Nenhum cliente deve ser cobrado enquanto os seguintes bloqueadores não estiverem resolvidos:

| Gate | Critério mínimo | Estado atual |
| --- | --- | --- |
| Produto | Fluxo criar → aprovar → agendar → publicar funcionando | Pendente |
| Meta | Aplicativo aprovado, em modo Live e publicando com OAuth | Pendente |
| Multiempresa | Isolamento entre workspaces testado automaticamente | Parcial |
| Segurança | Auditoria, backups, limites e resposta a incidentes | Pendente |
| Legal/LGPD | Termos, privacidade, contratos e exclusão de dados | Pendente |
| Financeiro | Planos, margem, impostos, cobrança e cancelamento | Pendente |
| Operação | Monitoramento, suporte e procedimento de falhas | Pendente |
| Infraestrutura | Planos comerciais e limites financeiros configurados | Pendente |

## 1. Meta e Instagram

A aprovação da Meta é o maior bloqueador externo. O Voha não deve armazenar senhas do Instagram nem prometer publicação automática antes de concluir o processo oficial.

### Requisitos

- [ ] Criar e configurar o aplicativo comercial na Meta.
- [ ] Definir o fluxo OAuth adequado para contas profissionais.
- [ ] Solicitar somente as permissões necessárias.
- [ ] Concluir App Review e verificações exigidas.
- [ ] Colocar o aplicativo em modo Live.
- [ ] Publicar imagem, carrossel e Reel em ambiente real.
- [ ] Registrar versão da Graph API e calendário de upgrades.
- [ ] Documentar rate limits e limites de publicação.
- [ ] Implementar renovação, expiração e revogação de tokens.
- [ ] Disponibilizar política de privacidade e exclusão de dados.
- [ ] Implementar callback/processo de exclusão exigido pela plataforma.
- [ ] Armazenar códigos, subcódigos e respostas de erro sem vazar tokens.

Referência principal: [Instagram Platform](https://developers.facebook.com/docs/instagram-platform/).

### Promessa comercial

Os contratos e a interface devem explicar que a publicação depende da disponibilidade e das regras da Meta. Uma publicação agendada não deve ser apresentada como garantia absoluta; o Voha deve informar falhas rapidamente, preservar o conteúdo e permitir nova tentativa segura.

## 2. Infraestrutura para uso comercial

O plano Hobby da Vercel é restrito a uso pessoal e não comercial. Antes da primeira venda, o projeto deve migrar para Vercel Pro ou outra hospedagem autorizada. [Vercel Hobby](https://vercel.com/docs/plans/hobby).

- [ ] Migrar a hospedagem para plano comercial.
- [ ] Decidir Supabase Free versus Pro considerando pausas e backups.
- [ ] Configurar Spend Cap e hard limits.
- [ ] Configurar alertas de uso e cobrança.
- [ ] Definir quota interna de armazenamento por plano.
- [ ] Configurar domínio próprio e renovação.
- [ ] Manter ambientes de desenvolvimento e produção separados.

Valores, limites e procedimentos estão em [costs-and-limits.md](costs-and-limits.md).

## 3. Arquitetura multiempresa

Todo recurso deve pertencer a um workspace e toda consulta deve verificar a associação do usuário.

### Remover particularidades do protótipo

- [ ] Substituir o workspace fixo `Larissa Cruz` por onboarding genérico.
- [ ] Tornar o seed demo opcional e removível.
- [ ] Remover nomes, mensagens e regras específicas da Larissa.
- [ ] Criar configuração de nome, fuso e identidade por workspace.

### Contas e permissões

- [ ] Cadastro ou convite seguro de novos usuários.
- [ ] Confirmação de e-mail e recuperação de senha.
- [ ] Papéis `owner`, `editor` e `approver` aplicados em todas as operações.
- [ ] Transferência segura de propriedade.
- [ ] Remoção de membros e revogação imediata de sessões.
- [ ] MFA para proprietários e administradores.

### Isolamento

- [ ] Testes automatizados tentando acessar outro workspace.
- [ ] Testes de RLS para leitura, escrita, alteração e exclusão.
- [ ] Chaves do R2 sempre prefixadas por workspace.
- [ ] URLs assinadas curtas e limitadas ao objeto autorizado.
- [ ] Nenhum identificador enviado pelo navegador deve substituir autorização no servidor.

## 4. LGPD e privacidade

Os papéis de controlador, operador e suboperador devem ser definidos de acordo com as decisões reais sobre o tratamento, e não apenas pelo nome colocado no contrato. O cliente pode ser controlador dos conteúdos e contatos tratados no Voha, enquanto o Voha pode ser operador nesse contexto e controlador dos dados próprios de conta, segurança e cobrança. [Guia da ANPD sobre agentes de tratamento](https://www.gov.br/anpd/pt-br/assuntos/noticias/nova-versao-do-guia-dos-agentes-de-tratamento).

### Documentos

- [ ] Termos de uso.
- [ ] Política de privacidade.
- [ ] Contrato de prestação do serviço.
- [ ] Acordo de tratamento de dados quando aplicável.
- [ ] Lista de suboperadores: Vercel, Supabase, Cloudflare e futuros fornecedores.
- [ ] Política de cookies se forem usados cookies não essenciais.
- [ ] Política de retenção, backup e exclusão.
- [ ] Procedimento de incidente e comunicação.

### Direitos dos titulares

- [ ] Canal de contato para privacidade.
- [ ] Exportação dos dados do workspace.
- [ ] Correção de dados cadastrais.
- [ ] Exclusão de conta, workspace, mídia e tokens.
- [ ] Registro de pedidos e prazos de atendimento.
- [ ] Avaliação de transferência internacional de dados.
- [ ] Definição do responsável ou encarregado aplicável.

Antes do lançamento, advogado com experiência em tecnologia/LGPD deve revisar os documentos e o fluxo real.

## 5. Segurança para SaaS

- [ ] Tokens da Meta criptografados e separados dos dados comuns.
- [ ] Segredos somente no servidor e com rotação documentada.
- [ ] Rate limiting em login, upload, convites, publicação e aprovação.
- [ ] Validação de MIME, extensão, tamanho e conteúdo dos uploads.
- [ ] Checksum e proteção contra arquivos duplicados.
- [ ] Logs de auditoria para ações sensíveis.
- [ ] Backups automáticos e teste periódico de restauração.
- [ ] Política de acesso do suporte aos dados dos clientes.
- [ ] Sessões revogáveis e proteção contra dispositivos perdidos.
- [ ] Dependências e vulnerabilidades verificadas antes de cada release.
- [ ] Plano de resposta a incidentes com responsáveis e contatos.
- [ ] Revisão de segurança antes da beta e antes do lançamento público.

## 6. Planos e unit economics

O preço precisa cobrir infraestrutura, impostos, suporte, perdas de cobrança e margem. Não deve ser baseado somente no custo do servidor.

### Possíveis dimensões dos planos

- quantidade de contas do Instagram conectadas;
- quantidade de clientes gerenciados;
- usuários do workspace;
- armazenamento utilizado;
- publicações mensais;
- aprovação externa e histórico;
- nível de suporte.

Uma estrutura inicial simples pode ter planos Solo, Studio e Agência. Os números e valores só devem ser definidos depois da beta, usando consumo real de mídia, publicação e suporte.

### Métricas necessárias

- [ ] Custo de infraestrutura por workspace ativo.
- [ ] Armazenamento médio por cliente.
- [ ] Publicações e tentativas por mês.
- [ ] Minutos de suporte por workspace.
- [ ] Taxa de falha de publicação.
- [ ] Custo de aquisição de cliente.
- [ ] Churn e inadimplência.
- [ ] Margem bruta por plano.

## 7. Cobrança, empresa e impostos

Antes de cobrar no Brasil, contador deve orientar:

- [ ] CNPJ e CNAE adequados.
- [ ] Regime tributário.
- [ ] Emissão de nota fiscal de serviço.
- [ ] Venda B2B versus B2C.
- [ ] Impostos sobre recorrência de software/SaaS.
- [ ] Cancelamento, reembolso e inadimplência.
- [ ] Aplicação do Código de Defesa do Consumidor.

A integração de cobrança precisa ter:

- [ ] Checkout seguro em provedor especializado.
- [ ] Webhooks assinados e idempotentes.
- [ ] Plano, entitlement e quota salvos separadamente.
- [ ] Período de tolerância para falha de pagamento.
- [ ] Downgrade sem perda imediata de dados.
- [ ] Cancelamento e exportação acessíveis.
- [ ] Reconciliação entre provedor, banco e notas fiscais.

## 8. Operação e suporte

- [ ] Canal e horário de suporte definidos.
- [ ] Prazo de primeira resposta por plano.
- [ ] Página de status.
- [ ] Alertas para publicação falha e token expirando.
- [ ] Monitoramento da fila/agendador.
- [ ] Retentativas limitadas, com backoff e idempotência.
- [ ] Runbook para falhas da Meta, Supabase, R2 e Vercel.
- [ ] Comunicação de incidentes e manutenção.
- [ ] Registro de causa raiz para incidentes relevantes.
- [ ] Política de créditos ou compensação, se oferecida.

## 9. Propriedade intelectual e marca

- [ ] Confirmar titularidade do código, logo, textos e assets.
- [ ] Verificar disponibilidade do nome Voha e domínios.
- [ ] Avaliar registro de marca no INPI antes de escalar divulgação.
- [ ] Revisar licenças de bibliotecas, ícones, fontes e imagens.
- [ ] Respeitar as regras de marca e uso de assets do Instagram/Meta.
- [ ] Definir no contrato que o cliente mantém a propriedade do próprio conteúdo.

## Estratégia recomendada

1. Terminar o fluxo funcional com dados demo.
2. Concluir upload no R2 e persistência de posts.
3. Integrar e obter aprovação da Meta.
4. Operar o Voha exclusivamente com Larissa por um período real.
5. Convidar de dois a cinco social medias para uma beta privada.
6. Medir consumo, falhas, suporte e disposição a pagar.
7. Implementar planos e cobrança com base nesses dados.
8. Fazer revisão jurídica, contábil e de segurança.
9. Abrir vendas gradualmente.

## Critério para beta paga

A beta paga só pode começar quando:

- a publicação pela Meta estiver aprovada e estável;
- cada workspace estiver isolado e testado;
- houver backup, alertas e recuperação de falhas;
- termos, privacidade e cancelamento estiverem disponíveis;
- o plano comercial da infraestrutura estiver ativo;
- o suporte tiver responsável e prazo definidos;
- o cliente souber claramente que se trata de uma beta.

