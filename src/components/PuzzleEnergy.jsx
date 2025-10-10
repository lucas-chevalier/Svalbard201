import React, { useEffect, useState, useRef } from "react";
import { db } from "../firebase";
import { ref, onValue, update, set } from "firebase/database";

export default function PuzzleEnergy({ sessionId, playerRole, onWin, players, playerId, roomName }) {
  const [state, setState] = useState(null);
  const [logs, setLogs] = useState([]);
  const [hintVisible, setHintVisible] = useState(false);
  const [showVictoryLocal, setShowVictoryLocal] = useState(false);
  const [showContextPopup, setShowContextPopup] = useState(true);
  const lastActivity = useRef(Date.now());
  const energyRefPath = `sessions/${sessionId}/energy`;

  // États locaux pour les sliders (affichage immédiat)
  const [localHeatR, setLocalHeatR] = useState(1);
  const [localPumpR, setLocalPumpR] = useState(1);
  const [localSerreR, setLocalSerreR] = useState(1);

  // Ajout d'un indice de contexte dans le journal des logs à l'entrée (une seule fois)
  useEffect(() => {
    if (!sessionId) return;
    const r = ref(db, energyRefPath);
    onValue(r, (snap) => {
      const v = snap.val();
      if (!v) return;
      const logs = v.logs || [];
      const contextText = "Contexte : Le réseau électrique de la station est instable. Objectif : stabilisez la puissance totale à 9 kW en priorisant le chauffage puis la pompe. Attention : une surcharge provoque un blackout !";
      const alreadyPresent = logs.some(l => l.text && l.text.startsWith("Contexte : Le réseau électrique de la station"));
      if (!alreadyPresent) {
        const newLog = { t: new Date().toLocaleTimeString(), text: contextText };
        const updatedLogs = [newLog, ...logs.slice(0, 49)];
        update(r, { logs: updatedLogs });
      }
    }, { onlyOnce: true });
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const r = ref(db, energyRefPath);
    const unsub = onValue(r, (snap) => {
      const v = snap.val();
      if (!v) {
        const defaultState = {
          power: { heat: 0, pump: 0, serre: 0 },
          total: 0,
          blackout: true,
          solved: false,
          logs: [],
          config: { 
            voltage: 0, 
            modules: { 
              heat: { R: 1, connected: true }, 
              pump: { R: 1, connected: true }, 
              serre: { R: 1, connected: true }
            } 
          },
        };
        set(r, defaultState);
        setState(defaultState);
        setLogs([]);
        // Synchroniser les états locaux
        setLocalHeatR(defaultState.config.modules.heat.R);
        setLocalPumpR(defaultState.config.modules.pump.R);
        setLocalSerreR(defaultState.config.modules.serre.R);
      } else {
        setState(v);
        setLogs(v.logs || []);
        if (v.solved) setShowVictoryLocal(true);
        // Synchroniser les états locaux avec Firebase
        if (v.config?.modules) {
          setLocalHeatR(v.config.modules.heat?.R || 1);
          setLocalPumpR(v.config.modules.pump?.R || 1);
          setLocalSerreR(v.config.modules.serre?.R || 1);
        }
      }
    });
    return () => unsub();
  }, [sessionId]);

  const markActivity = () => {
    lastActivity.current = Date.now();
    if (hintVisible) setHintVisible(false);
  };

  // Couleur du badge Total
  const getTotalBadgeColor = (total) => {
    if (Math.abs(total - 9) <= 0.2) return '#4caf50'; // proche de l'objectif
    if (total < 9) return '#ffaa00'; // en-dessous
    return '#d32f2f'; // au-dessus
  };

  // Ajoute un log synchronisé dans Firebase (et donc pour tous les joueurs)
  const pushLog = (text) => {
    const currentLogs = (state?.logs || []);
    const newLog = { t: new Date().toLocaleTimeString(), text };
    const updatedLogs = [newLog, ...currentLogs.slice(0, 49)];
    update(ref(db, energyRefPath), { logs: updatedLogs });
  };

  const computePowersFromConfig = (cfg) => {
    const V = Number(cfg?.voltage || 0);
    const modules = cfg?.modules || {};
    const power = {};
    let total = 0;
    Object.keys(modules).forEach((m) => {
      const mod = modules[m];
      if (!mod || !mod.connected) {
        power[m] = 0;
        return;
      }
      const R = Number(mod.R || 1);
      const p = (V * V) / Math.max(1, R);
      const rounded = Math.round(p * 10) / 10;
      power[m] = rounded;
      total += rounded;
    });
    total = Math.round(total * 10) / 10;
    return { power, total };
  };

  const updateConfig = (newCfgPartial, actor, shouldLog = false) => {
    if (!state) return;
    const cfg = { ...(state.config || {}), ...newCfgPartial };
    if (newCfgPartial.modules) {
      cfg.modules = { 
        ...(state.config?.modules || {}), 
        ...Object.keys(newCfgPartial.modules).reduce((acc, key) => {
          acc[key] = { ...(state.config?.modules?.[key] || {}), ...newCfgPartial.modules[key] };
          return acc;
        }, {})
      };
    }
    const { power: newPower, total } = computePowersFromConfig(cfg);
    const updates = { config: cfg, power: newPower, total };
    if (state.blackout) updates.blackout = false;
    
    // Force la mise à jour complète pour éviter les problèmes de synchronisation
    update(ref(db, energyRefPath), updates).catch(console.error);
    markActivity();
    
    if (shouldLog) {
      const vstr = Number(cfg.voltage || 0).toFixed(1);
      const who = actor || 'Énergéticien';
      pushLog(`${who}: config modifiée (V=${vstr}V, total=${total} kW)`);
    }
  };

  const triggerBlackout = () => {
    if (!state) return;
    const reset = { 
      power: { heat: 0, pump: 0, serre: 0 }, 
      total: 0, 
      blackout: true, 
      config: { ...(state.config || {}), voltage: 0 } 
    };
    set(ref(db, energyRefPath), { ...state, ...reset });
    pushLog("BLACKOUT : surcharge détectée, redémarrage nécessaire");
  };

  const restartSystem = () => {
    if (!state) return;
    const resetConfig = {
      voltage: 0,
      modules: {
        heat: { R: 1, connected: true },
        pump: { R: 1, connected: true },
        serre: { R: 1, connected: true }
      }
    };
    update(ref(db, energyRefPath), { 
      blackout: false, 
      config: resetConfig,
      power: { heat: 0, pump: 0, serre: 0 },
      total: 0
    });
    pushLog("Remise en marche : l'Énergéticien a relancé le système");
    markActivity();
  };

  useEffect(() => {
    if (!state) return;
    const total = Number(state.total || 0);
    if (total > 10 && !state.blackout) {
      triggerBlackout();
      return;
    }
    // Condition de victoire simplifiée : puissance totale = 9kW exactement
    if (total === 9) {
      if (!state.solved) {
        update(ref(db, energyRefPath), { solved: true });
        pushLog("Succès : réseau électrique stabilisé à 9 kW");
        if (onWin) onWin();
      }
    }
  }, [state, onWin]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (Date.now() - lastActivity.current > 120000 && !hintVisible) {
        setHintVisible(true);
        pushLog("Indice : stabilisez à 9 kW en priorisant chauffage puis pompe.");
      }
    }, 5000);
    return () => clearInterval(iv);
  }, [hintVisible]);

  if (!sessionId) return <div>Erreur : pas de session fournie.</div>;
  if (!state) return <div>Chargement du module énergie...</div>;

  const total = Number(state.total || 0);
  const power = state.power || { heat: 0, pump: 0, serre: 0 };
  const defaultModules = { 
    heat: { R: 1, connected: true }, 
    pump: { R: 1, connected: true }, 
    serre: { R: 1, connected: true }
  };
  const cfgSource = state.config || {};
  const config = {
    voltage: typeof cfgSource.voltage === 'number' ? cfgSource.voltage : 0,
    modules: { 
      ...defaultModules, 
      ...(cfgSource.modules || {}),
      // Force la serre à être toujours connectée
      serre: { 
        ...defaultModules.serre, 
        ...(cfgSource.modules?.serre || {}), 
        connected: true 
      }
    },
  };

  const isNearTarget = Math.abs(total - 9) <= 0.2;
  const badgeStyle = {
    display: 'inline-block',
    padding: '8px 12px',
    borderRadius: 16,
    background: getTotalBadgeColor(total),
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    transition: 'transform 300ms, box-shadow 300ms',
    transform: isNearTarget ? 'scale(1.06)' : 'scale(1)',
    boxShadow: isNearTarget ? '0 0 14px rgba(76,175,80,0.9)' : 'none'
  };

  const isEnerg = !playerRole || playerRole === 'Énergéticien';
  const isHydro = playerRole === 'Hydrologue';
  const isBio = playerRole === 'Biologiste';

  return (
    <div style={{position:'relative'}}>
      {showVictoryLocal && (
        <div className="victory-overlay" role="dialog" aria-modal="true">
          <div className="victory-card" style={{ textShadow: 'none', filter: 'none' }}>
            <h2 style={{ textShadow: 'none', filter: 'none' }}>🎉 Électricité Maîtrisée !</h2>
            <p style={{ textShadow: 'none', filter: 'none' }}>Réseau électrique stabilisé.</p>
            <p style={{ fontSize: '16px', fontStyle: 'italic', color: '#b0b0b0', marginTop: '12px', padding: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', lineHeight: '1.4' }}>
              "Félicitations ! Vous avez dompté l'électricité sans vous électrocuter. C'est déjà mieux que 73% des techniciens précédents."
            </p>
            <div style={{display:'flex', gap:8, marginTop:12}}>
              <button onClick={() => setShowVictoryLocal(false)} className="puzzle-action-btn">Fermer</button>
            </div>
          </div>
        </div>
      )}
      <h3>⚡ Module Électricité — Contrôle</h3>
      <div style={{display:'flex', gap:16}}>
        <div style={{minWidth:260}}>
          <div><b>Rôle affiché :</b> {playerRole || 'Énergéticien'}</div>
          {isEnerg && (
            <div>
              <h4>Contrôle — Modèle Ohmique</h4>
              <div style={{fontSize:12, marginBottom:8}}>
                Formule utilisée : <b>P = V² / R</b>
              </div>
              <div>Voltage : <b>{config.voltage.toFixed(1)}</b> V</div>
              <input 
                type="range" 
                min={0} 
                max={3} 
                step={0.1} 
                value={config.voltage} 
                disabled={state.blackout}
                onChange={(e) => updateConfig({ voltage: Number(e.target.value) }, 'Énergéticien', false)}
                onMouseUp={(e) => updateConfig({ voltage: Number(e.target.value) }, 'Énergéticien', true)}
                onTouchEnd={(e) => updateConfig({ voltage: Number(e.target.value) }, 'Énergéticien', true)} 
              />
              <div style={{marginTop:12}}>
                <div>Chauffage — P: <b>{power.heat}</b> kW</div>
                <div>Résistance R: <b>{localHeatR}</b></div>
                <input 
                  type="range" 
                  min={1} 
                  max={9} 
                  step={1} 
                  value={localHeatR} 
                  disabled={state.blackout}
                  onChange={(e) => setLocalHeatR(Number(e.target.value))}
                  onMouseUp={(e) => updateConfig({ 
                    modules: { heat: { ...config.modules.heat, R: Number(e.target.value) } } 
                  }, 'Énergéticien', true)}
                  onTouchEnd={(e) => updateConfig({ 
                    modules: { heat: { ...config.modules.heat, R: Number(e.target.value) } } 
                  }, 'Énergéticien', true)} 
                />
                <div style={{marginTop:8}}>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <div style={{flex:1}}>
                      <div style={{background:'#eee', height:12, borderRadius:6, overflow:'hidden'}}>
                        <div style={{width:`${Math.min(100, (total / 9) * 100)}%`, height:'100%', background:getTotalBadgeColor(total), transition:'width 300ms'}} />
                      </div>
                      <div style={{fontSize:13, color:'#333', marginTop:6, fontWeight:700}}>Objectif : 9 kW</div>
                    </div>
                    <div style={{minWidth:110, textAlign:'right', display:'flex', flexDirection:'column', alignItems:'flex-end'}}>
                      <span style={badgeStyle}>{total} kW</span>
                      {isNearTarget && <span style={{fontSize:12, color:'#4caf50', marginTop:6, fontWeight:600}}>✓ Objectif atteint</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {isHydro && (
            <div>
              <h4>État des pompes</h4>
              <div>Pompe: <b>{power.pump}</b> kW</div>
              <div>Voltage système: <b>{config.voltage.toFixed(1)}</b> V</div>
              <div>Résistance pompe: <b>{localPumpR}</b> Ω</div>
              <input 
                type="range" 
                min={1} 
                max={9} 
                step={1} 
                value={localPumpR} 
                disabled={state.blackout}
                onChange={(e) => setLocalPumpR(Number(e.target.value))}
                onMouseUp={(e) => updateConfig({ 
                  modules: { pump: { ...config.modules.pump, R: Number(e.target.value) } } 
                }, 'Hydrologue', true)}
                onTouchEnd={(e) => updateConfig({ 
                  modules: { pump: { ...config.modules.pump, R: Number(e.target.value) } } 
                }, 'Hydrologue', true)} 
              />
            </div>
          )}
          {isBio && (
            <div>
              <h4>Serre</h4>
              <div>Serre: <b>{power.serre}</b> kW</div>
              <div>Voltage système: <b>{config.voltage.toFixed(1)}</b> V</div>
              <div>Résistance serre: <b>{localSerreR}</b> Ω</div>
              <input 
                type="range" 
                min={1} 
                max={9} 
                step={1} 
                value={localSerreR} 
                disabled={state.blackout}
                onChange={(e) => setLocalSerreR(Number(e.target.value))}
                onMouseUp={(e) => updateConfig({ 
                  modules: { serre: { ...config.modules.serre, R: Number(e.target.value), connected: true } } 
                }, 'Biologiste', true)}
                onTouchEnd={(e) => updateConfig({ 
                  modules: { serre: { ...config.modules.serre, R: Number(e.target.value), connected: true } } 
                }, 'Biologiste', true)} 
              />
            </div>
          )}
        </div>
        <div style={{flex:1}}>
          <h4>Journal</h4>
          <div style={{maxHeight:220, overflowY:'auto', border:'1px solid #ddd', padding:8}}>
            {logs.map((l,i) => <div key={i}>[{l.t}] {l.text}</div>)}
          </div>
          {hintVisible && (
            <div style={{marginTop:12, padding:8, border:'1px dashed #ffaa00'}}>
              Indice : stabilisez à 9 kW en priorisant chauffage puis pompe.
            </div>
          )}
          {state.blackout && (
            <div style={{marginTop:12, padding:12, background:'#b30000', color:'#fff'}}>
              BLACKOUT — L'Énergéticien doit redémarrer le système.
              {isEnerg && (
                <div style={{marginTop:8}}>
                  <button onClick={restartSystem}>Redémarrer</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Popup explicatif à l'arrivée */}
      {showContextPopup && (
        <div className="victory-overlay">
          <div className="victory-card" style={{ maxWidth: '550px', textAlign: 'left', textShadow: 'none', filter: 'none' }}>
            <h2 style={{ color: '#ffee00', marginBottom: '16px', textAlign: 'center', textShadow: 'none', filter: 'none' }}>⚡ RAPPORT LOG - CENTRALE ÉLECTRIQUE</h2>
            
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,0,0,0.2)', borderRadius: '6px', border: '1px solid #ff6666' }}>
              <strong style={{ color: '#ff9999' }}>ALERTE SYSTÈME :</strong> Panne électrique détectée
            </div>

            <div style={{ lineHeight: '1.5', marginBottom: '20px' }}>
              <p style={{ marginBottom: '12px' }}>
                Le réseau électrique a été endommagé suite à une surcharge. Trois systèmes critiques demandent de l'énergie :
              </p>
              
              <div style={{ marginLeft: '16px', marginBottom: '12px' }}>
                <div style={{ marginBottom: '6px' }}>🔥 <strong>Chauffage</strong> - Système de survie</div>
                <div style={{ marginBottom: '6px' }}>💧 <strong>Pompe</strong> - Approvisionnement en eau</div>
                <div style={{ marginBottom: '6px' }}>🌱 <strong>Serre</strong> - Production alimentaire</div>
              </div>

              <p style={{ color: '#ffd700', fontWeight: 'bold' }}>
                Trouvez la configuration qui stabilise l'alimentation sans surcharge...
              </p>
            </div>

            <div style={{ textAlign: 'center' }}>
              <button 
                onClick={() => setShowContextPopup(false)}
                style={{
                  background: '#00ff66',
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