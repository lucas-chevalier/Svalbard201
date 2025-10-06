import React, { useEffect, useState } from "react";
import { ref, onValue, update, push } from "firebase/database";
import { db } from "../firebase";
import Chat from "./Chat";
import Timer from "./Timer";
import PuzzleEnergy from "./PuzzleEnergy";

export default function GameRoom({ sessionId, playerId }) {
  const [session, setSession] = useState(null);
  const sessionRef = ref(db, `sessions/${sessionId}`);

  useEffect(() => {
    const unsub = onValue(sessionRef, (snap) => setSession(snap.val()));
    return () => unsub();
  }, [sessionId]);

  if (!session) return <p>Chargement...</p>;

  // ✅ Trouve le joueur correspondant
  const player =
    Object.values(session.players || {}).find((p) => String(p.id) === String(playerId)) ||
    Object.values(session.players || {}).find((p) => p.name); // fallback au premier joueur
  const playerName = player?.name || "Inconnu";

  const solveEnergy = async () => {
    await update(ref(db, `sessions/${sessionId}/puzzles`), { energy: "solved" });
    await push(ref(db, `sessions/${sessionId}/chat`), {
      sender: "SYSTEM",
      text: `${playerName} a réactivé le module énergie`
    });
  };

  return (
    <div className="room">
      <h2>Session {sessionId}</h2>
      <h3>👤 Joueur : {playerName}</h3>
      <h4>🎭 Rôle : {player?.role || "Aucun rôle"}</h4>

      <Timer endTime={session.timer} />
      <PuzzleEnergy status={session.puzzles.energy} onSolve={solveEnergy} />
      <Chat sessionId={sessionId} playerName={playerName} />
    </div>
  );
}
// src/components/GameRoom.jsx