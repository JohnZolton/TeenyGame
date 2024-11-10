import jwt from "jsonwebtoken";
import NDK, { NDKEvent, NDKNip07Signer } from "@nostr-dev-kit/ndk";
import { validateEvent } from "nostr-tools";
import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET ?? "your_jwt_secret";

export async function POST(request: NextRequest) {
  interface AuthRequestBody {
    signedEvent: string;
  }
  const { signedEvent } = (await request.json()) as AuthRequestBody;

  try {
    const rawEvent = JSON.parse(
      Buffer.from(signedEvent, "base64").toString("utf-8"),
    ) as NDKEvent;
    console.log(rawEvent);

    if (!rawEvent) {
      return NextResponse.json(
        { error: "Failed to parse event" },
        { status: 400 },
      );
    }

    if (rawEvent.kind !== 27235) {
      return NextResponse.json(
        { error: "Invalid event kind" },
        { status: 400 },
      );
    }
    const ourUrl = `https://${
      process.env.AUTH_URL ?? "localhost:3000"
    }/api/auth/extension`;
    const goodTags = [
      ["u", ourUrl],
      ["method", "GET"],
    ];
    const tagsMatch = goodTags.every((tag) =>
      rawEvent.tags.some(
        (rawTag) => rawTag[0] === tag[0] && rawTag[1] === tag[1],
      ),
    );
    if (!tagsMatch) {
      return NextResponse.json(
        { error: "Invalid event tags" },
        { status: 400 },
      );
    }

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(rawEvent.created_at! - now) > 60) {
      return NextResponse.json({ error: "Event too old" }, { status: 400 });
    }

    const isGood = validateEvent(rawEvent);
    if (isGood) {
      const token = jwt.sign({ pubkey: rawEvent.pubkey }, JWT_SECRET, {});
      return NextResponse.json(
        { token },
        {
          status: 200,
        },
      );
    }
    return NextResponse.json({ error: "Unknown" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
