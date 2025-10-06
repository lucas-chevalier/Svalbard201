import React, { useRef, useEffect, useState } from "react";
import spriteSrc from "./bluerpipe-sheet.png"; // importe la spritesheet

export default function PuzzleWater({ size = 10 }) {
  const canvasRef = useRef(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [img] = useState(() => new Image());

  const [grid, setGrid] = useState([]);
  const TILE = 64;

  useEffect(() => {
    img.src = spriteSrc;
    img.onload = () => setImgLoaded(true);
  }, [img]);

  useEffect(() => {
    if (!imgLoaded) return;

    // Génération d'une grille simple pour test
    const newGrid = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => ({
        base: "straight",
        rot: Math.floor(Math.random() * 4),
      }))
    );
    setGrid(newGrid);
  }, [imgLoaded, size]);

  useEffect(() => {
    if (!imgLoaded || !grid.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const cellPix = Math.floor(canvas.width / size);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    grid.forEach((row, y) => {
      row.forEach((cell, x) => {
        const px = x * cellPix;
        const py = y * cellPix;

        // Fond
        ctx.fillStyle = "#0a1130";
        ctx.fillRect(px, py, cellPix, cellPix);
        ctx.strokeStyle = "#17204a";
        ctx.strokeRect(px + 0.5, py + 0.5, cellPix - 1, cellPix - 1);

        // Sprite
        const spriteCoords = getSpriteRect(cell.base);
        ctx.save();
        ctx.translate(px + cellPix / 2, py + cellPix / 2);
        ctx.rotate((cell.rot % 4) * Math.PI / 2);
        ctx.drawImage(
          img,
          spriteCoords.sx,
          spriteCoords.sy,
          TILE,
          TILE,
          -cellPix / 2,
          -cellPix / 2,
          cellPix,
          cellPix
        );
        ctx.restore();
      });
    });
  }, [imgLoaded, grid, size, img]);

  const getSpriteRect = (base) => {
    const TILEMAP = {
      straight: { col: 6, row: 6 },
      corner: { col: 7, row: 6 },
      tee: { col: 8, row: 6 },
      cross: { col: 6, row: 7 },
      cap: { col: 7, row: 7 },
      source: { col: 8, row: 7 },
      sink: { col: 6, row: 8 },
      blank: { col: 7, row: 8 },
    };
    const entry = TILEMAP[base] || TILEMAP.blank;
    return { sx: entry.col * TILE, sy: entry.row * TILE };
  };

  return <canvas ref={canvasRef} width={600} height={600} />;
}
