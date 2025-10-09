import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { ref, set, update, get } from "firebase/database";
import { v4 as uuidv4 } from "uuid";
import { Beaker, Zap, Droplets } from "lucide-react";

const roles = [
  { name: "Hydrologue", icon: <Droplets size={20} />, color: "#00eaff" },
  { name: "Énergéticien", icon: <Zap size={20} />, color: "#ffee00" },
  { name: "Biologiste", icon: <Beaker size={20} />, color: "#00ff66" },
];

function generatePerfectMaze(size = 8) {
  const NBIT = 1, EBIT = 2, SBIT = 4, WBIT = 8;
  const DIRS = [
    { dx: 0, dy: -1, bit: NBIT, opp: SBIT },
    { dx: 1, dy: 0, bit: EBIT, opp: WBIT },
    { dx: 0, dy: 1, bit: SBIT, opp: NBIT },
    { dx: -1, dy: 0, bit: WBIT, opp: EBIT },
  ];
  const inBounds = (x,y)=>x>=0 && y>=0 && x<size && y<size;
  const key = (x,y)=>`${x},${y}`;
  const cells = Array.from({length:size},()=>Array.from({length:size},()=>({open:0, base:"blank", kind:"pipe", rot:0})));
  const visited = new Set();
  const stack = [];
  const start = {x:0,y:0};
  visited.add(key(start.x,start.y));
  stack.push(start);

  while(stack.length){
    const cur = stack[stack.length-1];
    const options=[];
    for(const d of DIRS){
      const nx=cur.x+d.dx, ny=cur.y+d.dy;
      if(inBounds(nx,ny) && !visited.has(key(nx,ny))) options.push({nx,ny,d});
    }
    if(options.length){
      const {nx,ny,d} = options[Math.floor(Math.random()*options.length)];
      cells[cur.y][cur.x].open |= d.bit;
      cells[ny][nx].open |= d.opp;
      visited.add(key(nx,ny));
      stack.push({x:nx,y:ny});
    }else stack.pop();
  }
  return cells;
}

export default function Lobby({ onJoin }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [showVideo, setShowVideo] = useState(true);
  const [loadingVideo, setLoadingVideo] = useState(true);
  const [muted, setMuted] = useState(true); // ✅ Hook déplacé ici

  // --- Préchargement de la vidéo
  useEffect(() => {
    const video = document.createElement("video");
    video.src = "/assets/intro.mp4";
    video.preload = "auto";
  }, []);

  const toggleMute = () => setMuted((m) => !m);

  const createGame = async () => {
    if (!name.trim()) return alert("Entre ton pseudo !");
    const sid = "GV" + Math.floor(1000 + Math.random() * 9000);
    const playerId = uuidv4();
    const waterGrid = generatePerfectMaze(8);

    await set(ref(db, `sessions/${sid}`), {
      state: "waiting",
      host: playerId,
      players: {
        [playerId]: { id: playerId, name, role: "Aucun", color: "#666666" },
      },
      puzzles: { water: { grid: waterGrid } },
      miniGameStatus: {},
    });

    onJoin && onJoin(sid, playerId);
  };

  const joinGame = async () => {
    if (!name.trim() || !code.trim()) return alert("Entre ton pseudo et un code !");
    const sessionRef = ref(db, `sessions/${code}`);
    const snapshot = await get(sessionRef);
    if (!snapshot.exists()) return alert("Session introuvable !");
    const playerId = uuidv4();
    await update(ref(db, `sessions/${code}/players/${playerId}`), {
      id: playerId,
      name,
      role: "Aucun",
      color: "#666666",
    });
    onJoin && onJoin(code, playerId);
  };

  // --- Écran vidéo
  if (showVideo) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
        }}
      >
        <video
          src="/assets/intro.mp4"
          autoPlay
          playsInline
          muted={muted}
          preload="auto"
          onCanPlayThrough={() => setLoadingVideo(false)}
          onEnded={() => setShowVideo(false)}
          onError={(e) => {
            console.error("Erreur de chargement vidéo :", e);
            setShowVideo(false);
          }}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />

        {loadingVideo && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "#000",
              color: "#00ff66",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.3em",
            }}
          >
            Chargement de la séquence d’introduction...
          </div>
        )}

        {/* Bouton Passer l’intro */}
        <button
          onClick={() => setShowVideo(false)}
          style={{
            position: "absolute",
            bottom: "40px",
            right: "60px",
            background: "#00ff66",
            border: "none",
            color: "#000",
            padding: "10px 20px",
            borderRadius: "8px",
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0 0 10px #00ff66",
          }}
        >
          Passer l’intro ⏩
        </button>

        {/* 🔊 Bouton Activer le son */}
        <button
          onClick={toggleMute}
          style={{
            position: "absolute",
            bottom: "40px",
            left: "60px",
            background: muted ? "#444" : "#00ff66",
            border: "none",
            color: muted ? "#ddd" : "#000",
            padding: "10px 20px",
            borderRadius: "8px",
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: muted ? "0 0 8px #444" : "0 0 10px #00ff66",
          }}
        >
          {muted ? "🔇 Activer le son" : "🔊 Couper le son"}
        </button>
      </div>
    );
  }

  // --- Écran du lobby après la vidéo
  return (
    <div className="lobby fallout-terminal">
      <div className="vault-title">🧬 Svalbard201</div>
      <p className="subtitle">Connexion au terminal scientifique...</p>

      <input placeholder="Ton pseudo" value={name} onChange={(e)=>setName(e.target.value)} />
      <button onClick={createGame}>Créer une mission</button>

      <div className="divider">— ou —</div>

      <input placeholder="Code (ex: GV1234)" value={code} onChange={(e)=>setCode(e.target.value.toUpperCase())} />
      <button onClick={joinGame}>Rejoindre</button>

      <div className="roles-info">
        <h4>Rôles disponibles :</h4>
        <ul>
          {roles.map((r,i)=>(<li key={i} style={{color:r.color}}>{r.icon} {r.name}</li>))}
        </ul>
      </div>
    </div>
  );
}
