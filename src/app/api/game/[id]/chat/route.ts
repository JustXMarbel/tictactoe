import { db } from "@/db";
import { games, chatMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/game/[id]/chat
// Body: { playerId, message }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { playerId, message } = body;

    if (!playerId || !message || message.trim() === "") {
      return Response.json({ error: "Missing player ID or message content" }, { status: 400 });
    }

    // Fetch game to verify player and get their name
    const gameResults = await db.select().from(games).where(eq(games.id, id));
    if (gameResults.length === 0) {
      return Response.json({ error: "Game not found" }, { status: 404 });
    }

    const game = gameResults[0];

    let senderName = "";
    if (playerId === game.playerXId) {
      senderName = game.playerXName;
    } else if (playerId === game.playerOId) {
      senderName = game.playerOName || "O";
    } else {
      return Response.json({ error: "You are not a player in this game" }, { status: 403 });
    }

    // Insert message
    const [newMessage] = await db
      .insert(chatMessages)
      .values({
        gameId: id,
        senderId: playerId,
        senderName,
        message: message.trim(),
        createdAt: new Date(),
      })
      .returning();

    return Response.json({ message: newMessage });
  } catch (error: any) {
    return Response.json({ error: error.message || "Failed to send message" }, { status: 500 });
  }
}
