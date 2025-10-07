import React, { useState } from "react";
import "../style.css";

const IMAGE_SRC = "ImageEnigmes/Oscilloscope.png";

const QUESTIONS = [
  {
    question: "Première question, quelle est la mesure maximum des volt ?",
    validate: (val) => {
      const num = Number(val);
      return num >= 200 && num <= 250;
    }
  },
  {
    question: "Quelle est sa valeur minimale ?",
    validate: (val) => {
      const num = Number(val);
      return num >= -300 && num <= -225;
    }
  },
  {
    question: "Quelle est la fréquence du signal représenté sur le graphique ?",
    validate: (val) => {
      const num = Number(val);
      return num >= 45 && num <= 55;
    },
    hasHint: true
  }
];

export default function Grainotheque() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [response, setResponse] = useState("");
  const [validated, setValidated] = useState(false);
  const [error, setError] = useState("");
  const [showHint, setShowHint] = useState(false);

  // N'accepte que les chiffres et le signe moins
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
      setCurrentQuestion(currentQuestion + 1);
      setResponse("");
    } else {
      setValidated(true);
    }
  };

  const handleHint = () => {
    setShowHint(true);
  };
  const closeHint = () => {
    setShowHint(false);
  };

  return (
    <div className="salle-grainotheque" style={{ textAlign: "center", padding: "2rem" }}>
      <h2>Bienvenue dans la Grainothèque</h2>
      <div className="image-frame">
        <img src={IMAGE_SRC} alt="Oscilloscope" style={{ maxWidth: "400px", width: "100%", display: "block" }} />
      </div>
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
                style={{ marginLeft: "10px", verticalAlign: "middle", background: "#0b0b0b", border: "2px solid #ffee00", borderRadius: "50%", width: "36px", height: "36px", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 8px #ffee00", cursor: "pointer" }}
                title="Indice"
              >
                <span role="img" aria-label="ampoule" style={{ fontSize: "1.3em", color: "#ffee00" }}>💡</span>
              </button>
            )}
            <br />
            <button onClick={handleValidate} style={{ padding: "0.7rem 2rem", marginTop: "1rem" }}>
              Valider
            </button>
            {error && <div style={{ color: "red", marginTop: "1rem" }}>{error}</div>}
            {showHint && (
              <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
                <div style={{ background: "#222", color: "#00ff66", padding: "2rem", borderRadius: "12px", boxShadow: "0 0 20px #ffee00", maxWidth: "350px", textAlign: "center" }}>
                  <div style={{ fontSize: "1.5em", marginBottom: "1em" }}>Indice</div>
                  <div style={{ marginBottom: "1em" }}>
                    T = 1 / f avec T = Période du cycle (en secondes, s)<br /><br />F = fréquence du signal (en hertz, Hz)
                  </div>
                  <button onClick={closeHint} style={{ padding: "0.5rem 1.5rem", background: "#0b0b0b", border: "2px solid #ffee00", color: "#ffee00", borderRadius: "5px", cursor: "pointer" }}>Fermer</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: "green", marginTop: "1rem", fontSize: "1.3em" }}>
            Bravo, épreuve validée !
          </div>
        )}
      </div>
    </div>
  );
}
