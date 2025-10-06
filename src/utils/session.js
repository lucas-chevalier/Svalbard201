// src/utils/session.js
import { v4 as uuidv4 } from "uuid";

export function makeSessionCode() {
  // code lisible: GV + 4 chiffres
  const n = Math.floor(1000 + Math.random() * 9000);
  return `GV${n}`;
}

export function makePlayerId() {
  return uuidv4();
}
