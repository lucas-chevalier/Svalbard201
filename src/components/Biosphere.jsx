import React, { useState, useEffect } from "react";
import { ref, update } from "firebase/database";
import { db } from "../firebase";

const botaniqueData = [
  { nom: "Solanum-PT (Pomme de terre)", eau: "Moyen", energie: "Moyen", type: "Nourricière" },
  { nom: "Lemna-M (Lentille d’eau)", eau: "Élevé", energie: "Faible", type: "Assainissante" },
  { nom: "Helianthus-T (Tournesol)", eau: "Moyen", energie: "Élevé", type: "Stabilisatrice" },
  { nom: "Oryza-R (Riz)", eau: "Très élevé", energie: "Élevé", type: "Nourricière" },
  { nom: "Mentha-V (Menthe)", eau: "Faible", energie: "Faible", type: "Assainissante" },
  { nom: "Phaseolus-H (Haricot)", eau: "Moyen", energie: "Faible", type: "Nourricière" },
  { nom: "Solanum-TM (Tomate)", eau: "Moyen", energie: "Élevé", type: "Nourricière" },
  { nom: "Phragmites-RS (Roseau)", eau: "Élevé", energie: "Faible", type: "Assainissante" },
];

export default function Biosphere({ playerRole, sessionId, onWin }) {
  let infoContent;

  if (playerRole === "Hydrologue") {
    infoContent = (
      <>
        <h2>Note de service interne – Département Hydrique Svalbard 201</h2>
        <p>
          Les premiers échecs de la biosphère 200 provenaient d’une erreur humaine : trop d’ambition, pas assez d’équilibre.<br/>
          La stabilité d’un écosystème artificiel ne se mesure pas à la productivité, mais à la complémentarité.<br/>
          <br/>
          Les archives de la mission indiquent que la diversité fonctionnelle est essentielle :<br/>
          <ul>
            <li>une plante qui nourrit,</li>
            <li>une plante qui purifie,</li>
            <li>une plante qui régule.</li>
          </ul>
          L’eau doit circuler, pas s’évaporer. L’énergie doit alimenter, pas s’épuiser.<br/>
          Deux excès identiques provoquent toujours une rupture — trop d’eau ou trop d’énergie, le résultat est le même : déséquilibre.<br/>
          <br/>
          Observe les propositions du biologiste et rappelle-toi :<br/>
          <ul>
            <li>le froid et le calme favorisent la survie ;</li>
            <li>la diversité protège la stabilité ;</li>
            <li>un seul excès peut tout compromettre.</li>
          </ul>
          <br/>
          Signe : Dr E. Halden — Ingénierie Hydrique, 2089.
        </p>
      </>
    );
  } else if (playerRole === "Biologiste") {
    infoContent = (
      <>
        <h2>Fichier de consultation : Réserve Botanique – Section 201 / Accès Niveau B2</h2>
        <table style={{ width: '100%', background: '#111', color: '#00ff66', fontFamily: 'Consolas, monospace', borderCollapse: 'collapse', marginTop: '1em' }}>
          <thead>
            <tr style={{ background: '#222', color: '#00ffcc' }}>
              <th style={{ padding: '0.5em', borderBottom: '1px solid #00ff66' }}>Nom scientifique (code de spécimen)</th>
              <th style={{ padding: '0.5em', borderBottom: '1px solid #00ff66' }}>Besoin en eau</th>
              <th style={{ padding: '0.5em', borderBottom: '1px solid #00ff66' }}>Besoin énergétique</th>
              <th style={{ padding: '0.5em', borderBottom: '1px solid #00ff66' }}>Type écologique</th>
            </tr>
          </thead>
          <tbody>
            {botaniqueData.map((plante, idx) => (
              <tr key={idx}>
                <td style={{ padding: '0.5em', borderBottom: '1px solid #222' }}>{plante.nom}</td>
                <td style={{ padding: '0.5em', borderBottom: '1px solid #222' }}>{plante.eau}</td>
                <td style={{ padding: '0.5em', borderBottom: '1px solid #222' }}>{plante.energie}</td>
                <td style={{ padding: '0.5em', borderBottom: '1px solid #222' }}>{plante.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  } else if (playerRole === "Énergéticien") {
    infoContent = (
      <>
        <h2>Terminal d’alimentation – Biosphère 201 / Système de validation des combinaisons</h2>
        <TerminalEnergéticien sessionId={sessionId} onWin={onWin} />
        <div style={{ marginTop: '2em', fontSize: '0.9em', color: '#00ffcc' }}>
          Terminal : SVALBARD_201_MAINFRAME // Secure Node 04
        </div>
      </>
    );
  } else {
    infoContent = <div>Rôle inconnu.</div>;
  }

  return (
    <div className="biosphere-room" style={{ minHeight: "100vh", position: "relative" }}>
      <div style={{
        position: "absolute",
        left: "10%",
        right: "10%",
        bottom: "10%",
        zIndex: 2,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        overflowY: "auto",
        color: "#00ff66",
        fontFamily: "Consolas, monospace",
      }}>
        {infoContent}
      </div>
    </div>
  );
}

// === Terminal Énergéticien ===
function TerminalEnergéticien({ sessionId, onWin }) {
  const [codes, setCodes] = useState([]);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");
  const [msgColor, setMsgColor] = useState("#00ff66");
  const [plantsEntered, setPlantsEntered] = useState([]);

  const plants = [
    { code: "11A", type: "A", water: 1, energy: 1, name: "Menthe" },
    { code: "21N", type: "N", water: 2, energy: 1, name: "Haricot" },
    { code: "22N", type: "N", water: 2, energy: 2, name: "Pomme de terre" },
    { code: "23N", type: "N", water: 2, energy: 3, name: "Tomate" },
    { code: "23S", type: "S", water: 2, energy: 3, name: "Tournesol" },
    { code: "31A", type: "A", water: 3, energy: 1, name: "Lentille d’eau" },
    { code: "32A", type: "A", water: 3, energy: 2, name: "Roseau" },
    { code: "33N", type: "N", water: 3, energy: 3, name: "Riz" },
  ];

  const uniqueTypes = ["N", "A", "S"];
  const max_high_water = 1;
  const max_high_energy = 1;

  const handleAddCode = () => {
    if (codes.length >= 3) return;
    if (!/^([1-3])([1-3])[NAS]$/.test(input)) {
      setMessage("Entrée incorrecte.");
      setMsgColor("#ff3333");
      return;
    }
    const plant = plants.find(p => p.code === input);
    if (!plant) {
      setMessage("Plante non trouvée.");
      setMsgColor("#ff3333");
      return;
    }
    setCodes([...codes, input]);
    setPlantsEntered([...plantsEntered, plant]);
    setMessage(`Plante enregistrée : ${plant.name}`);
    setMsgColor("#00ff66");
    setInput("");
  };

  const handleRemoveLast = () => {
    if (codes.length === 0) return;
    setCodes(codes.slice(0, -1));
    setPlantsEntered(plantsEntered.slice(0, -1));
    setMessage("");
    setMsgColor("#00ff66");
  };

  const validateCombination = () => {
    if (codes.length !== 3) return;

    const types = plantsEntered.map(p => p.type);
    for (let t of uniqueTypes) {
      if (!types.includes(t)) {
        setMessage("Le système est déséquilibré");
        setMsgColor("#ff3333");
        return;
      }
    }

    const highWater = plantsEntered.filter(p => p.water === 3).length;
    if (highWater > max_high_water) {
      setMessage("Le système est déséquilibré");
      setMsgColor("#ff3333");
      return;
    }

    const highEnergy = plantsEntered.filter(p => p.energy === 3).length;
    if (highEnergy > max_high_energy) {
      setMessage("Le système est déséquilibré");
      setMsgColor("#ff3333");
      return;
    }

    setMessage("La biosphère est équilibrée, Félicitations");
    setMsgColor("#00ff66");

    if (sessionId && onWin) {
      update(ref(db, `sessions/${sessionId}/miniGameStatus`), { "Biosphère": true });
      onWin();
    }
  };

  useEffect(() => {
    if (codes.length === 3) validateCombination();
  }, [codes]);

  return (
    <div style={{ fontFamily: 'Consolas, monospace', background: '#111', border: '2px solid #00ff66', borderRadius: 8, padding: '1.5em', color: '#00ff66', maxWidth: 500, margin: '0 auto' }}>
      <div style={{ marginBottom: '1em' }}>Format attendu : <b>(Eau)(Énergie)(Type)</b> &nbsp; Exemple : <b>21N</b></div>
      <div style={{ marginBottom: '1em' }}>
        <div>
          Entrée du code : <input style={{ width: 60, fontFamily: 'inherit', fontSize: '1em' }} maxLength={3} value={input} onChange={e => setInput(e.target.value.toUpperCase())} disabled={codes.length >= 3} />
          <button style={{ marginLeft: '1em', background: '#00ff66', color: '#111', border: 'none', borderRadius: 4, padding: '0.3em 1em', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1em' }} onClick={handleAddCode} disabled={codes.length >= 3}>Valider code</button>
          <button style={{ marginLeft: '1em', background: '#222', color: '#00ff66', border: '1px solid #00ff66', borderRadius: 4, padding: '0.3em 1em', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1em' }} onClick={handleRemoveLast} disabled={codes.length === 0}>Supprimer dernier</button>
        </div>
      </div>

      <div style={{ marginBottom: '1em', fontSize: '0.95em' }}>
        <b>Plantes enregistrées :</b>
        <ul>
          {plantsEntered.map((p, idx) => <li key={idx}>{p.code} – {p.name}</li>)}
        </ul>
      </div>

      <div style={{ marginBottom: '1em', fontSize: '0.95em' }}>
        <b>Paramètres :</b><br />
        Eau : 1 = faible / 2 = moyen / 3 = élevé<br />
        Énergie : 1 = faible / 2 = moyen / 3 = élevé<br />
        Type : N = Nourricière / A = Assainissante / S = Stabilisatrice
      </div>

      {codes.length < 3 && <div style={{ marginBottom: '1em', color: '#00ffcc' }}>Entrez trois codes pour valider la combinaison.</div>}
      {message && <div style={{ marginTop: '1.5em', color: msgColor, fontWeight: 'bold', fontSize: '1.1em' }}>{message}</div>}
    </div>
  );
}
