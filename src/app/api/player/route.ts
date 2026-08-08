import { db } from "@/db";
import { players } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/player?id=PLAYER_ID
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return Response.json({ error: "Missing player ID" }, { status: 400 });
    }

    const result = await db.select().from(players).where(eq(players.id, id));
    if (result.length === 0) {
      return Response.json({ player: null });
    }

    return Response.json({ player: result[0] });
  } catch (error: any) {
    return Response.json({ error: error.message || "Failed to fetch player" }, { status: 500 });
  }
}

// POST /api/player
// Body: { id, name, action?: "register" | "update_stats", statType?: "online" | "bot", resultType?: "win" | "loss" | "draw" }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, action = "register", statType, resultType } = body;

    if (!id) {
      return Response.json({ error: "Missing player ID" }, { status: 400 });
    }

    // Check if player exists
    const existing = await db.select().from(players).where(eq(players.id, id));

    if (action === "register") {
      if (!name) {
        return Response.json({ error: "Missing player name" }, { status: 400 });
      }

      if (existing.length === 0) {
        // Create new player
        const [newPlayer] = await db.insert(players).values({
          id,
          name,
        }).returning();
        return Response.json({ player: newPlayer });
      } else {
        // Update existing player name
        const [updatedPlayer] = await db.update(players)
          .set({ name, updatedAt: new Date() })
          .where(eq(players.id, id))
          .returning();
        return Response.json({ player: updatedPlayer });
      }
    } else if (action === "update_stats") {
      if (existing.length === 0) {
        return Response.json({ error: "Player not found for stats update" }, { status: 404 });
      }

      const player = existing[0];
      const updates: Record<string, any> = { updatedAt: new Date() };

      if (statType === "online") {
        if (resultType === "win") updates.winsOnline = player.winsOnline + 1;
        if (resultType === "loss") updates.lossesOnline = player.lossesOnline + 1;
        if (resultType === "draw") updates.drawsOnline = player.drawsOnline + 1;
      } else if (statType === "bot") {
        if (resultType === "win") updates.winsBot = player.winsBot + 1;
        if (resultType === "loss") updates.lossesBot = player.lossesBot + 1;
        if (resultType === "draw") updates.drawsBot = player.drawsBot + 1;
      }

      const [updatedPlayer] = await db.update(players)
        .set(updates)
        .where(eq(players.id, id))
        .returning();

      return Response.json({ player: updatedPlayer });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: error.message || "Failed to update player" }, { status: 500 });
  }
}
