"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Trophy,
  Bot,
  Users,
  Globe,
  Volume2,
  VolumeX,
  Send,
  RefreshCw,
  MessageSquare,
  Edit2,
  Check,
  AlertCircle,
  Timer,
  ArrowLeft,
  User,
  Gamepad2,
  Flame,
} from "lucide-react";
import { getBotMove, checkWinner, playSound, BoardState } from "./utils/ticTacToe";
import { Confetti } from "./components/Confetti";

export default function GamePage() {
  // --- Profile & Authentication States ---
  const [playerId, setPlayerId] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [editNameValue, setEditNameValue] = useState<string>("");
  const [playerStats, setPlayerStats] = useState<{
    id: string;
    name: string;
    winsOnline: number;
    lossesOnline: number;
    drawsOnline: number;
    winsBot: number;
    lossesBot: number;
    drawsBot: number;
  } | null>(null);

  // --- Sound FX State ---
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // --- Navigation & Tab States ---
  const [activeTab, setActiveTab] = useState<"play" | "leaderboard">("play");
  const [mode, setMode] = useState<null | "local" | "bot" | "online">(null);

  // --- Leaderboard State ---
  const [onlineLeaders, setOnlineLeaders] = useState<any[]>([]);
  const [botLeaders, setBotLeaders] = useState<any[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState<boolean>(false);

  // --- Game Session States ---
  // Confetti trigger
  const [showConfetti, setShowConfetti] = useState<boolean>(false);

  // Option 1: LOCAL MODE
  const [localXName, setLocalXName] = useState<string>("Player X");
  const [localOName, setLocalOName] = useState<string>("Player O");
  const [isSettingLocalNames, setIsSettingLocalNames] = useState<boolean>(true);
  const [localBoard, setLocalBoard] = useState<BoardState>(Array(9).fill(""));
  const [localTurn, setLocalTurn] = useState<"X" | "O">("X");
  const [localWinner, setLocalWinner] = useState<"X" | "O" | "draw" | null>(null);
  const [localWinningLine, setLocalWinningLine] = useState<number[]>([]);
  const [localScores, setLocalScores] = useState<{ x: number; o: number; draws: number }>({
    x: 0,
    o: 0,
    draws: 0,
  });

  // Option 2: BOT MODE
  const [botDifficulty, setBotDifficulty] = useState<"easy" | "medium" | "unbeatable">("unbeatable");
  const [playerSymbol, setPlayerSymbol] = useState<"X" | "O">("X"); // Symbol player controls
  const [botBoard, setBotBoard] = useState<BoardState>(Array(9).fill(""));
  const [botTurn, setBotTurn] = useState<"X" | "O">("X");
  const [botWinner, setBotWinner] = useState<"X" | "O" | "draw" | null>(null);
  const [botWinningLine, setBotWinningLine] = useState<number[]>([]);
  const [isBotThinking, setIsBotThinking] = useState<boolean>(false);
  const [botScores, setBotScores] = useState<{ player: number; bot: number; draws: number }>({
    player: 0,
    bot: 0,
    draws: 0,
  });

  // Option 3: ONLINE MODE
  const [matchmakingStatus, setMatchmakingStatus] = useState<"idle" | "searching" | "matched">("idle");
  const [searchSeconds, setSearchSeconds] = useState<number>(0);
  const [onlineGameId, setOnlineGameId] = useState<string | null>(null);
  const [onlineGame, setOnlineGame] = useState<any | null>(null);
  const [onlineMessages, setOnlineMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState<string>("");
  const [mySymbol, setMySymbol] = useState<"X" | "O" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmittingMove, setIsSubmittingMove] = useState<boolean>(false);

  // References for intervals and scrolling
  const matchmakingIntervalRef = useRef<any>(null);
  const gamePollIntervalRef = useRef<any>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Trigger sound wrappers
  const triggerSound = (type: "move" | "win" | "lose" | "draw" | "click") => {
    if (soundEnabled) {
      playSound(type);
    }
  };

  // --- Initial Setup & Profile Sync ---
  useEffect(() => {
    // Generate or fetch Player ID & Name from Local Storage
    let storedId = localStorage.getItem("ttt_player_id");
    let storedName = localStorage.getItem("ttt_player_name");

    if (!storedId) {
      storedId = "player_" + Math.random().toString(36).substring(2, 11);
      localStorage.setItem("ttt_player_id", storedId);
    }
    if (!storedName) {
      storedName = "Challenger_" + Math.floor(Math.random() * 9000 + 1000);
      localStorage.setItem("ttt_player_name", storedName);
    }

    setPlayerId(storedId);
    setPlayerName(storedName);
    setEditNameValue(storedName);

    // Sync profile with database
    syncProfileWithDB(storedId, storedName);
    loadLeaderboard();

    // Check sound preference
    const soundPref = localStorage.getItem("ttt_sound_enabled");
    if (soundPref !== null) {
      setSoundEnabled(soundPref === "true");
    }
  }, []);

  // Sync profile function
  const syncProfileWithDB = async (id: string, name: string) => {
    try {
      const response = await fetch("/api/player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, action: "register" }),
      });
      const data = await response.json();
      if (data.player) {
        setPlayerStats(data.player);
      }
    } catch (err) {
      console.error("Failed to sync player profile with server database:", err);
    }
  };

  // Update profile statistics
  const updateStatsInDB = async (resultType: "win" | "loss" | "draw", statType: "online" | "bot") => {
    if (!playerId) return;
    try {
      const response = await fetch("/api/player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: playerId,
          action: "update_stats",
          statType,
          resultType,
        }),
      });
      const data = await response.json();
      if (data.player) {
        setPlayerStats(data.player);
      }
    } catch (err) {
      console.error("Failed to save game statistics:", err);
    }
  };

  // Fetch leaderboards
  const loadLeaderboard = async () => {
    setIsLoadingLeaderboard(true);
    try {
      const response = await fetch("/api/leaderboard");
      const data = await response.json();
      if (data.onlineLeaders) setOnlineLeaders(data.onlineLeaders);
      if (data.botLeaders) setBotLeaders(data.botLeaders);
    } catch (err) {
      console.error("Failed to load leaderboards:", err);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  // Save Player Name Edit
  const saveNameEdit = async () => {
    const trimmed = editNameValue.trim();
    if (!trimmed) return;
    triggerSound("click");
    setPlayerName(trimmed);
    localStorage.setItem("ttt_player_name", trimmed);
    setIsEditingName(false);
    await syncProfileWithDB(playerId, trimmed);
    // Reload leaderboard in case name changes
    loadLeaderboard();
  };

  // Toggle sound
  const toggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    localStorage.setItem("ttt_sound_enabled", String(nextVal));
    if (nextVal) {
      playSound("click");
    }
  };

  // --- Option 1: LOCAL GAME PLAY LOGIC ---
  const startLocalGameSetup = () => {
    triggerSound("click");
    setMode("local");
    setIsSettingLocalNames(true);
    setLocalBoard(Array(9).fill(""));
    setLocalTurn("X");
    setLocalWinner(null);
    setLocalWinningLine([]);
  };

  const launchLocalGame = () => {
    triggerSound("click");
    setIsSettingLocalNames(false);
    setLocalBoard(Array(9).fill(""));
    setLocalTurn("X");
    setLocalWinner(null);
    setLocalWinningLine([]);
  };

  const handleLocalCellClick = (index: number) => {
    if (localBoard[index] !== "" || localWinner) return;

    const updated = [...localBoard];
    updated[index] = localTurn;
    setLocalBoard(updated);
    triggerSound("move");

    const checkResult = checkWinner(updated);
    if (checkResult.winner) {
      setLocalWinner(checkResult.winner);
      if (checkResult.line) setLocalWinningLine(checkResult.line);

      if (checkResult.winner === "draw") {
        setLocalScores((prev) => ({ ...prev, draws: prev.draws + 1 }));
        triggerSound("draw");
      } else {
        setLocalScores((prev) => {
          if (checkResult.winner === "X") return { ...prev, x: prev.x + 1 };
          return { ...prev, o: prev.o + 1 };
        });
        triggerSound("win");
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }
    } else {
      setLocalTurn(localTurn === "X" ? "O" : "X");
    }
  };

  const resetLocalGame = () => {
    triggerSound("click");
    setLocalBoard(Array(9).fill(""));
    setLocalTurn("X");
    setLocalWinner(null);
    setLocalWinningLine([]);
  };

  // --- Option 2: BOT GAME PLAY LOGIC ---
  const startBotGameSetup = () => {
    triggerSound("click");
    setMode("bot");
    setBotBoard(Array(9).fill(""));
    setBotTurn("X");
    setBotWinner(null);
    setBotWinningLine([]);
    setIsBotThinking(false);
  };

  // When bot mode triggers bot moves
  useEffect(() => {
    if (mode !== "bot" || botWinner || isBotThinking) return;

    const botSymbol = playerSymbol === "X" ? "O" : "X";
    if (botTurn === botSymbol) {
      setIsBotThinking(true);

      // Simple delay to make bot feel real
      const delay = botDifficulty === "easy" ? 400 : botDifficulty === "medium" ? 600 : 850;

      const timer = setTimeout(() => {
        const move = getBotMove(botBoard, botDifficulty, botSymbol, playerSymbol);
        if (move !== -1) {
          const updated = [...botBoard];
          updated[move] = botSymbol;
          setBotBoard(updated);
          triggerSound("move");

          const checkResult = checkWinner(updated);
          if (checkResult.winner) {
            setBotWinner(checkResult.winner);
            if (checkResult.line) setBotWinningLine(checkResult.line);

            if (checkResult.winner === "draw") {
              setBotScores((prev) => ({ ...prev, draws: prev.draws + 1 }));
              triggerSound("draw");
              updateStatsInDB("draw", "bot");
            } else {
              // Bot won
              setBotScores((prev) => ({ ...prev, bot: prev.bot + 1 }));
              triggerSound("lose");
              updateStatsInDB("loss", "bot");
            }
          } else {
            setBotTurn(playerSymbol);
          }
        }
        setIsBotThinking(false);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [botTurn, mode, botBoard, botWinner, playerSymbol, botDifficulty]);

  const handleBotCellClick = (index: number) => {
    if (botBoard[index] !== "" || botWinner || botTurn !== playerSymbol || isBotThinking) return;

    const updated = [...botBoard];
    updated[index] = playerSymbol;
    setBotBoard(updated);
    triggerSound("move");

    const checkResult = checkWinner(updated);
    if (checkResult.winner) {
      setBotWinner(checkResult.winner);
      if (checkResult.line) setBotWinningLine(checkResult.line);

      if (checkResult.winner === "draw") {
        setBotScores((prev) => ({ ...prev, draws: prev.draws + 1 }));
        triggerSound("draw");
        updateStatsInDB("draw", "bot");
      } else {
        // Player won
        setBotScores((prev) => ({ ...prev, player: prev.player + 1 }));
        triggerSound("win");
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
        updateStatsInDB("win", "bot");
      }
    } else {
      const botSymbol = playerSymbol === "X" ? "O" : "X";
      setBotTurn(botSymbol);
    }
  };

  const resetBotGame = () => {
    triggerSound("click");
    setBotBoard(Array(9).fill(""));
    setBotTurn("X");
    setBotWinner(null);
    setBotWinningLine([]);
    setIsBotThinking(false);
  };

  // --- Option 3: ONLINE GAMEPLAY & MATCHMAKING LOGIC ---
  const startOnlineMatchmaking = async () => {
    if (!playerName.trim()) {
      alert("Please enter a valid name first.");
      return;
    }
    triggerSound("click");
    setMode("online");
    setMatchmakingStatus("searching");
    setSearchSeconds(0);
    setOnlineGame(null);
    setOnlineGameId(null);
    setMySymbol(null);
    setErrorMessage(null);
    setOnlineMessages([]);

    // Call join queue API
    try {
      const res = await fetch("/api/matchmaking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, playerName, action: "join" }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setErrorMessage(data.error || "Supabase matchmaking is not available right now.");
        setMatchmakingStatus("idle");
        return;
      }

      if (data.status === "matched") {
        setMatchmakingStatus("matched");
        setOnlineGameId(data.gameId);
        startPollingGame(data.gameId);
      } else {
        // Start polling matchmaking queue
        startPollingMatchmaking();
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to join matchmaking. Please try again.");
      setMatchmakingStatus("idle");
    }
  };

  // Matchmaking Timer Counter
  useEffect(() => {
    let timer: any;
    if (matchmakingStatus === "searching") {
      timer = setInterval(() => {
        setSearchSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [matchmakingStatus]);

  const startPollingMatchmaking = () => {
    if (matchmakingIntervalRef.current) clearInterval(matchmakingIntervalRef.current);

    matchmakingIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/matchmaking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, playerName, action: "join" }),
        });
        const data = await res.json();

        if (!res.ok || data.error) {
          clearInterval(matchmakingIntervalRef.current);
          setErrorMessage(data.error || "Supabase matchmaking is not available right now.");
          setMatchmakingStatus("idle");
          return;
        }

        if (data.status === "matched") {
          clearInterval(matchmakingIntervalRef.current);
          setMatchmakingStatus("matched");
          setOnlineGameId(data.gameId);
          startPollingGame(data.gameId);
        }
      } catch (err) {
        console.error("Matchmaking poll error:", err);
      }
    }, 1500);
  };

  const cancelMatchmaking = async () => {
    triggerSound("click");
    if (matchmakingIntervalRef.current) clearInterval(matchmakingIntervalRef.current);
    setMatchmakingStatus("idle");
    setMode(null);

    try {
      await fetch("/api/matchmaking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, action: "leave" }),
      });
    } catch (err) {
      console.error("Failed to cancel matchmaking:", err);
    }
  };

  const startPollingGame = (gameId: string) => {
    if (gamePollIntervalRef.current) clearInterval(gamePollIntervalRef.current);

    const poll = async () => {
      try {
        const res = await fetch(`/api/game/${gameId}`);
        if (!res.ok) {
          throw new Error("Game not found or finished");
        }
        const data = await res.json();

        // Check if there are updates
        const oldGame = onlineGame;
        const newGame = data.game;

        setOnlineGame(newGame);
        setOnlineMessages(data.messages || []);

        // Determine my symbol
        if (newGame.playerXId === playerId) {
          setMySymbol("X");
        } else if (newGame.playerOId === playerId) {
          setMySymbol("O");
        }

        // Play sounds or trigger effects on updates
        if (oldGame) {
          // Play sound on move made
          if (oldGame.board !== newGame.board) {
            triggerSound("move");
          }

          // Trigger end game events
          if (oldGame.status === "active" && newGame.status === "finished") {
            const meWin =
              (newGame.winner === "X" && newGame.playerXId === playerId) ||
              (newGame.winner === "O" && newGame.playerOId === playerId);

            if (newGame.winner === "draw") {
              triggerSound("draw");
            } else if (meWin) {
              triggerSound("win");
              setShowConfetti(true);
              setTimeout(() => setShowConfetti(false), 3000);
            } else {
              triggerSound("lose");
            }

            // Sync stats
            syncProfileWithDB(playerId, playerName);
            loadLeaderboard();
          }
        } else {
          // First poll success
          triggerSound("click");
        }

        // If game is finished, we can slow down or stop polling, but we should let user stay in screen
        if (newGame.status === "finished") {
          clearInterval(gamePollIntervalRef.current);
        }
      } catch (err) {
        console.error("Polling game state error:", err);
      }
    };

    poll(); // immediate initial fetch
    gamePollIntervalRef.current = setInterval(poll, 1600);
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (matchmakingIntervalRef.current) clearInterval(matchmakingIntervalRef.current);
      if (gamePollIntervalRef.current) clearInterval(gamePollIntervalRef.current);
    };
  }, []);

  // Online Cell Click
  const handleOnlineCellClick = async (index: number) => {
    if (!onlineGameId || !onlineGame || isSubmittingMove) return;
    if (onlineGame.status !== "active") return;

    const isMyTurn = onlineGame.turn === mySymbol;
    if (!isMyTurn) return;

    if (onlineGame.board[index] !== "-") return;

    setIsSubmittingMove(true);

    // Optimistic UI updates
    const boardArr = onlineGame.board.split("");
    boardArr[index] = mySymbol as string;
    const optimisticBoard = boardArr.join("");
    setOnlineGame({
      ...onlineGame,
      board: optimisticBoard,
      turn: mySymbol === "X" ? "O" : "X",
    });
    triggerSound("move");

    try {
      const res = await fetch(`/api/game/${onlineGameId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          action: "move",
          index,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setErrorMessage(data.error);
        // Re-fetch correct state on error
        const correctState = await fetch(`/api/game/${onlineGameId}`).then((r) => r.json());
        if (correctState.game) setOnlineGame(correctState.game);
      } else if (data.game) {
        setOnlineGame(data.game);
        if (data.game.status === "finished") {
          const meWin =
            (data.game.winner === "X" && data.game.playerXId === playerId) ||
            (data.game.winner === "O" && data.game.playerOId === playerId);

          if (data.game.winner === "draw") {
            triggerSound("draw");
          } else if (meWin) {
            triggerSound("win");
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3000);
          } else {
            triggerSound("lose");
          }
          // Refresh user profile and leaderboard
          syncProfileWithDB(playerId, playerName);
          loadLeaderboard();
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("Network error when making move.");
    } finally {
      setIsSubmittingMove(false);
    }
  };

  // Forfeit online game
  const forfeitOnlineGame = async () => {
    if (!onlineGameId || !onlineGame) return;
    if (onlineGame.status !== "active") return;

    const confirmForfeit = window.confirm("Are you sure you want to forfeit this match?");
    if (!confirmForfeit) return;

    triggerSound("click");
    try {
      const res = await fetch(`/api/game/${onlineGameId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          action: "forfeit",
        }),
      });
      const data = await res.json();
      if (data.game) {
        setOnlineGame(data.game);
        triggerSound("lose");
        syncProfileWithDB(playerId, playerName);
        loadLeaderboard();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Send Chat message
  const sendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const message = chatInput.trim();
    if (!message || !onlineGameId) return;

    setChatInput("");
    triggerSound("click");

    // Optimistically add message
    const tempMsg = {
      id: Math.random(),
      gameId: onlineGameId,
      senderId: playerId,
      senderName: playerName,
      message: message,
      createdAt: new Date().toISOString(),
    };
    setOnlineMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await fetch(`/api/game/${onlineGameId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, message }),
      });
      const data = await res.json();
      if (data.message) {
        // Replace optimistic message with actual DB message
        setOnlineMessages((prev) => prev.map((m) => (m.id === tempMsg.id ? data.message : m)));
      }
    } catch (err) {
      console.error("Failed to send message: ", err);
    }
  };

  // Quick Chat Phrase sender
  const sendQuickPhrase = async (phrase: string) => {
    if (!onlineGameId) return;
    try {
      // Optimistic
      const tempMsg = {
        id: Math.random(),
        gameId: onlineGameId,
        senderId: playerId,
        senderName: playerName,
        message: phrase,
        createdAt: new Date().toISOString(),
      };
      setOnlineMessages((prev) => [...prev, tempMsg]);
      triggerSound("click");

      const res = await fetch(`/api/game/${onlineGameId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, message: phrase }),
      });
      const data = await res.json();
      if (data.message) {
        setOnlineMessages((prev) => prev.map((m) => (m.id === tempMsg.id ? data.message : m)));
      }
    } catch (err) {
      console.error("Failed to send quick chat phrase:", err);
    }
  };

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [onlineMessages]);

  // Leave active game & go back to dashboard
  const leaveActiveGame = () => {
    triggerSound("click");
    if (mode === "online" && onlineGame && onlineGame.status === "active") {
      const confirmLeave = window.confirm(
        "You are in an active match! Leaving now will count as a forfeit. Are you sure?"
      );
      if (!confirmLeave) return;
      forfeitOnlineGame();
    }

    // Stop intervals
    if (gamePollIntervalRef.current) clearInterval(gamePollIntervalRef.current);
    if (matchmakingIntervalRef.current) clearInterval(matchmakingIntervalRef.current);

    setMode(null);
    setOnlineGame(null);
    setOnlineGameId(null);
    setMatchmakingStatus("idle");
    setMySymbol(null);
    setErrorMessage(null);
  };

  // Find Winning Line Index helper
  const getOnlineWinningLine = (boardStr: string): number[] => {
    if (!boardStr) return [];
    const boardArr = boardStr.split("").map((c) => (c === "-" ? "" : c));
    const checkResult = checkWinner(boardArr);
    return checkResult.line || [];
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-white font-sans selection:bg-indigo-500 selection:text-white">
      {showConfetti && <Confetti />}

      {/* --- TOP HEADER AND PROFILE BAR --- */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-slate-950/80 border-b border-indigo-950 px-4 py-3 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="font-black text-2xl tracking-tighter text-white">#</span>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-rose-200 bg-clip-text text-transparent">
                TIC-TAC-TOE CHAMPIONS
              </h1>
              <p className="text-xs text-slate-400">Play local, challenge AI, or compete worldwide</p>
            </div>
          </div>

          {/* Player Profile & Sound Button */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {/* Sound Toggle */}
            <button
              onClick={toggleSound}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition"
              title={soundEnabled ? "Mute Game" : "Enable Sound"}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>

            {/* Profile Nickname Widget */}
            <div className="flex items-center gap-2 bg-slate-900/90 border border-indigo-950/80 rounded-xl px-3 py-1.5 shadow-inner">
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-sm text-white">
                {playerName ? playerName[0].toUpperCase() : "P"}
              </div>

              {isEditingName ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value.slice(0, 15))}
                    className="bg-slate-950 text-white text-xs px-2 py-1 rounded border border-indigo-500 outline-none w-24 sm:w-32 focus:ring-1 focus:ring-indigo-400"
                    placeholder="Nickname"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveNameEdit();
                      if (e.key === "Escape") setIsEditingName(false);
                    }}
                  />
                  <button
                    onClick={saveNameEdit}
                    className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    <Check size={12} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold max-w-[100px] sm:max-w-[150px] truncate text-slate-200">
                    {playerName || "Loading..."}
                  </span>
                  <button
                    onClick={() => {
                      triggerSound("click");
                      setEditNameValue(playerName);
                      setIsEditingName(true);
                    }}
                    className="text-slate-400 hover:text-white transition"
                  >
                    <Edit2 size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* --- MAIN LAYOUT CONTAINER --- */}
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        {mode === null ? (
          /* =========================================================
             DASHBOARD SCREEN (WHEN NO GAME IS ACTIVE)
             ========================================================= */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* LEFT COLUMN: MODES SELECTION (Span 2) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Promo Banner / Intro */}
              <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-indigo-900 to-indigo-950 border border-indigo-800 p-6 sm:p-8 shadow-xl shadow-indigo-950/50">
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl" />
                <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-48 h-48 bg-rose-500/10 rounded-full blur-2xl" />

                <div className="relative z-10 max-w-lg">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Featured Arena
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black mt-3 leading-tight tracking-tight text-white">
                    Step Into The Arena
                  </h2>
                  <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                    Enjoy classic Tic-Tac-Toe completely modernized with offline pass-and-play, smarter bot
                    difficulties, and global matchmaking featuring integrated game rooms and chat!
                  </p>
                </div>
              </div>

              {/* THREE GAME OPTIONS CHANNELS */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold tracking-wider text-indigo-400 uppercase">
                  Select Game Option
                </h3>

                {/* Option 1: LOCAL FRIEND SAME DEVICE */}
                <div className="group relative rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-rose-500/30 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-300 hover:shadow-lg hover:shadow-rose-950/10 hover:bg-slate-900/90">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-rose-500/20 to-rose-600/10 border border-rose-500/30 flex items-center justify-center text-rose-400 group-hover:scale-105 transition-transform duration-300">
                      <Users size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-base group-hover:text-rose-400 transition-colors">
                        Option 1: With Friends on Same Device
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-md">
                        Classic pass-and-play! Enter customized names and keep session score records with your friend next to you.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={startLocalGameSetup}
                    className="w-full sm:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-rose-900/20"
                  >
                    Play Local
                  </button>
                </div>

                {/* Option 2: AGAINST A BOT */}
                <div className="group relative rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/30 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-950/10 hover:bg-slate-900/90">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform duration-300">
                      <Bot size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-base group-hover:text-emerald-400 transition-colors">
                        Option 2: Play Against a Bot
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400">
                          Train with AI. Difficulty options:
                        </span>
                        <select
                          value={botDifficulty}
                          onChange={(e) => {
                            triggerSound("click");
                            setBotDifficulty(e.target.value as any);
                          }}
                          className="bg-slate-950 border border-slate-800 text-slate-300 text-[11px] rounded px-1.5 py-0.5 outline-none font-semibold focus:border-emerald-500"
                        >
                          <option value="easy">Easy (Random)</option>
                          <option value="medium">Medium (Moderate)</option>
                          <option value="unbeatable">Unbeatable (Minimax AI)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    {/* Choose Symbol */}
                    <div className="flex items-center justify-center bg-slate-950 rounded-xl p-1 border border-slate-800">
                      <button
                        onClick={() => {
                          triggerSound("click");
                          setPlayerSymbol("X");
                        }}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                          playerSymbol === "X"
                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Play as X
                      </button>
                      <button
                        onClick={() => {
                          triggerSound("click");
                          setPlayerSymbol("O");
                        }}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                          playerSymbol === "O"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Play as O
                      </button>
                    </div>

                    <button
                      onClick={startBotGameSetup}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-900/20"
                    >
                      Battle Bot
                    </button>
                  </div>
                </div>

                {/* Option 3: ONLINE MATCHMAKING */}
                <div className="group relative rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/30 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-950/10 hover:bg-slate-900/90">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-indigo-600/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform duration-300">
                      <Globe size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-base group-hover:text-indigo-400 transition-colors">
                        Option 3: Online Matchmaking
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-md">
                        Enter the matchmaking pool! Get paired up with an active player, play live matches, and text each other using instant-phrases and custom chats.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={startOnlineMatchmaking}
                    className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-indigo-900/20"
                  >
                    Match Online
                  </button>
                </div>
              </div>

              {/* STATS BREAKDOWN FOR CURRENT PLAYER */}
              <div className="rounded-2xl bg-slate-900/40 border border-slate-800 p-5">
                <h4 className="text-xs font-bold tracking-wider text-slate-400 uppercase flex items-center gap-2 mb-4">
                  <Flame size={14} className="text-amber-500" />
                  Your Historical Statistics
                </h4>

                {playerStats ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Online Stats */}
                    <div className="bg-slate-950/60 rounded-xl p-4 border border-indigo-950">
                      <p className="text-xs font-bold text-indigo-300 mb-2">Online Matchmaking Records</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                          <p className="text-[10px] text-slate-400">Wins</p>
                          <p className="text-base font-black text-emerald-400">{playerStats.winsOnline}</p>
                        </div>
                        <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                          <p className="text-[10px] text-slate-400">Losses</p>
                          <p className="text-base font-black text-rose-400">{playerStats.lossesOnline}</p>
                        </div>
                        <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                          <p className="text-[10px] text-slate-400">Draws</p>
                          <p className="text-base font-black text-slate-300">{playerStats.drawsOnline}</p>
                        </div>
                      </div>
                    </div>

                    {/* Bot Stats */}
                    <div className="bg-slate-950/60 rounded-xl p-4 border border-emerald-950">
                      <p className="text-xs font-bold text-emerald-300 mb-2">Bot Arena Records</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                          <p className="text-[10px] text-slate-400">Wins</p>
                          <p className="text-base font-black text-emerald-400">{playerStats.winsBot}</p>
                        </div>
                        <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                          <p className="text-[10px] text-slate-400">Losses</p>
                          <p className="text-base font-black text-rose-400">{playerStats.lossesBot}</p>
                        </div>
                        <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                          <p className="text-[10px] text-slate-400">Draws</p>
                          <p className="text-base font-black text-slate-300">{playerStats.drawsBot}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-500 text-xs">
                    No stats found. Connect to register your profile!
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: LEADERS BOARD PANEL */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                  <Trophy size={20} className="text-amber-400" />
                  Leaderboards
                </h3>
                <button
                  onClick={loadLeaderboard}
                  disabled={isLoadingLeaderboard}
                  className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:text-white transition text-slate-400 hover:border-slate-700"
                >
                  <RefreshCw size={14} className={isLoadingLeaderboard ? "animate-spin" : ""} />
                </button>
              </div>

              {/* Tabs selector */}
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => {
                    triggerSound("click");
                    setActiveTab("play"); // using activeTab as leaderboard subtype tab
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition ${
                    activeTab === "play"
                      ? "bg-indigo-600 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Online Legends
                </button>
                <button
                  onClick={() => {
                    triggerSound("click");
                    setActiveTab("leaderboard");
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition ${
                    activeTab === "leaderboard"
                      ? "bg-indigo-600 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Bot Champions
                </button>
              </div>

              {/* LIST DISPLAY */}
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {isLoadingLeaderboard ? (
                  <div className="text-center py-12 text-slate-500 text-sm animate-pulse">
                    Loading leaderboards...
                  </div>
                ) : (
                  <>
                    {activeTab === "play" ? (
                      /* Online list */
                      onlineLeaders.length === 0 ? (
                        <p className="text-center text-xs text-slate-500 py-8">No online history yet.</p>
                      ) : (
                        onlineLeaders.map((leader, i) => (
                          <div
                            key={leader.id}
                            className={`flex items-center justify-between p-3 rounded-xl border ${
                              leader.id === playerId
                                ? "bg-indigo-950/50 border-indigo-500"
                                : "bg-slate-950/40 border-slate-900"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center ${
                                  i === 0
                                    ? "bg-amber-500 text-slate-950"
                                    : i === 1
                                    ? "bg-slate-300 text-slate-950"
                                    : i === 2
                                    ? "bg-amber-700 text-white"
                                    : "bg-slate-900 text-slate-400"
                                }`}
                              >
                                {i + 1}
                              </span>
                              <div>
                                <span className="text-xs font-bold block truncate max-w-[120px]">
                                  {leader.name}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {leader.lossesOnline} L • {leader.drawsOnline} D
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-black text-emerald-400 block">
                                {leader.winsOnline} Wins
                              </span>
                            </div>
                          </div>
                        ))
                      )
                    ) : (
                      /* Bot list */
                      botLeaders.length === 0 ? (
                        <p className="text-center text-xs text-slate-500 py-8">No bot battles yet.</p>
                      ) : (
                        botLeaders.map((leader, i) => (
                          <div
                            key={leader.id}
                            className={`flex items-center justify-between p-3 rounded-xl border ${
                              leader.id === playerId
                                ? "bg-indigo-950/50 border-indigo-500"
                                : "bg-slate-950/40 border-slate-900"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center ${
                                  i === 0
                                    ? "bg-amber-500 text-slate-950"
                                    : i === 1
                                    ? "bg-slate-300 text-slate-950"
                                    : i === 2
                                    ? "bg-amber-700 text-white"
                                    : "bg-slate-900 text-slate-400"
                                }`}
                              >
                                {i + 1}
                              </span>
                              <div>
                                <span className="text-xs font-bold block truncate max-w-[120px]">
                                  {leader.name}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {leader.lossesBot} L • {leader.drawsBot} D
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-black text-emerald-400 block">
                                {leader.winsBot} Wins
                              </span>
                            </div>
                          </div>
                        ))
                      )
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================
             ACTIVE GAME SCREENS (LOCAL / BOT / ONLINE MATCH)
             ========================================================= */
          <div className="space-y-6">
            {/* GAME CONTROLS & HEADER */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow">
              <div className="flex items-center gap-3">
                <button
                  onClick={leaveActiveGame}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs transition"
                >
                  <ArrowLeft size={14} />
                  Dashboard
                </button>
                <div className="h-6 w-px bg-slate-800" />
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-600/20 text-indigo-400 border border-indigo-600/30">
                    {mode === "local" ? "LOCAL FRIENDS" : mode === "bot" ? `BOT (${botDifficulty})` : "ONLINE MATCH"}
                  </span>
                </div>
              </div>

              {/* Display Scores */}
              <div className="flex items-center gap-4 text-xs font-bold">
                {mode === "local" && (
                  <div className="flex items-center gap-2">
                    <span className="text-rose-400">{localXName}: {localScores.x}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-emerald-400">{localOName}: {localScores.o}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-300">Draws: {localScores.draws}</span>
                  </div>
                )}

                {mode === "bot" && (
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-400">You ({playerSymbol}): {botScores.player}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-emerald-400">Bot: {botScores.bot}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-300">Draws: {botScores.draws}</span>
                  </div>
                )}

                {mode === "online" && onlineGame && (
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-300">X: {onlineGame.playerXName}</span>
                    <span className="text-slate-500">vs</span>
                    <span className="text-slate-300">O: {onlineGame.playerOName}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ERROR MESSAGE BANNER */}
            {errorMessage && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs p-3 rounded-xl flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <AlertCircle size={14} />
                  {errorMessage}
                </span>
                <button onClick={() => setErrorMessage(null)} className="font-bold underline text-[10px]">
                  Dismiss
                </button>
              </div>
            )}

            {/* TWO COLUMN PLAY BOARD SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
              {/* BOARD INTERFACE COLUMN (Span 2 or Centered) */}
              <div className={`${mode === "online" ? "lg:col-span-2" : "lg:col-span-3"} flex flex-col items-center justify-center`}>
                {/* MATCHMAKING QUEUE DISPLAY */}
                {mode === "online" && matchmakingStatus === "searching" && (
                  <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-xl animate-fade-in my-8">
                    <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-4 border-indigo-600/20 animate-pulse" />
                      <div className="absolute inset-0 rounded-full border-t-4 border-indigo-500 animate-spin" />
                      <Globe size={40} className="text-indigo-400 animate-pulse" />
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-white">Finding Online Match</h3>
                      <p className="text-xs text-slate-400">Searching for other challengers worldwide...</p>
                    </div>

                    <div className="flex items-center justify-center gap-1 bg-slate-950 w-24 mx-auto py-1.5 rounded-lg border border-slate-800">
                      <Timer size={14} className="text-rose-500 animate-pulse" />
                      <span className="text-xs font-mono font-bold">{searchSeconds}s</span>
                    </div>

                    <button
                      onClick={cancelMatchmaking}
                      className="px-6 py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition rounded-xl text-xs font-bold"
                    >
                      Cancel Search
                    </button>
                  </div>
                )}

                {/* GAME ACTIVE INTERFACES */}

                {/* 1. LOCAL FRIEND SAME DEVICE BOARD */}
                {mode === "local" && (
                  <div className="w-full max-w-md space-y-6 py-4">
                    {isSettingLocalNames ? (
                      /* Name form before start */
                      <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl">
                        <h4 className="font-bold text-base text-indigo-400 text-center">Local Players setup</h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                              Player X Name
                            </label>
                            <input
                              type="text"
                              value={localXName}
                              onChange={(e) => setLocalXName(e.target.value.slice(0, 15))}
                              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                              Player O Name
                            </label>
                            <input
                              type="text"
                              value={localOName}
                              onChange={(e) => setLocalOName(e.target.value.slice(0, 15))}
                              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>
                        <button
                          onClick={launchLocalGame}
                          className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition"
                        >
                          Start Match
                        </button>
                      </div>
                    ) : (
                      /* Active local grid */
                      <div className="space-y-6">
                        {/* Status bar */}
                        <div className="text-center">
                          {localWinner ? (
                            localWinner === "draw" ? (
                              <h3 className="text-xl font-extrabold text-slate-300">It's a Draw! 🤝</h3>
                            ) : (
                              <h3 className="text-xl font-extrabold text-emerald-400">
                                🎉 {localWinner === "X" ? localXName : localOName} Won!
                              </h3>
                            )
                          ) : (
                            <h3 className="text-base font-bold text-slate-200">
                              Turn:{" "}
                              <span
                                className={localTurn === "X" ? "text-rose-400" : "text-emerald-400"}
                              >
                                {localTurn === "X" ? localXName : localOName} ({localTurn})
                              </span>
                            </h3>
                          )}
                        </div>

                        {/* Grid */}
                        <div className="grid grid-cols-3 gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800 aspect-square max-w-[340px] mx-auto shadow-2xl">
                          {localBoard.map((cell, idx) => {
                            const isWinCell = localWinningLine.includes(idx);
                            return (
                              <button
                                key={idx}
                                onClick={() => handleLocalCellClick(idx)}
                                className={`rounded-xl aspect-square flex items-center justify-center text-4xl font-black transition-all ${
                                  cell === "" ? "bg-slate-900/60 hover:bg-slate-900 cursor-pointer" : "bg-slate-900"
                                } ${isWinCell ? "ring-2 ring-emerald-400 bg-emerald-950/20" : "border border-slate-800/40"}`}
                              >
                                {cell === "X" && (
                                  <span className="text-rose-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.3)] animate-scale-in">
                                    X
                                  </span>
                                )}
                                {cell === "O" && (
                                  <span className="text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)] animate-scale-in">
                                    O
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={resetLocalGame}
                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white text-xs font-bold rounded-xl transition"
                          >
                            Rematch
                          </button>
                          <button
                            onClick={startLocalGameSetup}
                            className="px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold rounded-xl transition"
                          >
                            Rename Players
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. BOT CHALLENGE BOARD */}
                {mode === "bot" && (
                  <div className="w-full max-w-md space-y-6 py-4">
                    <div className="text-center space-y-1">
                      <div className="text-xs text-slate-400 flex items-center justify-center gap-1">
                        <Bot size={12} />
                        Playing vs {botDifficulty} Bot
                      </div>

                      {botWinner ? (
                        botWinner === "draw" ? (
                          <h3 className="text-xl font-extrabold text-slate-300">It's a Draw! 🤝</h3>
                        ) : (
                          <h3
                            className={`text-xl font-extrabold ${
                              botWinner === playerSymbol ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {botWinner === playerSymbol ? "🎉 You Won!" : "🤖 Bot Won!"}
                          </h3>
                        )
                      ) : (
                        <h3 className="text-base font-bold text-slate-200">
                          {botTurn === playerSymbol ? (
                            <span className="text-emerald-400">Your Turn ({playerSymbol})</span>
                          ) : (
                            <span className="text-amber-400 animate-pulse">Bot is thinking...</span>
                          )}
                        </h3>
                      )}
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-3 gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800 aspect-square max-w-[340px] mx-auto shadow-2xl">
                      {botBoard.map((cell, idx) => {
                        const isWinCell = botWinningLine.includes(idx);
                        return (
                          <button
                            key={idx}
                            onClick={() => handleBotCellClick(idx)}
                            className={`rounded-xl aspect-square flex items-center justify-center text-4xl font-black transition-all ${
                              cell === "" ? "bg-slate-900/60 hover:bg-slate-900 cursor-pointer" : "bg-slate-900"
                            } ${isWinCell ? "ring-2 ring-emerald-400 bg-emerald-950/20" : "border border-slate-800/40"}`}
                          >
                            {cell === "X" && (
                              <span className="text-rose-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.3)]">X</span>
                            )}
                            {cell === "O" && (
                              <span className="text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">O</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Action button */}
                    <div className="flex justify-center">
                      <button
                        onClick={resetBotGame}
                        className="px-6 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white text-xs font-bold rounded-xl transition"
                      >
                        Reset Game
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. ONLINE MATCHPLAY BOARD */}
                {mode === "online" && onlineGame && (
                  <div className="w-full max-w-md space-y-6 py-4">
                    <div className="text-center space-y-1">
                      {/* Opponent Identity Banner */}
                      <div className="flex items-center justify-center gap-2 text-xs">
                        <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-[10px] text-slate-300">
                          Room: {onlineGame.id.slice(5, 12)}
                        </span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-slate-400">Live matched</span>
                      </div>

                      {/* Winner status or Turn status */}
                      {onlineGame.status === "finished" ? (
                        onlineGame.winner === "draw" ? (
                          <h3 className="text-xl font-extrabold text-slate-300">It's a Draw! 🤝</h3>
                        ) : (
                          <h3 className="text-xl font-extrabold">
                            {onlineGame.winner === mySymbol ? (
                              <span className="text-emerald-400">🎉 Victory! You Won!</span>
                            ) : (
                              <span className="text-rose-400">Defeat! Opponent Won!</span>
                            )}
                          </h3>
                        )
                      ) : (
                        <h3 className="text-base font-bold text-slate-200">
                          {onlineGame.turn === mySymbol ? (
                            <span className="text-emerald-400 animate-pulse flex items-center justify-center gap-1.5">
                              Your Turn ({mySymbol})
                            </span>
                          ) : (
                            <span className="text-slate-400">
                              Opponent's Turn ({onlineGame.turn === "X" ? "X" : "O"})
                            </span>
                          )}
                        </h3>
                      )}
                    </div>

                    {/* Score / Names bar */}
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-950/60 rounded-xl border border-slate-900 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        <span className={`font-semibold ${mySymbol === "X" ? "text-indigo-400 font-black" : "text-slate-300"}`}>
                          X: {onlineGame.playerXName} {mySymbol === "X" && "(You)"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                        <span className={`font-semibold ${mySymbol === "O" ? "text-indigo-400 font-black" : "text-slate-300"}`}>
                          O: {onlineGame.playerOName} {mySymbol === "O" && "(You)"}
                        </span>
                      </div>
                    </div>

                    {/* Online Grid */}
                    <div className="grid grid-cols-3 gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800 aspect-square max-w-[340px] mx-auto shadow-2xl relative">
                      {/* Thinking mask if submitting move */}
                      {isSubmittingMove && (
                        <div className="absolute inset-0 bg-slate-950/30 rounded-2xl flex items-center justify-center backdrop-blur-[1px]" />
                      )}

                      {onlineGame.board.split("").map((cellChar: string, idx: number) => {
                        const cellVal = cellChar === "-" ? "" : cellChar;
                        const line = getOnlineWinningLine(onlineGame.board);
                        const isWinCell = line.includes(idx);

                        return (
                          <button
                            key={idx}
                            disabled={
                              onlineGame.status !== "active" ||
                              onlineGame.turn !== mySymbol ||
                              cellVal !== ""
                            }
                            onClick={() => handleOnlineCellClick(idx)}
                            className={`rounded-xl aspect-square flex items-center justify-center text-4xl font-black transition-all ${
                              cellVal === "" && onlineGame.status === "active" && onlineGame.turn === mySymbol
                                ? "bg-indigo-900/10 hover:bg-indigo-900/30 cursor-pointer hover:scale-[1.02]"
                                : "bg-slate-900"
                            } ${isWinCell ? "ring-2 ring-emerald-400 bg-emerald-950/20" : "border border-slate-800/40"}`}
                          >
                            {cellVal === "X" && (
                              <span className="text-rose-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.3)] animate-scale-in">
                                X
                              </span>
                            )}
                            {cellVal === "O" && (
                              <span className="text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)] animate-scale-in">
                                O
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Forfeit option / Action Button */}
                    <div className="flex gap-2 justify-center">
                      {onlineGame.status === "active" && (
                        <button
                          onClick={forfeitOnlineGame}
                          className="px-4 py-2 bg-slate-950 hover:bg-rose-950 hover:text-rose-300 border border-slate-800 hover:border-rose-900 text-slate-400 text-xs font-bold rounded-xl transition"
                        >
                          Forfeit Match
                        </button>
                      )}

                      {onlineGame.status === "finished" && (
                        <button
                          onClick={startOnlineMatchmaking}
                          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition"
                        >
                          Find New Opponent
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* CHAT / QUICK-PHRASES WINDOW (Only in Online Matchmaking Mode & Matched) */}
              {mode === "online" && matchmakingStatus === "matched" && onlineGame && (
                <div className="lg:col-span-1 bg-slate-900/90 border border-indigo-950/80 rounded-3xl flex flex-col h-[480px] lg:h-auto shadow-xl overflow-hidden">
                  {/* Chat header */}
                  <div className="p-4 border-b border-indigo-950 flex items-center justify-between bg-slate-950/50">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={16} className="text-indigo-400" />
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-200">
                        Live Match Chat
                      </h4>
                    </div>
                    <span className="text-[10px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded font-bold">
                      Active
                    </span>
                  </div>

                  {/* Messages List Area */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/20">
                    {onlineMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-4">
                        <MessageSquare size={24} className="text-slate-600 mb-2" />
                        <p className="text-xs">No chat messages yet.</p>
                        <p className="text-[10px] text-slate-600">Send a friendly greeting or use quick emojis!</p>
                      </div>
                    ) : (
                      onlineMessages.map((msg) => {
                        const isMe = msg.senderId === playerId;
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                          >
                            <span className="text-[9px] text-slate-500 mb-0.5 px-1">
                              {msg.senderName}
                            </span>
                            <div
                              className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-xs shadow-sm break-words ${
                                isMe
                                  ? "bg-indigo-600 text-white rounded-tr-none"
                                  : "bg-slate-800 text-slate-100 rounded-tl-none"
                              }`}
                            >
                              {msg.message}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* Quick-Phrases Quick Selection */}
                  <div className="p-2 border-t border-indigo-950/50 bg-slate-950/40 flex flex-wrap gap-1 items-center justify-center">
                    {["GLHF! 🎮", "Nice move! 🔥", "Oops! 😅", "OMG 😱", "Good Game! 🤝", "Rematch? 🔄"].map(
                      (phrase) => (
                        <button
                          key={phrase}
                          onClick={() => sendQuickPhrase(phrase)}
                          className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[10px] hover:text-white hover:border-slate-700 transition"
                        >
                          {phrase}
                        </button>
                      )
                    )}
                  </div>

                  {/* Text Input Footer */}
                  <form onSubmit={sendChatMessage} className="p-3 bg-slate-950 border-t border-indigo-950 flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value.slice(0, 100))}
                      placeholder="Type a message..."
                      className="flex-1 bg-slate-900 border border-slate-800 text-white rounded-xl px-3 py-1.5 text-xs outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className="p-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-xl text-white transition flex items-center justify-center w-8 h-8"
                    >
                      <Send size={14} />
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* --- FOOTER REGION --- */}
      <footer className="mt-12 border-t border-indigo-950/60 bg-slate-950/40 py-8 text-center text-slate-500 text-xs px-4">
        <div className="max-w-6xl mx-auto space-y-2">
          <p className="font-semibold text-slate-400">
            Tic-Tac-Toe Arena — Ultimate Multi-Option Play Suite
          </p>
          <p>
            Powered by Next.js, PostgreSQL, Drizzle ORM, and Tailwind CSS.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-4 text-slate-600">
            <span>Pass &amp; Play Mode</span>
            <span>•</span>
            <span>Minimax AI Bot Mode</span>
            <span>•</span>
            <span>Live Long Polling Matchmaker</span>
          </div>
          <div className="pt-1">
            <a
              href="/index.html"
              className="text-indigo-400 hover:text-indigo-300 hover:underline font-semibold"
            >
              Open the standalone offline index.html version →
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
