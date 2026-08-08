import { pgTable, text, integer, timestamp, serial } from "drizzle-orm/pg-core";

export const players = pgTable("players", {
  id: text("id").primaryKey(), // unique client-generated session id
  name: text("name").notNull(),
  winsOnline: integer("wins_online").default(0).notNull(),
  lossesOnline: integer("losses_online").default(0).notNull(),
  drawsOnline: integer("draws_online").default(0).notNull(),
  winsBot: integer("wins_bot").default(0).notNull(),
  lossesBot: integer("losses_bot").default(0).notNull(),
  drawsBot: integer("draws_bot").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const games = pgTable("games", {
  id: text("id").primaryKey(), // random uuid/id
  playerXId: text("player_x_id").notNull(),
  playerXName: text("player_x_name").notNull(),
  playerOId: text("player_o_id"), // null if local, 'bot' if bot, or player_id if online
  playerOName: text("player_o_name"), // "Friend" / "Bot Easy" / etc
  mode: text("mode").notNull(), // 'local', 'bot', 'online'
  botDifficulty: text("bot_difficulty"), // 'easy', 'medium', 'unbeatable'
  board: text("board").default("---------").notNull(), // 9-character grid, e.g. "---------"
  turn: text("turn").default("X").notNull(), // 'X' or 'O'
  winner: text("winner"), // 'X', 'O', 'draw', or null
  status: text("status").default("active").notNull(), // 'waiting', 'active', 'finished', 'abandoned'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastMoveAt: timestamp("last_move_at").defaultNow().notNull(),
});

export const matchmakingQueue = pgTable("matchmaking_queue", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull().unique(),
  playerName: text("player_name").notNull(),
  gameId: text("game_id"), // populated when match is made
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  gameId: text("game_id").notNull(),
  senderId: text("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
