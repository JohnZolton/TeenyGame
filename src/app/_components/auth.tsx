"use client";
import { useAuth } from "./AuthContext";
import React, { ReactNode } from "react";
import { Button } from "~/components/ui/button";
import { useRouter } from "next/navigation";

interface AuthComponentProps {
  children: ReactNode;
}

export default function SignedIn({ children }: AuthComponentProps) {
  const { user, authHeader } = useAuth();
  if (authHeader) {
    return null;
  }
  return <>{children}</>;
}

export function SignedOut({ children }: AuthComponentProps) {
  const { user, authHeader } = useAuth();
  if (!authHeader) {
    return null;
  }
  return <>{children}</>;
}

interface SignOutButtonProps {
  className?: string;
}
export function SignOutButton({ className }: SignOutButtonProps) {
  const router = useRouter();
  function handleSignOut() {
    try {
      localStorage.clear();
      void router.push("/");
    } catch (error) {
      console.error("logout failed: ", error);
    }
  }
  return (
    <button onClick={() => handleSignOut()} className={className ?? ""}>
      Sign out
    </button>
  );
}

export function SignInButton() {
  const router = useRouter();
  const { authWithNostr } = useAuth();
  async function handleSignIn() {
    try {
      const token = await authWithNostr();
      void router.push("/games");
    } catch (error) {
      console.error("Auth failed: ", error);
    }
  }
  function handleButtonClick() {
    handleSignIn().catch((error) => console.error("error: ", error));
  }
  return (
    <Button onClick={handleButtonClick}>Sign in with Nostr Extension</Button>
  );
}

export function SignInButtonAmber() {
  function handleSignIn() {
    try {
      const isLiveMode = process.env.NODE_ENV === "production";
      const baseUrl = "https://www.teenygame.com";
      const authUrl = `${baseUrl}/api/authenticate`;
      const callbackUrl = `${
        isLiveMode ? baseUrl : window.location.origin
      }/api/auth/amber?event=`;

      const event = {
        kind: 27235,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ["u", authUrl],
          ["method", "GET"],
        ],
        content: "",
      };

      const encodedJson = encodeURIComponent(JSON.stringify(event));
      const signerUrl = `nostrsigner:${encodedJson}?compressionType=none&returnType=event&type=sign_event&callbackUrl=${callbackUrl}`;

      window.open(signerUrl, "_blank");
    } catch (error) {
      console.error("Auth failed: ", error);
    }
  }
  return <Button onClick={handleSignIn}>Sign in with Amber</Button>;
}
