"use client";

import { useAccount } from "./useAccount";

interface CurrentUser {
  name: string;
  email: string | null;
}

/** Name and email of the signed-in user ("ゲスト" until loaded / in dev login bypass). */
export function useCurrentUser(): CurrentUser {
  const { name, email } = useAccount();
  return { name, email };
}
