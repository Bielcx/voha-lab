import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar · Voha",
  description: "Acesse seu calendário de conteúdo no Voha.",
};

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-story" aria-label="Sobre o Voha">
        <div className="login-wordmark">
          <span className="login-pixel-heart" aria-hidden="true">
            {Array.from({ length: 63 }, (_, index) => <i key={index} />)}
          </span>
          <strong>voha</strong>
        </div>
        <div className="login-story-copy">
          <span className="login-kicker">SEU ESTÚDIO DE CONTEÚDO</span>
          <h1>Ideias no lugar.<br />Posts no ar.</h1>
          <p>Planeje, aprove e publique no Instagram sem perder o ritmo.</p>
        </div>
        <div className="login-week" aria-hidden="true">
          <span>SEG</span><span>TER</span><span>QUA</span><span>QUI</span><span>SEX</span>
          <i /><i className="has-post" /><i /><i className="has-post coral" /><i />
        </div>
        <small>Feito para a rotina real de quem cuida de várias marcas.</small>
      </section>

      <section className="login-panel">
        <LoginForm />
      </section>
    </main>
  );
}
