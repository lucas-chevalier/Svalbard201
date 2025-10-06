import React, { useState } from "react";

export default function PuzzleEnergy({ status, onSolve }) {
  const [solar, setSolar] = useState(30);
  const [wind, setWind] = useState(30);
  const [battery, setBattery] = useState(40);

  const handleSolve = () => {
    const total = solar * 0.4 + wind * 0.3 + battery * 0.3;
    if (total >= 70) {
      alert("Énergie rétablie !");
      onSolve();
    } else {
      alert("Production insuffisante !");
    }
  };

  return (
    <div className="puzzle">
      <h3>⚡ Module Énergie ({status})</h3>
      <label>☀️ Solaire {solar}%</label>
      <input type="range" value={solar} onChange={e => setSolar(+e.target.value)} />
      <label>🌬️ Éolien {wind}%</label>
      <input type="range" value={wind} onChange={e => setWind(+e.target.value)} />
      <label>🔋 Batterie {battery}%</label>
      <input type="range" value={battery} onChange={e => setBattery(+e.target.value)} />
      <button disabled={status === "solved"} onClick={handleSolve}>Valider</button>
    </div>
  );
}
// src/components/PuzzleEnergy.jsx