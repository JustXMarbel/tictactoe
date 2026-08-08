// Tic-Tac-Toe Game Utilities and AI

export type BoardState = string[]; // Array of 9 strings: 'X', 'O', or ''

export const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
  [0, 4, 8], [2, 4, 6],            // Diagonals
];

export function checkWinner(board: BoardState): { winner: "X" | "O" | "draw" | null; line?: number[] } {
  for (const combo of WINNING_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a] as "X" | "O", line: combo };
    }
  }

  if (board.every((cell) => cell !== "")) {
    return { winner: "draw" };
  }

  return { winner: null };
}

// Minimax algorithm for unbeatable Tic-Tac-Toe bot
function minimax(
  board: BoardState,
  depth: number,
  isMax: boolean,
  botSymbol: "X" | "O",
  playerSymbol: "X" | "O"
): number {
  const scoreResult = checkWinner(board);
  if (scoreResult.winner === botSymbol) return 10 - depth;
  if (scoreResult.winner === playerSymbol) return depth - 10;
  if (scoreResult.winner === "draw") return 0;

  if (isMax) {
    let best = -1000;
    for (let i = 0; i < 9; i++) {
      if (board[i] === "") {
        board[i] = botSymbol;
        best = Math.max(best, minimax(board, depth + 1, false, botSymbol, playerSymbol));
        board[i] = "";
      }
    }
    return best;
  } else {
    let best = 1000;
    for (let i = 0; i < 9; i++) {
      if (board[i] === "") {
        board[i] = playerSymbol;
        best = Math.min(best, minimax(board, depth + 1, true, botSymbol, playerSymbol));
        board[i] = "";
      }
    }
    return best;
  }
}

// Find the best move for the bot
export function findBestMove(board: BoardState, botSymbol: "X" | "O", playerSymbol: "X" | "O"): number {
  let bestVal = -1000;
  let bestMove = -1;

  for (let i = 0; i < 9; i++) {
    if (board[i] === "") {
      board[i] = botSymbol;
      const moveVal = minimax(board, 0, false, botSymbol, playerSymbol);
      board[i] = "";

      if (moveVal > bestVal) {
        bestVal = moveVal;
        bestMove = i;
      }
    }
  }

  // Fallback to random if no move found (should not happen)
  if (bestMove === -1) {
    const available = board.map((c, idx) => (c === "" ? idx : -1)).filter((idx) => idx !== -1);
    return available[Math.floor(Math.random() * available.length)];
  }

  return bestMove;
}

// Bot logic interface
export function getBotMove(
  board: BoardState,
  difficulty: "easy" | "medium" | "unbeatable",
  botSymbol: "X" | "O",
  playerSymbol: "X" | "O"
): number {
  const availableMoves = board.map((cell, index) => (cell === "" ? index : -1)).filter((val) => val !== -1);
  if (availableMoves.length === 0) return -1;

  if (difficulty === "easy") {
    // Completely random move
    const randomIndex = Math.floor(Math.random() * availableMoves.length);
    return availableMoves[randomIndex];
  }

  if (difficulty === "medium") {
    // 50% smart unbeatable move, 50% random move
    if (Math.random() < 0.5) {
      return findBestMove(board, botSymbol, playerSymbol);
    } else {
      const randomIndex = Math.floor(Math.random() * availableMoves.length);
      return availableMoves[randomIndex];
    }
  }

  // Unbeatable (100% Minimax AI)
  return findBestMove(board, botSymbol, playerSymbol);
}

// Sound effects generator using Web Audio API (Self-contained!)
export function playSound(type: "move" | "win" | "lose" | "draw" | "click") {
  if (typeof window === "undefined") return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();

    if (type === "click" || type === "move") {
      // Short blip sound
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = type === "click" ? "sine" : "triangle";
      osc.frequency.setValueAtTime(type === "click" ? 600 : 450, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === "win") {
      // Cheerful ascending arpeggio
      const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.1);

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + index * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + index * 0.1 + 0.15);

        osc.start(ctx.currentTime + index * 0.1);
        osc.stop(ctx.currentTime + index * 0.1 + 0.15);
      });
    } else if (type === "lose") {
      // Disappointing descending sweep
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.4);

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === "draw") {
      // Neutral double beep
      [0, 0.15].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = "square";
        osc.frequency.setValueAtTime(350, ctx.currentTime + delay);

        gain.gain.setValueAtTime(0.05, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.1);

        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.1);
      });
    }
  } catch (err) {
    console.warn("Web Audio API sound failed to play:", err);
  }
}
