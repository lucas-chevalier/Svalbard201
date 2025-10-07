import React, { useState } from "react";
import { db } from "../firebase";
import { ref, set, update, get } from "firebase/database";
import { v4 as uuidv4 } from "uuid";
import { Beaker, Zap, Droplets } from "lucide-react";

const roles = [
  { name: "Hydrologue", icon: <Droplets size={20} />, color: "#00eaff" },
  { name: "Énergéticien", icon: <Zap size={20} />, color: "#ffee00" },
  { name: "Biologiste", icon: <Beaker size={20} />, color: "#00ff66" },
];

// Génération de la grille water
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

  const createGame = async () => {
    if (!name.trim()) return alert("Entre ton pseudo !");
    const sid = "GV" + Math.floor(1000 + Math.random() * 9000);
    const playerId = uuidv4();

    const waterGrid = generatePerfectMaze(8);

    await set(ref(db, `sessions/${sid}`), {
      state: "waiting",
      host: playerId,
      players: {
        [playerId]: {
          id: playerId,
          name,
          role: "Aucun",
          color: "#666666",
        },
      },
      chat: [],
      puzzles: { 
        water: { 
          grid: waterGrid, 
          rotations: waterGrid.map(row => row.map(()=>0)) 
        } 
      },
      miniGameStatus: { 
        "Salle de traitement (eau)": false,
        "Débarras": false,
        "Système de survie": false,
        "Biosphère": false,
        "Grainothèque": false,
        "Centrale électrique": false
      },
      timer: Date.now() + 60*60*1000
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
      color: "#666666"
    });

    onJoin && onJoin(code, playerId);
  };

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
          {roles.map((r,i)=>(
            <li key={i} style={{color:r.color}}>{r.icon} {r.name}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
