import React, { useEffect, useState } from "react";
import { ref, onChildAdded, push, onValue } from "firebase/database";
import { db } from "../firebase";

export default function Chat({ sessionId, playerId, playerName }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [players, setPlayers] = useState({});

  // Récupération des joueurs et rôles
  useEffect(() => {
    const playersRef = ref(db, `sessions/${sessionId}/players`);
    const unsub = onValue(playersRef, (snap) => {
      setPlayers(snap.val() || {});
    });
    return () => unsub();
  }, [sessionId]);

  // Écoute des nouveaux messages
  useEffect(() => {
    const chatRef = ref(db, `sessions/${sessionId}/chat`);
    const unsub = onChildAdded(chatRef, (snap) => {
      const msg = snap.val();
      setMsgs((p) => [...p, msg]);
    });
    return () => unsub();
  }, [sessionId]);

  // Envoi de message avec rôle inclus
  const send = async () => {
    if (!text.trim()) return;
    const role = players?.[playerId]?.role || "Joueur";

    await push(ref(db, `sessions/${sessionId}/chat`), {
      sender: playerName,
      role,
      text,
      timestamp: Date.now(),
    });

    setText("");
  };

  // Gestion Entrée
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="chat">
      <h4>💬 Terminal</h4>
      <div className="messages">
        {msgs.map((m, i) => (
          <p key={i}>
            <strong style={{ color: "#00ff66" }}>
              {m.sender}
              <span style={{ color: "#00ffcc" }}> ({m.role})</span>
            </strong>
            : {m.text}
          </p>
        ))}
      </div>

      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyPress} // Envoi sur Enter
        placeholder="Écrire..."
        style={{
          width: "100%",
          padding: "6px",
          borderRadius: "4px",
          border: "1px solid #00ff66",
          background: "rgba(0,20,0,0.9)",
          color: "#00ff66",
          fontFamily: "Courier New, monospace",
          textShadow: "0 0 3px #00ff66",
          marginTop: "6px",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}
