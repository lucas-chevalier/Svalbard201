import React, { useState, useEffect } from "react";
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

  const sessionRef = ref(db, `sessions/${sessionId}`);
  const miniGameRef = ref(db, `sessions/${sessionId}/miniGameStatus`);
  const orderRef = ref(db, `sessions/${sessionId}/roomsOrder`);
  const timerRef = ref(db, `sessions/${sessionId}/timer`);

  // --- 🔹 Chargement des données
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
    return () => {
      unsubSession();
      unsubMini();
      unsubOrder();
    };
  }, [sessionRef, miniGameRef, orderRef]);

  // --- ⚙️ Définir l'ordre initial (1 seule fois, par le host)
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

  // Timer : on vérifie via Firebase snapshot pour éviter de relancer à chaque render
  const timerSnap = ref(db, `sessions/${sessionId}/timer`);
  onValue(timerSnap, (snap) => {
    if (!snap.exists()) set(timerRef, Date.now() + 60 * 60 * 1000);
  }, { onlyOnce: true });

}, [session?.host, roomsOrder.length, playerId]);


  if (!session) return <p>Chargement...</p>;

  // --- Liste des mini-jeux disponibles
  const miniGames = {
    "Salle radio": Grainotheque,
    "Pompe hydraulique": PuzzlePompe,
    "Centrale électrique": PuzzleEnergy,
    "Biosphère": Biosphere,
    "Débarras": PuzzleDebarras,
    "Salle de crise": SalleCrise,

  };

  // --- Gestion de la validation d'une salle
  const handleWin = (roomName) => {
    const updated = { ...miniGameStatus, [roomName]: true };
    update(sessionRef, { miniGameStatus: updated });
    alert(`Puzzle de "${roomName}" terminé !`);
  };

  const currentRoomInfo = roomsOrder.find((r) => r.name === currentRoom);
  const MiniGame = miniGames[currentRoom];

  const handleLeaveRoom = () => {
    setCurrentRoom("controlRoom");
  };

  // --- Callback pour accès à toutes les salles
  const handleAccessAllRooms = () => setForceAccessAll(true);

  return (
    <>
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
