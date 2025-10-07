import React, { useState, useEffect } from "react";
import { ref, onValue, update } from "firebase/database";
import { db } from "../firebase";
import Chat from "./Chat";
import Timer from "./Timer";
import PuzzleWater from "./PuzzleWater";
import Grainotheque from "./Grainotheque"; // ✅ ton composant du mini-jeu

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
            {miniGameStatus[p.currentRoom] && <span> ✔</span>}
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
  const sessionRef = ref(db, `sessions/${sessionId}`);
  const miniGameRef = ref(db, `sessions/${sessionId}/miniGameStatus`);

  useEffect(() => {
    const unsubSession = onValue(sessionRef, (snap) => setSession(snap.val()));
    const unsubMini = onValue(miniGameRef, (snap) => {
      const s = snap.val();
      if (s) setMiniGameStatus(s);
    });
    return () => {
      unsubSession();
      unsubMini();
    };
  }, [sessionRef, miniGameRef]);

  if (!session) return <p>Chargement...</p>;

  const rooms = [
    { name: "Système de survie", bg: "/backgrounds/survie.jpg" },
    { name: "Débarras", bg: "/backgrounds/debarras.jpg" },
    { name: "Biosphère", bg: "/backgrounds/biosphere.jpg" },
    { name: "Grainothèque", bg: "/backgrounds/grainotheque.jpg" },
    { name: "Centrale électrique", bg: "/backgrounds/centrale.jpg" },
    { name: "Salle de traitement (eau)", bg: "/backgrounds/water.jpg" },
  ];

  // ✅ Ajout de Grainotheque dans les mini-jeux disponibles
  const miniGames = {
    "Salle de traitement (eau)": PuzzleWater,
    "Grainothèque": Grainotheque,
  };

  const handleWin = (roomName) => {
    const updated = { ...miniGameStatus, [roomName]: true };
    update(sessionRef, { miniGameStatus: updated });
    alert(`Puzzle de "${roomName}" terminé !`);
  };

  const roomInfo = rooms.find((r) => r.name === currentRoom);
  const MiniGame = miniGames[currentRoom];

  return (
    <>
      {currentRoom === "controlRoom" ? (
        <Room
          key={currentRoom}
          title="Salle de contrôle"
          bg="/backgrounds/controlRoom.jpg"
        >
          <Timer endTime={session.timer} />
          <PlayerStatus
            players={session.players}
            host={session.host}
            miniGameStatus={miniGameStatus}
          />
          <div className="map-grid">
            {rooms.map((room) => (
              <div
                key={room.name}
                className={`room-tile ${
                  miniGameStatus[room.name] ? "completed" : ""
                }`}
                onClick={() => setCurrentRoom(room.name)}
              >
                <img src={room.bg} alt={room.name} className="tile-image" />
                <div className="tile-label">{room.name}</div>
                {miniGameStatus[room.name] && (
                  <span className="mini-complete">✔</span>
                )}
              </div>
            ))}
          </div>
          <Chat
            sessionId={sessionId}
            playerId={playerId}
            playerName={session.players[playerId]?.name || "??"}
          />
        </Room>
      ) : (
        <Room key={currentRoom} title={currentRoom} bg={roomInfo.bg}>
          <Timer endTime={session.timer} />
          {MiniGame && (
            <MiniGame
              sessionId={sessionId}
              roomName={currentRoom.toLowerCase()}
              onWin={() => handleWin(currentRoom)}
            />
          )}
          <button
            className="return-lobby-btn"
            onClick={() => setCurrentRoom("controlRoom")}
          >
            Retour à la salle de contrôle
          </button>
          <Chat
            sessionId={sessionId}
            playerId={playerId}
            playerName={session.players[playerId]?.name || "??"}
          />
        </Room>
      )}
    </>
  );
}
