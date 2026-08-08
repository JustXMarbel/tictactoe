import { getSupabaseServerClient, normalizePlayer, supabaseMissingResponse, isSupabaseConfigured } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) return supabaseMissingResponse();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "Missing player ID" }, { status: 400 });

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.from("players").select("*").eq("id", id).maybeSingle();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ player: normalizePlayer(data) });
  } catch (error: any) {
    return Response.json({ error: error.message || "Failed to fetch player" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) return supabaseMissingResponse();

    const body = await req.json();
    const { id, name, action = "register", statType, resultType } = body;

    if (!id) return Response.json({ error: "Missing player ID" }, { status: 400 });

    const supabase = getSupabaseServerClient();

    const { data: existing, error: fetchError } = await supabase
      .from("players")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) return Response.json({ error: fetchError.message }, { status: 500 });

    if (action === "register") {
      if (!name) return Response.json({ error: "Missing player name" }, { status: 400 });

      const basePayload = {
        id,
        name,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("players")
        .upsert(basePayload, { onConflict: "id" })
        .select("*")
        .single();

      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ player: normalizePlayer(data) });
    }

    if (action === "update_stats") {
      if (!existing) return Response.json({ error: "Player not found for stats update" }, { status: 404 });

      const updates: Record<string, any> = { updated_at: new Date().toISOString() };

      if (statType === "online") {
        if (resultType === "win") updates.wins_online = (existing.wins_online ?? 0) + 1;
        if (resultType === "loss") updates.losses_online = (existing.losses_online ?? 0) + 1;
        if (resultType === "draw") updates.draws_online = (existing.draws_online ?? 0) + 1;
      } else if (statType === "bot") {
        if (resultType === "win") updates.wins_bot = (existing.wins_bot ?? 0) + 1;
        if (resultType === "loss") updates.losses_bot = (existing.losses_bot ?? 0) + 1;
        if (resultType === "draw") updates.draws_bot = (existing.draws_bot ?? 0) + 1;
      } else {
        return Response.json({ error: "Invalid stat type" }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("players")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();

      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ player: normalizePlayer(data) });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: error.message || "Failed to update player" }, { status: 500 });
  }
}
