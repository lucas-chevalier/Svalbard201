import React, { useEffect, useState, useRef } from "react";
import { db } from "../firebase";
import { ref, onValue, update, set } from "firebase/database";

// PuzzlePompe connecté à Realtime DB sous sessions/{sessionId}/pompe
// Props: sessionId (obligatoire), playerRole (optionnel), onSolve (callback)
export default function PuzzlePompe({ sessionId, playerRole, onSolve }) {
  const [state, setState] = useState(null);
  const [logs, setLogs] = useState([]);
  const [hintVisible, setHintVisible] = useState(false);
  const lastActivity = useRef(Date.now());
  const pompeRefPath = `sessions/${sessionId}/pompe`;

  // États principaux
  const [pressure, setPressure] = useState({ p1: 0, p2: 0, p3: 0 });
  const [valves, setValves] = useState({ v1: "open", v2: "open", v3: "open" });
  const [pumpPower, setPumpPower] = useState(0);
  const [leakZone, setLeakZone] = useState("p3");
  const [crashed, setCrashed] = useState(false);
  const [solved, setSolved] = useState(false);

  // init & listen
  useEffect(() => {
    if (!sessionId) return;
    const r = ref(db, pompeRefPath);
    const unsub = onValue(r, (snap) => {
      const v = snap.val();
      if (!v) {
        // démarrage en défaut / tous les capteurs à 0
        const defaultState = {
          pressure: { p1: 0, p2: 0, p3: 0 },
          valves: { v1: "open", v2: "open", v3: "open" },
          pumpPower: 0,
          leak_zone: "p3",
          crashed: false,
          solved: false,
        };
        set(r, defaultState);
        setState(defaultState);
        // Affichage de l'indice différé de 2 minutes
        if (window.__pompeIndiceTimeout) clearTimeout(window.__pompeIndiceTimeout);
        window.__pompeIndiceTimeout = setTimeout(() => {
          setLogs((l) => [
            { t: new Date().toLocaleTimeString(), text: "Indice : une variation anormale de pression indique une fuite. Peut-être qu’isoler une section et ajuster la pompe permettrait de rétablir la situation…" },
            ...l.slice(0, 49)
          ]);
        }, 120000);
      } else {
        setState(v);
        // Ne pas afficher l'indice immédiatement
      }
    });
    return () => unsub();
  }, [sessionId]);

  // Synchronisation avec Firebase
  useEffect(() => {
    if (!sessionId) return;
    const r = ref(db, pompeRefPath);
    const unsub = onValue(r, (snap) => {
      const v = snap.val();
      if (v) {
        setPressure(v.pressure || { p1: 0, p2: 0, p3: 0 });
        setValves(v.valves || { v1: "open", v2: "open", v3: "open" });
        setPumpPower(v.pumpPower || 0);
        setLeakZone(v.leak_zone || "p3");
        setCrashed(!!v.crashed);
        setSolved(!!v.solved);
        setState(v);
      }
    });
    return () => unsub();
  }, [sessionId]);

  // Simulation hydraulique (tick)
  useEffect(() => {
    if (!sessionId || crashed || solved) return;
    const interval = setInterval(() => {
      let next = { ...pressure };
      const pump = pumpPower;
      const v = { ...valves };
      const leak = leakZone;
      // --- Gestion des vannes, surcharge et oscillation ---
      // Surcharge : si pompe >90% et <100%, P1/P2 montent vite et pompe chute à 50% après 3s
      const isSurcharge = pump > 90 && pump < 100;
  // Oscillation capteurs (hors surcharge)
  const osc = () => Math.floor(Math.random() * 5) - 2; // -2, -1, 0, 1, 2
      // P1
      if (v.v1 === "closed") {
        next.p1 = Math.max(0, next.p1 - 3);
      } else if (isSurcharge) {
        next.p1 = Math.min(100, next.p1 + 3);
      } else {
        if (next.p1 < 80) next.p1 = 80;
        if (pump > 90) {
          next.p1 = Math.min(100, next.p1 + 3);
        } else {
          // Oscillation autour de 80 sans dépasser 80
          let oscVal = next.p1 + osc();
          if (oscVal > 80) oscVal = 80;
          if (oscVal < 0) oscVal = 0;
          next.p1 = oscVal;
        }
      }
      // P2
      if (v.v2 === "closed") {
        next.p2 = Math.max(0, next.p2 - 3);
      } else if (isSurcharge) {
        next.p2 = Math.min(100, next.p2 + 3);
      } else {
        if (next.p2 < 80) next.p2 = 80;
        if (pump > 90) {
          next.p2 = Math.min(100, next.p2 + 3);
        } else {
          let oscVal = next.p2 + osc();
          if (oscVal > 80) oscVal = 80;
          if (oscVal < 0) oscVal = 0;
          next.p2 = oscVal;
        }
      }
      // P3 (oscillation aussi, mais bornée à 80 sauf si pompe >90)
      if (v.v3 === "closed" && pump >= 75 && pump <= 85) {
        if (next.p3 < 80) {
          next.p3 = Math.min(80, next.p3 + 4);
        } else if (next.p3 > 80) {
          next.p3 = Math.max(80, next.p3 - 3);
        }
        // Oscillation autour de 80
        if (pump <= 90) {
          let oscVal = next.p3 + osc();
          if (oscVal > 80) oscVal = 80;
          if (oscVal < 0) oscVal = 0;
          next.p3 = oscVal;
        }
      } else {
        // sinon, tendance à baisser
        next.p3 = Math.max(0, next.p3 - 3);
        // Oscillation autour de la valeur courante, bornée à 80 si pompe <=90
        if (pump <= 90) {
          let oscVal = next.p3 + osc();
          if (oscVal > 80) oscVal = 80;
          if (oscVal < 0) oscVal = 0;
          next.p3 = oscVal;
        }
      }

      // Timer de surcharge : si on entre en surcharge, on démarre un timeout pour baisser la pompe à 50%
      if (isSurcharge && !window.__pompeSurchargeTimeout) {
        window.__pompeSurchargeTimeout = setTimeout(() => {
          setPumpPower(50);
          update(ref(db, pompeRefPath), { pumpPower: 50 });
          pushLog("Surcharge détectée : la pompe a été automatiquement abaissée à 50% !");
          window.__pompeSurchargeTimeout = null;
        }, 3000);
      }
      if (!isSurcharge && window.__pompeSurchargeTimeout) {
        clearTimeout(window.__pompeSurchargeTimeout);
        window.__pompeSurchargeTimeout = null;
      }
      // P3 se stabilise à 80 si V3 fermée ET pompe entre 75 et 85 inclus
      if (v.v3 === "closed" && pump >= 75 && pump <= 85) {
        if (next.p3 < 80) {
          next.p3 = Math.min(80, next.p3 + 4);
        } else if (next.p3 > 80) {
          next.p3 = Math.max(80, next.p3 - 3);
        }
        // sinon, reste à 80
      } else {
        // sinon, tendance à baisser
        next.p3 = Math.max(0, next.p3 - 3);
      }
      // Fuite
      if (leak === "p3" && v.v3 === "open") {
        next.p3 = Math.max(0, next.p3 - 8);
      }
      // Crash si pompe >= 100
      let crash = false;
      if (pump >= 100) {
        crash = true;
        next = { p1: 80, p2: 80, p3: 0 };
        setPumpPower(0);
        update(ref(db, pompeRefPath), { pumpPower: 0 });
      }
      // Condition de victoire : P1=80, P2=80, P3=50
      let win = false;
      if (
        next.p1 === 80 &&
        next.p2 === 80 &&
        next.p3 === 50
      ) {
        win = true;
      }
      // Mise à jour Firebase
      update(ref(db, pompeRefPath), {
        pressure: next,
        crashed: crash,
        solved: win,
      });
      setPressure(next);
      setCrashed(crash);
      setSolved(win);
      if (win) pushLog("Succès : fuite isolée et pression rétablie sur P3");
      if (crash) pushLog("CRASH SYSTEM : pompe en surcharge, redémarrage nécessaire");
    }, 1200);
    return () => clearInterval(interval);
  }, [pressure, valves, pumpPower, leakZone, crashed, solved, sessionId]);

  const markActivity = () => {
    lastActivity.current = Date.now();
    if (hintVisible) setHintVisible(false);
  };

  const pushLog = (text) => {
    setLogs((l) => [{ t: new Date().toLocaleTimeString(), text }, ...l.slice(0, 49)]);
  };

  // Contrôles UI
  const toggleValve = (key) => {
    const newValves = { ...valves, [key]: valves[key] === "open" ? "closed" : "open" };
    setValves(newValves);
    update(ref(db, pompeRefPath), { valves: newValves });
    markActivity();
    pushLog(`Vanne ${key.toUpperCase()} changée : ${newValves[key]}`);
  };
  // Ne logue plus chaque variation, seulement la position finale
  const changePump = (val) => {
    setPumpPower(val);
    update(ref(db, pompeRefPath), { pumpPower: val });
    markActivity();
  };
  const logPumpFinal = (val) => {
    pushLog(`Pompe réglée à ${val}%`);
  };
  const restart = () => {
    setCrashed(false);
    setPumpPower(0);
    update(ref(db, pompeRefPath), { crashed: false, pumpPower: 0 });
    pushLog("Redémarrage du système pompe");
  };

  // Détermination des rôles
  const isHydro = playerRole === "Hydrologue";
  const isEnerg = playerRole === "Énergéticien";
  const isBio = playerRole === "Biologiste";

  if (!sessionId) return <div>Erreur : pas de session fournie.</div>;
  if (!state) return <div>Chargement du module pompe...</div>;

  return (
    <div style={{position:'relative'}}>
      <h3>🚰 Module Pompe — Contrôle</h3>
      <div style={{display:'flex', gap:16}}>
        <div style={{minWidth:260}}>
          <div><b>Rôle affiché :</b> {playerRole || '—'}</div>
          {isHydro && (
            <>
              <h4>Contrôle des vannes</h4>
              <div>
                {Object.keys(valves).map((v) => (
                  <div key={v} style={{marginBottom:4}}>
                    {v.toUpperCase()} : <b>{valves[v]}</b> <button onClick={() => toggleValve(v)} disabled={crashed || solved}>Basculer</button>
                  </div>
                ))}
              </div>
            </>
          )}
          {isEnerg && (
            <>
              <h4>Contrôle de la pompe</h4>
              <div>Puissance actuelle : <b>{pumpPower}%</b></div>
              <input
                type="range"
                min={0}
                max={100}
                value={pumpPower}
                onChange={e => changePump(Number(e.target.value))}
                onMouseUp={e => logPumpFinal(Number(e.target.value))}
                onTouchEnd={e => logPumpFinal(Number(e.target.value))}
                disabled={crashed || solved}
              />
            </>
          )}
          <h4>Pressions</h4>
          <ul>
            <li>P1 : {pressure.p1}</li>
            <li>P2 : {pressure.p2}</li>
            <li>P3 : {pressure.p3}</li>
          </ul>
          {/* Indice sur la fuite */}
          {/* Indice déplacé dans le journal des logs */}
          {crashed && isEnerg && <button onClick={restart} style={{marginTop:8}}>Redémarrer la pompe</button>}
        </div>
        {isBio && (
          <div style={{minWidth:220, marginLeft:24}}>
            <h4>État des plantes</h4>
            <div>
              {(() => {
                const avg = (pressure.p1 + pressure.p2 + pressure.p3) / 3;
                if (avg < 30) return <span style={{color:'#b30000'}}>Plantes sèches</span>;
                if (avg < 50) return <span style={{color:'#ffaa00'}}>Stress hydrique</span>;
                if (avg < 70) return <span style={{color:'#ffaa00'}}>Stress hydrique</span>;
                if (avg < 80) return <span style={{color:'#00cc44'}}>OK</span>;
                return <span style={{color:'#0077cc'}}>Détrempées</span>;
              })()}
            </div>
            <div style={{marginTop:8}}>
              Retour terrain : {pressure.p1 < 30 || pressure.p2 < 30 || pressure.p3 < 30 ? "Certains secteurs manquent d'eau" : "Pas d'alerte"}
            </div>
          </div>
        )}
        <div style={{flex:1}}>
          <h4>Journal & état</h4>
          <div style={{maxHeight:220, overflowY:'auto', border:'1px solid #ddd', padding:8}}>
            {logs.map((l,i)=> <div key={i}>[{l.t}] {l.text}</div>)}
          </div>
          {hintVisible && (
            <div style={{marginTop:12, padding:8, border:'1px dashed #ffaa00'}}>Indice : Isolez la fuite et rétablissez la pression sur P3.</div>
          )}
          {state.crashed && (
            <div style={{marginTop:12, padding:12, background:'#b30000', color:'#fff', borderRadius:6}}>
              CRASH système — la pompe a été arrêtée. L'Hydrologue doit relancer le système.
              {/* Ajoutez ici un bouton de redémarrage si besoin */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
