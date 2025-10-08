import React, { useState, useEffect } from 'react';
import { ref, onValue, set, get } from 'firebase/database';
import { db } from '../firebase';

const ProgressBar = ({ value, maxValue = 100 }) => {
  const percentage = (value / maxValue) * 100;
  let color = '#4caf50'; // vert par défaut
  if (percentage < 40) color = '#f44336'; // rouge
  else if (percentage < 70) color = '#ff9800'; // orange

  return (
    <div style={{ width: '100%', backgroundColor: '#e0e0e0', borderRadius: '4px' }}>
      <div
        style={{
          width: `${percentage}%`,
          backgroundColor: color,
          height: '20px',
          borderRadius: '4px',
          transition: 'width 0.5s ease-in-out',
        }}
      />
    </div>
  );
};

export default function SalleCrise({ sessionId, playerRole, playerId, session, onWin }) {
  console.log("Role reçu:", playerRole);  // Debug
  const [phase, setPhase] = useState('diagnostic'); // diagnostic, decision, resultat
  const [phaseTimer, setPhaseTimer] = useState(null);
  const [indicators, setIndicators] = useState({
    eau: { niveau: 70, pollution: 30, evaporation: 50 },
    energie: { production: 60, consommation: 40, rendement: 80 },
    bio: { croissance: 65, oxygene: 75, toxines: 45 }
  });
  const [playerChoice, setPlayerChoice] = useState('');
  const [allChoices, setAllChoices] = useState({});
  const [globalScore, setGlobalScore] = useState(null);

  const indicatorRef = ref(db, `sessions/${sessionId}/crise/indicators`);
  const choicesRef = ref(db, `sessions/${sessionId}/crise/choices`);
  const phaseRef = ref(db, `sessions/${sessionId}/crise/phase`);

  // Gestion des phases et du timer
  useEffect(() => {
    const unsubPhase = onValue(phaseRef, (snap) => {
      const val = snap.val();
      if (val && val.currentPhase) {
        setPhase(val.currentPhase);
        if (val.phaseStartTime) {
          const timeLeft = Math.max(0, (val.phaseStartTime + val.phaseDuration) - Date.now());
          setPhaseTimer(timeLeft);
        }
      }
    });

    // Si c'est le chef de session (host), il gère les transitions de phase
    const isHost = playerId === session?.host;
    if (isHost) {
      // Initialisation de la première phase si nécessaire
      get(phaseRef).then((snap) => {
        if (!snap.exists()) {
          set(phaseRef, {
            currentPhase: 'diagnostic',
            phaseStartTime: Date.now(),
            phaseDuration: 60000, // 60 secondes par phase
          });
        }
      });
    }

    return unsubPhase;
  }, [phaseRef, playerId, session]);

  // Chargement des données
  useEffect(() => {
    const unsubIndicators = onValue(indicatorRef, (snap) => {
      const val = snap.val();
      if (val) setIndicators(val);
    });

    const unsubChoices = onValue(choicesRef, (snap) => {
      const val = snap.val();
      if (val) setAllChoices(val);
    });

    return () => {
      unsubIndicators();
      unsubChoices();
    };
  }, [indicatorRef, choicesRef]);

  // Gestion du timer et des transitions de phase
  useEffect(() => {
    if (phaseTimer === null) return;

    const timer = setInterval(() => {
      const newTime = Math.max(0, phaseTimer - 1000);
      setPhaseTimer(newTime);

      // Si le timer arrive à 0 et que c'est le host, passer à la phase suivante
      if (newTime === 0 && playerId === session?.host) {
        const nextPhase = {
          diagnostic: 'decision',
          decision: 'resultat',
          resultat: 'resultat' // Reste sur resultat
        }[phase];

        set(phaseRef, {
          currentPhase: nextPhase,
          phaseStartTime: Date.now(),
          phaseDuration: 60000, // 60 secondes par phase
        });

        // Si on passe en phase résultat, calculer le score
        if (nextPhase === 'resultat') {
          calculateScore();
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [phaseTimer, phase, playerId, session?.host]);

  const choices = {
    Hydrologue: [
      { id: 'purifier_eau', label: 'Purifier l\'eau', desc: '+eau, -énergie' },
      { id: 'distribuer_rapide', label: 'Distribution rapide', desc: '+énergie, -biosphère' },
      { id: 'fermer_circuits', label: 'Fermer circuits', desc: '+sécurité, -souplesse' }
    ],
    'Énergéticien': [
      { id: 'stabiliser_reseau', label: 'Stabiliser réseau', desc: '+fiabilité, -production' },
      { id: 'maximiser_rendement', label: 'Maximiser rendement', desc: '+énergie, +pollution' },
      { id: 'rediriger_vers_biosphere', label: 'Rediriger vers biosphère', desc: '+coop, -autonomie' }
    ],
    Biologiste: [
      { id: 'renforcer_biodiversite', label: 'Renforcer biodiversité', desc: '+résilience, -rendement' },
      { id: 'croissance_rapide', label: 'Croissance rapide', desc: '+production, +consommation' },
      { id: 'filtrer_toxines', label: 'Filtrer toxines', desc: '+pureté, -vitesse' }
    ]
  };

  const handleChoice = (choice) => {
    setPlayerChoice(choice);
    set(ref(db, `sessions/${sessionId}/crise/choices/${playerRole}`), choice);
  };

  const calculateScore = () => {
    let scoreEau = 0;
    let scoreEnergie = 0;
    let scoreBio = 0;

    Object.entries(allChoices).forEach(([playerRole, choice]) => {
      switch(choice) {
        // Hydrologue
        case 'purifier_eau': 
          scoreEau += 10; 
          scoreEnergie -= 5;
          break;
        case 'distribuer_rapide':
          scoreEau -= 5;
          scoreEnergie += 5;
          scoreBio -= 5;
          break;
        case 'fermer_circuits':
          scoreEau += 5;
          scoreEnergie -= 5;
          break;

        // Energéticien
        case 'stabiliser_reseau':
          scoreEnergie += 7;
          scoreEau += 3;
          break;
        case 'maximiser_rendement':
          scoreEnergie += 10;
          scoreBio -= 7;
          break;
        case 'rediriger_vers_biosphere':
          scoreEnergie -= 5;
          scoreBio += 10;
          break;

        // Biologiste
        case 'renforcer_biodiversite':
          scoreBio += 10;
          scoreEnergie -= 3;
          break;
        case 'croissance_rapide':
          scoreBio += 7;
          scoreEau -= 5;
          scoreEnergie -= 5;
          break;
        case 'filtrer_toxines':
          scoreBio += 5;
          scoreEau += 5;
          scoreEnergie -= 3;
          break;
      }
    });

    const scoreGlobal = (scoreEau + scoreEnergie + scoreBio + 30) / 60;
    setGlobalScore(scoreGlobal);
    return scoreGlobal;
  };

  const normalizeRole = (role) => {
    // Normalise le rôle pour gérer les différences d'accents
    if (role === 'Energeticien' || role === 'Energéticien' || role === 'Énergéticien') {
      return 'Énergéticien';
    }
    return role;
  };

  const renderDiagnostic = () => {
    const normalizedRole = normalizeRole(playerRole);
    console.log("Switch case avec role normalisé:", normalizedRole);  // Debug
    switch(normalizedRole) {
      case 'Hydrologue':
        return (
          <div className="diagnostic-panel">
            <h3>Diagnostic Hydraulique</h3>
            <div className="indicator">
              <label>Niveau d'eau</label>
              <ProgressBar value={indicators.eau.niveau} />
            </div>
            <div className="indicator">
              <label>Pollution</label>
              <ProgressBar value={indicators.eau.pollution} />
            </div>
            <div className="indicator">
              <label>Évaporation</label>
              <ProgressBar value={indicators.eau.evaporation} />
            </div>
          </div>
        );
      case 'Énergéticien':
        return (
          <div className="diagnostic-panel">
            <h3>Diagnostic Énergétique</h3>
            <div className="indicator">
              <label>Production</label>
              <ProgressBar value={indicators.energie.production} />
            </div>
            <div className="indicator">
              <label>Consommation</label>
              <ProgressBar value={indicators.energie.consommation} />
            </div>
            <div className="indicator">
              <label>Rendement</label>
              <ProgressBar value={indicators.energie.rendement} />
            </div>
          </div>
        );
      case 'Biologiste':
        return (
          <div className="diagnostic-panel">
            <h3>Diagnostic Biosphère</h3>
            <div className="indicator">
              <label>Croissance</label>
              <ProgressBar value={indicators.bio.croissance} />
            </div>
            <div className="indicator">
              <label>Oxygène</label>
              <ProgressBar value={indicators.bio.oxygene} />
            </div>
            <div className="indicator">
              <label>Toxines</label>
              <ProgressBar value={indicators.bio.toxines} />
            </div>
          </div>
        );
      default:
        console.log("Rôle non reconnu:", playerRole);  // Debug
        return (
          <div className="diagnostic-panel">
            <h3>Rôle non reconnu</h3>
            <p>Rôle reçu : {playerRole || 'aucun'}</p>
            <p>Rôles attendus : Hydrologue, Énergéticien, Biologiste</p>
            <p className="debug-info" style={{fontSize: '0.8em', color: '#666'}}>
              Note technique : Rôle normalisé : {normalizeRole(playerRole)}
            </p>
          </div>
        );
    }
  };

  const renderDecision = () => {
    const roleChoices = choices[playerRole] || [];
    return (
      <div className="decision-panel">
        <h3>Prenez votre décision</h3>
        <div className="choices-grid">
          {roleChoices.map((choice) => (
            <button
              key={choice.id}
              onClick={() => handleChoice(choice.id)}
              className={`choice-button ${playerChoice === choice.id ? 'selected' : ''}`}
            >
              <h4>{choice.label}</h4>
              <p>{choice.desc}</p>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderResultat = () => {
    if (globalScore === null) return null;

    let message = '';
    if (globalScore >= 0.7) {
      message = "Colonie stable : survie estimée à 80 jours.";
    } else if (globalScore >= 0.4) {
      message = "Système instable : ajustements nécessaires.";
    } else {
      message = "Pollution critique : survie compromise.";
    }

    return (
      <div className="resultat-panel">
        <h3>Résultat de l'audit</h3>
        <div className="terminal-output">
          <pre>
            {`=== RAPPORT D'AUDIT ===\n\n`}
            {`Score global : ${(globalScore * 100).toFixed(1)}%\n\n`}
            {`Diagnostic : ${message}\n\n`}
            {`=== FIN DU RAPPORT ===`}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="salle-crise">
      <div className="phase-indicator">
        <div className={`phase ${phase === 'diagnostic' ? 'active' : ''}`}>
          1. Diagnostic {phase === 'diagnostic' && phaseTimer && <span>({Math.ceil(phaseTimer / 1000)}s)</span>}
        </div>
        <div className={`phase ${phase === 'decision' ? 'active' : ''}`}>
          2. Décision {phase === 'decision' && phaseTimer && <span>({Math.ceil(phaseTimer / 1000)}s)</span>}
        </div>
        <div className={`phase ${phase === 'resultat' ? 'active' : ''}`}>
          3. Résultat {phase === 'resultat' && phaseTimer && <span>({Math.ceil(phaseTimer / 1000)}s)</span>}
        </div>
      </div>

      <div className="main-content">
        {phase === 'diagnostic' && renderDiagnostic()}
        {phase === 'decision' && renderDecision()}
        {phase === 'resultat' && renderResultat()}
      </div>
    </div>
  );
}