"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className ?? "text-sm text-stone-500 hover:text-stone-800"}
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      로그아웃
    </button>
  );
}
