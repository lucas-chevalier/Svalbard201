import React, { useEffect, useState } from "react";
import { ref, onValue, set, update } from "firebase/database";
import { db } from "../firebase";
import { Beaker, Zap, Droplets, ShieldAlert } from "lucide-react";

const roleIcons = {
  Hydrologue: <Droplets size={18} />,
  "Énergéticien": <Zap size={18} />,
  Biologiste: <Beaker size={18} />,
  Aucun: <ShieldAlert size={18} />,
};

const roleColors = {
  Hydrologue: "#00bfff",
  "Énergéticien": "#ffcc00",
  Biologiste: "#00ff99",
  Aucun: "#666666",
};

// --- Génération de la grille du puzzle "water" ---
function generatePerfectMaze(size = 8) {
  const NBIT = 1, EBIT = 2, SBIT = 4, WBIT = 8;
  const DIRS = [
    { dx: 0, dy: -1, bit: NBIT, opp: SBIT },
    { dx: 1, dy: 0, bit: EBIT, opp: WBIT },
    { dx: 0, dy: 1, bit: SBIT, opp: NBIT },
    { dx: -1, dy: 0, bit: WBIT, opp: EBIT },
  ];
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < size && y < size;
  const key = (x, y) => `${x},${y}`;

  const cells = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({ open: 0, base: "blank", kind: "pipe", rot: 0 }))
  );
  const visited = new Set();
  const stack = [];
  const start = { x: 0, y: 0 };
  visited.add(key(start.x, start.y));
  stack.push(start);

  while (stack.length) {
    const cur = stack[stack.length - 1];
    const options = [];
    for (const d of DIRS) {
      const nx = cur.x + d.dx, ny = cur.y + d.dy;
      if (inBounds(nx, ny) && !visited.has(key(nx, ny))) options.push({ nx, ny, d });
    }
    if (options.length) {
      const { nx, ny, d } = options[Math.floor(Math.random() * options.length)];
      cells[cur.y][cur.x].open |= d.bit;
      cells[ny][nx].open |= d.opp;
      visited.add(key(nx, ny));
      stack.push({ x: nx, y: ny });
    } else stack.pop();
  }

  return cells;
}

export default function WaitingRoom({ sessionId, playerId, onStart }) {
  const [session, setSession] = useState(null);
  const [showVideo, setShowVideo] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const sessionRef = ref(db, `sessions/${sessionId}`);

  useEffect(() => {
    const unsub = onValue(sessionRef, (snap) => {
      const data = snap.val();
      if (!data) return;

      setSession(data);

      // Si le joueur n'a pas de rôle, lui assigner "Aucun"
      if (data.players && data.players[playerId] && !data.players[playerId].role) {
        const playerRef = ref(db, `sessions/${sessionId}/players/${playerId}`);
        update(playerRef, { role: "Aucun", color: roleColors["Aucun"] });
      }

      // Quand la partie démarre
      if (data?.state === "video") {
        setShowVideo(true);
      }
      if (data?.state === "playing" && !videoEnded) {
        // --- Création de la grille "water" si elle n'existe pas ---
        const puzzleRef = ref(db, `sessions/${sessionId}/puzzles/water`);
        onValue(
          puzzleRef,
          (snap) => {
            if (!snap.exists()) {
              const generatedGrid = generatePerfectMaze(8);
              set(puzzleRef, generatedGrid).catch(console.error);
            }
          },
          { onlyOnce: true }
        );
        setShowVideo(false);
        setVideoEnded(true);
        onStart(sessionId, playerId);
      }
    });
    return () => unsub();
  }, [sessionId, playerId, onStart, videoEnded]);

  if (!session) return <p>Chargement du briefing...</p>;

  const isHost = String(session.host) === String(playerId);
  const player = session.players?.[playerId];
  const playerRole = player?.role || "Aucun";

  const takenRoles = Object.values(session.players || {})
    .map((p) => p.role)
    .filter((r) => r && r !== "Aucun");

  const allRoles = ["Hydrologue", "Énergéticien", "Biologiste"];

  const chooseRole = async (role) => {
    if (role !== "Aucun" && takenRoles.includes(role)) return;
    const playerRef = ref(db, `sessions/${sessionId}/players/${playerId}`);
    await update(playerRef, { role, color: roleColors[role] });
  };

  const allReady =
    Object.values(session.players || {}).every((p) => p.role && p.role !== "Aucun") &&
    Object.keys(session.players || {}).length >= 2;

  const startGame = async () => {
    if (!allReady) {
      alert("Tous les joueurs doivent choisir un rôle avant de commencer !");
      return;
    }
    await update(sessionRef, { state: "video" });
  };

  // Quand la vidéo se termine, le chef lance la partie
  const handleVideoEnd = async () => {
    if (isHost) {
      await update(sessionRef, { state: "playing" });
    }
    setShowVideo(false);
    setVideoEnded(true);
  };

  if (showVideo) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#000",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <video
          src="/assets/briefing.mp4"
          autoPlay
          controls={false}
          onEnded={handleVideoEnd}
          style={{
            width: "80vw",
            maxWidth: "900px",
            borderRadius: "16px",
            boxShadow: "0 0 40px #00ff66",
          }}
        />
      </div>
    );
  }

  return (
    <div className="waiting-room fallout-terminal">
      <div className="vault-title">📡 Salle de Briefing</div>
      <p className="subtitle">Mission ID : {sessionId}</p>

      <h3>👥 Opérateurs connectés :</h3>
      <ul className="players-list">
        {Object.values(session.players || {}).map((p, i) => (
          <li key={i} style={{ borderColor: p.color || "#00ff66", opacity: p.id === playerId ? 1 : 0.9 }}>
            <span style={{ color: p.color || "#00ff66" }}>{p.role ? <>{p.role}</> : <ShieldAlert size={16} />}</span>
            <span style={{ marginLeft: 6 }}>{p.name}</span>
            <span style={{ marginLeft: 6, fontWeight: p.role === "Aucun" ? "normal" : "bold" }}></span>
            {String(session.host) === String(p.id) && <span>★ Chef</span>}
          </li>
        ))}
      </ul>

      <div className="role-selection">
        <h4>🎯 Choisis ton rôle :</h4>
        <div>
          {['Aucun', ...allRoles].map((role) => {
            const taken = takenRoles.includes(role);
            const isMine = playerRole === role;
            return (
              <button
                key={role}
                onClick={() => chooseRole(role)}
                disabled={taken && !isMine}
                style={{
                  opacity: taken && !isMine ? 0.4 : 1,
                  background: isMine ? roleColors[role] : "#0b1f1a",
                  color: isMine ? "#000" : "#00ff99",
                  border: `1px solid ${roleColors[role]}`,
                  margin: 6,
                  padding: "8px 12px",
                  borderRadius: 8,
                  cursor: taken && !isMine ? "not-allowed" : "pointer",
                }}
              >
                {role} {roleIcons[role]}
              </button>
            );
          })}
        </div>
      </div>

      {isHost ? (
        <button
          onClick={startGame}
          className="launch-button"
          disabled={!allReady}
          style={{
            marginTop: 20,
            background: allReady ? "#00ff99" : "#555",
            color: allReady ? "#000" : "#aaa",
          }}
        >
          🚀 Lancer la mission
        </button>
      ) : (
        <div style={{marginTop: 32, color: "#00ff99", fontSize: "1.2em", textAlign: "center"}}>
          En attente du lancement par le chef de mission...
        </div>
      )}
    </div>
  );
}
