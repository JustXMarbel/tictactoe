import { db } from "@/db";
import { players } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Top 10 online players
    const onlineLeaders = await db
      .select()
      .from(players)
      .orderBy(desc(players.winsOnline))
      .limit(10);

    // Top 10 bot players
    const botLeaders = await db
      .select()
      .from(players)
      .orderBy(desc(players.winsBot))
      .limit(10);

    return Response.json({
      onlineLeaders,
      botLeaders,
    });
  } catch (error: any) {
    return Response.json({ error: error.message || "Failed to fetch leaderboard" }, { status: 500 });
  }
}
