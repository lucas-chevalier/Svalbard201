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
  const [showContextPopup, setShowContextPopup] = useState(true);
  const [readyPlayers, setReadyPlayers] = useState({});
  const [indicators, setIndicators] = useState({
    eau: { niveau: 70, pollution: 30, evaporation: 50 },
    energie: { production: 60, consommation: 40, rendement: 80 },
    bio: { croissance: 65, oxygene: 75, toxines: 45 }
  });
  const [playerChoice, setPlayerChoice] = useState('');
  const [choiceConfirmed, setChoiceConfirmed] = useState(false);
  const [allChoices, setAllChoices] = useState({});
  const [globalScore, setGlobalScore] = useState(null);
  const globalScoreRef = ref(db, `sessions/${sessionId}/crise/globalScore`);

  const indicatorRef = ref(db, `sessions/${sessionId}/crise/indicators`);
  const choicesRef = ref(db, `sessions/${sessionId}/crise/choices`);
  const phaseRef = ref(db, `sessions/${sessionId}/crise/phase`);
  const readyPlayersRef = ref(db, `sessions/${sessionId}/crise/readyPlayers`);

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

    // Écouter les joueurs prêts
    const unsubReady = onValue(readyPlayersRef, (snap) => {
      const val = snap.val() || {};
      setReadyPlayers(val);
    });

    return () => {
      unsubPhase();
      unsubReady();
    };
  }, [phaseRef, readyPlayersRef]);

  // Démarrage du timer uniquement quand tous les joueurs sont prêts
  useEffect(() => {
    if (!session?.players) return;
    
    const allPlayerIds = Object.keys(session.players);
    const readyPlayerIds = Object.keys(readyPlayers);
    const allPlayersReady = allPlayerIds.length > 0 && 
                           allPlayerIds.every(id => readyPlayers[id] === true);

    const isHost = playerId === session?.host;
    
    if (isHost && allPlayersReady) {
      // Vérifier si le timer n'a pas encore été démarré
      get(phaseRef).then((snap) => {
        const currentPhaseData = snap.val();
        if (!currentPhaseData || !currentPhaseData.phaseStartTime) {
          // Démarrer la première phase
          set(phaseRef, {
            currentPhase: 'diagnostic',
            phaseStartTime: Date.now(),
            phaseDuration: 60000, // 60 secondes par phase
          });
        }
      });
    }
  }, [readyPlayers, session, playerId, phaseRef]);

  // Fonction pour initier la procédure (fermer popup et marquer comme prêt)
  const handleInitiateProcedure = () => {
    setShowContextPopup(false);
    // Marquer ce joueur comme prêt dans Firebase
    set(ref(db, `sessions/${sessionId}/crise/readyPlayers/${playerId}`), true);
  };

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

        // Si on passe en phase résultat, calculer le score et valider la salle
        if (nextPhase === 'resultat') {
          calculateScore();
          if (typeof onWin === 'function') onWin();
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [phaseTimer, phase, playerId, session?.host]);

  const choices = {
    Hydrologue: [
      { id: 'purifier_eau', label: 'Purifier l’eau', desc: '“Tu lances la purification complète de l’eau : elle sera plus propre, mais la station consommera beaucoup d’électricité.”' },
      { id: 'distribuer_rapide', label: 'Distribuer plus vite', desc: '“Tu accélères la distribution de l’eau : les systèmes sont plus performants, mais certaines zones risquent d’être trop arrosées ou polluées.”' },
      { id: 'fermer_circuits', label: 'Fermer certains circuits', desc: '“Tu coupes les canalisations secondaires : c’est plus sûr, mais l’eau n’atteindra pas toutes les zones.”' }
    ],
    'Énergéticien': [
      { id: 'stabiliser_reseau', label: 'Stabiliser le réseau', desc: '“Tu rends le réseau plus stable : moins de pannes, mais un peu moins d’électricité produite.”' },
      { id: 'maximiser_rendement', label: 'Pousser les générateurs', desc: '“Tu augmentes la puissance : plus d’électricité, mais ça chauffe et pollue davantage.”' },
      { id: 'rediriger_vers_biosphere', label: 'Donner du courant à la biosphère', desc: '“Tu rediriges de l’énergie vers les serres : les plantes seront mieux, mais la centrale tournera moins fort.”' }
    ],
    Biologiste: [
      { id: 'renforcer_biodiversite', label: 'Planter plus d’espèces', desc: '“Tu diversifies les plantes : le système sera plus solide, mais les récoltes pousseront moins vite.”' },
      { id: 'croissance_rapide', label: 'Faire pousser plus vite', desc: '“Tu stimules la croissance : plus de nourriture, mais ça vide les réserves d’eau et d’énergie.”' },
      { id: 'filtrer_toxines', label: 'Activer les filtres naturels', desc: '“Tu actives des plantes purificatrices : l’air et l’eau seront plus sains, mais la croissance ralentira un peu.”' }
    ]
  };

  const handleChoice = (choice) => {
    setPlayerChoice(choice);
    setChoiceConfirmed(false);
  };

  const handleConfirm = () => {
    if (playerChoice) {
      set(ref(db, `sessions/${sessionId}/crise/choices/${playerRole}`), playerChoice);
      setChoiceConfirmed(true);
    }
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
    set(globalScoreRef, scoreGlobal); // Synchronise le score pour tous
    return scoreGlobal;
  };
  // Synchronisation du score global pour tous les joueurs
  useEffect(() => {
    const unsubGlobalScore = onValue(globalScoreRef, (snap) => {
      const val = snap.val();
      if (val !== null && val !== undefined) setGlobalScore(val);
    });
    return unsubGlobalScore;
  }, [globalScoreRef]);

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
              disabled={choiceConfirmed}
            >
              <h4>{choice.label}</h4>
              <p>{choice.desc}</p>
              {playerChoice === choice.id && !choiceConfirmed && (
                <span style={{color:'#00ff66',fontWeight:'bold'}}>Sélectionné</span>
              )}
              {playerChoice === choice.id && choiceConfirmed && (
                <span style={{color:'#00ff66',fontWeight:'bold'}}>Choix confirmé</span>
              )}
            </button>
          ))}
        </div>
        <button
          className="confirm-choice-btn"
          style={{marginTop:20,padding:'10px 30px',fontWeight:'bold',background:'#00ff66',color:'#222',borderRadius:8,border:'none',cursor:playerChoice&&!choiceConfirmed?'pointer':'not-allowed',opacity:playerChoice&&!choiceConfirmed?1:0.5}}
          onClick={handleConfirm}
          disabled={!playerChoice || choiceConfirmed}
        >
          Confirmer mon choix
        </button>
        {choiceConfirmed && (
          <div style={{marginTop:10,color:'#00ff66',fontWeight:'bold'}}>Votre choix a été enregistré !</div>
        )}
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

      {/* Indicateur des joueurs prêts */}
      {session?.players && (
        <div style={{ 
          padding: '10px', 
          margin: '10px 0', 
          background: 'rgba(0,0,0,0.3)', 
          borderRadius: '6px',
          fontSize: '14px'
        }}>
          <strong>Statut de l'équipe :</strong>
          {Object.entries(session.players).map(([id, player]) => (
            <span key={id} style={{ 
              marginLeft: '10px',
              color: readyPlayers[id] ? '#00ff66' : '#ffaa00'
            }}>
              {player.name} {readyPlayers[id] ? '✓' : '⏳'}
            </span>
          ))}
        </div>
      )}

      <div className="main-content">
        {/* Si le joueur a cliqué mais que tous ne sont pas encore prêts, afficher l'écran d'attente */}
        {readyPlayers[playerId] && session?.players && 
         !Object.keys(session.players).every(id => readyPlayers[id]) ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '300px',
            textAlign: 'center',
            padding: '40px',
            background: 'rgba(0,20,20,0.8)',
            borderRadius: '10px',
            border: '1px solid #004444'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
            <h2 style={{ color: '#00ffcc', marginBottom: '16px' }}>Attente des autres membres de l'équipe</h2>
            <p style={{ color: '#cccccc', lineHeight: '1.5', marginBottom: '20px' }}>
              Vous avez initié la procédure d'urgence.<br/>
              La mission démarrera dès que tous les membres auront confirmé leur présence.
            </p>
            <div style={{ 
              padding: '15px', 
              background: 'rgba(255,255,0,0.1)', 
              borderRadius: '6px',
              border: '1px solid #ffff00'
            }}>
              <strong style={{ color: '#ffff00' }}>⚠️ Veuillez patienter...</strong>
            </div>
          </div>
        ) : (
          // Contenu normal du jeu si tous sont prêts ou si ce joueur n'a pas encore cliqué
          <>
            {phase === 'diagnostic' && renderDiagnostic()}
            {phase === 'decision' && renderDecision()}
            {phase === 'resultat' && renderResultat()}
          </>
        )}
      </div>

      {/* Popup explicatif à l'arrivée */}
      {showContextPopup && (
        <div className="victory-overlay">
          <div className="victory-card" style={{ maxWidth: '600px', textAlign: 'left', textShadow: 'none', filter: 'none' }}>
            <h2 style={{ color: '#ff6b6b', marginBottom: '16px', textAlign: 'center', textShadow: 'none', filter: 'none' }}>🚨 RAPPORT LOG - SALLE DE CRISE</h2>
            
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,0,0,0.2)', borderRadius: '6px', border: '1px solid #ff6666' }}>
              <strong style={{ color: '#ff9999' }}>SITUATION CRITIQUE :</strong> Défaillances multiples détectées
            </div>

            <div style={{ lineHeight: '1.5', marginBottom: '20px' }}>
              <p style={{ marginBottom: '12px' }}>
                Plusieurs systèmes vitaux de la station présentent des anomalies. Une procédure d'urgence coordonnée est requise :
              </p>
              
              <div style={{ marginLeft: '16px', marginBottom: '12px' }}>
                <div style={{ marginBottom: '6px' }}>📊 <strong>Phase Diagnostic</strong> - Analyser les indicateurs selon votre spécialité</div>
                <div style={{ marginBottom: '6px' }}>💡 <strong>Phase Décision</strong> - Proposer une solution d'intervention</div>
                <div style={{ marginBottom: '6px' }}>⚖️ <strong>Phase Résultat</strong> - Évaluation collective des choix</div>
              </div>

              <p style={{ color: '#ffd700', fontWeight: 'bold' }}>
                La coordination entre équipes déterminera le succès de l'intervention...
              </p>
            </div>

            <div style={{ textAlign: 'center' }}>
              <button 
                onClick={handleInitiateProcedure}
                style={{
                  background: '#ff6b6b',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Initier la procédure
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}