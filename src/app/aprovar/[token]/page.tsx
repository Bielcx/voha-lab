import type { Metadata } from "next";

import { ApprovalReviewClient } from "@/app/aprovar/[token]/approval-review";
import { getApprovalReview } from "@/lib/approvals/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Revisar conteúdo · Voha",
  description: "Revise e aprove um conteúdo preparado no Voha.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function ApprovalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const review = await getApprovalReview(token);

  if (!review) {
    return (
      <main className="approval-page">
        <section className="approval-unavailable">
          <span className="approval-brand"><i /> VOHA</span>
          <div className="approval-pixel-mark" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
          <h1>Este link não está disponível</h1>
          <p>Ele pode ter sido digitado incorretamente ou substituído por uma nova versão.</p>
          <small>Peça um novo link para quem enviou o conteúdo.</small>
        </section>
      </main>
    );
  }

  return <ApprovalReviewClient token={token} initialReview={review} />;
}
