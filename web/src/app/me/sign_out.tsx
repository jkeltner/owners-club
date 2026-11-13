"use client";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth_client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="button quiet"
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
