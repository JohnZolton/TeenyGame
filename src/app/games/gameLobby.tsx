"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { pusherClient } from "~/lib/pusher";
import { api } from "~/trpc/react";
import { game, player } from "@prisma/client";

export function GameLobby() {
  const [userNpub, setUserNpub] = useState<string | null>();
  const [displayName, setDisplayName] = useState<string | null>();
  const [imgUrl, setImgUrl] = useState<string | null>();
  const [games, setGames] = useState<(game & { players: player[] })[]>([]);
  const router = useRouter();
  const { data: allGames, isLoading, isError } = api.game.getGames.useQuery();
  useEffect(() => {
    setUserNpub(localStorage.getItem("userNpub"));
    setImgUrl(localStorage.getItem("profileImage"));
    setDisplayName(localStorage.getItem("displayName"));

    if (allGames) {
      setGames(allGames);
    }

    const channel = pusherClient.subscribe("game-events");
    channel.bind("gameCreated", (newGame: game & { players: player[] }) => {
      console.log("newgame: ", newGame);
      setGames((prevGames) => [...prevGames, newGame]);
    });
    return () => {
      pusherClient.unsubscribe("game-events");
    };
  }, [allGames]);

  const { mutate: newGame } = api.game.makeGame.useMutation({
    onSuccess: (data) => void router.push(`games/${data.id}#init`),
  });
  const { mutate: joinGame } = api.game.joinGame.useMutation();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (isError) {
    return <div>Error fetching games</div>;
  }

  return (
    <div>
      <div>
        {games?.map((game) => (
          <div key={game.id} className="mb-4 rounded-lg border p-4">
            <h2 className="text-xl">{game.gameName}</h2>
            <p>Players:</p>
            {game.players?.map((player, index) => (
              <div
                key={`${game.id}-${index}`}
                className="flex items-center justify-start"
              >
                {player.image && (
                  <img
                    src={player.image}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                )}
                <div>{player.name}</div>
              </div>
            ))}
            <button
              onClick={() => {
                joinGame({ gameId: game.id, playerId: userNpub ?? "" });
                router.push(`/games/${game.id}`);
              }}
              className="mt-2 rounded bg-blue-500 px-4 py-2 hover:bg-blue-600"
            >
              Join Game
            </button>
          </div>
        ))}
      </div>
      <button
        disabled={!(userNpub ?? imgUrl ?? displayName)}
        onClick={() =>
          newGame({
            playerId: userNpub!,
            image: imgUrl!,
            name: displayName!,
            gameName: "Flappy-Bird",
          })
        }
        className="mt-4 rounded bg-green-500 px-4 py-2 hover:bg-green-600"
      >
        Create New Game
      </button>
    </div>
  );
}
