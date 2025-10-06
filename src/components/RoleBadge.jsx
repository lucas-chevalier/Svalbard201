export default function RoleBadge({ player }) {
  return (
    <div className="role-badge">
      <span>{player.name}</span>
      <small>{player.isHost ? "Host" : "Player"}</small>
    </div>
  );
}
// src/components/RoleBadge.jsx