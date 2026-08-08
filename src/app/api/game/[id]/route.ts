import { db } from "@/db";
import { games, chatMessages, players } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function checkWinner(board: string): "X" | "O" | "draw" | null {
  const winningLines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
    [0, 4, 8], [2, 4, 6],            // Diagonals
  ];

  for (const [a, b, c] of winningLines) {
    if (board[a] !== "-" && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as "X" | "O";
    }
  }

  if (!board.includes("-")) {
    return "draw";
  }

  return null;
}

// Update statistics of players
async function updateOnlineStats(winnerSymbol: "X" | "O" | "draw", playerXId: string, playerOId: string | null) {
  try {
    if (winnerSymbol === "draw") {
      // Increment draws for both
      await db.update(players)
        .set({ drawsOnline: sql`${players.drawsOnline} + 1`, updatedAt: new Date() })
        .where(eq(players.id, playerXId));
      if (playerOId) {
        await db.update(players)
          .set({ drawsOnline: sql`${players.drawsOnline} + 1`, updatedAt: new Date() })
          .where(eq(players.id, playerOId));
      }
    } else if (winnerSymbol === "X") {
      // X wins, O loses
      await db.update(players)
        .set({ winsOnline: sql`${players.winsOnline} + 1`, updatedAt: new Date() })
        .where(eq(players.id, playerXId));
      if (playerOId) {
        await db.update(players)
          .set({ lossesOnline: sql`${players.lossesOnline} + 1`, updatedAt: new Date() })
          .where(eq(players.id, playerOId));
      }
    } else if (winnerSymbol === "O") {
      // O wins, X loses
      await db.update(players)
        .set({ lossesOnline: sql`${players.lossesOnline} + 1`, updatedAt: new Date() })
        .where(eq(players.id, playerXId));
      if (playerOId) {
        await db.update(players)
          .set({ winsOnline: sql`${players.winsOnline} + 1`, updatedAt: new Date() })
          .where(eq(players.id, playerOId));
      }
    }
  } catch (err) {
    console.error("Failed to update player stats: ", err);
  }
}

// GET /api/game/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const gameResults = await db.select().from(games).where(eq(games.id, id));
    if (gameResults.length === 0) {
      return Response.json({ error: "Game not found" }, { status: 404 });
    }

    const game = gameResults[0];

    // Fetch messages for this game
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.gameId, id))
      .orderBy(chatMessages.createdAt);

    return Response.json({ game, messages });
  } catch (error: any) {
    return Response.json({ error: error.message || "Failed to fetch game" }, { status: 500 });
  }
}

// POST /api/game/[id]
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { playerId, action, index } = body;

    if (!playerId) {
      return Response.json({ error: "Missing player ID" }, { status: 400 });
    }

    const gameResults = await db.select().from(games).where(eq(games.id, id));
    if (gameResults.length === 0) {
      return Response.json({ error: "Game not found" }, { status: 404 });
    }

    const game = gameResults[0];

    if (game.status !== "active") {
      return Response.json({ error: "Game is already finished" }, { status: 400 });
    }

    // Handle Forfeit
    if (action === "forfeit") {
      const winnerSymbol = playerId === game.playerXId ? "O" : "X";
      const winnerName = winnerSymbol === "X" ? game.playerXName : (game.playerOName || "O");

      const [updatedGame] = await db
        .update(games)
        .set({
          status: "finished",
          winner: winnerSymbol,
          updatedAt: new Date(),
          lastMoveAt: new Date(),
        })
        .where(eq(games.id, id))
        .returning();

      // Update online stats
      await updateOnlineStats(winnerSymbol, game.playerXId, game.playerOId);

      return Response.json({ game: updatedGame });
    }

    // Handle Move
    if (action === "move") {
      if (index === undefined || index < 0 || index > 8) {
        return Response.json({ error: "Invalid move index" }, { status: 400 });
      }

      // Check player identity & current turn
      const isPlayerX = playerId === game.playerXId;
      const isPlayerO = playerId === game.playerOId;

      if (!isPlayerX && !isPlayerO) {
        return Response.json({ error: "You are not a player in this game" }, { status: 403 });
      }

      const playerSymbol = isPlayerX ? "X" : "O";

      if (game.turn !== playerSymbol) {
        return Response.json({ error: "It is not your turn" }, { status: 400 });
      }

      // Check if spot is empty
      if (game.board[index] !== "-") {
        return Response.json({ error: "Cell is already taken" }, { status: 400 });
      }

      // Construct new board string
      const boardArr = game.board.split("");
      boardArr[index] = playerSymbol;
      const updatedBoard = boardArr.join("");

      // Check winner
      const winnerResult = checkWinner(updatedBoard);

      const updates: Record<string, any> = {
        board: updatedBoard,
        updatedAt: new Date(),
        lastMoveAt: new Date(),
      };

      if (winnerResult) {
        updates.status = "finished";
        updates.winner = winnerResult;
      } else {
        // Toggle turn
        updates.turn = playerSymbol === "X" ? "O" : "X";
      }

      const [updatedGame] = await db
        .update(games)
        .set(updates)
        .where(eq(games.id, id))
        .returning();

      // If finished, update stats
      if (winnerResult) {
        await updateOnlineStats(winnerResult, game.playerXId, game.playerOId);
      }

      return Response.json({ game: updatedGame });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: error.message || "Failed to make game action" }, { status: 500 });
  }
}
