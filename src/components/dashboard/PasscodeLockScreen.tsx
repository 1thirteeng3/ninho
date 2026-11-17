"use client";

import React, { useState } from "react";
import { Lock } from "lucide-react";

interface PasscodeLockScreenProps {
  onUnlocked: () => void;
}

export function PasscodeLockScreen({ onUnlocked }: PasscodeLockScreenProps) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passcode.trim() || isChecking) return;

    setIsChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        setError(data.message ?? "Senha incorreta.");
        return;
      }
      setPasscode("");
      onUnlocked();
    } catch {
      setError("Não foi possível validar o acesso. Tente novamente.");
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <section className="surface-card w-full max-w-sm rounded-2xl p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <h1 className="font-editorial inline-flex items-baseline text-3xl italic tracking-tight text-ink">
            <span>Ninho</span>
            <span
              className="ml-0.5 not-italic font-sans font-black"
              style={{ color: "var(--accent-vivid)" }}
            >
              .
            </span>
          </h1>
          <span className="surface-rose-tint inline-flex h-9 w-9 items-center justify-center rounded-full text-[#EC4899]">
            <Lock className="h-4 w-4" />
          </span>
        </div>

        <p className="mt-2 text-xs text-ink-secondary">
          Acesso restrito a <strong>Giovanni &amp; Maria Luiza</strong>. Digite a
          senha do casal para abrir o painel.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="ninho-passcode"
              className="block text-[11px] font-semibold text-ink-secondary mb-1"
            >
              Senha / PIN de acesso
            </label>
            <input
              id="ninho-passcode"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Digite a senha do casal"
              className="surface-card w-full rounded-xl px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-[#EC4899] focus:outline-none"
            />
          </div>

          {error && (
            <p className="text-xs font-semibold text-[#EC4899]">{error}</p>
          )}

          <button
            type="submit"
            disabled={isChecking || !passcode.trim()}
            className="pressable w-full rounded-full border-2 border-[#1F0D18] bg-[#FF3B9A] px-4 py-2.5 text-xs font-bold text-white shadow-[2px_2px_0px_#1F0D18] disabled:opacity-50"
          >
            {isChecking ? "Verificando..." : "Entrar no Ninho"}
          </button>
        </form>
      </section>
    </main>
  );
}
