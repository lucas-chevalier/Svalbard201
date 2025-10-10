import React, { useState, useEffect, useMemo } from "react";
import { ref, onValue, update, set } from "firebase/database";
import { db } from "../firebase";
import Chat from "./Chat";
import Timer from "./Timer";
import Grainotheque from "./Grainotheque";
import PuzzlePompe from "./PuzzlePompe";
import Biosphere from "./Biosphere";
import PuzzleEnergy from "./PuzzleEnergy";
import PuzzleDebarras from "./PuzzleDebarras";
import SalleCrise from "./SalleCrise";
import BackgroundMusic from "./BackgroundMusic";

function Room({ title, bg, children }) {
  const defaultBg = "/backgrounds/controlRoom.jpg";
  const backgroundImage = bg || defaultBg;

  return (
    <div
      className="room fade-in"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: "100vh",
        padding: 20,
        color: "#00ff66",
        position: "relative",
      }}
    >
      <h2>{title}</h2>
      {children}
    </div>
  );
}

function PlayerStatus({ players, host, miniGameStatus, currentRoom }) {
  return (
    <div className="player-status">
      <h4>👥 Équipe connectée</h4>
      <ul>
        {Object.values(players || {}).map((p) => (
          <li key={p.id}>
            <span style={{ color: p.color || "#0f0" }}>{p.name}</span> —{" "}
            <span>{p.role || "Aucun rôle"}</span>
            {p.id === host && <span> ★ Chef</span>}
            {p.currentRoom === currentRoom && <span> 👉</span>}
            {miniGameStatus[currentRoom] && <span> ✔</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function GameRoom({ sessionId, playerId }) {
  const [session, setSession] = useState(null);
  const [currentRoom, setCurrentRoom] = useState("controlRoom");
  const [miniGameStatus, setMiniGameStatus] = useState({});
  const [roomsOrder, setRoomsOrder] = useState([]);
  const [forceAccessAll, setForceAccessAll] = useState(false);
  const [globalScore, setGlobalScore] = useState(null);
  const [showEndVideo, setShowEndVideo] = useState(false);
  const [loadingVideo, setLoadingVideo] = useState(true);
  const [showFinalPage, setShowFinalPage] = useState(false);

const sessionRef = useMemo(() => ref(db, `sessions/${sessionId}`), [sessionId]);
const miniGameRef = useMemo(() => ref(db, `sessions/${sessionId}/miniGameStatus`), [sessionId]);
const orderRef = useMemo(() => ref(db, `sessions/${sessionId}/roomsOrder`), [sessionId]);
const globalScoreRef = useMemo(() => ref(db, `sessions/${sessionId}/crise/globalScore`), [sessionId]);
const endVideoRef = useMemo(() => ref(db, `sessions/${sessionId}/endVideo`), [sessionId]);


  useEffect(() => {
    const unsubSession = onValue(sessionRef, (snap) => setSession(snap.val()));
    const unsubMini = onValue(miniGameRef, (snap) => {
      const s = snap.val();
      if (s) setMiniGameStatus(s);
    });
    const unsubOrder = onValue(orderRef, (snap) => {
      const val = snap.val();
      if (val) setRoomsOrder(val);
    });
    const unsubScore = onValue(globalScoreRef, (snap) => {
      const val = snap.val();
      if (val !== null && val !== undefined) setGlobalScore(val);
    });
    const unsubEndVideo = onValue(endVideoRef, (snap) => {
      const val = snap.val();
      if (val?.finished) {
        setShowEndVideo(false);
        setShowFinalPage(true);
      }
    });

    return () => {
      unsubSession();
      unsubMini();
      unsubOrder();
      unsubScore();
      unsubEndVideo();
    };
  }, [sessionRef, miniGameRef, orderRef, globalScoreRef, endVideoRef]);

  useEffect(() => {
    if (!session?.host || roomsOrder.length > 0 || playerId !== session.host) return;

    const defaultOrder = [
      { name: "Centrale électrique", bg: "/backgrounds/centrale.jpg" },
      { name: "Pompe hydraulique", bg: "/backgrounds/water.jpg" },
      { name: "Salle radio", bg: "/backgrounds/grainotheque.png" },
      { name: "Biosphère", bg: "/backgrounds/biosphereB.png" },
      { name: "Débarras", bg: "/backgrounds/debarras.jpg" },
      { name: "Salle de crise", bg: "/backgrounds/sallecrise.png" },
    ].map((r, i) => ({ ...r, order: i + 1 }));

    set(orderRef, defaultOrder).then(() => setRoomsOrder(defaultOrder));

    const timerSnap = ref(db, `sessions/${sessionId}/timer`);
    onValue(
      timerSnap,
      (snap) => {
        if (!snap.exists()) set(ref(db, `sessions/${sessionId}/timer`), Date.now() + 40 * 60 * 1000);
      },
      { onlyOnce: true }
    );
  }, [session?.host, roomsOrder.length, playerId]);

const [hasPlayedEndVideo, setHasPlayedEndVideo] = useState(false);

useEffect(() => {
  if (
    !hasPlayedEndVideo &&
    !showEndVideo &&
    !showFinalPage && // ✅ empêche de rejouer la vidéo une fois la page finale affichée
    roomsOrder.length > 0 &&
    Object.keys(miniGameStatus).length === roomsOrder.length &&
    Object.values(miniGameStatus).every(Boolean)
  ) {
    setShowEndVideo(true);
    setHasPlayedEndVideo(true);
  }
}, [miniGameStatus, roomsOrder, hasPlayedEndVideo, showEndVideo, showFinalPage]);
 

  if (!session) return <p>Chargement...</p>;

  const miniGames = {
    "Salle radio": Grainotheque,
    "Pompe hydraulique": PuzzlePompe,
    "Centrale électrique": PuzzleEnergy,
    "Biosphère": Biosphere,
    "Débarras": PuzzleDebarras,
    "Salle de crise": SalleCrise,
  };

  const handleWin = (roomName) => {
    const updated = { ...miniGameStatus, [roomName]: true };
    update(sessionRef, { miniGameStatus: updated });
  };

  const currentRoomInfo = roomsOrder.find((r) => r.name === currentRoom);
  const MiniGame = miniGames[currentRoom];
  const handleLeaveRoom = () => setCurrentRoom("controlRoom");
  const handleAccessAllRooms = () => setForceAccessAll(true);

  const isHost = session.host === playerId;

  // --- Vidéo finale après les 6 modules
  if (showEndVideo && globalScore > 0) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#000",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
        }}
      >
        <video
          src="/assets/fin.mp4"
          autoPlay
          playsInline
          muted={false}
          onCanPlayThrough={() => setLoadingVideo(false)}
          onEnded={() => {
            setShowEndVideo(false);
            setShowFinalPage(true);
          }}
          style={{ width: "80%", height: "60%", objectFit: "contain" }}
        />
        {loadingVideo && (
          <p style={{ color: "#00ff66", marginTop: 12, fontFamily: "monospace", fontSize: "1.2em" }}>
            Chargement de la vidéo de fin...
          </p>
        )}
        {isHost && (
          <button
            onClick={() => {
              update(endVideoRef, { finished: true });
              setShowEndVideo(false);
              setShowFinalPage(true);
            }}
            style={{
              marginTop: 20,
              background: "#00ff66",
              color: "#000",
              border: "none",
              borderRadius: 8,
              padding: "10px 18px",
              fontWeight: "bold",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Passer la vidéo
          </button>
        )}
      </div>
    );
  }

if (showFinalPage) {
  if (globalScore === null) return null;

  const finalScoreText = `${(globalScore * 100).toFixed(1)}%`;

  // Déterminer le message, subtitle et funFact selon le score
  let message = "";
  let subtitle = "";
  let funFact = "";

  if (globalScore >= 0.8) {
    message = "Colonie parfaitement stable : survie estimée à 120 jours.";
    subtitle = "Félicitations ! Vous avez réussi l'impossible !";
    funFact =
      "Fait amusant : Même les plantes applaudissent votre performance. Littéralement. On a dû les arrêter avant qu'elles ne se fatiguent.";
  } else if (globalScore >= 0.7) {
    message = "Colonie très stable : survie estimée à 100 jours.";
    subtitle = "Excellent travail d'équipe !";
    funFact =
      "Conseil du jour : Votre efficacité est si élevée que le manuel de survie demande maintenant VOTRE autographe.";
  } else if (globalScore >= 0.6) {
    message = "Colonie stable : survie estimée à 80 jours.";
    subtitle = "Bonne coordination !";
    funFact =
      "Note du QG : Les autres colonies vous jalousent. Votre secret ? Des pauses café plus fréquentes.";
  } else if (globalScore >= 0.5) {
    message = "Système relativement stable : survie estimée à 65 jours.";
    subtitle = "Pas mal, mais on peut mieux faire...";
    funFact =
      "Observation technique : Votre station fonctionne comme une vieille voiture - ça marche, mais on entend des bruits bizarres.";
  } else if (globalScore >= 0.3) {
    message = "Système instable : ajustements nécessaires. Survie estimée à 45 jours.";
    subtitle = "Houston, nous avons un léger problème...";
    funFact = "Conseil pratique : Commencez à apprendre les signaux de fumée. Juste au cas où.";
  } else if (globalScore >= 0.1) {
    message = "Système critique : intervention d'urgence requise. Survie estimée à 30 jours.";
    subtitle = "Les choses se corsent !";
    funFact =
      "Mise à jour du manuel : La section 'Comment survivre avec 3 bouts de ficelle et une prière' vient d'être ajoutée.";
  } else if (globalScore >= -0.1) {
    message = "Défaillance majeure détectée : survie compromise à 20 jours.";
    subtitle = "Alerte rouge ! Tout le monde panique !";
    funFact =
      "Note personnelle du directeur : J'ai commencé à rédiger vos nécrologies. Par précaution, bien sûr.";
  } else if (globalScore >= -0.5) {
    message = "Catastrophe imminente : survie estimée à 10 jours maximum.";
    subtitle = "Préparez les canots de sauvetage !";
    funFact =
      "Dernière chance : Les paris sont ouverts au QG sur qui survivra le plus longtemps. Actuellement, le cactus de la cafétéria mène.";
  } else {
    message = "Effondrement total du système : évacuation immédiate recommandée.";
    subtitle = "Game Over, man ! Game Over !";
    funFact =
      "Épitaphe suggérée : 'Ils ont essayé. Vraiment. Enfin... pas si fort que ça, finalement.'";
  }
    const backgroundImage = globalScore < 0 ? "/backgrounds/lose.png" : "none";


  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundImage: backgroundImage !== "none" ? `url(${backgroundImage})` : "none",
        backgroundSize: "cover",
        backgroundPosition: "center",
        background: "radial-gradient(circle at center, #001a00, #000)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        color: "#00ff66",
        fontFamily: "monospace",
        padding: "40px",
        textAlign: "center",

      }}
    >
      <h1 style={{ fontSize: "2.8em", marginBottom: "1rem", color: "#00ff66" }}>
        Mission terminée 🛰️
      </h1>

      <p style={{ fontSize: "1.5em", marginBottom: "1rem" }}>
        Score final de la salle de crise :
      </p>

      <p
        style={{
          fontSize: "3em",
          fontWeight: "bold",
          color: "#ffcc00",
          marginBottom: "1.5rem",
        }}
      >
        {finalScoreText}
      </p>

      <div
        style={{
          maxWidth: "700px",
          background: "rgba(0,0,0,0.7)",
          border: "2px solid #00ff66",
          borderRadius: "16px",
          padding: "20px 30px",
          boxShadow: "0 0 20px #00ff66",
          lineHeight: "1.6",
          fontSize: "1.2em",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ marginBottom: "0.5rem", color: "#00ff66" }}>{subtitle}</h2>
        <p>{message}</p>
        <em style={{ display: "block", marginTop: "1rem", color: "#ffaa00" }}>{funFact}</em>
      </div>
    </div>
  );
}

  // --- Salle de contrôle et autres salles
  return (
    
    <>
     {/* Musique de fond */}
        <BackgroundMusic src="/assets/music/background.mp3" defaultVolume={0.2} />
      {currentRoom === "controlRoom" ? (
        <Room key={currentRoom} title="Salle de contrôle" bg="/backgrounds/controlRoom.jpg">
          <Timer endTime={session.timer} />
          <PlayerStatus
            players={session.players}
            host={session.host}
            miniGameStatus={miniGameStatus}
            currentRoom={currentRoom}
          />

          <div className="progress-section">
            <div className="progress-text">
              Progression : {Object.keys(miniGameStatus).filter((r) => miniGameStatus[r]).length} / {roomsOrder.length}
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${
                    (Object.keys(miniGameStatus).filter((r) => miniGameStatus[r]).length / roomsOrder.length) * 100
                  }%`,
                }}
              ></div>
            </div>
          </div>

          <div
            className="map-grid"
            style={{
              pointerEvents: "auto",
              gridTemplateColumns: "repeat(3, 1fr)",
              maxWidth: "900px",
              marginRight: "360px",
              marginLeft: "40px",
              marginTop: "20px",
            }}
          >
            {roomsOrder.map((room, index) => {
              const isUnlocked = forceAccessAll || index === 0 || miniGameStatus[roomsOrder[index - 1]?.name];
              const isCompleted = miniGameStatus[room.name];

              return (
                <div
                  key={room.name}
                  className={`room-tile ${isCompleted ? "completed" : ""} ${!isUnlocked ? "locked" : ""}`}
                  style={{
                    cursor: isUnlocked ? "pointer" : "not-allowed",
                    opacity: isUnlocked ? 1 : 0.4,
                    filter: isUnlocked ? "none" : "grayscale(100%)",
                    transition: "all 0.3s ease",
                  }}
                  onClick={() => isUnlocked && setCurrentRoom(room.name)}
                >
                  <img src={room.bg} alt={room.name} className="tile-image" />
                  <div className="tile-label">
                    {room.order}. {room.name}
                  </div>
                  {isCompleted && <span className="mini-complete">✔</span>}
                  {!isUnlocked && <span className="locked-icon">🔒</span>}
                </div>
              );
            })}
          </div>

          <Chat
            sessionId={sessionId}
            playerId={playerId}
            playerName={session.players[playerId]?.name || "??"}
            onAccessAllRooms={handleAccessAllRooms}
          />
        </Room>
      ) : (
        <Room key={currentRoom} title={currentRoom} bg={currentRoomInfo?.bg}>
          <div style={{ marginRight: "360px" }}>
            <Timer endTime={session.timer} />
            {currentRoom === "Salle de crise" && globalScore !== null && (
              <div
                style={{
                  background: "#000a",
                  border: "2px solid #00ff66",
                  borderRadius: "12px",
                  padding: "12px 20px",
                  color: "#00ff66",
                  fontWeight: "bold",
                  textAlign: "center",
                  marginBottom: "20px",
                  maxWidth: "400px",
                }}
              >
                Score global actuel : {(globalScore * 100).toFixed(1)}%
              </div>
            )}
            {MiniGame && (
              <MiniGame
                sessionId={sessionId}
                roomName={currentRoom.toLowerCase()}
                playerRole={session.players[playerId]?.role}
                playerId={playerId}
                session={session}
                players={session.players}
                onWin={() => handleWin(currentRoom)}
              />
            )}

            <button className="return-lobby-btn" onClick={handleLeaveRoom}>
              Retour à la salle de contrôle
            </button>
          </div>

          <Chat
            sessionId={sessionId}
            playerId={playerId}
            playerName={session.players[playerId]?.name || "??"}
            onAccessAllRooms={handleAccessAllRooms}
          />
        </Room>
      )}
    </>
  );
}
