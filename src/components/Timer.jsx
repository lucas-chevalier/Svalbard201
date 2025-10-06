// src/components/Timer.jsx
import React, { useEffect, useState } from "react";

export default function Timer({ endTime }) {
  const [remaining, setRemaining] = useState(endTime - Date.now());
  const [beepPlayed, setBeepPlayed] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(Math.max(0, endTime - Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  // ⏰ Calcul minutes / secondes
  const min = Math.floor(remaining / 60000);
  const sec = Math.floor((remaining % 60000) / 1000);

  // 🟥 Déclenche le beep une fois quand il reste moins de 5 min
  useEffect(() => {
    if (remaining < 5 * 60 * 1000 && !beepPlayed) {
      const audio = new Audio(
        "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
      );
      audio.volume = 0.4;
      audio.play();
      setBeepPlayed(true);
    }
  }, [remaining, beepPlayed]);

  // 🟢 Choix de la classe selon le temps restant
  const timerClass =
    remaining < 5 * 60 * 1000 ? "timer timer-warning" : "timer";

  return (
    <h3 className={timerClass}>
      ⏳ Temps restant : {min}m {sec < 10 ? "0" + sec : sec}s
    </h3>
  );
}
