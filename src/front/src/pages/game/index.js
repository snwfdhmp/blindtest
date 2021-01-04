import React from "react";
import { useParams } from "react-router-dom";

export default function Page({ gameId }) {
  const params = useParams();
  if (!gameId) gameId = params.id;
  if (!gameId) return <p>ERROR: Missing game ID.</p>;

  return (
    <div>
      <p>Game ID: {gameId}</p>
    </div>
  );
}
