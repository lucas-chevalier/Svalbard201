import React, { useState, useEffect } from "react";
import { ref, onValue, update } from "firebase/database";
import { db } from "../firebase";
import "../style.css";

const IMAGE_SRC = "ImageEnigmes/Oscilloscope.png";

const QUESTIONS = [
  {
    question: "Première question, quelle est la mesure maximum des volt ?",
    validate: (val) => {
      const num = Number(val);
      return num >= 200 && num <= 250;
    },
  },
  {
    question: "Quelle est sa valeur minimale ?",
    validate: (val) => {
      const num = Number(val);
      return num >= -300 && num <= -225;
    },
  },
  {
    question: "Quelle est la fréquence du signal représenté sur le graphique ?",
    validate: (val) => {
      const num = Number(val);
      return num >= 45 && num <= 55;
    },
    hasHint: true,
  },
];

export default function Grainotheque({ sessionId, roomName = "grainotheque", onWin, playerRole, players, playerId }) {
  const [showVictoryLocal, setShowVictoryLocal] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [response, setResponse] = useState("");
  const [validated, setValidated] = useState(false);
  const [error, setError] = useState("");
  const [showHint, setShowHint] = useState(false);

  // 🔹 Référence Firebase
  const progressRef = ref(db, `sessions/${sessionId}/progress/${roomName}`);

  // 🧠 Charger la progression depuis Firebase
  useEffect(() => {
    const unsub = onValue(progressRef, (snap) => {
      const data = snap.val();
      if (data) {
        if (data.currentQuestion !== undefined) setCurrentQuestion(data.currentQuestion);
        if (data.validated) setValidated(true);
        if (data.validated) setShowVictoryLocal(true);
      }
    });
    return () => unsub();
  }, [progressRef]);

  // 💾 Sauvegarde dans Firebase
  const saveProgress = (updates) => {
    update(progressRef, updates);
  };

  const handleChange = (e) => {
    const value = e.target.value.replace(/[^0-9-]/g, "");
    setResponse(value);
  };

  const handleValidate = () => {
    const val = response.trim();
    if (!QUESTIONS[currentQuestion].validate(val)) {
      setError("Ce n'est pas correct, recommence");
      return;
    }
    setError("");
    if (currentQuestion < QUESTIONS.length - 1) {
      const next = currentQuestion + 1;
      setCurrentQuestion(next);
      setResponse("");
      saveProgress({ currentQuestion: next });
    } else {
      setValidated(true);
      setShowVictoryLocal(true);
      saveProgress({ validated: true });
      if (onWin) onWin();
    }
  };

  const handleHint = () => setShowHint(true);
  const closeHint = () => setShowHint(false);

  // 🔸 Calcul de la progression
  const progress = ((currentQuestion + (validated ? 1 : 0)) / QUESTIONS.length) * 100;

  return (
    <div className="salle-grainotheque" style={{ textAlign: "center", padding: "2rem" }}>
      <h2>Bienvenue dans la Salle radio</h2>

      {/* 🧭 Barre de progression */}
      <div
        style={{
          margin: "1.5rem auto",
          width: "80%",
          height: "24px",
          background: "#111",
          border: "2px solid #00ff66",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "0 0 10px #00ff66",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: validated
              ? "linear-gradient(90deg, #00ff66, #66ff99)"
              : "linear-gradient(90deg, #ffee00, #00ff66)",
            transition: "width 0.5s ease, background 0.5s ease",
          }}
        />
      </div>
      <p style={{ color: "#00ff66", marginBottom: "1rem" }}>
        Progression : {validated ? "✔ Épreuve terminée" : `${currentQuestion + 1} / ${QUESTIONS.length}`}
      </p>

      {/* Image */}
      <div className="image-frame">
        <img
          src={IMAGE_SRC}
          alt="Oscilloscope"
          style={{ maxWidth: "400px", width: "100%", display: "block", margin: "0 auto" }}
        />
      </div>

      {/* Zone des questions */}
      <div style={{ marginTop: "2rem" }}>
        {!validated ? (
          <div style={{ marginBottom: "1rem" }}>
            <label>{QUESTIONS[currentQuestion].question}</label>
            <br />
            <input
              type="text"
              inputMode="numeric"
              value={response}
              onChange={handleChange}
              style={{ padding: "0.5rem", width: "60%" }}
              autoFocus
            />
            {QUESTIONS[currentQuestion].hasHint && (
              <button
                onClick={handleHint}
                style={{
                  marginLeft: "10px",
                  verticalAlign: "middle",
                  background: "#0b0b0b",
                  border: "2px solid #ffee00",
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 8px #ffee00",
                  cursor: "pointer",
                }}
                title="Indice"
              >
                <span role="img" aria-label="ampoule" style={{ fontSize: "1.3em", color: "#ffee00" }}>
                  💡
                </span>
              </button>
            )}
            <br />
            <button
              onClick={handleValidate}
              style={{
                padding: "0.7rem 2rem",
                marginTop: "1rem",
                background: "#0b0b0b",
                color: "#00ff66",
                border: "2px solid #00ff66",
                borderRadius: "8px",
                cursor: "pointer",
                boxShadow: "0 0 10px #00ff66",
              }}
            >
              Valider
            </button>
            {error && <div style={{ color: "red", marginTop: "1rem" }}>{error}</div>}
          </div>
        ) : (
          <div
            style={{
              color: "limegreen",
              marginTop: "1.5rem",
              fontSize: "1.4em",
              textShadow: "0 0 10px #00ff66",
            }}
          >
            ✅ Bravo, épreuve validée !
          </div>
        )}
      </div>

      {/* Fenêtre d’indice */}
      {showHint && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#222",
              color: "#00ff66",
              padding: "2rem",
              borderRadius: "12px",
              boxShadow: "0 0 20px #ffee00",
              maxWidth: "350px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "1.5em", marginBottom: "1em" }}>Indice</div>
            <div style={{ marginBottom: "1em" }}>
              T = 1 / f avec T = Période du cycle (en secondes, s)
              <br />
              <br />
              F = fréquence du signal (en hertz, Hz)
            </div>
            <button
              onClick={closeHint}
              style={{
                padding: "0.5rem 1.5rem",
                background: "#0b0b0b",
                border: "2px solid #ffee00",
                color: "#ffee00",
                borderRadius: "5px",
                cursor: "pointer",
              }}
            >
              Fermer
            </button>
          </div>
          {showVictoryLocal && (
            <div className="victory-overlay" role="dialog" aria-modal="true">
              <div className="victory-card" style={{ textShadow: 'none', filter: 'none' }}>
                <h2 style={{ textShadow: 'none', filter: 'none' }}>🎉 Succès !</h2>
                <p style={{ textShadow: 'none', filter: 'none' }}>Épreuve validée — bravo !</p>
                <div style={{display:'flex', gap:8, marginTop:12}}>
                  <button onClick={() => setShowVictoryLocal(false)} className="puzzle-action-btn">Fermer</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
