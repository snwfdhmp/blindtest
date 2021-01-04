import React, { useState, useEffect } from "react";

export default function Lobby() {
  const [users, setUsers] = useState([
    { name: "Martin" },
    { name: "Léandre" },
    { name: "Rémi" },
    { name: "Ursula" },
  ]);

  return (
    <div>
      <div>
        <h3>Players</h3>
        {users.map((user) => (
          <div>- {user.name}</div>
        ))}
        <br />
        <div>Invite link: ###</div>
      </div>
      <div>
        <h3>Next game settings</h3>
        <div>
          Playlist:{" "}
          <input
            type="text"
            placeholder="https://spotify.com/playlist/UAZ4368842"
          />
        </div>
        <div>
          Number of musics:{" "}
          <input type="number" placeholder="30" defaultValue={30} />
        </div>
        <br></br>
        <button>Start game</button>
      </div>
    </div>
  );
}
