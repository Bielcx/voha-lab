import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "contato@voha-lab.com.br";

export const metadata: Metadata = {
  title: "Política de Privacidade — Voha",
  description: "Como o Voha coleta, utiliza, protege e exclui dados pessoais.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="LEGAL / PRIVACIDADE"
      title="Política de Privacidade"
      intro="Esta política explica como o Voha trata os dados necessários para planejar, aprovar e publicar conteúdo no Instagram."
      updatedAt="24 de julho de 2026"
      sections={[
        {
          title: "Dados tratados",
          content: (
            <>
              <p>
                Tratamos dados de conta, workspace e clientes cadastrados, identificadores de
                contas profissionais do Instagram, mídias enviadas, legendas, agendamentos,
                histórico de publicações e registros técnicos de segurança.
              </p>
              <p>
                Credenciais e tokens de integração são armazenados de forma protegida e usados
                apenas para executar as ações autorizadas pelo usuário.
              </p>
            </>
          ),
        },
        {
          title: "Finalidades e base de uso",
          content: (
            <p>
              Os dados são usados para autenticar usuários, organizar o calendário editorial,
              armazenar mídias, solicitar aprovações, publicar no Instagram, informar falhas e
              manter a segurança e a continuidade do serviço. Não vendemos dados pessoais nem os
              utilizamos para publicidade direcionada.
            </p>
          ),
        },
        {
          title: "Serviços envolvidos",
          content: (
            <p>
              O Voha utiliza Supabase para autenticação e banco de dados, Cloudflare Workers e R2
              para execução e armazenamento de mídias, e APIs da Meta para conectar e publicar em
              contas profissionais do Instagram. Cada fornecedor trata somente os dados
              necessários à sua função.
            </p>
          ),
        },
        {
          title: "Retenção e segurança",
          content: (
            <p>
              Mantemos os dados enquanto o workspace estiver ativo ou pelo período necessário
              para cumprir obrigações de segurança. Aplicamos controle de acesso por workspace,
              conexões criptografadas, credenciais protegidas e registros operacionais com
              retenção limitada.
            </p>
          ),
        },
        {
          title: "Seus direitos",
          content: (
            <p>
              Você pode solicitar acesso, correção, portabilidade ou exclusão dos seus dados,
              além de desconectar o Instagram a qualquer momento. Consulte também as{" "}
              <a href="/exclusao-de-dados">instruções de exclusão de dados</a>.
            </p>
          ),
        },
        {
          title: "Contato",
          content: (
            <p>
              Dúvidas ou solicitações sobre privacidade podem ser enviadas para{" "}
              <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
