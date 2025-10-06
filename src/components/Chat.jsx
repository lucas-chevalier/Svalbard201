import React, { useEffect, useState } from "react";
import { ref, onChildAdded, push } from "firebase/database";
import { db } from "../firebase";

export default function Chat({ sessionId, playerName }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");

  useEffect(() => {
    const chatRef = ref(db, `sessions/${sessionId}/chat`);
    const unsub = onChildAdded(chatRef, (snap) => setMsgs(p => [...p, snap.val()]));
    return () => unsub();
  }, []);

  const send = async () => {
    if (!text.trim()) return;
    await push(ref(db, `sessions/${sessionId}/chat`), { sender: playerName, text });
    setText("");
  };

  return (
    <div className="chat">
      <h4>💬 Terminal</h4>
      <div className="messages">
        {msgs.map((m, i) => (
          <p key={i}><strong>{m.sender}</strong>: {m.text}</p>
        ))}
      </div>
      <input value={text} onChange={e => setText(e.target.value)} placeholder="Écrire..." />
      <button onClick={send}>Envoyer</button>
    </div>
  );
}
// src/components/Chat.jsx