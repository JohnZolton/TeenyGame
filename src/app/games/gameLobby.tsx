"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { api } from "~/trpc/react";

export function GameLobby() {
  const [userNpub, setUserNpub] = useState<string | null>();
  const [displayName, setDisplayName] = useState<string | null>();
  const [imgUrl, setImgUrl] = useState<string | null>();
  const router = useRouter();
  useEffect(() => {
    setUserNpub(localStorage.getItem("userNpub"));
    setImgUrl(localStorage.getItem("profileImage"));
    setDisplayName(localStorage.getItem("displayName"));
  }, []);
  const { data: allGames } = api.game.getGames.useQuery();

  const { mutate: newGame } = api.game.makeGame.useMutation({
    onSuccess: (data) => void router.push(`games/${data.id}#init`),
  });
  const { mutate: joinGame } = api.game.joinGame.useMutation();

  return (
    <div>
      {allGames?.map((game) => (
        <div key={game.id} className="mb-4 rounded-lg border p-4">
          <h2 className="text-xl">Game {game.id}</h2>
          <p>Players:</p>
          {game.players.map((player, index) => (
            <div
              key={`player-${index}`}
              className="flex items-center justify-start"
            >
              {player.image && (
                <img
                  src={player.image}
                  className="h-10 w-10 rounded-full object-cover"
                />
              )}
              <div>{player.name ?? player.npub}</div>
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
