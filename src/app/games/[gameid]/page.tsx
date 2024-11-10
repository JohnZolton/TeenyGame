// src/app/games/[gameid]/page.tsx
import GameRoom from "./gameroom";

type GameRoomPageProps = {
  params: Promise<{
    gameid: string;
  }>;
};

export default async function GameRoomPage({ params }: GameRoomPageProps) {
  const resolvedParams = await params;
  return <GameRoom gameid={resolvedParams.gameid} />;
}
