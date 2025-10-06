// src/components/WaitingRoom.jsx
import React, { useEffect, useState } from "react";
import { ref, onValue, update } from "firebase/database";
import { db } from "../firebase";
import { Beaker, Zap, Droplets, ShieldAlert } from "lucide-react";

const roleIcons = {
  Hydrologue: <Droplets size={18} />,
  "Énergéticien": <Zap size={18} />,
  Biologiste: <Beaker size={18} />,
};

export default function WaitingRoom({ sessionId, playerId, onStart }) {
  const [session, setSession] = useState(null);
  const sessionRef = ref(db, `sessions/${sessionId}`);

  useEffect(() => {
    const unsub = onValue(sessionRef, (snap) => {
      const data = snap.val();
      setSession(data);
      // Quand l’hôte lance la partie, tout le monde bascule
      if (data?.state === "playing") {
        onStart(sessionId, playerId);
      }
    });
    return () => unsub();
  }, [sessionId, playerId, onStart]);

  if (!session) return <p>Chargement du briefing...</p>;

  const isHost = String(session.host) === String(playerId);

  const startGame = () => {
    update(sessionRef, { state: "playing" });
  };

  return (
    <div className="waiting-room fallout-terminal">
      <div className="vault-title">📡 Salle de Briefing</div>
      <p className="subtitle">Mission ID : {sessionId}</p>

      <h3>👥 Opérateurs connectés :</h3>
      <ul className="players-list">
        {Object.values(session.players || {}).map((p, i) => (
          <li key={i} className="player-entry" style={{ borderColor: p.color || "#00ff66" }}>
            <span className="player-icon" style={{ color: p.color || "#00ff66" }}>
              {roleIcons[p.role] || <ShieldAlert size={16} />}
            </span>
            <span className="player-name">{p.name}</span>
            <span className="player-role" style={{ color: p.color || "#00ff66" }}>
              {p.role}
            </span>
            {String(session.host) === String(p.id) && (
              <span className="player-host">★ Chef</span>
            )}
          </li>
        ))}
      </ul>

      {isHost ? (
        <button onClick={startGame} className="launch-button">
          🚀 Lancer la mission
        </button>
      ) : (
        <p>En attente du lancement par le chef de mission...</p>
      )}
    </div>
  );
}
// src/components/WaitingRoom.jsx