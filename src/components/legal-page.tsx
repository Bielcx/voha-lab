import Link from "next/link";
import type { ReactNode } from "react";

type LegalSection = {
  title: string;
  content: ReactNode;
};

type LegalPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  updatedAt: string;
  sections: LegalSection[];
};

export function LegalPage({ eyebrow, title, intro, updatedAt, sections }: LegalPageProps) {
  return (
    <main className="legal-page">
      <header className="legal-header">
        <Link className="legal-brand" href="/" aria-label="Voltar para o Voha">
          <span aria-hidden="true">♥</span>
          <strong>Voha</strong>
        </Link>
        <Link className="legal-back" href="/">
          Voltar ao aplicativo
        </Link>
      </header>

      <article className="legal-document">
        <div className="legal-title">
          <span>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{intro}</p>
          <small>Última atualização: {updatedAt}</small>
        </div>

        <div className="legal-sections">
          {sections.map((section, index) => (
            <section key={section.title}>
              <span className="legal-index">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h2>{section.title}</h2>
                {section.content}
              </div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
