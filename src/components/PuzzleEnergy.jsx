import React, { useEffect, useState, useRef } from "react";
import { db } from "../firebase";
import { ref, onValue, update, set } from "firebase/database";

export default function PuzzleEnergy({ sessionId, playerRole, onSolve }) {
  const [state, setState] = useState(null);
  const [logs, setLogs] = useState([]);
  const [hintVisible, setHintVisible] = useState(false);
  const lastActivity = useRef(Date.now());
  const energyRefPath = `sessions/${sessionId}/energy`;

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
          power: { heat: 0, pump: 0, serre: 0, lab: 0 },
          total: 0,
          blackout: true,
          solved: false,
          logs: [],
        };
        set(r, defaultState);
        setState(defaultState);
        setLogs([]);
      } else {
        setState(v);
        setLogs(v.logs || []);
      }
    });
    return () => unsub();
  }, [sessionId]);

  const markActivity = () => {
    lastActivity.current = Date.now();
    if (hintVisible) setHintVisible(false);
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

  const updateConfig = (newCfgPartial, actor) => {
    if (!state) return;
    const cfg = { ...(state.config || {}), ...newCfgPartial };
    if (newCfgPartial.modules) {
      cfg.modules = { ...(state.config?.modules || {}), ...newCfgPartial.modules };
    }
    const { power: newPower, total } = computePowersFromConfig(cfg);
    const updates = { config: cfg, power: newPower, total };
    if (state.blackout) updates.blackout = false;
    update(ref(db, energyRefPath), updates);
    markActivity();
    const vstr = Number(cfg.voltage || 0).toFixed(1);
    const who = actor || 'Énergéticien';
    pushLog(`${who}: config modifiée (V=${vstr}V, total=${total} kW)`);
  };

  const triggerBlackout = () => {
    if (!state) return;
    const reset = { 
      power: { heat: 0, pump: 0, serre: 0, lab: 0 }, 
      total: 0, 
      blackout: true, 
      config: { ...(state.config || {}), voltage: 0 } 
    };
    set(ref(db, energyRefPath), { ...state, ...reset });
    pushLog("BLACKOUT : surcharge détectée, redémarrage nécessaire");
  };

  const restartSystem = () => {
    if (!state) return;
    update(ref(db, energyRefPath), { blackout: false });
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
    const heat = Number(state.power?.heat || 0);
    const pump = Number(state.power?.pump || 0);
    const serre = Number(state.power?.serre || 0);
    const lab = Number(state.power?.lab || 0);
    if (total === 9 && heat >= 3 && pump >= 3 && (serre >= 3 || lab >= 3)) {
      if (!state.solved) {
        update(ref(db, energyRefPath), { solved: true });
        pushLog("Succès : réseau énergétique stabilisé à 9 kW");
        if (onSolve) onSolve();
      }
    }
  }, [state, onSolve]);

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
  const power = state.power || { heat: 0, pump: 0, serre: 0, lab: 0 };
  const defaultModules = { 
    heat: { R: 3, connected: true }, 
    pump: { R: 3, connected: true }, 
    serre: { R: 3, connected: false }, 
    lab: { R: 3, connected: false } 
  };
  const cfgSource = state.config || {};
  const config = {
    voltage: typeof cfgSource.voltage === 'number' ? cfgSource.voltage : 0,
    modules: { ...defaultModules, ...(cfgSource.modules || {}) },
  };

  const isEnerg = !playerRole || playerRole === 'Énergéticien';
  const isHydro = playerRole === 'Hydrologue';
  const isBio = playerRole === 'Biologiste';

  return (
    <div style={{position:'relative'}}>
      <h3>⚡ Module Énergie — Contrôle</h3>
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
                onChange={(e) => updateConfig({ voltage: Number(e.target.value) }, 'Énergéticien')} 
              />
              <div style={{marginTop:12}}>
                <div>Chauffage — P: <b>{power.heat}</b> kW</div>
                <div>Résistance R: <b>{config.modules.heat.R}</b></div>
                <input 
                  type="range" 
                  min={1} 
                  max={9} 
                  step={1} 
                  value={config.modules.heat.R} 
                  disabled={state.blackout}
                  onChange={(e) => updateConfig({ 
                    modules: { heat: { ...config.modules.heat, R: Number(e.target.value) } } 
                  }, 'Énergéticien')} 
                />
                <div style={{marginTop:8}}>
                  Total: <b>{total}</b> kW (objectif: 9 kW)
                </div>
              </div>
            </div>
          )}
          {isHydro && (
            <div>
              <h4>État des pompes</h4>
              <div>Pompe: <b>{power.pump >= 3 ? 'OK' : 'Faible'}</b> — <span style={{color:'#00b'}}>({power.pump} kW)</span></div>
              <div>Résistance pompe: <b>{config.modules.pump.R}</b></div>
              <input 
                type="range" 
                min={1} 
                max={9} 
                step={1} 
                value={config.modules.pump.R} 
                disabled={state.blackout}
                onChange={(e) => updateConfig({ 
                  modules: { pump: { ...config.modules.pump, R: Number(e.target.value) } } 
                }, 'Hydrologue')} 
              />
            </div>
          )}
          {isBio && (
            <div>
              <h4>Serre</h4>
              <div>Chauffage: <b>{power.heat}</b> kW</div>
              <div>Éclairage: <b>{power.serre}</b> kW</div>
              <div>Résistance serre: <b>{config.modules.serre.R}</b></div>
              <input 
                type="range" 
                min={1} 
                max={9} 
                step={1} 
                value={config.modules.serre.R} 
                disabled={state.blackout}
                onChange={(e) => updateConfig({ 
                  modules: { serre: { ...config.modules.serre, R: Number(e.target.value) } } 
                }, 'Biologiste')} 
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
    </div>
  );
}