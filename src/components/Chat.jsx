import React, { useEffect, useState } from "react";
import { ref, onChildAdded, push, onValue } from "firebase/database";
import { db } from "../firebase";

export default function Chat({ sessionId, playerId, playerName }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [players, setPlayers] = useState({});

  // Récupération de la liste des joueurs et de leurs rôles
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

  const send = async () => {
    if (!text.trim()) return;

    // Récupérer le rôle du joueur depuis players
    const role = players?.[playerId]?.role || "Joueur";

    await push(ref(db, `sessions/${sessionId}/chat`), {
      sender: playerName,
      role,
      text,
    });

    setText("");
  };

  return (
    <div className="chat">
      <h4>💬 Terminal</h4>
      <div className="messages">
        {msgs.map((m, i) => (
          <p key={i}>
            <strong>{m.sender} ({m.role})</strong>: {m.text}
          </p>
        ))}
      </div>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Écrire..."
      />
      <button onClick={send}>Envoyer</button>
    </div>
  );
}
// src/components/Chat.jsx