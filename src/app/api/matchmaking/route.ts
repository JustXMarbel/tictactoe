import { db } from "@/db";
import { matchmakingQueue, games } from "@/db/schema";
import { eq, ne, isNull, lt, and } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// Clean up stale matchmaking queue entries
async function cleanupStaleQueue() {
  const cutoff = new Date(Date.now() - 25000); // 25 seconds of inactivity
  try {
    // Delete stale queue entries that aren't matched yet
    await db.delete(matchmakingQueue).where(
      and(
        isNull(matchmakingQueue.gameId),
        lt(matchmakingQueue.joinedAt, cutoff)
      )
    );
  } catch (err) {
    console.error("Error cleaning up stale queue:", err);
  }
}

// POST /api/matchmaking
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { playerId, playerName, action } = body;

    if (!playerId) {
      return Response.json({ error: "Missing player ID" }, { status: 400 });
    }

    await cleanupStaleQueue();

    if (action === "leave") {
      await db.delete(matchmakingQueue).where(eq(matchmakingQueue.playerId, playerId));
      return Response.json({ status: "left" });
    }

    if (action === "join") {
      if (!playerName) {
        return Response.json({ error: "Missing player name" }, { status: 400 });
      }

      // Check if player already has an entry
      const existingQueue = await db
        .select()
        .from(matchmakingQueue)
        .where(eq(matchmakingQueue.playerId, playerId));

      let playerEntry = existingQueue[0];

      if (playerEntry) {
        // If already matched, return the game ID
        if (playerEntry.gameId) {
          // Clean up this queue entry now that we matched and the client knows
          await db.delete(matchmakingQueue).where(eq(matchmakingQueue.playerId, playerId));
          return Response.json({ status: "matched", gameId: playerEntry.gameId });
        }

        // Update the timestamp to keep it alive
        await db
          .update(matchmakingQueue)
          .set({ joinedAt: new Date() })
          .where(eq(matchmakingQueue.playerId, playerId));
      } else {
        // Insert new entry
        const [inserted] = await db
          .insert(matchmakingQueue)
          .values({
            playerId,
            playerName,
            joinedAt: new Date(),
          })
          .returning();
        playerEntry = inserted;
      }

      // Try to find another player who is waiting (gameId is null and not current player)
      const opponents = await db
        .select()
        .from(matchmakingQueue)
        .where(
          and(
            isNull(matchmakingQueue.gameId),
            ne(matchmakingQueue.playerId, playerId)
          )
        )
        .limit(1);

      if (opponents.length > 0) {
        const opponent = opponents[0];
        const gameId = "game_" + Math.random().toString(36).substring(2, 15);

        // Decide symbols: randomly assign who is X and who is O. Let's say player who was waiting first is X.
        // The opponent was waiting first (they are already in the queue). So they are X, and joiner is O.
        const playerXId = opponent.playerId;
        const playerXName = opponent.playerName;
        const playerOId = playerId;
        const playerOName = playerName;

        // Create game
        await db.insert(games).values({
          id: gameId,
          playerXId,
          playerXName,
          playerOId,
          playerOName,
          mode: "online",
          board: "---------",
          turn: "X",
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastMoveAt: new Date(),
        });

        // Update both players' matchmaking queue entries
        await db
          .update(matchmakingQueue)
          .set({ gameId })
          .where(eq(matchmakingQueue.playerId, playerXId));

        await db
          .update(matchmakingQueue)
          .set({ gameId })
          .where(eq(matchmakingQueue.playerId, playerOId));

        // Immediately delete the current player queue entry since we matched it
        await db.delete(matchmakingQueue).where(eq(matchmakingQueue.playerId, playerId));

        return Response.json({ status: "matched", gameId });
      }

      // No opponent found, still waiting
      return Response.json({ status: "waiting" });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: error.message || "Failed matchmaking" }, { status: 500 });
  }
}
