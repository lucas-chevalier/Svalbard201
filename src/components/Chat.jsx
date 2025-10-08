import React, { useEffect, useState, useRef } from "react";
import { ref, onChildAdded, push, onValue } from "firebase/database";
import { db } from "../firebase";

export default function Chat({ sessionId, playerId, playerName }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [players, setPlayers] = useState({});
  const messagesEndRef = useRef(null);

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

  // Scroll automatique vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

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
    <div
      className="chat chat-right"
      style={{
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: "340px",
        height: "100vh", // <-- Ajouté ici
        background: "rgba(0,20,0,0.92)",
        borderLeft: "2px solid #00ff66",
        display: "flex",
        flexDirection: "column",
        zIndex: 10,
      }}
    >
      <h4 style={{ padding: "12px 16px 0 16px", margin: 0 }}>💬 Terminal</h4>
      <div
        className="messages"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "10px 16px 80px 16px",
        }}
      >
        {msgs.map((m, i) => (
          <p key={i} style={{ margin: "6px 0" }}>
            <strong style={{ color: "#00ff66" }}>
              {m.sender}
              <span style={{ color: "#00ffcc" }}> ({m.role})</span>
            </strong>
            : {m.text}
          </p>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "12px 16px",
          background: "rgba(0,20,0,0.98)",
          borderTop: "1px solid #00ff66",
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Écrire..."
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "6px",
            border: "1px solid #00ff66",
            background: "#111",
            color: "#00ff66",
            fontFamily: "Courier New, monospace",
            textShadow: "0 0 3px #00ff66",
            boxSizing: "border-box",
            fontSize: "1em",
          }}
        />
      </div>
    </div>
  );
}
