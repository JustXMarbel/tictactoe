import { getSupabaseServerClient, isSupabaseConfigured, normalizePlayer, supabaseMissingResponse } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isSupabaseConfigured()) return supabaseMissingResponse();

    const supabase = getSupabaseServerClient();

    const { data: onlineLeaders, error: onlineError } = await supabase
      .from("players")
      .select("*")
      .order("wins_online", { ascending: false })
      .limit(10);

    if (onlineError) return Response.json({ error: onlineError.message }, { status: 500 });

    const { data: botLeaders, error: botError } = await supabase
      .from("players")
      .select("*")
      .order("wins_bot", { ascending: false })
      .limit(10);

    if (botError) return Response.json({ error: botError.message }, { status: 500 });

    return Response.json({
      onlineLeaders: (onlineLeaders || []).map((player) => normalizePlayer(player)).filter(Boolean),
      botLeaders: (botLeaders || []).map((player) => normalizePlayer(player)).filter(Boolean),
    });
  } catch (error: any) {
    return Response.json({ error: error.message || "Failed to fetch leaderboard" }, { status: 500 });
  }
}
