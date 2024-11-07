"use client";

import { jwtDecode } from "jwt-decode";
import "~/styles/globals.css";
import type { AppProps } from "next/app";
import NDK, { NDKEvent, NostrEvent, NDKNip07Signer } from "@nostr-dev-kit/ndk";
import {
  createContext,
  useEffect,
  useState,
  ReactNode,
  useContext,
} from "react";
import { EventTemplate } from "nostr-tools";
import { WindowNostr } from "nostr-tools/nip07";
import { Buffer } from "buffer";
import { JwtPayload } from "jsonwebtoken";

interface AuthContextProps {
  authHeader: string | null;
  user: string | null;
  authWithNostr: () => Promise<string>;
}
export const AuthContext = createContext<AuthContextProps>({
  authHeader: null,
  user: null,
  authWithNostr: async () => Promise.resolve(""),
});
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authHeader, setAuthHeader] = useState<string | null>(null);
  const [user, setUser] = useState<string | null>(null);
  useEffect(() => {
    const storedAuthHeader = localStorage.getItem("authHeader");
    if (storedAuthHeader) {
      setAuthHeader(storedAuthHeader);
    }
    const storedNpub = localStorage.getItem("userNpub");
    if (storedNpub) {
      setUser(storedNpub);
    }
  }, []);

  async function authWithNostr() {
    const nostr = window.nostr as WindowNostr;
    if (!nostr) {
      return "";
    }
    const isLiveMode = process.env.NODE_ENV === "production";

    const authUrl = `https://${
      isLiveMode ? (process.env.AUTH_URL ?? "liftr.club") : "localhost:3000"
    }/api/authenticate`;
    const event = await nostr.signEvent({
      kind: 27235,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["u", authUrl],
        ["method", "GET"],
      ],
      content: "",
    });

    const base64Event = Buffer.from(JSON.stringify(event)).toString("base64");
    const response = await fetch("/api/authenticate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ signedEvent: base64Event }),
    });
    if (!response.ok) {
      throw new Error("failed to authenticate");
    }
    interface AuthResponse {
      token: string;
    }
    const { token } = (await response.json()) as AuthResponse;
    localStorage.setItem("authHeader", `Bearer ${token}`);
    localStorage.setItem("userNpub", event.pubkey);
    setUser(event.pubkey);
    const ndk = new NDK({
      explicitRelayUrls: [
        "wss://nos.lol",
        "wss://relay.nostr.band",
        "wss://relay.damus.io",
        "wss://relay.plebstr.com",
      ],
    });
    await ndk.connect();
    const user = ndk.getUser({ pubkey: event.pubkey });
    console.log(user);
    await user.fetchProfile();
    console.log(user.profile);
    localStorage.setItem("profileImage", user.profile?.image ?? "");
    localStorage.setItem("displayName", user.profile?.displayName ?? "");
    return token;
  }

  function verifyJWT(token: string) {
    try {
      const decodedToken = jwtDecode<JwtPayload>(token);
      const currentTime = Date.now() / 1000;
      if (decodedToken && decodedToken.exp !== undefined) {
        return decodedToken.exp > currentTime;
      }
      return false;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  useEffect(() => {
    if (!authHeader) return;

    const checkTokenValidity = () => {
      const isValid = verifyJWT(authHeader);
      if (!isValid) {
        localStorage.removeItem("authHeader");
        setAuthHeader(null);
      }
    };

    const intervalId = setInterval(checkTokenValidity, 5 * 60 * 1000); // Check every 5 minutes

    return () => clearInterval(intervalId);
  }, [authHeader]);

  const updateAuthFromStorage = () => {
    const storedAuthHeader = localStorage.getItem("authHeader");
    const userNpub = localStorage.getItem("userNpub");
    if (storedAuthHeader && verifyJWT(storedAuthHeader)) {
      setAuthHeader(storedAuthHeader);
      if (userNpub) {
        setUser(userNpub);
      }
    } else {
      localStorage.removeItem("authHeader");
      setAuthHeader(null);
    }

    const storedNpub = localStorage.getItem("userNpub");
    setUser(storedNpub);
  };

  // Initial load and setup storage event listener
  useEffect(() => {
    updateAuthFromStorage();

    // Event listener for storage changes
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "authHeader" || event.key === "userNpub") {
        updateAuthFromStorage();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ authHeader, user, authWithNostr }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
