import React, { useEffect, useState } from 'react';
import { ref, onValue, set, update, get } from 'firebase/database';
import { db } from '../firebase';

export default function PuzzleDebarras({ sessionId, roomName, onWin, playerRole, players: sessionPlayers, playerId }) {
  // Local fallback players for standalone testing (used when sessionPlayers is missing)
  const localPlayers = [
    { id: 'p1', name: 'Hydrologue', role: 'Hydrologue' },
    { id: 'p2', name: 'Énergéticien', role: 'Énergéticien' },
    { id: 'p3', name: 'Biologiste', role: 'Biologiste' }
  ];

  const playersArr = sessionPlayers
    ? Object.values(sessionPlayers).map(p => ({ id: p.id, name: p.name, role: p.role || 'Aucun' }))
    : localPlayers;

  // Debug: vérifier les rôles reçus
  console.log('[PuzzleDebarras] sessionPlayers:', sessionPlayers);
  console.log('[PuzzleDebarras] playersArr:', playersArr);
  console.log('[PuzzleDebarras] playerRole (actuel):', playerRole);
  console.log('[PuzzleDebarras] playerId:', playerId);
  
  // Vérifier quel array est utilisé
  if (sessionPlayers) {
    console.log('[PuzzleDebarras] Utilisation des sessionPlayers (données réelles)');
  } else {
    console.log('[PuzzleDebarras] Utilisation des localPlayers (mode test/fallback)');
  }

  const [dbCurrentPlayer, setDbCurrentPlayer] = useState(null);
  const [pending, setPending] = useState([]);
  const [currentPiece, setCurrentPiece] = useState(null);
  const [canPlace, setCanPlace] = useState(false);
  const [message, setMessage] = useState('');
  const [placements, setPlacements] = useState({});
  const [slotsState, setSlotsState] = useState([]);
  const [showVictoryLocal, setShowVictoryLocal] = useState(false);

  const debarrasRefPath = sessionId ? `sessions/${sessionId}/puzzles/${roomName}` : null;
  const roleOrder = ['Biologiste', 'Énergéticien', 'Hydrologue'];
  const isMyTurn = dbCurrentPlayer && String(dbCurrentPlayer) === String(playerId);

  // Debug: vérifier la logique de tour
  console.log('[PuzzleDebarras] isMyTurn check:', { 
    dbCurrentPlayer, 
    playerId, 
    isMyTurn,
    currentPiece: !!currentPiece 
  });

  const getImgForPiece = (id) => {
    const imgPath = `/ImageEnigmes/${id}.png`;
    console.log('[PuzzleDebarras] Image path for', id, ':', imgPath);
    return imgPath;
  };

  function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const piecesData = [
    { id: 'piece1', question: "Pourquoi les éoliennes sont-elles plus efficaces en milieu côtier ou montagneux ?", answer: 'C', options: ['A: Car le vent y est plus chaud', 'B: Car elles sont plus hautes en altitude', 'C: Car les différences de pression y créent des vents plus constants'] },
    { id: 'piece2', question: "Dans un système fermé comme l’abri Svalbard 201, quel est le principal risque d’un cycle de l’eau mal régulé ?", answer: 'B', options: ['A: Une augmentation de la salinité', 'B: Une condensation excessive entraînant une perte de chaleur', 'C: Une évaporation nulle empêchant la photosynthèse'] },
    { id: 'piece3', question: "Pourquoi les plantes sont-elles essentielles au maintien de l’équilibre atmosphérique dans un écosystème clos ?", answer: 'A', options: ['A: Elles recyclent le dioxyde de carbone en oxygène via la photosynthèse', 'B: Elles absorbent les rayonnements solaires pour refroidir l’air', 'C: Elles produisent de l’eau grâce à la respiration'] },
    { id: 'piece4', question: "Quelle est la principale limite de l’énergie solaire dans un environnement polaire ?", answer: 'A', options: ['A: La faible durée d’ensoleillement en hiver', 'B: Le coût de fabrication des panneaux', 'C: Le besoin en eau pour le nettoyage'] },
    { id: 'piece5', question: "Pourquoi un sol vivant est-il essentiel à la survie d’une serre hydroponique à long terme ?", answer: 'C', options: ['A: Il stabilise la température de l’eau', 'B: Il retient le CO₂ pour les racines', 'C: Il héberge des micro-organismes qui recyclent les nutriments'] },
    { id: 'piece6', question: "Dans un cycle hydrologique fermé, quelle étape est indispensable pour que l’eau reste potable ?", answer: 'B', options: ['A: L’évaporation', 'B: La filtration biologique ou mécanique', 'C: La condensation'] },
    { id: 'piece7', question: "Quel lien existe-t-il entre la production d’énergie éolienne et les courants océaniques ?", answer: 'A', options: ['A: Les différences thermiques de l’eau influencent les vents', 'B: Les océans captent l’énergie des turbines sous-marines', 'C: Les vents ralentissent la circulation marine'] },
    { id: 'piece8', question: "Quel phénomène atmosphérique, amplifié par le réchauffement climatique, influence la formation des nuages ?", answer: 'C', options: ['A: La baisse du point de rosée', 'B: L’augmentation des particules lourdes', 'C: L’élévation de la température moyenne de l’air'] },
    { id: 'piece9', question: "Pourquoi la biomasse peut-elle être considérée comme neutre en carbone si elle est bien gérée ?", answer: 'B', options: ['A: Parce qu’elle ne libère pas de CO₂', 'B: Parce que le CO₂ émis lors de sa combustion est réabsorbé lors de la croissance des plantes', 'C: Parce qu’elle se régénère plus vite que les énergies fossiles'] }
  ].map(p => ({ ...p, img: getImgForPiece(p.id) }));

  const playersCount = sessionPlayers ? Object.keys(sessionPlayers).length : playersArr.length;
  const everyoneHasRole = sessionPlayers ? Object.values(sessionPlayers).every(p => p.role && p.role !== 'Aucun') : true;
  const myRole = playerRole || playersArr.find(p => String(p.id) === String(playerId))?.role;
  const isHost = myRole === 'Biologiste';

  useEffect(() => {
    if (!debarrasRefPath) {
      const init = shuffleArray(piecesData);
      setPending(init);
      setSlotsState(['piece1','piece2','piece3','piece4','piece5','piece6','piece7','piece8','piece9']);
      setPlacements({});
      const bio = playersArr.find(p => p.role === 'Biologiste');
      setDbCurrentPlayer(bio?.id || playersArr[0]?.id || null);
      setMessage('Mode local - pas de synchronisation Firebase');
      return;
    }

    const r = ref(db, debarrasRefPath);

    const unsub = onValue(r, (snap) => {
      const v = snap.val();
      console.log('[PuzzleDebarras] Firebase data sync:', { v, sessionPlayers, playersCount, everyoneHasRole });

      if (!v) {
        // Initialisation du puzzle
        const init = shuffleArray(piecesData);
        const biologiste = sessionPlayers ? Object.values(sessionPlayers).find(p => p.role === 'Biologiste') : playersArr.find(p => p.role === 'Biologiste');
        const defaultSlots = ['piece1','piece2','piece3','piece4','piece5','piece6','piece7','piece8','piece9'];
        set(ref(db, debarrasRefPath), {
          slots: defaultSlots,
          pending: init,
          placements: {},
          currentPlayer: biologiste?.id || null
        }).catch(console.error);
        setMessage('Préparation du puzzle...');
        return;
      }

      // Enrichir les données pending
      const dbPending = v.pending || [];
      const enrichedPending = dbPending.map((it) => {
        if (!it) return it;
        if (it.question && it.options && it.img) return it; // Si déjà enrichi
        const id = typeof it === 'string' ? it : it.id;
        const found = piecesData.find(p => p.id === id);
        if (found) {
          return { ...found, img: getImgForPiece(found.id) };
        }
        return (typeof it === 'string') ? { id: it, img: getImgForPiece(it) } : it;
      });

      // Mettre à jour les états locaux
      setSlotsState(v.slots || []);
      setPending(enrichedPending);
      setPlacements(v.placements || {});
      setDbCurrentPlayer(v.currentPlayer ?? null);

      console.log('[PuzzleDebarras] State updated from Firebase:', {
        currentPlayer: v.currentPlayer,
        pendingCount: enrichedPending.length,
        placementsCount: Object.keys(v.placements || {}).length
      });

      // Gérer le cas où il n'y a pas de currentPlayer
      if (!v.currentPlayer && enrichedPending.length > 0) {
        const biologiste = sessionPlayers ? Object.values(sessionPlayers).find(p => p.role === 'Biologiste') : playersArr.find(p => p.role === 'Biologiste');
        const startId = biologiste?.id || playersArr[0]?.id || null;
        if (startId) {
          (async () => {
            try {
              await set(ref(db, debarrasRefPath + '/currentPlayer'), startId);
              console.log('[PuzzleDebarras] Set initial currentPlayer to:', startId);
            } catch (e) {
              console.error('Erreur fallback currentPlayer:', e);
            }
          })();
        }
      }
    });

    return () => {
      unsub();
    };
  }, [debarrasRefPath, sessionPlayers]);

  // Listen to miniGameStatus for this room to show global victory popup
  useEffect(() => {
    if (!sessionId) return;
    const statusRef = ref(db, `sessions/${sessionId}/miniGameStatus/${roomName}`);
    const unsubStatus = onValue(statusRef, (snap) => {
      const v = snap.val();
      if (v) setShowVictoryLocal(true);
    });
    return () => unsubStatus();
  }, [sessionId, roomName]);

  // useEffect séparé pour gérer l'affichage des questions basé sur le changement de joueur
  useEffect(() => {
    console.log('[PuzzleDebarras] Question logic triggered:', { 
      dbCurrentPlayer, 
      pendingLength: pending.length, 
      currentPiece: !!currentPiece,
      isMyTurn: String(dbCurrentPlayer) === String(playerId)
    });

    // Si pas de joueur actuel ou pas de questions en attente, ne rien faire
    if (!dbCurrentPlayer || !pending.length) {
      console.log('[PuzzleDebarras] No current player or no pending questions');
      
      // Vérifier si le puzzle est vraiment terminé (au moins une pièce placée)
      const hasPlacedPieces = Object.keys(placements).length > 0;
      if (!pending.length && hasPlacedPieces) {
        setMessage('🎉 Puzzle complété !');
        onWin && onWin();
      } else if (!pending.length && !hasPlacedPieces) {
        setMessage('Initialisation du puzzle...');
      } else {
        setMessage('En attente...');
      }
      return;
    }

    // Réinitialiser la pièce courante si ce n'est pas mon tour
    if (String(dbCurrentPlayer) !== String(playerId)) {
      if (currentPiece) {
        console.log('[PuzzleDebarras] Not my turn, clearing current piece');
        setCurrentPiece(null);
        setCanPlace(false);
      }
      setMessage(`C'est au tour de ${getPlayerDisplayName(dbCurrentPlayer)}`);
      return;
    }

    // Si c'est mon tour et qu'il n'y a pas de question affichée
    if (!currentPiece && pending.length > 0) {
      console.log('[PuzzleDebarras] My turn, showing question:', pending[0]);
      console.log('[PuzzleDebarras] Piece structure:', JSON.stringify(pending[0], null, 2));
      setCurrentPiece(pending[0]);
      setMessage('Répondez pour débloquer la pièce.');
    } else if (currentPiece) {
      console.log('[PuzzleDebarras] Question already displayed for my turn');
      console.log('[PuzzleDebarras] Current piece structure:', JSON.stringify(currentPiece, null, 2));
    }
  }, [dbCurrentPlayer, pending.length, playerId]);

  const puzzleStarted = !!dbCurrentPlayer;
  const canLaunch = !puzzleStarted && playersCount >= 3 && everyoneHasRole;

  const launchPuzzle = async () => {
    if (!debarrasRefPath) return;
    const biologiste = sessionPlayers ? Object.values(sessionPlayers).find(p => p.role === 'Biologiste') : playersArr.find(p => p.role === 'Biologiste');
    const startId = biologiste?.id || playersArr[0]?.id || null;
    if (!startId) return;
    try {
      const nodeRef = ref(db, debarrasRefPath);
      try {
        const snap = await get(nodeRef);
        const existing = snap && snap.exists() ? snap.val() : null;
        if (!existing || !existing.pending || (Array.isArray(existing.pending) && existing.pending.length === 0)) {
          const init = shuffleArray(piecesData);
          const defaultSlots = ['piece1','piece2','piece3','piece4','piece5','piece6','piece7','piece8','piece9'];
          await set(nodeRef, {
            slots: defaultSlots,
            pending: init,
            placements: {},
            currentPlayer: startId
          });
        } else {
          await set(ref(db, debarrasRefPath + '/currentPlayer'), startId);
        }
      } catch (e) {
        console.error('Erreur lors de linitialisation du puzzle:', e);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Helper function pour afficher le nom du joueur
  const getPlayerDisplayName = (playerId) => {
    const player = playersArr.find(p => String(p.id) === String(playerId));
    if (!player) return `Joueur ${playerId}`;
    return `${player.role || 'Joueur'} (${player.name || playerId})`;
  };

  const resetAndShuffle = async () => {
    if (!debarrasRefPath) return;
    if (!confirm('Cette action va réinitialiser le puzzle pour tous les joueurs et mélanger les questions — continuer ?')) return;
    const biologiste = sessionPlayers ? Object.values(sessionPlayers).find(p => p.role === 'Biologiste') : playersArr.find(p => p.role === 'Biologiste');
    const startId = biologiste?.id || playersArr[0]?.id || null;
    const init = shuffleArray(piecesData);
    const defaultSlots = ['piece1','piece2','piece3','piece4','piece5','piece6','piece7','piece8','piece9'];
    try {
      await set(ref(db, debarrasRefPath), {
        slots: defaultSlots,
        pending: init,
        placements: {},
        currentPlayer: startId
      });
      setPending(init);
      setPlacements({});
      setDbCurrentPlayer(startId);
      setMessage('Puzzle réinitialisé et mélangé.');
    } catch (e) {
      console.error('Erreur resetAndShuffle:', e);
    }
  };

  function findNextPlayerId(curId) {
    if (!playersArr || playersArr.length === 0) return null;
    const curPlayer = playersArr.find(p => String(p.id) === String(curId));
    const curRole = curPlayer?.role || 'Biologiste';
    const curRolePos = roleOrder.indexOf(curRole);
    for (let offset = 1; offset <= roleOrder.length; offset++) {
      const targetRole = roleOrder[(curRolePos + offset) % roleOrder.length];
      const candidate = playersArr.find(p => p.role === targetRole);
      if (candidate) return candidate.id;
    }
    const idx = playersArr.findIndex(p => String(p.id) === String(curId));
    return playersArr[(idx + 1) % playersArr.length]?.id || playersArr[0]?.id || null;
  }

  async function rotatePendingAndAdvance() {
    const nextPending = (pending && pending.length > 0) ? pending.slice(1).concat(pending[0]) : pending;
    const nextPlayerId = findNextPlayerId(dbCurrentPlayer);
    try {
      await update(ref(db, debarrasRefPath), {
        pending: nextPending,
        currentPlayer: nextPlayerId || null,
        placements: placements || {}
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function checkAnswer(ans) {
    if (!dbCurrentPlayer || String(dbCurrentPlayer) !== String(playerId)) {
      setMessage("⛔ Ce n'est pas votre tour pour répondre.");
      return;
    }
    if (!currentPiece) return;
    if (ans === currentPiece.answer) {
      setMessage('✅ Bonne réponse ! Placez la pièce dans le bon slot.');
      setCanPlace(true);
    } else {
      setMessage('❌ Mauvaise réponse. Cette question reviendra plus tard.');
      rotatePendingAndAdvance();
    }
  }

  async function handleDrop(slotAcceptId) {
    if (!canPlace) {
      setMessage("⏳ Répondez correctement avant de placer la pièce.");
      return;
    }
    if (!currentPiece) return;
    if (!dbCurrentPlayer || String(dbCurrentPlayer) !== String(playerId)) {
      setMessage("⛔ Ce n'est pas votre tour pour placer.");
      return;
    }

    if (slotAcceptId === currentPiece.id) {
      setMessage('🧩 Pièce correctement placée !');
      const nextPending = pending.slice(1);
      const newPlacements = { ...placements, [slotAcceptId]: currentPiece.id };
      const nextPlayerId = findNextPlayerId(dbCurrentPlayer);
      
      console.log('[PuzzleDebarras] handleDrop success:', {
        nextPending: nextPending.length,
        nextPlayerId,
        newPlacements
      });
      
      try {
        const defaultSlots = ['piece1','piece2','piece3','piece4','piece5','piece6','piece7','piece8','piece9'];
        await update(ref(db, debarrasRefPath), {
          slots: slotsState.length ? slotsState : defaultSlots,
          placements: newPlacements,
          pending: nextPending,
          currentPlayer: nextPlayerId || null
        });
        
        console.log('[PuzzleDebarras] Firebase updated successfully');
        
        // Reset local state immédiatement pour préparer le prochain tour
        setCurrentPiece(null);
        setCanPlace(false);
        
      } catch (e) {
        console.error('[PuzzleDebarras] Firebase update error:', e);
      }

      if (!nextPending || nextPending.length === 0) {
        setMessage('🎉 Puzzle complété !');
        onWin && onWin();
      } else {
        setMessage('En attente du prochain joueur...');
      }
    } else {
      setMessage('⚠️ Mauvais emplacement. Réessayez.');
    }
  }

  const visualSlots = ['piece1','piece2','piece3','piece4','piece5','piece6','piece7','piece8','piece9'];

  return (
    <div className={isMyTurn ? 'puzzle-container' : 'puzzle-container inactive-dim'}>
      <div className="puzzle-center-wrapper">
        {showVictoryLocal && (
          <div className="victory-overlay" role="dialog" aria-modal="true">
            <div className="victory-card">
              <h2>🎉 Succès !</h2>
              <p>Énigme résolue — bravo !</p>
              <div style={{display:'flex', gap:8, marginTop:12}}>
                <button onClick={() => setShowVictoryLocal(false)} className="puzzle-action-btn">Fermer</button>
              </div>
            </div>
          </div>
        )}
        <h3 className="puzzle-title">Svalbard 201 - Puzzle Débarras</h3>

        {/* Affichage des rôles de tous les joueurs */}
        <div className="puzzle-players-bar">
          <div className="puzzle-players-inner">
            <div className="puzzle-players-title">👥 Équipe :</div>
            <div className="puzzle-players-list">
              {(sessionPlayers ? Object.values(sessionPlayers) : playersArr).map(player => (
                <div key={player.id} className={`puzzle-player ${String(player.id) === String(playerId) ? 'me' : ''}`}>
                  <span className="puzzle-player-name">{player.name || `Joueur ${player.id}`}</span>
                  <span className="puzzle-player-role">({player.role || 'Aucun'})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="puzzle-current-row">
          <div className={`puzzle-current-player ${dbCurrentPlayer ? 'active-player-glow' : ''} ${dbCurrentPlayer === playerId ? 'me' : ''}`}>
            Joueur actif : {(() => {
              const currentPlayer = sessionPlayers 
                ? Object.values(sessionPlayers).find(p => String(p.id) === String(dbCurrentPlayer))
                : playersArr.find(p => String(p.id) === String(dbCurrentPlayer));
              return `${currentPlayer?.name || '—'} (${currentPlayer?.role || '—'})`;
            })()}
          </div>
        </div>

        <div className="puzzle-main">
          <div className="puzzle-left">
            <div className="question-box">
              {isMyTurn && currentPiece ? (
                <>
                  <div style={{ fontWeight:'700', fontSize:18 }}>{currentPiece.question}</div>
                  <div className="answers" aria-live="polite">
                    {currentPiece.options.map((opt, i) => (
                      <button
                        key={i}
                        className="puzzle-answer-btn"
                        onClick={() => isMyTurn && checkAnswer(['A','B','C'][i])}
                        aria-disabled={!isMyTurn}
                        aria-pressed={false}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="question-hidden" aria-hidden="true">Question masquée</div>
                  <div className="waiting-note" role="status" aria-live="polite">⏳ En attente de la réponse du joueur actif...</div>
                </>
              )}
            </div>
            <div className="puzzle-message">
              <div className="puzzle-message-text">{message}</div>
            </div>
          </div>
          <div className="puzzle-right">
            <div className="piece-preview">
              {currentPiece && (
                <img
                  src={currentPiece.img}
                  alt={currentPiece.id}
                  className="piece-img"
                  draggable={canPlace && isMyTurn}
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', currentPiece.id)}
                />
              )}
            </div>

            <div className="puzzle-slots-grid">
              {visualSlots.map((s) => (
                <div
                  key={s}
                  onDragOver={(e) => canPlace && isMyTurn && e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (isMyTurn) handleDrop(s);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Emplacement ${s}`}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && canPlace && isMyTurn) {
                      e.preventDefault();
                      handleDrop(s);
                    }
                  }}
                  className="slot"
                >
                  {placements && placements[s] ? (
                    <img src={getImgForPiece(placements[s])} alt={placements[s]} className="placed" />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop:12, display:'flex', gap:8 }}>
          {canLaunch && isHost && (
            <button onClick={launchPuzzle} className="puzzle-action-btn">Lancer le puzzle</button>
          )}
          {isHost && (
            <button onClick={resetAndShuffle} className="puzzle-action-btn destructive">Réinitialiser</button>
          )}
        </div>
      </div>
    </div>
  );
}
