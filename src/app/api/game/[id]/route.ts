import {
  getSupabaseServerClient,
  isSupabaseConfigured,
  normalizeGame,
  normalizeMessage,
  supabaseMissingResponse,
  type GameRow,
} from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function checkWinner(board: string): "X" | "O" | "draw" | null {
  const winningLines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];

  for (const [a, b, c] of winningLines) {
    if (board[a] !== "-" && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as "X" | "O";
    }
  }
  return board.includes("-") ? null : "draw";
}

async function incrementPlayerColumn(playerId: string, column: string) {
  const supabase = getSupabaseServerClient();
  const { data: player, error: fetchError } = await supabase
    .from("players")
    .select(column)
    .eq("id", playerId)
    .maybeSingle();

  if (fetchError || !player) return;

  const playerRecord = player as unknown as Record<string, unknown>;
  const current = Number(playerRecord[column] ?? 0);
  await supabase
    .from("players")
    .update({ [column]: current + 1, updated_at: new Date().toISOString() })
    .eq("id", playerId);
}

async function updateOnlineStats(winnerSymbol: "X" | "O" | "draw", playerXId: string, playerOId: string | null) {
  if (winnerSymbol === "draw") {
    await incrementPlayerColumn(playerXId, "draws_online");
    if (playerOId) await incrementPlayerColumn(playerOId, "draws_online");
    return;
  }

  if (winnerSymbol === "X") {
    await incrementPlayerColumn(playerXId, "wins_online");
    if (playerOId) await incrementPlayerColumn(playerOId, "losses_online");
    return;
  }

  await incrementPlayerColumn(playerXId, "losses_online");
  if (playerOId) await incrementPlayerColumn(playerOId, "wins_online");
}

async function getGame(id: string): Promise<GameRow | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("games").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as GameRow | null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSupabaseConfigured()) return supabaseMissingResponse();

    const { id } = await params;
    const supabase = getSupabaseServerClient();

    const game = await getGame(id);
    if (!game) return Response.json({ error: "Game not found" }, { status: 404 });

    const { data: messages, error: messageError } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("game_id", id)
      .order("created_at", { ascending: true });

    if (messageError) return Response.json({ error: messageError.message }, { status: 500 });

    return Response.json({
      game: normalizeGame(game),
      messages: (messages || []).map((message) => normalizeMessage(message)).filter(Boolean),
    });
  } catch (error: any) {
    return Response.json({ error: error.message || "Failed to fetch game" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSupabaseConfigured()) return supabaseMissingResponse();

    const { id } = await params;
    const body = await req.json();
    const { playerId, action, index } = body;

    if (!playerId) return Response.json({ error: "Missing player ID" }, { status: 400 });

    const supabase = getSupabaseServerClient();
    const game = await getGame(id);
    if (!game) return Response.json({ error: "Game not found" }, { status: 404 });
    if (game.status !== "active") return Response.json({ error: "Game is already finished" }, { status: 400 });

    if (action === "forfeit") {
      const winnerSymbol: "X" | "O" = playerId === game.player_x_id ? "O" : "X";
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from("games")
        .update({ status: "finished", winner: winnerSymbol, updated_at: now, last_move_at: now })
        .eq("id", id)
        .select("*")
        .single();

      if (error) return Response.json({ error: error.message }, { status: 500 });
      await updateOnlineStats(winnerSymbol, game.player_x_id, game.player_o_id);
      return Response.json({ game: normalizeGame(data) });
    }

    if (action !== "move") return Response.json({ error: "Invalid action" }, { status: 400 });
    if (index === undefined || index < 0 || index > 8) {
      return Response.json({ error: "Invalid move index" }, { status: 400 });
    }

    const isPlayerX = playerId === game.player_x_id;
    const isPlayerO = playerId === game.player_o_id;
    if (!isPlayerX && !isPlayerO) return Response.json({ error: "You are not a player in this game" }, { status: 403 });

    const playerSymbol = isPlayerX ? "X" : "O";
    if (game.turn !== playerSymbol) return Response.json({ error: "It is not your turn" }, { status: 400 });
    if (game.board[index] !== "-") return Response.json({ error: "Cell is already taken" }, { status: 400 });

    const boardArr = game.board.split("");
    boardArr[index] = playerSymbol;
    const updatedBoard = boardArr.join("");
    const winnerResult = checkWinner(updatedBoard);
    const now = new Date().toISOString();

    const updates: Record<string, any> = {
      board: updatedBoard,
      updated_at: now,
      last_move_at: now,
    };

    if (winnerResult) {
      updates.status = "finished";
      updates.winner = winnerResult;
    } else {
      updates.turn = playerSymbol === "X" ? "O" : "X";
    }

    const { data, error } = await supabase.from("games").update(updates).eq("id", id).select("*").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });

    if (winnerResult) await updateOnlineStats(winnerResult, game.player_x_id, game.player_o_id);

    return Response.json({ game: normalizeGame(data) });
  } catch (error: any) {
    return Response.json({ error: error.message || "Failed to make game action" }, { status: 500 });
  }
}
