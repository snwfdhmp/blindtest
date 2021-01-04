import React from "react";
import { useParams } from "react-router-dom";
import { gql, useQuery } from "@apollo/client";

export default function Page() {
  const { loading, data, error } = useQuery(gql`
    query {
      topTracks {
        name
      }
    }
  `);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {JSON.stringify(error)}</p>;

  return (
    <div style={{ marginTop: "1rem" }}>
      <h1>Tracks </h1>
      <ul>
        {data &&
          data.topTracks &&
          data.topTracks.map((track) => <li>{track.name}</li>)}
      </ul>
    </div>
  );
}
