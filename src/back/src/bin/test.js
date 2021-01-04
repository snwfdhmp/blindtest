var SpotifyWebApi = require("spotify-web-api-node");

// credentials are optional
var spotifyApi = new SpotifyWebApi({
  clientId: "5f1b134b26494209a4a0e02f4d7d868a",
  clientSecret: "47a60f1f7edc425cb22acaa54a98bdaf",
  redirectUri: "https://localhost:3000/callback",
});

spotifyApi.setAccessToken(
  "BQCewY3WAfYQrsSEOmW57BlHoUinFTE3yRPcSgMQwl5O4MQdIbNZNLTlWGG0anarKSH4tyKihrmx-WUL5SzAfcEZf2d9uk9Ph0gGBYrQVLDuJk3HMLWZdqtMIy_JXtyeezfKZBqT-Oi9"
);

const main = async () => {
  spotifyApi.getUserPlaylists({ limit: 3 }, (err, data) => {
    if (err) {
      console.log({ err });
      return;
    }
    data.body.items.forEach((playlist) => {
      spotifyApi.getPlaylistTracks(playlist.id, { limit: 5 }).then((data) => {
        data.body.items.forEach((track) => {
          console.log({ track: track.track.name });
        });
      });
    });
  });
};

main();
