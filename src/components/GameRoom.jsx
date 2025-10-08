import React, { useState, useEffect } from "react";
import { ref, onValue, update, set } from "firebase/database";
import { db } from "../firebase";
import Chat from "./Chat";
import Timer from "./Timer";
import Grainotheque from "./Grainotheque";
import PuzzlePompe from "./PuzzlePompe";
import Biosphere from "./Biosphere";
import PuzzleEnergy from "./PuzzleEnergy";

function Room({ title, bg, children }) {
  return (
    <div
      className="room fade-in"
      style={{
        backgroundImage: `url(${bg})`,
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

function PlayerStatus({ players, host, miniGameStatus }) {
  return (
    <div className="player-status">
      <h4>👥 Équipe connectée</h4>
      <ul>
        {Object.values(players || {}).map((p) => (
          <li key={p.id}>
            <span style={{ color: p.color || "#0f0" }}>{p.name}</span> —{" "}
            <span>{p.role || "Aucun rôle"}</span>
            {p.id === host && <span> ★ Chef</span>}
            {p.currentRoom && miniGameStatus[p.currentRoom] && <span> ✔</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function GameRoom({ sessionId, playerId }) {
  const [session, setSession] = useState(null);
  const [currentRoom, setCurrentRoom] = useState("controlRoom");
  // Pour reset les logs de la pompe quand on quitte la salle
  const pompeRef = ref(db, `sessions/${sessionId}/pompe`);
  const [miniGameStatus, setMiniGameStatus] = useState({});
  const [roomsOrder, setRoomsOrder] = useState([]);

  const sessionRef = ref(db, `sessions/${sessionId}`);
  const miniGameRef = ref(db, `sessions/${sessionId}/miniGameStatus`);
  const orderRef = ref(db, `sessions/${sessionId}/roomsOrder`);

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
    if (!session?.host) return;
    if (roomsOrder.length > 0) return;
    if (playerId === session.host) {
      const defaultOrder = [
        { name: "Grainothèque", bg: "/backgrounds/grainotheque.jpg" },
        { name: "Salle de traitement (eau)", bg: "/backgrounds/water.jpg" },
        { name: "Centrale électrique", bg: "/backgrounds/centrale.jpg" },
        { name: "Débarras", bg: "/backgrounds/debarras.jpg" },
        { name: "Biosphère", bg: "/backgrounds/biosphere.jpg" },
        { name: "Système de survie", bg: "/backgrounds/survie.jpg" },
      ].map((r, i) => ({ ...r, order: i + 1 }));

      set(orderRef, defaultOrder);
      setRoomsOrder(defaultOrder);
    }
  }, [session, playerId, roomsOrder, orderRef]);

  if (!session) return <p>Chargement...</p>;

  // --- Liste des mini-jeux disponibles
  const miniGames = {
    "Grainothèque": Grainotheque,
    "Salle de traitement (eau)": PuzzlePompe,
    "Centrale électrique": PuzzleEnergy,
  };

  // --- Gestion de la validation d'une salle
  const handleWin = (roomName) => {
    const updated = { ...miniGameStatus, [roomName]: true };
    update(sessionRef, { miniGameStatus: updated });
    alert(`Puzzle de "${roomName}" terminé !`);
  };

  const currentRoomInfo = roomsOrder.find((r) => r.name === currentRoom);
  const MiniGame = miniGames[currentRoom];

  // Fonction pour quitter une salle
  const handleLeaveRoom = () => {
    setCurrentRoom("controlRoom");
  };

  return (
    <>
      {currentRoom === "controlRoom" ? (
        <Room key={currentRoom} title="Salle de contrôle" bg="/backgrounds/controlRoom.jpg">
          <Timer endTime={session.timer} />
          <PlayerStatus
            players={session.players}
            host={session.host}
            miniGameStatus={miniGameStatus}
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
              opacity: 0.6,
              pointerEvents: "auto",
              transition: "opacity 0.3s ease",
            }}
          >
            {roomsOrder.map((room, index) => {
              const isUnlocked =
                index === 0 || miniGameStatus[roomsOrder[index - 1]?.name];
              const isCompleted = miniGameStatus[room.name];

              return (
                <div
                  key={room.name}
                  className={`room-tile ${
                    isCompleted ? "completed" : ""
                  } ${!isUnlocked ? "locked" : ""}`}
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
          />
        </Room>
      ) : (
        currentRoom === "Biosphère" ? (
          <Biosphere playerID={session.players[playerId]?.role} />
        ) : (
          <Room key={currentRoom} title={currentRoom} bg={currentRoomInfo?.bg}>
            <Timer endTime={session.timer} />
            {MiniGame && (
              <MiniGame
                sessionId={sessionId}
                roomName={currentRoom.toLowerCase()}
                playerRole={session.players[playerId]?.role}
                onWin={() => handleWin(currentRoom)}
              />
            )}
            <button
              className="return-lobby-btn"
              onClick={handleLeaveRoom}
            >
              Retour à la salle de contrôle
            </button>
            <Chat
              sessionId={sessionId}
              playerId={playerId}
              playerName={session.players[playerId]?.name || "??"}
            />
          </Room>
        )
      )}
    </>
  );
}
