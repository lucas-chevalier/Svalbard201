import React, { useRef, useEffect, useState } from "react";
import { ref, onValue, set } from "firebase/database";
import { db } from "../firebase";

export default function PuzzleWater({ sessionId, roomName, size = 8, onWin }) {
  const canvasRef = useRef(null);
  const [img, setImg] = useState(null);
  const [grid, setGrid] = useState([]);
  const [rotations, setRotations] = useState([]);
  const [won, setWon] = useState(false);
  const [showVictoryLocal, setShowVictoryLocal] = useState(false);
  const [alreadyLoaded, setAlreadyLoaded] = useState(false);
  const TILE = 64;

  const NBIT = 1, EBIT = 2, SBIT = 4, WBIT = 8;
  const DIRS = [
    { dx: 0, dy: -1, bit: NBIT, opp: SBIT },
    { dx: 1, dy: 0, bit: EBIT, opp: WBIT },
    { dx: 0, dy: 1, bit: SBIT, opp: NBIT },
    { dx: -1, dy: 0, bit: WBIT, opp: EBIT },
  ];
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < size && y < size;
  const key = (x, y) => `${x},${y}`;

  const TILEMAP = {
    straight: { col: 4, row: 0 },
    corner: { col: 3, row: 1 },
    cross: { col: 1, row: 2 },
    tee: { col: 0, row: 2 },
    cap: { col: 2, row: 2 },
    source: { col: 0, row: 0 },
    sink: { col: 2, row: 1 },
    blank: { col: 4, row: 5 },
  };
  const getSpriteRect = (base) => {
    const entry = TILEMAP[base] || TILEMAP.blank;
    return { sx: entry.col * TILE, sy: entry.row * TILE };
  };

  // Charger image depuis public/assets/
  useEffect(() => {
    const image = new Image();
    image.src = "/assets/bluerpipe-sheet.png";
    image.onload = () => setImg(image);
  }, []);

  // Charger grille + rotations depuis Firebase
  useEffect(() => {
    if (alreadyLoaded) return;
    const puzzleRef = ref(db, `sessions/${sessionId}/puzzles/${roomName}`);
    const unsub = onValue(puzzleRef, (snap) => {
      const data = snap.val();
      if (!data) return;

      setGrid(data.grid);
      setRotations(data.rotations);
      setAlreadyLoaded(true);
      setWon(false);
    });
    return () => unsub();
  }, [sessionId, roomName, alreadyLoaded]);

  // Écouter le statut de victoire pour synchroniser le popup
  useEffect(() => {
    const solvedRef = ref(db, `sessions/${sessionId}/puzzles/${roomName}/solved`);
    const unsub = onValue(solvedRef, (snap) => {
      if (snap.val() === true) {
        setShowVictoryLocal(true);
      }
    });
    return () => unsub();
  }, [sessionId, roomName]);

  const handleClick = (x, y) => {
    if (won) return;
    const newRot = (rotations[y][x] + 1) % 4;
    setRotations((prev) => {
      const updated = prev.map(row => [...row]);
      updated[y][x] = newRot;
      // Sauvegarde rotation dans Firebase
      set(ref(db, `sessions/${sessionId}/puzzles/${roomName}/rotations/${y}/${x}`), newRot);
      return updated;
    });
  };

  const openMaskAfterRotation = (cell, rot) => {
    let m = cell.open;
    for (let i = 0; i < rot; i++) {
      let r = 0;
      if (m & NBIT) r |= EBIT;
      if (m & EBIT) r |= SBIT;
      if (m & SBIT) r |= WBIT;
      if (m & WBIT) r |= NBIT;
      m = r;
    }
    return m;
  };

  const computePowered = (state, rots) => {
    let sx = 0, sy = 0;
    outer: for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (state[y][x].kind === "source") { sx = x; sy = y; break outer; }
      }
    }
    const seen = new Set();
    const stack = [{ x: sx, y: sy }];

    while (stack.length) {
      const { x, y } = stack.pop();
      const k = key(x, y);
      if (seen.has(k)) continue;
      seen.add(k);

      const m = openMaskAfterRotation(state[y][x], rots[y][x]);
      for (const d of DIRS) {
        const nx = x + d.dx, ny = y + d.dy;
        if (!inBounds(nx, ny)) continue;
        const m2 = openMaskAfterRotation(state[ny][nx], rots[ny][nx]);
        if ((m & d.bit) && (m2 & d.opp)) {
          const kk = key(nx, ny);
          if (!seen.has(kk)) stack.push({ x: nx, y: ny });
        }
      }
    }
    return seen;
  };

  useEffect(() => {
    if (!img || !grid.length || !rotations.length || !alreadyLoaded) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const cellPix = canvas.width / size;

    const powered = computePowered(grid, rotations);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const px = x * cellPix;
        const py = y * cellPix;
        const cell = grid[y][x];
        const rot = rotations[y][x];

        ctx.fillStyle = "#0a1130";
        ctx.fillRect(px, py, cellPix, cellPix);
        ctx.strokeStyle = "#17204a";
        ctx.strokeRect(px + 0.5, py + 0.5, cellPix - 1, cellPix - 1);

        const { sx, sy } = getSpriteRect(
          cell.kind === "source" ? "source" :
          cell.kind === "sink" ? "cap" : cell.base
        );

        const cx = px + cellPix / 2;
        const cy = py + cellPix / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot * (Math.PI / 2));
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, sx, sy, 64, 64, -cellPix/2, -cellPix/2, cellPix, cellPix);
        ctx.restore();

        if (powered.has(key(x, y))) {
          ctx.save();
          ctx.globalAlpha = 0.35;
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = "#6feaff";
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(12, cellPix*0.45), 0, Math.PI*2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    if (!won && powered.size === size*size) {
      setWon(true);
      onWin?.();
      // mark solved in firebase and show overlay for all
      set(ref(db, `sessions/${sessionId}/puzzles/${roomName}/solved`), true).catch(console.error);
      setShowVictoryLocal(true);
      // also set miniGameStatus for room to keep consistent with GameRoom progression
      set(ref(db, `sessions/${sessionId}/miniGameStatus/${roomName}`), true).catch(console.error);
    }
  }, [img, grid, rotations, won, size, onWin, alreadyLoaded]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleClickCanvas = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor(((e.clientX - rect.left)/canvas.width) * size);
      const y = Math.floor(((e.clientY - rect.top)/canvas.height) * size);
      if (inBounds(x, y)) handleClick(x, y);
    };
    canvas.addEventListener("click", handleClickCanvas);
    return () => canvas.removeEventListener("click", handleClickCanvas);
  }, [size, rotations, won]);

  if (!img || !grid.length || !rotations.length) return <p>Chargement du puzzle...</p>;

  return (
    <div style={{ display:"grid", placeItems:"center", marginTop:20, position:"relative" }}>
      {showVictoryLocal && (
        <div className="victory-overlay" role="dialog" aria-modal="true">
          <div className="victory-card" style={{ textShadow: 'none', filter: 'none' }}>
            <h2 style={{ textShadow: 'none', filter: 'none' }}>🎉 Système Réparé !</h2>
            <p style={{ textShadow: 'none', filter: 'none' }}>Réseau hydraulique complété.</p>
            <p style={{ fontSize: '16px', fontStyle: 'italic', color: '#b0b0b0', marginTop: '12px', padding: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', lineHeight: '1.4' }}>
              "Bravo ! Vous avez reconnecté assez de tuyaux pour impressionner un castor. Maintenant l'eau coule dans le bon sens... enfin, on espère."
            </p>
            <div style={{display:'flex', gap:8, marginTop:12}}>
              <button onClick={() => setShowVictoryLocal(false)} className="puzzle-action-btn">Fermer</button>
            </div>
          </div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={600}
        height={600}
        style={{ background:"#0a1026", border:"2px solid #1e2550", imageRendering:"pixelated", cursor: won?"default":"pointer", borderRadius:12, boxShadow:"0 10px 30px rgba(0,0,0,.35)" }}
      />
    </div>
  );
}
