import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type PlayerRow = {
  id: string;
  name: string;
  wins_online: number;
  losses_online: number;
  draws_online: number;
  wins_bot: number;
  losses_bot: number;
  draws_bot: number;
  created_at?: string;
  updated_at?: string;
};

export type GameRow = {
  id: string;
  player_x_id: string;
  player_x_name: string;
  player_o_id: string | null;
  player_o_name: string | null;
  mode: string;
  bot_difficulty: string | null;
  board: string;
  turn: string;
  winner: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
  last_move_at?: string;
};

export type MatchmakingQueueRow = {
  id: number;
  player_id: string;
  player_name: string;
  game_id: string | null;
  joined_at?: string;
};

export type ChatMessageRow = {
  id: number;
  game_id: string;
  sender_id: string;
  sender_name: string;
  message: string;
  created_at?: string;
};

export function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && process.env.SUPABASE_SECRET_KEY);
}

export function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

export function getSupabaseServerClient(): SupabaseClient {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SECRET_KEY."
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function normalizePlayer(row: PlayerRow | null) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    winsOnline: row.wins_online ?? 0,
    lossesOnline: row.losses_online ?? 0,
    drawsOnline: row.draws_online ?? 0,
    winsBot: row.wins_bot ?? 0,
    lossesBot: row.losses_bot ?? 0,
    drawsBot: row.draws_bot ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeGame(row: GameRow | null) {
  if (!row) return null;
  return {
    id: row.id,
    playerXId: row.player_x_id,
    playerXName: row.player_x_name,
    playerOId: row.player_o_id,
    playerOName: row.player_o_name,
    mode: row.mode,
    botDifficulty: row.bot_difficulty,
    board: row.board,
    turn: row.turn,
    winner: row.winner,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMoveAt: row.last_move_at,
  };
}

export function normalizeMessage(row: ChatMessageRow | null) {
  if (!row) return null;
  return {
    id: row.id,
    gameId: row.game_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    message: row.message,
    createdAt: row.created_at,
  };
}

export function supabaseMissingResponse() {
  return Response.json(
    {
      error:
        "Supabase URL is missing. Add SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in the environment to enable online matchmaking and persistent stats.",
    },
    { status: 503 }
  );
}
