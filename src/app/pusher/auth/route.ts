import { NextRequest, NextResponse } from "next/server";
import { pusher } from "~/lib/pusher";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const socketId = formData.get("socket_id");
    const channelName = formData.get("channel_name");

    if (!(socketId ?? channelName)) {
      throw new Error("Required field socket_id is missing");
    }
    if (typeof socketId !== "string" || typeof channelName !== "string") {
      throw new Error(
        "Required fields socket_id and/or channel_name are missing or invalid.",
      );
    }

    // dev dummy data
    const user = {
      id: `user_${Math.random().toString(36).substr(2, 9)}`,
      user_info: {
        name: `user_${Math.random().toString(36).substr(2, 9)}`,
      },
    };

    // Authenticate the user, dev => everyone gets approved
    const authResponse = pusher.authorizeChannel(
      socketId.toString(),
      channelName.toString(),
      {
        user_id: user.id,
        user_info: user.user_info,
      },
    );

    return NextResponse.json(authResponse);
  } catch (error) {
    console.error("Error authenticating with Pusher:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 403 },
    );
  }
}
