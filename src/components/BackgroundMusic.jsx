import React, { useRef, useState, useEffect } from "react";

export default function BackgroundMusic({ src, defaultVolume = 0.2 }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(defaultVolume);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {
        // Sur mobile, autoplay peut échouer
        console.log("Lecture requiert une interaction utilisateur");
      });
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div style={{
      position: "fixed",
      bottom: 20,
      left: 20,
      background: "rgba(0,0,0,0.7)",
      color: "#00ff66",
      padding: "10px 14px",
      borderRadius: "10px",
      fontFamily: "monospace",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      gap: "10px",
    }}>
      <audio ref={audioRef} src={src} autoPlay loop />
      <button
        onClick={togglePlay}
        style={{
          background: "#00ff66",
          color: "#000",
          border: "none",
          borderRadius: 6,
          padding: "4px 8px",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        {isPlaying ? "Pause" : "Play"}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => setVolume(parseFloat(e.target.value))}
        style={{ cursor: "pointer" }}
      />
    </div>
  );
}
