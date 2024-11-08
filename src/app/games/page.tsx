import Link from "next/link";
import { api } from "~/trpc/react";
import NavBar from "../_components/navmenu";
import { Suspense } from "react";
import { LoadingSpinner } from "../_components/loader";
import { HydrateClient } from "~/trpc/server";
import { GameLobby } from "./gameLobby";

export default async function Lobby() {
  return (
    <HydrateClient>
      <div className="flex min-h-screen flex-col items-center justify-start bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <NavBar />
        <div className="container mx-auto p-4">
          <GameLobby />
        </div>
      </div>
    </HydrateClient>
  );
}
