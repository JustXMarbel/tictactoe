import {
  getSupabaseServerClient,
  isSupabaseConfigured,
  normalizeMessage,
  supabaseMissingResponse,
  type GameRow,
} from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSupabaseConfigured()) return supabaseMissingResponse();

    const { id } = await params;
    const body = await req.json();
    const { playerId, message } = body;

    if (!playerId || !message || message.trim() === "") {
      return Response.json({ error: "Missing player ID or message content" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: game, error: gameError } = await supabase.from("games").select("*").eq("id", id).maybeSingle();

    if (gameError) return Response.json({ error: gameError.message }, { status: 500 });
    if (!game) return Response.json({ error: "Game not found" }, { status: 404 });

    const gameRow = game as GameRow;
    let senderName = "";
    if (playerId === gameRow.player_x_id) {
      senderName = gameRow.player_x_name;
    } else if (playerId === gameRow.player_o_id) {
      senderName = gameRow.player_o_name || "O";
    } else {
      return Response.json({ error: "You are not a player in this game" }, { status: 403 });
    }

    const { data: newMessage, error } = await supabase
      .from("chat_messages")
      .insert({
        game_id: id,
        sender_id: playerId,
        sender_name: senderName,
        message: message.trim(),
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ message: normalizeMessage(newMessage) });
  } catch (error: any) {
    return Response.json({ error: error.message || "Failed to send message" }, { status: 500 });
  }
}
