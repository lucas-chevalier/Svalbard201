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
  const [showVictoryLocal, setShowVictoryLocal] = useState(false);
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
          setShowVictoryLocal(true);
          if (typeof onWin === 'function') onWin();
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [phaseTimer, phase, playerId, session?.host]);

  const choices = {
    Hydrologue: [
      { id: 'purifier_eau', label: 'Purifier l\'eau', desc: '"Tu lances la purification complète de l\'eau : elle sera plus propre, mais la station consommera beaucoup d\'électricité."' },
      { id: 'distribuer_rapide', label: 'Distribuer plus vite', desc: '"Tu accélères la distribution de l\'eau : les systèmes sont plus performants, mais certaines zones risquent d\'être trop arrosées ou polluées."' },
      { id: 'fermer_circuits', label: 'Fermer certains circuits', desc: '"Tu coupes les canalisations secondaires : c\'est plus sûr, mais l\'eau n\'atteindra pas toutes les zones."' },
      { id: 'vider_reserves', label: 'BOOST HYDRIQUE MAXIMAL', desc: '"Tu libères TOUTES les réserves d\'eau d\'un coup pour une irrigation massive ! Performance garantie à 200% ! Que peut-il mal se passer ?"' }
    ],
    'Énergéticien': [
      { id: 'stabiliser_reseau', label: 'Stabiliser le réseau', desc: '"Tu rends le réseau plus stable : moins de pannes, mais un peu moins d\'électricité produite."' },
      { id: 'maximiser_rendement', label: 'Pousser les générateurs', desc: '"Tu augmentes la puissance : plus d\'électricité, mais ça chauffe et pollue davantage."' },
      { id: 'rediriger_vers_biosphere', label: 'Donner du courant à la biosphère', desc: '"Tu rediriges de l\'énergie vers les serres : les plantes seront mieux, mais la centrale tournera moins fort."' },
      { id: 'surcharge_totale', label: 'MODE TURBO ULTIME', desc: '"Tu pousses les réacteurs à 150% de leur capacité ! Énergie illimitée pendant des heures ! Les ingénieurs adorent cette astuce !"' }
    ],
    Biologiste: [
      { id: 'renforcer_biodiversite', label: 'Planter plus d\'espèces', desc: '"Tu diversifies les plantes : le système sera plus solide, mais les récoltes pousseront moins vite."' },
      { id: 'croissance_rapide', label: 'Faire pousser plus vite', desc: '"Tu stimules la croissance : plus de nourriture, mais ça vide les réserves d\'eau et d\'énergie."' },
      { id: 'filtrer_toxines', label: 'Activer les filtres naturels', desc: '"Tu actives des plantes purificatrices : l\'air et l\'eau seront plus sains, mais la croissance ralentira un peu."' },
      { id: 'fertilisant_experimental', label: 'SÉRUM CROISSANCE X-42', desc: '"Tu utilises le fertilisant expérimental ultra-secret ! Croissance x10 en quelques heures ! Testé par les meilleurs scientifiques* (*sur des cobayes)"' }
    ]
  };  const handleChoice = (choice) => {
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
        case 'vider_reserves': // OPTION PIÈGE !
          scoreEau -= 20; // Catastrophe hydrique
          scoreEnergie -= 15; // Plus d'énergie pour pomper
          scoreBio -= 10; // Inondation des cultures
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
        case 'surcharge_totale': // OPTION PIÈGE !
          scoreEnergie -= 25; // Fusion des réacteurs
          scoreEau -= 15; // Système de refroidissement grillé
          scoreBio -= 20; // Pollution radioactive
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
        case 'fertilisant_experimental': // OPTION PIÈGE !
          scoreBio -= 30; // Mutation des plantes
          scoreEau -= 10; // Contamination de l'eau
          scoreEnergie -= 5; // Confinement d'urgence
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
    
    // Fonction pour obtenir le statut d'un indicateur (logique uniforme)
    const getIndicatorStatus = (value) => {
      if (value < 40) return { color: '#f44336', status: 'ALERTE', icon: '🚨' };
      if (value < 70) return { color: '#ff9800', status: 'ATTENTION', icon: '⚠️' };
      return { color: '#4caf50', status: 'NORMAL', icon: '✓' };
    };

    switch(normalizedRole) {
      case 'Hydrologue':
        const eauNiveau = getIndicatorStatus(indicators.eau.niveau);
        const eauPollution = getIndicatorStatus(indicators.eau.pollution);
        const eauEvaporation = getIndicatorStatus(indicators.eau.evaporation);
        
        return (
          <div className="diagnostic-panel" style={{ padding: '20px', background: 'rgba(0,100,150,0.1)', borderRadius: '8px' }}>
            <h3 style={{ color: '#00eaff', marginBottom: '20px' }}>💧 DIAGNOSTIC SYSTÈME HYDRAULIQUE</h3>
            
            <div style={{ marginBottom: '20px', padding: '12px', background: 'rgba(0,234,255,0.1)', borderRadius: '6px' }}>
              <strong style={{ color: '#00eaff' }}>SITUATION :</strong> Analyse des réserves et de la qualité de l'eau de la station
            </div>
            
            <div className="indicator" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontWeight: 'bold' }}>Niveau des réservoirs</label>
                <span style={{ color: eauNiveau.color, fontWeight: 'bold' }}>
                  {eauNiveau.icon} {eauNiveau.status}
                </span>
              </div>
              <ProgressBar value={indicators.eau.niveau} />
              <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
                Capacité actuelle: {indicators.eau.niveau}% | Alerte: &lt;40% | Surveillance: 40-70% | OK: &gt;70%
              </div>
            </div>
            
            <div className="indicator" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontWeight: 'bold' }}>Taux de pollution</label>
                <span style={{ color: eauPollution.color, fontWeight: 'bold' }}>
                  {eauPollution.icon} {eauPollution.status}
                </span>
              </div>
              <ProgressBar value={indicators.eau.pollution} />
              <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
                Contamination: {indicators.eau.pollution}% | Alerte: &lt;40% | Surveillance: 40-70% | OK: &gt;70%
              </div>
            </div>
            
            <div className="indicator" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontWeight: 'bold' }}>Taux d'évaporation</label>
                <span style={{ color: eauEvaporation.color, fontWeight: 'bold' }}>
                  {eauEvaporation.icon} {eauEvaporation.status}
                </span>
              </div>
              <ProgressBar value={indicators.eau.evaporation} />
              <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
                Perte thermique: {indicators.eau.evaporation}% | Alerte: &lt;40% | Surveillance: 40-70% | OK: &gt;70%
              </div>
            </div>
          </div>
        );
        
      case 'Énergéticien':
        const energieProduction = getIndicatorStatus(indicators.energie.production);
        const energieConsommation = getIndicatorStatus(indicators.energie.consommation);
        const energieRendement = getIndicatorStatus(indicators.energie.rendement);
        
        return (
          <div className="diagnostic-panel" style={{ padding: '20px', background: 'rgba(150,150,0,0.1)', borderRadius: '8px' }}>
            <h3 style={{ color: '#ffee00', marginBottom: '20px' }}>⚡ DIAGNOSTIC SYSTÈME ÉNERGÉTIQUE</h3>
            
            <div style={{ marginBottom: '20px', padding: '12px', background: 'rgba(255,238,0,0.1)', borderRadius: '6px' }}>
              <strong style={{ color: '#ffee00' }}>SITUATION :</strong> Surveillance de la production et distribution électrique
            </div>
            
            <div className="indicator" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontWeight: 'bold' }}>Production électrique</label>
                <span style={{ color: energieProduction.color, fontWeight: 'bold' }}>
                  {energieProduction.icon} {energieProduction.status}
                </span>
              </div>
              <ProgressBar value={indicators.energie.production} />
              <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
                Sortie générateurs: {indicators.energie.production}% | Alerte: &lt;40% | Surveillance: 40-70% | OK: &gt;70%
              </div>
            </div>
            
            <div className="indicator" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontWeight: 'bold' }}>Consommation globale</label>
                <span style={{ color: energieConsommation.color, fontWeight: 'bold' }}>
                  {energieConsommation.icon} {energieConsommation.status}
                </span>
              </div>
              <ProgressBar value={indicators.energie.consommation} />
              <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
                Charge système: {indicators.energie.consommation}% | Alerte: &lt;40% | Surveillance: 40-70% | OK: &gt;70%
              </div>
            </div>
            
            <div className="indicator" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontWeight: 'bold' }}>Rendement réseau</label>
                <span style={{ color: energieRendement.color, fontWeight: 'bold' }}>
                  {energieRendement.icon} {energieRendement.status}
                </span>
              </div>
              <ProgressBar value={indicators.energie.rendement} />
              <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
                Efficacité distribution: {indicators.energie.rendement}% | Alerte: &lt;40% | Surveillance: 40-70% | OK: &gt;70%
              </div>
            </div>
          </div>
        );
        
      case 'Biologiste':
        const bioCroissance = getIndicatorStatus(indicators.bio.croissance);
        const bioOxygene = getIndicatorStatus(indicators.bio.oxygene);
        const bioToxines = getIndicatorStatus(indicators.bio.toxines);
        
        return (
          <div className="diagnostic-panel" style={{ padding: '20px', background: 'rgba(0,150,50,0.1)', borderRadius: '8px' }}>
            <h3 style={{ color: '#00ff66', marginBottom: '20px' }}>🌱 DIAGNOSTIC ÉCOSYSTÈME BIOLOGIQUE</h3>
            
            <div style={{ marginBottom: '20px', padding: '12px', background: 'rgba(0,255,102,0.1)', borderRadius: '6px' }}>
              <strong style={{ color: '#00ff66' }}>SITUATION :</strong> Monitoring de la biosphère et de la qualité de l'air
            </div>
            
            <div className="indicator" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontWeight: 'bold' }}>Croissance végétale</label>
                <span style={{ color: bioCroissance.color, fontWeight: 'bold' }}>
                  {bioCroissance.icon} {bioCroissance.status}
                </span>
              </div>
              <ProgressBar value={indicators.bio.croissance} />
              <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
                Taux développement: {indicators.bio.croissance}% | Alerte: &lt;40% | Surveillance: 40-70% | OK: &gt;70%
              </div>
            </div>
            
            <div className="indicator" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontWeight: 'bold' }}>Niveau d'oxygène</label>
                <span style={{ color: bioOxygene.color, fontWeight: 'bold' }}>
                  {bioOxygene.icon} {bioOxygene.status}
                </span>
              </div>
              <ProgressBar value={indicators.bio.oxygene} />
              <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
                Concentration O₂: {indicators.bio.oxygene}% | Alerte: &lt;40% | Surveillance: 40-70% | OK: &gt;70%
              </div>
            </div>
            
            <div className="indicator" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontWeight: 'bold' }}>Pureté atmosphérique</label>
                <span style={{ color: bioToxines.color, fontWeight: 'bold' }}>
                  {bioToxines.icon} {bioToxines.status}
                </span>
              </div>
              <ProgressBar value={indicators.bio.toxines} />
              <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
                Pureté atmosphérique: {indicators.bio.toxines}% | Alerte: &lt;40% | Surveillance: 40-70% | OK: &gt;70%
              </div>
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
        <div className="choices-grid" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: '12px', 
          maxWidth: '900px',
          margin: '0 auto'
        }}>
          {roleChoices.map((choice) => (
            <button
              key={choice.id}
              onClick={() => handleChoice(choice.id)}
              className={`choice-button ${playerChoice === choice.id ? 'selected' : ''}`}
              disabled={choiceConfirmed}
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                border: '2px solid #444',
                background: playerChoice === choice.id ? 'rgba(0,255,102,0.2)' : 'rgba(0,0,0,0.3)',
                color: '#fff',
                textAlign: 'left',
                cursor: choiceConfirmed ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                minHeight: '100px',
                maxHeight: '140px',
                overflow: 'hidden'
              }}
            >
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>{choice.label}</h4>
              <p style={{ margin: '0 0 8px 0', fontSize: '12px', lineHeight: '1.3', opacity: '0.9' }}>{choice.desc}</p>
              {playerChoice === choice.id && !choiceConfirmed && (
                <span style={{color:'#00ff66',fontWeight:'bold', fontSize: '11px'}}>Sélectionné</span>
              )}
              {playerChoice === choice.id && choiceConfirmed && (
                <span style={{color:'#00ff66',fontWeight:'bold', fontSize: '11px'}}>Choix confirmé</span>
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
    let subtitle = '';
    let funFact = '';
    
    if (globalScore >= 0.8) {
      message = "Colonie parfaitement stable : survie estimée à 120 jours.";
      subtitle = "Félicitations ! Vous avez réussi l'impossible !";
      funFact = "Fait amusant : Même les plantes applaudissent votre performance. Littéralement. On a dû les arrêter avant qu'elles ne se fatiguent.";
    } else if (globalScore >= 0.7) {
      message = "Colonie très stable : survie estimée à 100 jours.";
      subtitle = "Excellent travail d'équipe !";
      funFact = "Conseil du jour : Votre efficacité est si élevée que le manuel de survie demande maintenant VOTRE autographe.";
    } else if (globalScore >= 0.6) {
      message = "Colonie stable : survie estimée à 80 jours.";
      subtitle = "Bonne coordination !";
      funFact = "Note du QG : Les autres colonies vous jalousent. Votre secret ? Des pauses café plus fréquentes.";
    } else if (globalScore >= 0.5) {
      message = "Système relativement stable : survie estimée à 65 jours.";
      subtitle = "Pas mal, mais on peut mieux faire...";
      funFact = "Observation technique : Votre station fonctionne comme une vieille voiture - ça marche, mais on entend des bruits bizarres.";
    } else if (globalScore >= 0.3) {
      message = "Système instable : ajustements nécessaires. Survie estimée à 45 jours.";
      subtitle = "Houston, nous avons un léger problème...";
      funFact = "Conseil pratique : Commencez à apprendre les signaux de fumée. Juste au cas où.";
    } else if (globalScore >= 0.1) {
      message = "Système critique : intervention d'urgence requise. Survie estimée à 30 jours.";
      subtitle = "Les choses se corsent !";
      funFact = "Mise à jour du manuel : La section 'Comment survivre avec 3 bouts de ficelle et une prière' vient d'être ajoutée.";
    } else if (globalScore >= -0.1) {
      message = "Défaillance majeure détectée : survie compromise à 20 jours.";
      subtitle = "Alerte rouge ! Tout le monde panique !";
      funFact = "Note personnelle du directeur : J'ai commencé à rédiger vos nécrologies. Par précaution, bien sûr.";
    } else if (globalScore >= -0.5) {
      message = "Catastrophe imminente : survie estimée à 10 jours maximum.";
      subtitle = "Préparez les canots de sauvetage !";
      funFact = "Dernière chance : Les paris sont ouverts au QG sur qui survivra le plus longtemps. Actuellement, le cactus de la cafétéria mène.";
    } else {
      message = "Effondrement total du système : évacuation immédiate recommandée.";
      subtitle = "Game Over, man ! Game Over !";
      funFact = "Épitaphe suggérée : 'Ils ont essayé. Vraiment. Enfin... pas si fort que ça, finalement.'";
    }

    return (
      <div className="resultat-panel">
        <h3>Résultat de l'audit</h3>
        <div className="terminal-output">
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'Consolas, monospace' }}>
            {`=== RAPPORT D'AUDIT SVALBARD-201 ===\n\n`}
            {`Score global : ${(globalScore * 100).toFixed(1)}%\n`}
            {`${subtitle}\n\n`}
            {`DIAGNOSTIC OFFICIEL :\n${message}\n\n`}
            {`💬 ${funFact}\n\n`}
            {`=== [TRANSMISSION TERMINÉE] ===\n`}
            {`Station Svalbard-201 - "Survie et Innovation dans l'Arctique"`}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="salle-crise">
      {showVictoryLocal && (
        <div className="victory-overlay" role="dialog" aria-modal="true">
          <div className="victory-card">
            <h2>🎉 Mission Accomplie !</h2>
            <p>Audit de crise terminé avec succès.</p>
            <p style={{ fontSize: '14px', fontStyle: 'italic', color: '#888', marginTop: '8px' }}>
              "Félicitations ! Vous avez survécu à la bureaucratie de crise. Statistiquement parlant, c'était plus dangereux que la crise elle-même."
            </p>
            <div style={{display:'flex', gap:8, marginTop:12}}>
              <button onClick={() => setShowVictoryLocal(false)} className="puzzle-action-btn">Fermer</button>
            </div>
          </div>
        </div>
      )}
      
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
            <h2 style={{ color: '#ff6b6b', marginBottom: '16px', textAlign: 'center', textShadow: 'none', filter: 'none' }}>RAPPORT LOG - SALLE DE CRISE</h2>
            
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