import React, { useEffect, useState, useRef } from "react";
import { db } from "../firebase";
import { ref, onValue, update, set } from "firebase/database";

// PuzzlePompe connecté à Realtime DB sous sessions/{sessionId}/pompe
// Props: sessionId (obligatoire), playerRole (optionnel), onSolve (callback)
export default function PuzzlePompe({ sessionId, playerRole, onWin, players, playerId, roomName }) {
  const [state, setState] = useState(null);
  const [logs, setLogs] = useState([]);
  const [showContextPopup, setShowContextPopup] = useState(true);
  
  // Définir le chemin Firebase en premier
  const pompeRefPath = `sessions/${sessionId}/pompe`;
  
  // --- CONTEXTE & OBJECTIF ---
  // Ce puzzle simule une fuite dans le système hydraulique de la station.
  // Votre objectif : identifier la zone de fuite, isoler la section concernée à l'aide des vannes,
  // puis ajuster la puissance de la pompe pour rétablir une pression stable dans le réseau.
  // Attention : une mauvaise manipulation peut provoquer une surcharge ou un crash du système !
  // Collaborez pour surveiller les pressions, fermer les bonnes vannes et stabiliser la situation.

  // Ajout du contexte dans le journal des logs à l'entrée dans la salle (une seule fois)
  useEffect(() => {
    if (!sessionId) return;
    const r = ref(db, pompeRefPath);
    onValue(r, (snap) => {
      const v = snap.val();
      if (!v) return;
      const logs = v.logs || [];
      const contextText = "Contexte : Une fuite a été détectée dans le réseau hydraulique de la station. Objectif : Identifiez la zone de fuite, isolez-la en fermant les vannes appropriées, puis ajustez la puissance de la pompe pour rétablir une pression normale. Attention : Une mauvaise manipulation peut provoquer une surcharge ou un crash du système. Communiquez et coopérez pour réussir !";
      const alreadyPresent = logs.some(l => l.text && l.text.startsWith("Contexte : Une fuite a été détectée"));
      if (!alreadyPresent) {
        const newLog = { t: new Date().toLocaleTimeString(), text: contextText };
        const updatedLogs = [newLog, ...logs.slice(0, 49)];
        update(r, { logs: updatedLogs });
      }
    }, { onlyOnce: true });
    // onlyOnce: true pour ne pas réécrire à chaque re-render
  }, [sessionId, pompeRefPath]);

  const [hintVisible, setHintVisible] = useState(false);
  const lastActivity = useRef(Date.now());

  // États principaux
  const [pressure, setPressure] = useState({ p1: 0, p2: 0, p3: 0 });
  const [valves, setValves] = useState({ v1: "open", v2: "open", v3: "open" });
  const [pumpPower, setPumpPower] = useState(0);
  const [showPumpHint, setShowPumpHint] = useState(false);
  const [leakZone, setLeakZone] = useState("p3");
  const [crashed, setCrashed] = useState(false);
  const [solved, setSolved] = useState(false);
  const [showVictoryLocal, setShowVictoryLocal] = useState(false);

  // Retourne une couleur du rouge->vert selon la valeur de la pompe
  const getPumpColor = (p) => {
    // Règle : 0-19 rouge, 20-74 orange, 75-85 vert, 86-99 orange, 100 rouge
    if (p <= 0) return '#d32f2f';
    if (p < 20) return '#d32f2f';
    if (p < 75) return '#ff9800';
    if (p <= 85) return '#2e7d32';
    if (p < 100) return '#ff9800';
    return '#d32f2f';
  };

    // init & listen
  useEffect(() => {
    if (!sessionId) return;
    const r = ref(db, pompeRefPath);
    const unsub = onValue(r, (snap) => {
      const v = snap.val();
      if (!v) {
        // démarrage en défaut / tous les capteurs à 0
        // On préserve le flag indiceShown si déjà présent (rare mais possible en cas de reset manuel)
        const currentRef = ref(db, pompeRefPath);
        onValue(currentRef, (snap2) => {
          const prev = snap2.val() || {};
          const defaultState = {
            pressure: { p1: 50, p2: 50, p3: 2 },
            valves: { v1: "open", v2: "open", v3: "open" },
            pumpPower: 0,
            leak_zone: "p3",
            crashed: false,
            solved: false,
            logs: [], // Ajout des logs synchronisés
            ...(typeof prev.indiceShown !== 'undefined' ? { indiceShown: prev.indiceShown } : {})
          };
          set(r, defaultState);
          setState(defaultState);
          setLogs([]);
        }, { onlyOnce: true });
      } else {
        setState(v);
        // Synchroniser les logs depuis Firebase
        setLogs(v.logs || []);
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
        if (v.solved) setShowVictoryLocal(true);
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
      // Si la pompe est complètement arrêtée, tous les capteurs baissent vers 0
      if (pump === 0) {
        // décrément plus marqué pour simuler la chute de pression
        next.p1 = Math.max(0, Math.round(next.p1 - 6));
        next.p2 = Math.max(0, Math.round(next.p2 - 6));
        next.p3 = Math.max(0, Math.round(next.p3 - 4));
        // Mettre à jour et quitter le tick
        update(ref(db, pompeRefPath), { pressure: next, crashed: false, solved: false });
        setPressure(next);
        setCrashed(false);
        setSolved(false);
        return;
      }
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
        // Si V3 est ouverte, P1 oscille autour de 50
        if (v.v3 === "open") {
          if (next.p1 < 50) {
            next.p1 = Math.min(50, next.p1 + 2);
          } else if (next.p1 > 50) {
            next.p1 = Math.max(50, next.p1 - 2);
          }
          // Oscillation autour de 50
          let oscVal = next.p1 + osc();
          if (oscVal > 55) oscVal = 55;
          if (oscVal < 45) oscVal = 45;
          next.p1 = oscVal;
        } else {
          // Si V3 est fermée, P1 monte à 80
          if (next.p1 < 80) next.p1 = Math.min(80, next.p1 + 3);
          if (pump > 90) {
            next.p1 = Math.min(100, next.p1 + 3);
          } else {
            // Oscillation autour de 80 sans dépasser 80
            let oscVal = next.p1 + osc();
            if (oscVal > 80) oscVal = 80;
            if (oscVal < 75) oscVal = 75;
            next.p1 = oscVal;
          }
        }
      }
      // P2
      if (v.v2 === "closed") {
        next.p2 = Math.max(0, next.p2 - 3);
      } else if (isSurcharge) {
        next.p2 = Math.min(100, next.p2 + 3);
      } else {
        // Si V3 est ouverte, P2 oscille autour de 50
        if (v.v3 === "open") {
          if (next.p2 < 50) {
            next.p2 = Math.min(50, next.p2 + 2);
          } else if (next.p2 > 50) {
            next.p2 = Math.max(50, next.p2 - 2);
          }
          // Oscillation autour de 50
          let oscVal = next.p2 + osc();
          if (oscVal > 55) oscVal = 55;
          if (oscVal < 45) oscVal = 45;
          next.p2 = oscVal;
        } else {
          // Si V3 est fermée, P2 monte à 80
          if (next.p2 < 80) next.p2 = Math.min(80, next.p2 + 3);
          if (pump > 90) {
            next.p2 = Math.min(100, next.p2 + 3);
          } else {
            // Oscillation autour de 80 sans dépasser 80
            let oscVal = next.p2 + osc();
            if (oscVal > 80) oscVal = 80;
            if (oscVal < 75) oscVal = 75;
            next.p2 = oscVal;
          }
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
      } else if (v.v3 === "closed" && pump > 50 && pump < 75) {
        // Nouvelle condition : vanne P3 fermée et pompe entre 50 et 75 -> P3 augmente à 30
        if (next.p3 < 30) {
          next.p3 = Math.min(30, next.p3 + 3);
        } else if (next.p3 > 30) {
          next.p3 = Math.max(30, next.p3 - 2);
        }
        // Oscillation légère autour de 30
        let oscVal = next.p3 + osc() * 0.5;
        if (oscVal > 35) oscVal = 35;
        if (oscVal < 25) oscVal = 25;
        next.p3 = oscVal;
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
          // Utiliser la fonction pushLog pour synchroniser via Firebase
          const currentLogs = state?.logs || [];
          const newLog = { t: new Date().toLocaleTimeString(), text: "Surcharge détectée : la pompe a été automatiquement abaissée à 50% !" };
          const updatedLogs = [newLog, ...currentLogs.slice(0, 49)];
          update(ref(db, pompeRefPath), { pumpPower: 50, logs: updatedLogs });
          window.__pompeSurchargeTimeout = null;
        }, 3000);
      }
      if (!isSurcharge && window.__pompeSurchargeTimeout) {
        clearTimeout(window.__pompeSurchargeTimeout);
        window.__pompeSurchargeTimeout = null;
      }
            // P3 se stabilise à 50 si V3 fermée ET pompe entre 75 et 85 inclus
      if (v.v3 === "closed" && pump >= 75 && pump <= 85) {
        if (next.p3 < 50) {
          next.p3 = Math.min(50, next.p3 + 4);
        } else if (next.p3 > 50) {
          next.p3 = Math.max(50, next.p3 - 3);
        }
        // Oscillation autour de 50
        let oscVal = next.p3 + osc();
        if (oscVal > 52) oscVal = 52;
        if (oscVal < 48) oscVal = 48;
        next.p3 = oscVal;
      } else {
        // Fuite : oscillation entre 0 et 5 pour simuler très basse pression
        if (next.p3 > 5) {
          next.p3 = Math.max(0, next.p3 - 2);
        } else if (next.p3 < 0) {
          next.p3 = Math.min(5, next.p3 + 1);
        }
        // Oscillation autour de 2.5 (entre 0 et 5)
        let oscVal = next.p3 + (Math.floor(Math.random() * 6) - 2.5); // -2.5 à +2.5
        if (oscVal > 5) oscVal = 5;
        if (oscVal < 0) oscVal = 0;
        next.p3 = Math.round(oscVal);
      }
      // Crash si pompe >= 100
      let crash = false;
      if (pump >= 100) {
        crash = true;
        next = { p1: 80, p2: 80, p3: 0 };
        setPumpPower(0);
        update(ref(db, pompeRefPath), { pumpPower: 0 });
      }
      // Condition de victoire : P1≈80, P2≈80, P3>=50
      let win = false;
      // tolérance pour éviter d'attendre des oscillations parfaitement alignées
      const near = (v, target, tol = 1) => Math.abs(v - target) <= tol;
      if (near(next.p1, 80, 1) && near(next.p2, 80, 1) && next.p3 >= 50) {
        // snap to exact win values for immediate feedback
        next.p1 = 80;
        next.p2 = 80;
        if (next.p3 < 50) next.p3 = 50;
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
      if (win) {
        pushLog("Succès : fuite isolée et pression rétablie sur P3");
        if (onWin) onWin();
      }
      if (crash) pushLog("CRASH SYSTEM : pompe en surcharge, redémarrage nécessaire");
    }, 1200);
    return () => clearInterval(interval);
  }, [pressure, valves, pumpPower, leakZone, crashed, solved, sessionId]);

  const markActivity = () => {
    lastActivity.current = Date.now();
    if (hintVisible) setHintVisible(false);
  };

  const pushLog = (text) => {
    // Récupérer les logs actuels depuis Firebase et ajouter le nouveau
    const currentLogs = state?.logs || [];
    const newLog = { t: new Date().toLocaleTimeString(), text };
    const updatedLogs = [newLog, ...currentLogs.slice(0, 49)];
    
    // Mettre à jour Firebase avec les nouveaux logs
    update(ref(db, pompeRefPath), { logs: updatedLogs });
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
      {/* Victory popup - visible to all when solved flag is set in Firebase */}
      {showVictoryLocal && (
        <div className="victory-overlay" role="dialog" aria-modal="true">
          <div className="victory-card" style={{ textShadow: 'none', filter: 'none' }}>
            <h2 style={{ textShadow: 'none', filter: 'none' }}>🎉 Fuite Colmatée !</h2>
            <p style={{ textShadow: 'none', filter: 'none' }}>La fuite a été isolée et la pression est rétablie.</p>
            <p style={{ fontSize: '16px', fontStyle: 'italic', color: '#b0b0b0', marginTop: '12px', padding: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', lineHeight: '1.4' }}>
              "Excellent ! Vous avez arrêté la fuite avant qu'elle ne transforme la station en aquarium géant. Les poissons sont déçus."
            </p>
            <div style={{display:'flex', gap:8, marginTop:12}}>
              <button onClick={() => setShowVictoryLocal(false)} className="puzzle-action-btn">Fermer</button>
            </div>
          </div>
        </div>
      )}
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
              <div>Puissance actuelle : <b style={{color: getPumpColor(pumpPower)}}>{pumpPower}%</b></div>
              <div style={{position:'relative', padding:'8px 0', marginTop:6}}>
                {/* zone recommandée (visuelle seulement) */}
                <div style={{position:'absolute', left:`${75}%`, right:`${100-85}%`, top:0, bottom:0, background:'rgba(76,175,80,0.06)', pointerEvents:'none', borderRadius:6}} />
                <input
                  style={{width:'100%', transition:'all 200ms'}}
                  type="range"
                  min={0}
                  max={100}
                  value={pumpPower}
                  onChange={e => changePump(Number(e.target.value))}
                  onMouseUp={e => logPumpFinal(Number(e.target.value))}
                  onTouchEnd={e => logPumpFinal(Number(e.target.value))}
                  disabled={crashed || solved}
                />
              </div>
            </>
          )}
          <h4>Pressions</h4>
          <div>
            <div style={{marginBottom:6}}>P1: <b>{pressure.p1}</b></div>
            <div style={{background:'#eee', height:10, borderRadius:6, overflow:'hidden', marginBottom:8}}><div style={{width:`${Math.min(100, pressure.p1)}%`, height:'100%', background: pressure.p1>=75? '#4caf50' : pressure.p1>=40? '#ffaa00' : '#ff4444', transition:'width 400ms, background-color 400ms'}}/></div>
            <div style={{marginBottom:6}}>P2: <b>{pressure.p2}</b></div>
            <div style={{background:'#eee', height:10, borderRadius:6, overflow:'hidden', marginBottom:8}}><div style={{width:`${Math.min(100, pressure.p2)}%`, height:'100%', background: pressure.p2>=75? '#4caf50' : pressure.p2>=40? '#ffaa00' : '#ff4444', transition:'width 400ms, background-color 400ms'}}/></div>
            <div style={{marginBottom:6}}>P3: <b>{pressure.p3}</b></div>
            <div style={{background:'#eee', height:10, borderRadius:6, overflow:'hidden', marginBottom:8}}><div style={{width:`${Math.min(100, pressure.p3)}%`, height:'100%', background: pressure.p3>=75? '#4caf50' : pressure.p3>=40? '#ffaa00' : '#ff4444', transition:'width 400ms, background-color 400ms'}}/></div>
          </div>
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
                if (avg < 40) return <span style={{color:'#ff4444', fontWeight:'bold'}}>⚠️ Plantes sèches - ATTENTION</span>;
                if (avg < 50) return <span style={{color:'#ffaa00'}}>Stress hydrique</span>;
                if (avg < 70) return <span style={{color:'#ffaa00'}}>Stress hydrique</span>;
                if (avg < 80) return <span style={{color:'#00cc44'}}>OK</span>;
                return <span style={{color:'#0077cc'}}>Détrempées</span>;
              })()}
            </div>
            <div style={{marginTop:8}}>
              Retour terrain : {(() => {
                const avg = (pressure.p1 + pressure.p2 + pressure.p3) / 3;
                if (pressure.p1 < 30 || pressure.p2 < 30 || pressure.p3 < 30) return "Certains secteurs manquent d'eau";
                if (avg >= 75 && avg <= 85) return "Conditions optimales pour la croissance";
                if (avg < 75) return "Irrigation insuffisante, croissance ralentie";
                if (avg > 85) return "Excès d'eau détecté, risque de pourriture";
                return "Surveillance en cours";
              })()}
            </div>
          </div>
        )}
        <div style={{flex:1}}>
          <h4>Journal & état</h4>
          <div style={{maxHeight:220, overflowY:'auto', border:'1px solid #ddd', padding:8}}>
            {logs.map((l,i)=> <div key={i}>[{l.t}] {l.text}</div>)}
          </div>
          {/* Indice supprimé définitivement */}
          {state.crashed && (
            <div style={{marginTop:12, padding:12, background:'#b30000', color:'#fff', borderRadius:6}}>
              CRASH système — la pompe a été arrêtée. L'Hydrologue doit relancer le système.
              {/* Ajoutez ici un bouton de redémarrage si besoin */}
            </div>
          )}
        </div>
      </div>

      {/* Popup explicatif à l'arrivée */}
      {showContextPopup && (
        <div className="victory-overlay">
          <div className="victory-card" style={{ maxWidth: '550px', textAlign: 'left', textShadow: 'none', filter: 'none' }}>
            <h2 style={{ color: '#00eaff', marginBottom: '16px', textAlign: 'center', textShadow: 'none', filter: 'none' }}>💧 Système Hydraulique</h2>
            
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,0,0,0.2)', borderRadius: '6px', border: '1px solid #ff6666' }}>
              <strong style={{ color: '#ff9999' }}>ALERTE SYSTÈME :</strong> Fuite détectée dans le réseau
            </div>

            <div style={{ lineHeight: '1.5', marginBottom: '20px' }}>
              <p style={{ marginBottom: '12px' }}>
                Une fuite compromet l'approvisionnement en eau de la station. Le système hydraulique nécessite une intervention d'urgence :
              </p>
              
              <div style={{ marginLeft: '16px', marginBottom: '12px' }}>
                <div style={{ marginBottom: '6px' }}>🔍 <strong>Identifier</strong> la zone de fuite</div>
                <div style={{ marginBottom: '6px' }}>🚰 <strong>Isoler</strong> la section avec les vannes</div>
                <div style={{ marginBottom: '6px' }}>⚙️ <strong>Ajuster</strong> la puissance de pompe</div>
              </div>

              <p style={{ color: '#ffd700', fontWeight: 'bold' }}>
                Collaborez pour rétablir une pression stable sans surcharge...
              </p>
            </div>

            <div style={{ textAlign: 'center' }}>
              <button 
                onClick={() => setShowContextPopup(false)}
                style={{
                  background: '#00eaff',
                  color: '#000',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Accéder aux commandes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
