import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { validateEvent } from "nostr-tools";
import { NDKEvent } from "@nostr-dev-kit/ndk";

const JWT_SECRET = process.env.JWT_SECRET ?? "your_jwt_secret";

export async function GET(request: NextRequest) {
  console.log([...request.nextUrl.searchParams.entries()]);

  const event = request.nextUrl.searchParams.get("event");
  console.log(event);

  try {
    const decodedEvent = decodeURIComponent(event!);
    console.log(decodedEvent);

    if (!decodedEvent || typeof decodedEvent !== "string") {
      return NextResponse.json({ error: "No event provided" }, { status: 400 });
    }

    const rawEvent = JSON.parse(decodedEvent) as NDKEvent;
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
    const ourUrl = `https://www.teenygame.com/api/authenticate`;
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

    const isGood = validateEvent(rawEvent);
    console.log("ITS GOOD");

    if (isGood) {
      const token = jwt.sign({ pubkey: rawEvent.pubkey }, JWT_SECRET, {
        expiresIn: "2h",
      });

      const html = `
        <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Authentication Complete</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f0f0f0;
            color: #333;
        }
        .container {
            text-align: center;
            padding: 20px;
            background-color: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            font-size: 24px;
            margin-bottom: 10px;
        }
        p {
            font-size: 18px;
            line-height: 1.5;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Authentication Complete</h1>
        <p>You can now close this window and return to the app.</p>
    </div>

    <script>
        console.log('AMBER AUTH HIT');
        localStorage.setItem('authHeader', 'Bearer ${token}');
        localStorage.setItem('userNpub', '${rawEvent.pubkey}');
        if (window.opener){
          window.opener.location.reload();
        }
        window.close();
        setTimeout(() => {
            window.location.href = 'https://${
              process.env.AUTH_URL ?? "localhost:3000"
            }/home';
        }, 1000);
    </script>
</body>
</html>
      `;
      const response = new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html",
        },
      });
      return response;
    } else {
      return NextResponse.json(
        { error: "Invalid event or signature" },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Authentication error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
