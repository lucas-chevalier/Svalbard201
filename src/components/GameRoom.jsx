import React, { useEffect, useState } from "react";
import { ref, onValue, update, push } from "firebase/database";
import { db } from "../firebase";
import Chat from "./Chat";
import Timer from "./Timer";
import PuzzleEnergy from "./PuzzleEnergy";
import PuzzleWater from "./PuzzleWater"; // Mini-jeu réseau d'eau

export default function GameRoom({ sessionId, playerId }) {
  const [session, setSession] = useState(null);
  const [currentRoom, setCurrentRoom] = useState("lobby"); // lobby, waterPuzzle, etc.
  const sessionRef = ref(db, `sessions/${sessionId}`);

  useEffect(() => {
    const unsub = onValue(sessionRef, (snap) => setSession(snap.val()));
    return () => unsub();
  }, []);

  const solveEnergy = async () => {
    await update(ref(db, `sessions/${sessionId}/puzzles`), { energy: "solved" });
    await push(ref(db, `sessions/${sessionId}/chat`), {
      sender: "SYSTEM",
      text: `${session.players[playerId].name} a réactivé le module énergie`
    });
  };

  if (!session) return <p>Chargement...</p>;

  // Liste des salles accessibles
  const rooms = [
    "Salle de contrôle",
    "Système de survie",
    "Débarras",
    "Biosphère",
    "Grainothèque",
    "Centrale électrique",
    "Salle de traitement (eau)"
  ];

  // Gestion click sur salle
  const enterRoom = (room) => {
    if(room === "Salle de traitement (eau)") setCurrentRoom("waterPuzzle");
    else alert(`${room} pas encore implémentée`);
  };

  // Si mini-jeu actif
  if(currentRoom === "waterPuzzle") {
    return (
      <div className="room">
        <h2>Salle de traitement (eau)</h2>
        <Timer endTime={session.timer} />
        <PuzzleWater onWin={() => alert("Puzzle terminé !")} />
        <button onClick={() => setCurrentRoom("lobby")}>Retour au lobby</button>
        <Chat sessionId={sessionId} playerName={session.players[playerId]?.name || "??"} />
      </div>
    );
  }

  // Vue lobby / plan des salles
  return (
    <div className="room">
      <h2>Session {sessionId}</h2>
      <Timer endTime={session.timer} />
      <PuzzleEnergy status={session.puzzles.energy} onSolve={solveEnergy} />
      <div className="map-grid" style={{margin: '16px 0'}}>
        {rooms.map((room, i) => (
          <div key={i} className="room" onClick={() => enterRoom(room)}>
            {room}
          </div>
        ))}
      </div>
      <Chat sessionId={sessionId} playerName={session.players[playerId]?.name || "??"} />
    </div>
  );
}
