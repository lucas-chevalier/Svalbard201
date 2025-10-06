// src/components/Lobby.jsx
import React, { useState } from "react";
import { db } from "../firebase";
import { ref, set, push } from "firebase/database";
import { Beaker, Zap, Droplets } from "lucide-react"; // Fallout-style vector icons

const roles = [
  { name: "Hydrologue", icon: <Droplets size={20} />, color: "#00eaff" },
  { name: "Énergéticien", icon: <Zap size={20} />, color: "#ffee00" },
  { name: "Biologiste", icon: <Beaker size={20} />, color: "#00ff66" },
];

export default function Lobby({ onJoin }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const getRandomRole = () => roles[Math.floor(Math.random() * roles.length)];

  const createGame = async () => {
    if (!name) return alert("Entre ton pseudo !");
    const sid = "GV" + Math.floor(1000 + Math.random() * 9000);
    const playerId = Date.now();
    const role = getRandomRole();

    await set(ref(db, `sessions/${sid}`), {
      state: "waiting",
      host: playerId,
      players: {
        [playerId]: {
          id: playerId,
          name,
          role: role.name,
          color: role.color,
        },
      },
      chat: [],
      puzzles: { energy: "locked" },
      timer: Date.now() + 60 * 60 * 1000,
    });

    onJoin && onJoin(sid, playerId);
  };

  const joinGame = async () => {
    if (!name || !code) return alert("Entre ton pseudo et un code !");
    const playerId = Date.now();
    const role = getRandomRole();

    await push(ref(db, `sessions/${code}/players`), {
      id: playerId,
      name,
      role: role.name,
      color: role.color,
    });

    onJoin && onJoin(code, playerId);
  };

  return (
    <div className="lobby fallout-terminal">
      <div className="vault-title">🧬 svalbard201</div>
      <p className="subtitle">Connexion au terminal scientifique...</p>

      <div className="input-group">
        <label>Identifiant opérateur :</label>
        <input
          placeholder="Ton pseudo"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="button-group">
        <button onClick={createGame}>Créer une mission</button>
        <div className="divider">— ou —</div>
        <input
          placeholder="Code (ex: GV1234)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button onClick={joinGame}>Rejoindre</button>
      </div>

      <div className="roles-info">
        <h4>Rôles disponibles :</h4>
        <ul>
          {roles.map((r, i) => (
            <li key={i} style={{ color: r.color }}>
              {r.icon} {r.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
