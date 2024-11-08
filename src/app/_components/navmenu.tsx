"use client";

import Link from "next/link";
import { useAuth } from "./AuthContext";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "../../components/ui/dialog";
import {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { useRouter } from "next/navigation";
import SignedIn, { SignOutButton, SignedOut } from "./auth";
import NDK, {
  NDKSubscriptionCacheUsage,
  NDKSubscriptionOptions,
  NDKUser,
} from "@nostr-dev-kit/ndk";
import { Skeleton } from "~/components/ui/skeleton";

export const NavBar = () => {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="mx-auto flex w-full flex-row items-center justify-between px-4 pb-2 pt-4">
      <nav className="flex items-center justify-end">
        <div className={`flex flex-col items-end space-x-6`}>
          <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger>
              <Avatar setDisplayName={setDisplayName} />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="flex flex-col gap-y-1">
              <DropdownMenuItem>
                <div className="font-semibold">{displayName}</div>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href={"/"} className="">
                  Home
                </Link>
              </DropdownMenuItem>
              <SignedIn>
                <DropdownMenuItem>
                  <SignOutButton className="" />
                </DropdownMenuItem>
              </SignedIn>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </div>
  );
};

export default NavBar;

interface AvatarProps {
  setDisplayName?: (name: string) => void;
}
function Avatar({ setDisplayName }: AvatarProps) {
  const [url, setUrl] = useState("");
  const [userName, setUserName] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const { authWithNostr } = useAuth();
  const maxRetries = 10;
  useEffect(() => {
    if (typeof window !== "undefined") {
      const userNpub = localStorage.getItem("userNpub");
      const imgUrl = localStorage.getItem("profileImage");
      const displayName = localStorage.getItem("displayName");
      setUrl(imgUrl ?? "");
      if (setDisplayName) {
        setDisplayName(displayName ?? "");
        setUserName(displayName ?? "");
      }
      if (!imgUrl || !displayName) {
        void getProfile(userNpub);
      }
    }
  }, [setDisplayName]);
  async function handleNostrAuth() {
    try {
      const token = await authWithNostr();
      localStorage.setItem("authToken", token);
      const userNpub = localStorage.getItem("userNpub");
      const imgUrl = localStorage.getItem("profileImage");
      const displayName = localStorage.getItem("displayName");
      setUrl(imgUrl ?? "");
      setUserName(displayName ?? "");
    } catch (error) {
      console.error("Auth failed: ", error);
    }
  }

  useEffect(() => {
    const userNpub = localStorage.getItem("userNpub");
    if (!userNpub) {
      void handleNostrAuth();
    }
    if ((!url || !userName) && userNpub && retryCount < maxRetries) {
      const timeout = setTimeout(() => {
        void getProfile(userNpub);
        setRetryCount((prev) => prev + 1);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [url, userName, retryCount]);

  async function getProfile(npub: string | null) {
    if (!npub) {
      return;
    }
    const ndk = new NDK({
      explicitRelayUrls: [
        "wss://nos.lol",
        "wss://relay.nostr.band",
        "wss://relay.damus.io",
        "wss://relay.plebstr.com",
      ],
    });
    await ndk.connect();
    if (npub) {
      const user = ndk.getUser({ pubkey: npub });
      console.log(user);
      await user.fetchProfile();
      console.log(user.profile);
      localStorage.setItem("profileImage", user.profile?.image ?? "");
      localStorage.setItem("displayName", user.profile?.name ?? "");
      setUrl(user.profile?.image ?? "");
      setUserName(user.profile?.name ?? "");
    }
  }

  if (url) {
    return (
      <div className="flex items-center justify-center">
        <img src={url} className="h-10 w-10 rounded-full object-cover" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center">
      <Skeleton className="h-10 w-10 rounded-full object-cover" />
    </div>
  );
}
