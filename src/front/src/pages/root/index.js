import React from "react";
import useAxios from "axios-hooks";

import Lobby from "../../components/organisms/OldLobby";

export default function Page() {
  return (
    <div>
      <h1>Lobby</h1>
      <Lobby />
      {/* <PlaylistList /> */}
      <TrackList playlistId={"6Nqy9X5VFl203IMoe38sMz"} />
      {/* <TrackPreview trackId={"4fixebDZAVToLbUCuEloa2"} /> */}
    </div>
  );
}

function TrackList({ playlistId }) {
  const [{ loading, data, error }, refetch] = useAxios({
    url: `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
    headers: {
      Authorization:
        "Bearer BQCewY3WAfYQrsSEOmW57BlHoUinFTE3yRPcSgMQwl5O4MQdIbNZNLTlWGG0anarKSH4tyKihrmx-WUL5SzAfcEZf2d9uk9Ph0gGBYrQVLDuJk3HMLWZdqtMIy_JXtyeezfKZBqT-Oi9",
    },
  });

  if (loading) return null;
  if (error) return <p>Error: {JSON.stringify(error.response.data.error)}</p>;
  if (!data) return <p>Uncatched error (but no data)</p>;

  return (
    <ul>
      {data.items.map((item) => (
        <li>
          {item.track.id}: {item.track.name}
        </li>
      ))}
    </ul>
  );
}
