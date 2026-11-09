"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth_client";

export function GoogleButton({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await authClient.signIn.social({ provider: "google", callbackURL: next });
      }}
    >
      {busy ? "Opening Google…" : "Continue with Google"}
    </button>
  );
}
