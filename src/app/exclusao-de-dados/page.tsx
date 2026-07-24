import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "contato@voha-lab.com.br";

export const metadata: Metadata = {
  title: "Exclusão de Dados — Voha",
  description: "Instruções para desconectar o Instagram e solicitar a exclusão de dados no Voha.",
};

export default function DataDeletionPage() {
  return (
    <LegalPage
      eyebrow="LEGAL / CONTROLE DE DADOS"
      title="Exclusão de dados"
      intro="Você controla sua conexão com o Instagram e pode solicitar a remoção dos dados mantidos pelo Voha."
      updatedAt="24 de julho de 2026"
      sections={[
        {
          title: "Desconectar o Instagram",
          content: (
            <p>
              No Voha, abra Clientes, selecione o cliente conectado e use a ação “Desconectar”.
              O token de acesso armazenado pelo Voha será removido e novas publicações deixarão de
              ser enviadas para essa conta.
            </p>
          ),
        },
        {
          title: "Remover o Voha pela Meta",
          content: (
            <p>
              Você também pode revogar o acesso nas configurações da sua conta do Instagram ou da
              Central de Contas da Meta. A revogação invalida a autorização concedida ao Voha.
            </p>
          ),
        },
        {
          title: "Solicitar exclusão completa",
          content: (
            <p>
              Envie a solicitação a partir do e-mail associado ao workspace para{" "}
              <a href={`mailto:${supportEmail}?subject=Exclusão de dados no Voha`}>
                {supportEmail}
              </a>
              . Informe o nome do workspace e o usuário do Instagram conectado. Nunca envie sua
              senha ou token de acesso.
            </p>
          ),
        },
        {
          title: "Prazo e confirmação",
          content: (
            <p>
              Confirmaremos o recebimento e concluiremos a exclusão em até 30 dias, salvo quando a
              retenção mínima for necessária para segurança, prevenção a fraude ou cumprimento de
              obrigação legal. Ao concluir, enviaremos uma confirmação ao solicitante.
            </p>
          ),
        },
        {
          title: "O que será removido",
          content: (
            <p>
              A solicitação pode abranger perfil, associação ao workspace, clientes, conexões do
              Instagram, mídias, posts, aprovações, histórico e notificações. Backups técnicos,
              quando existentes, expiram conforme a política de retenção e não retornam ao uso
              normal do produto.
            </p>
          ),
        },
      ]}
    />
  );
}
