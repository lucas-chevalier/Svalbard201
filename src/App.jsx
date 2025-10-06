import React, { useState } from "react";
import Lobby from "./components/Lobby";
import WaitingRoom from "./components/WaitingRoom";
import GameRoom from "./components/GameRoom";

export default function App() {
  const [sessionInfo, setSessionInfo] = useState(null);
  const [phase, setPhase] = useState("lobby"); // "lobby" | "waiting" | "playing"

  if (phase === "lobby") {
    return (
      <Lobby
        onJoin={(sessionId, playerId) => {
          setSessionInfo({ sessionId, playerId });
          setPhase("waiting");
        }}
      />
    );
  }

  if (phase === "waiting") {
    return (
      <WaitingRoom
        sessionId={sessionInfo.sessionId}
        playerId={sessionInfo.playerId}
        onStart={() => setPhase("playing")}
      />
    );
  }

  if (phase === "playing") {
    return (
      <GameRoom
        sessionId={sessionInfo.sessionId}
        playerId={sessionInfo.playerId}
      />
    );
  }

  return null;
}
// src/App.jsx