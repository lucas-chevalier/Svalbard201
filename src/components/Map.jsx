import React from "react";

export default function Map() {
  return (
    <div className="map-container fallout-terminal">
      <h2>📡 Plan du complexe Svalbard201</h2>
      <div className="map-grid">
        <div className="room control">Salle de contrôle</div>
        <div className="room survival">Système de survie</div>
        <div className="room storage">Débarras</div>
        <div className="room biosphere">Biosphère</div>
        <div className="room seedbank">Grainothèque</div>
        <div className="room power">Centrale électrique</div>
        <div className="room water">Salle de traitement (eau)</div>
      </div>
    </div>
  );
}
// src/components/Map.jsx