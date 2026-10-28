import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function App() {
  const [albums, setAlbums] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/albums`)
      .then((response) => {
        if (!response.ok) throw new Error("Could not load albums");
        return response.json();
      })
      .then((data) => setAlbums(data.albums ?? data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main
      style={{
        background: "#f5f2ec",
        color: "#252823",
        minHeight: "100vh",
        padding: "48px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>Stillroom</h1>
      <p>Your personal photo library</p>

      {loading && <p>Loading albums...</p>}
      {error && <p>Error: {error}</p>}

      {!loading &&
        !error &&
        albums.map((album) => (
          <section
            key={album.id}
            style={{
              background: "white",
              padding: "20px",
              borderRadius: "12px",
              maxWidth: "420px",
            }}
          >
            <h2>{album.name}</h2>
            <p>{album.description}</p>
            <p>{album.photo_count ?? 0} photos</p>
          </section>
        ))}
    </main>
  );
}
