import Pusher from "pusher";
import PusherClient from "pusher-js";

export const pusher = new Pusher({
  appId: process.env.NEXT_PUBLIC_PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

export const pusherClient = new PusherClient(
  process.env.NEXT_PUBLIC_PUSHER_KEY!,
  {
    authEndpoint: "/api/pusher/auth",
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  },
);
