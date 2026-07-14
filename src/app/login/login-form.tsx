"use client";

import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useState, type FormEvent } from "react";

import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("E-mail ou senha incorretos.");
      setPending(false);
      return;
    }

    const bootstrapResponse = await fetch("/api/workspace/bootstrap", {
      method: "POST",
    });

    if (!bootstrapResponse.ok) {
      const result = (await bootstrapResponse.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(result?.error ?? "Não foi possível abrir seu workspace.");
      setPending(false);
      return;
    }

    window.location.assign("/");
  }

  return (
    <div className="login-form-wrap">
      <div className="login-form-heading">
        <span className="login-lock"><LockKeyhole size={18} /></span>
        <div>
          <span className="login-kicker">ÁREA DE TRABALHO</span>
          <h2>Que bom ter você aqui.</h2>
          <p>Entre para continuar organizando seus conteúdos.</p>
        </div>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <label>
          <span>E-mail</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="voce@exemplo.com"
            required
            disabled={pending}
          />
        </label>

        <label>
          <span>Senha</span>
          <span className="password-field">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Sua senha"
              required
              disabled={pending}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </span>
        </label>

        <p className="login-error" role="alert" aria-live="polite">
          {error}
        </p>

        <button className="login-submit" type="submit" disabled={pending}>
          <span>{pending ? "Abrindo seu workspace…" : "Entrar no Voha"}</span>
          <ArrowRight size={17} />
        </button>
      </form>

      <p className="login-access-note">
        Acesso reservado. Novos usuários são convidados pelo administrador.
      </p>
    </div>
  );
}
