import { getSupabaseServerClient, isSupabaseConfigured, supabaseMissingResponse } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

async function cleanupStaleQueue() {
  const supabase = getSupabaseServerClient();
  const cutoff = new Date(Date.now() - 25000).toISOString();
  await supabase.from("matchmaking_queue").delete().is("game_id", null).lt("joined_at", cutoff);
}

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) return supabaseMissingResponse();

    const body = await req.json();
    const { playerId, playerName, action } = body;

    if (!playerId) return Response.json({ error: "Missing player ID" }, { status: 400 });

    const supabase = getSupabaseServerClient();
    await cleanupStaleQueue();

    if (action === "leave") {
      const { error } = await supabase.from("matchmaking_queue").delete().eq("player_id", playerId);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ status: "left" });
    }

    if (action !== "join") return Response.json({ error: "Invalid action" }, { status: 400 });
    if (!playerName) return Response.json({ error: "Missing player name" }, { status: 400 });

    const { data: existingEntry, error: existingError } = await supabase
      .from("matchmaking_queue")
      .select("*")
      .eq("player_id", playerId)
      .maybeSingle();

    if (existingError) return Response.json({ error: existingError.message }, { status: 500 });

    if (existingEntry?.game_id) {
      await supabase.from("matchmaking_queue").delete().eq("player_id", playerId);
      return Response.json({ status: "matched", gameId: existingEntry.game_id });
    }

    if (existingEntry) {
      const { error } = await supabase
        .from("matchmaking_queue")
        .update({ player_name: playerName, joined_at: new Date().toISOString() })
        .eq("player_id", playerId);
      if (error) return Response.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await supabase.from("matchmaking_queue").insert({
        player_id: playerId,
        player_name: playerName,
        joined_at: new Date().toISOString(),
      });
      if (error) return Response.json({ error: error.message }, { status: 500 });
    }

    const { data: opponents, error: opponentError } = await supabase
      .from("matchmaking_queue")
      .select("*")
      .is("game_id", null)
      .neq("player_id", playerId)
      .order("joined_at", { ascending: true })
      .limit(1);

    if (opponentError) return Response.json({ error: opponentError.message }, { status: 500 });

    if (!opponents || opponents.length === 0) {
      return Response.json({ status: "waiting" });
    }

    const opponent = opponents[0];
    const gameId = "game_" + Math.random().toString(36).substring(2, 15);
    const now = new Date().toISOString();

    const playerXId = opponent.player_id;
    const playerXName = opponent.player_name;
    const playerOId = playerId;
    const playerOName = playerName;

    const { error: gameError } = await supabase.from("games").insert({
      id: gameId,
      player_x_id: playerXId,
      player_x_name: playerXName,
      player_o_id: playerOId,
      player_o_name: playerOName,
      mode: "online",
      board: "---------",
      turn: "X",
      status: "active",
      created_at: now,
      updated_at: now,
      last_move_at: now,
    });

    if (gameError) return Response.json({ error: gameError.message }, { status: 500 });

    const { error: xQueueError } = await supabase
      .from("matchmaking_queue")
      .update({ game_id: gameId })
      .eq("player_id", playerXId);
    if (xQueueError) return Response.json({ error: xQueueError.message }, { status: 500 });

    await supabase.from("matchmaking_queue").delete().eq("player_id", playerOId);

    return Response.json({ status: "matched", gameId });
  } catch (error: any) {
    return Response.json({ error: error.message || "Failed matchmaking" }, { status: 500 });
  }
}
