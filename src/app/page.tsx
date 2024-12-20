import Link from "next/link";

import { api, HydrateClient } from "~/trpc/server";
import SignedIn, {
  SignedOut,
  SignInButton,
  SignInButtonAmber,
} from "./_components/auth";
import NavBar from "./_components/navmenu";
import { buttonVariants } from "~/components/ui/button";

export default async function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <NavBar />
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
          Teeny <span className="text-[hsl(280,100%,70%)]">Game</span>
        </h1>
        <SignedOut>
          <SignInButton />
          <SignInButtonAmber />
        </SignedOut>
        <SignedIn>
          <Link
            className={buttonVariants({ variant: "default" })}
            href={"/games"}
          >
            Go to Lobby
          </Link>
        </SignedIn>
      </div>
    </main>
  );
}
