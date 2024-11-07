import Link from "next/link";

import { api, HydrateClient } from "~/trpc/server";

export default async function Lobby() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      Lobby
    </main>
  );
}
