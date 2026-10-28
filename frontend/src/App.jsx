import { useEffect, useState } from "react";
import {
  Images,
  FolderPlus,
  Search,
  ArrowLeft,
  Upload,
  X,
  Trash2,
  Tag,
  Check,
  LoaderCircle,
  Copy,
  Share2,
  Link2,
  ImagePlus,
  ShieldAlert,
  Pencil,
  ChevronDown,
} from "lucide-react";
import "./index.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const SERVER = API.replace(/\/api\/?$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || "Request failed.");
  }

  return data;
}

function getList(data, key) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data[key])) return data[key];
  return [];
}

function getPhotoDate(photo) {
  const value = photo.captured_at || photo.uploaded_at;
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function imageUrl(photo, sharedToken) {
  if (photo.thumbnail_url) {
    const url = photo.thumbnail_url;

    if (/^https?:\/\//i.test(url)) return url;
    return `${SERVER}${url.startsWith("/") ? url : `/${url}`}`;
  }

  if (sharedToken) {
    return `${API}/shared/${sharedToken}/photos/${photo.id}/thumbnail`;
  }

  return `${API}/photos/${photo.id}/thumbnail`;
}

function formatDate(photo) {
  const timestamp = getPhotoDate(photo);

  if (!timestamp) return "Date unavailable";

  return new Date(timestamp).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* Custom dropdown: avoids the browser's blue native option highlight. */
function SortDropdown({ sortOrder, setSortOrder }) {
  const [open, setOpen] = useState(false);

  const options = [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
  ];

  const selected =
    options.find((option) => option.value === sortOrder) || options[0];

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <div className="custom-sort">
      <span className="sort-label">Sort by</span>

      <div className="sort-dropdown">
        <button
          type="button"
          className="sort-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <span>{selected.label}</span>
          <ChevronDown
            size={17}
            className={open ? "sort-chevron open" : "sort-chevron"}
          />
        </button>

        {open && (
          <>
            <button
              type="button"
              className="sort-dismiss"
              aria-label="Close sorting menu"
              onClick={() => setOpen(false)}
            />

            <div className="sort-menu" role="listbox" aria-label="Sort photos">
              {options.map((option) => {
                const isSelected = sortOrder === option.value;

                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    key={option.value}
                    className={
                      isSelected ? "sort-option selected" : "sort-option"
                    }
                    onClick={() => {
                      setSortOrder(option.value);
                      setOpen(false);
                    }}
                  >
                    <span>{option.label}</span>
                    {isSelected && <Check size={16} />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function App() {
  const [albums, setAlbums] = useState([]);
  const [activeAlbum, setActiveAlbum] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [albumCovers, setAlbumCovers] = useState({});

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sharing, setSharing] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");

  const [showAlbumForm, setShowAlbumForm] = useState(false);
  const [albumName, setAlbumName] = useState("");
  const [albumDescription, setAlbumDescription] = useState("");

  const [showRenameForm, setShowRenameForm] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [tagText, setTagText] = useState("");

  const [shareUrl, setShareUrl] = useState("");
  const [shareToken, setShareToken] = useState("");
  const [showSharePanel, setShowSharePanel] = useState(false);

  const [sharedAlbum, setSharedAlbum] = useState(null);
  const [sharedPhotos, setSharedPhotos] = useState([]);
  const [sharedUnavailable, setSharedUnavailable] = useState(false);

  const path = window.location.pathname;
  const sharedMatch = path.match(/^\/shared\/([^/]+)\/?$/);
  const sharedToken = sharedMatch ? sharedMatch[1] : null;
  const isSharedPage = Boolean(sharedToken);

  const sortedPhotos = [...photos].sort((a, b) => {
    const difference = getPhotoDate(a) - getPhotoDate(b);
    return sortOrder === "oldest" ? difference : -difference;
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);
    setError("");

    try {
      if (isSharedPage) {
        await loadSharedAlbum();
      } else {
        await loadAlbums();
      }
    } catch (err) {
      setError(err.message || "Unable to load Stillroom.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAlbums() {
    const data = await request("/albums");
    const list = getList(data, "albums");
    setAlbums(list);

    const covers = {};

    await Promise.all(
      list.map(async (album) => {
        try {
          const result = await request(`/albums/${album.id}/photos`);
          const photoList = getList(result, "photos");

          const cover = photoList.find(
            (photo) => String(photo.id) === String(album.cover_photo_id),
          );

          if (cover) covers[album.id] = cover;
        } catch {
          // One album's cover should not prevent other albums from loading.
        }
      }),
    );

    setAlbumCovers(covers);
  }

  async function loadSharedAlbum() {
    try {
      const data = await request(`/shared/${sharedToken}`);
      const album = data.album || data.sharedAlbum || data;
      const list = getList(data, "photos");

      setSharedAlbum(album);
      setSharedPhotos(list);
      setSharedUnavailable(false);
    } catch {
      setSharedUnavailable(true);
      setSharedAlbum(null);
      setSharedPhotos([]);
    }
  }

  async function openAlbum(album) {
    setLoading(true);
    setError("");
    setNotice("");
    setSearch("");
    setTagFilter("");
    setShowSharePanel(false);
    setShareUrl("");
    setShareToken("");

    try {
      const data = await request(`/albums/${album.id}/photos`);
      setActiveAlbum(album);
      setPhotos(getList(data, "photos"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshActiveAlbum() {
    if (!activeAlbum) return;

    const data = await request(`/albums/${activeAlbum.id}/photos`);
    setPhotos(getList(data, "photos"));
  }

  function backToLibrary() {
    setActiveAlbum(null);
    setPhotos([]);
    setSelectedPhoto(null);
    setShowSharePanel(false);
    setShareUrl("");
    setShareToken("");
    setSearch("");
    setTagFilter("");
    setError("");
    setNotice("");
    loadAlbums().catch((err) => setError(err.message));
  }

  async function createAlbum(event) {
    event.preventDefault();

    if (!albumName.trim()) {
      setError("Please enter an album name.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      await request("/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: albumName.trim(),
          description: albumDescription.trim(),
        }),
      });

      setAlbumName("");
      setAlbumDescription("");
      setShowAlbumForm(false);
      setNotice("Album created successfully.");
      await loadAlbums();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function startRename(album) {
    setRenameValue(album.name || "");
    setShowRenameForm(true);
    setError("");
  }

  async function renameAlbum(event) {
    event.preventDefault();

    if (!activeAlbum || !renameValue.trim()) {
      setError("Please enter an album name.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const result = await request(`/albums/${activeAlbum.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });

      const updated = result.album || {
        ...activeAlbum,
        name: renameValue.trim(),
      };

      setActiveAlbum(updated);
      setShowRenameForm(false);
      setNotice("Album renamed successfully.");
      await loadAlbums();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteAlbum(album) {
    const confirmed = window.confirm(
      `Delete "${album.name}" and its photos? This cannot be undone.`,
    );

    if (!confirmed) return;

    setBusy(true);
    setError("");

    try {
      await request(`/albums/${album.id}`, { method: "DELETE" });

      if (activeAlbum && String(activeAlbum.id) === String(album.id)) {
        setActiveAlbum(null);
        setPhotos([]);
      }

      setNotice("Album deleted.");
      await loadAlbums();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhotos(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (!files.length || !activeAlbum) return;

    if (files.length > 10) {
      setError("Please upload no more than 10 photos at a time.");
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("photos", file));

    setUploading(true);
    setError("");

    try {
      await request(`/albums/${activeAlbum.id}/photos`, {
        method: "POST",
        body: formData,
      });

      setNotice(`${files.length} photo(s) uploaded.`);
      await refreshActiveAlbum();
      await loadAlbums();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function saveTags() {
    if (!selectedPhoto) return;

    const tags = [
      ...new Set(
        tagText
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    ];

    setBusy(true);
    setError("");

    try {
      await request(`/photos/${selectedPhoto.id}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });

      setNotice("Photo tags saved.");
      setSelectedPhoto(null);
      await refreshActiveAlbum();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function setCover(photo) {
    if (!activeAlbum) return;

    setBusy(true);
    setError("");

    try {
      await request(`/albums/${activeAlbum.id}/cover`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_id: photo.id }),
      });

      setNotice("Album cover updated.");
      await loadAlbums();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deletePhoto(photo) {
    if (!window.confirm("Delete this photo?")) return;

    setBusy(true);
    setError("");

    try {
      await request(`/photos/${photo.id}`, { method: "DELETE" });

      setSelectedPhoto(null);
      setNotice("Photo deleted.");
      await refreshActiveAlbum();
      await loadAlbums();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function filterByTags(event) {
    event.preventDefault();

    if (!tagFilter.trim()) {
      await refreshActiveAlbum();
      return;
    }

    setLoading(true);
    setError("");

    try {
      const query = encodeURIComponent(
        tagFilter
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
          .join(","),
      );

      const data = await request(`/photos/search?tags=${query}`);
      const results = getList(data, "photos");

      setPhotos(
        results.filter(
          (photo) => String(photo.album_id) === String(activeAlbum?.id),
        ),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function createShareLink() {
    if (!activeAlbum) return;

    setSharing(true);
    setError("");

    try {
      const data = await request(`/albums/${activeAlbum.id}/share`, {
        method: "POST",
      });

      const token = data.token || data.share?.token;
      const url =
        data.share_url ||
        data.shareUrl ||
        (token ? `${window.location.origin}/shared/${token}` : "");

      if (!url) {
        throw new Error("The server did not return a share link.");
      }

      setShareUrl(url);
      setShareToken(token || "");
      setShowSharePanel(true);
      setNotice("Share link created.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSharing(false);
    }
  }

  async function copyShareLink() {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotice("Share link copied.");
    } catch {
      setError("Copy failed. Please select and copy the link manually.");
    }
  }

  async function revokeShareLink() {
    if (!activeAlbum) return;

    if (!window.confirm("Revoke this share link?")) return;

    setSharing(true);
    setError("");

    try {
      await request(`/albums/${activeAlbum.id}/share`, {
        method: "DELETE",
      });

      setShareUrl("");
      setShareToken("");
      setShowSharePanel(false);
      setNotice("Share link revoked.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSharing(false);
    }
  }

  function openPhoto(photo) {
    setSelectedPhoto(photo);

    const tags = Array.isArray(photo.tags)
      ? photo.tags
          .map((tag) => (typeof tag === "string" ? tag : tag.name))
          .filter(Boolean)
      : [];

    setTagText(tags.join(", "));
    setError("");
  }

  const filteredAlbums = albums.filter((album) => {
    const query = search.toLowerCase();

    return (
      (album.name || "").toLowerCase().includes(query) ||
      (album.description || "").toLowerCase().includes(query)
    );
  });

  if (isSharedPage) {
    return (
      <div className="app-shell">
        <main className="main-area" style={{ marginLeft: 0 }}>
          <header className="topbar">
            <button className="brand" type="button">
              <span className="brand-mark">
                <Images size={20} />
              </span>
              <span>
                Stillroom
                <small>PHOTOGRAPHY, PRESERVED</small>
              </span>
            </button>
            <span className="topbar-right">
              <Link2 size={14} /> Shared album
            </span>
          </header>

          <div className="page-content">
            {loading ? (
              <div className="loading">
                <LoaderCircle className="spin" size={20} />
                Loading shared album...
              </div>
            ) : sharedUnavailable ? (
              <div className="empty-state">
                <ShieldAlert size={34} />
                <h3>This shared album is unavailable</h3>
                <p>The link may have expired or been revoked.</p>
              </div>
            ) : (
              <>
                <div className="page-heading">
                  <span className="eyebrow">SHARED COLLECTION</span>
                  <h1>{sharedAlbum?.name || "Shared album"}</h1>
                  <p>
                    {sharedAlbum?.description ||
                      "A collection of memories shared with you."}
                  </p>
                  <span className="muted-meta">
                    {sharedPhotos.length} photos · Read only
                  </span>
                </div>

                {sharedPhotos.length ? (
                  <div className="photo-grid">
                    {sharedPhotos.map((photo) => (
                      <div className="photo-card" key={photo.id}>
                        <img
                          src={imageUrl(photo, sharedToken)}
                          alt={photo.original_name || "Shared photo"}
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <Images size={34} />
                    <h3>No photos in this album</h3>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" type="button" onClick={backToLibrary}>
          <span className="brand-mark">
            <Images size={21} />
          </span>
          <span>
            Stillroom
            <small>PHOTOGRAPHY, PRESERVED</small>
          </span>
        </button>

        <div className="side-label">LIBRARY</div>

        <button
          type="button"
          className={!activeAlbum ? "nav-item active" : "nav-item"}
          onClick={backToLibrary}
        >
          <Images size={17} />
          All collections
        </button>

        <div className="sidebar-bottom">
          <div className="sidebar-note">
            Every photograph holds
            <br />a little piece of time.
          </div>
          <div className="sidebar-foot">YOUR PERSONAL PHOTO LIBRARY</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Library</span>
            {activeAlbum && (
              <>
                <span className="crumb-separator">/</span>
                <strong>{activeAlbum.name}</strong>
              </>
            )}
          </div>

          <div className="topbar-right">
            <span className="status-dot" />
            Your private collection
          </div>
        </header>

        <div className="page-content">
          {error && (
            <div className="message error-message">
              <ShieldAlert size={17} />
              <span>{error}</span>
              <button
                type="button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {notice && (
            <div className="message success-message">
              <Check size={17} />
              <span>{notice}</span>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {loading ? (
            <div className="loading">
              <LoaderCircle size={20} className="spin" />
              Loading your collection...
            </div>
          ) : activeAlbum ? (
            <>
              <button
                className="back-link"
                type="button"
                onClick={backToLibrary}
              >
                <ArrowLeft size={15} />
                Back to collections
              </button>

              <div className="album-heading">
                <div className="page-heading">
                  <span className="eyebrow">YOUR COLLECTION</span>
                  <h1>{activeAlbum.name}</h1>
                  <p>
                    {activeAlbum.description ||
                      "Your moments, gathered in one place."}
                  </p>
                  <span className="muted-meta">{photos.length} photos</span>
                </div>

                <div className="album-actions">
                  <label className="primary-button upload-button">
                    {uploading ? (
                      <LoaderCircle size={15} className="spin" />
                    ) : (
                      <Upload size={15} />
                    )}
                    {uploading ? "Uploading..." : "Upload photos"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      hidden
                      disabled={uploading}
                      onChange={uploadPhotos}
                    />
                  </label>

                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => startRename(activeAlbum)}
                  >
                    <Pencil size={15} />
                    Rename
                  </button>

                  <button
                    className="secondary-button"
                    type="button"
                    onClick={createShareLink}
                    disabled={sharing}
                  >
                    <Share2 size={15} />
                    Share
                  </button>

                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => deleteAlbum(activeAlbum)}
                    disabled={busy}
                  >
                    <Trash2 size={15} />
                    Delete
                  </button>
                </div>
              </div>

              {showSharePanel && (
                <div className="share-panel">
                  <div>
                    <strong>Share this collection</strong>
                    <p>Anyone with this link can view the shared album.</p>
                    <input
                      readOnly
                      aria-label="Share link"
                      value={shareUrl}
                      onFocus={(event) => event.target.select()}
                    />
                  </div>

                  <button
                    className="secondary-button"
                    type="button"
                    onClick={copyShareLink}
                  >
                    <Copy size={15} />
                    Copy link
                  </button>

                  <button
                    className="secondary-button"
                    type="button"
                    disabled={sharing}
                    onClick={revokeShareLink}
                  >
                    <X size={15} />
                    Revoke link
                  </button>
                </div>
              )}

              <form className="filter-bar" onSubmit={filterByTags}>
                <label className="search-box">
                  <Tag size={16} />
                  <input
                    value={tagFilter}
                    onChange={(event) => setTagFilter(event.target.value)}
                    placeholder="Filter by tags, e.g. nature, travel"
                    aria-label="Filter photos by tags"
                  />
                </label>

                <button className="secondary-button" type="submit">
                  Apply filter
                </button>

                {tagFilter && (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={async () => {
                      setTagFilter("");
                      setLoading(true);
                      try {
                        await refreshActiveAlbum();
                      } catch (err) {
                        setError(err.message);
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    Clear
                  </button>
                )}

                <SortDropdown
                  sortOrder={sortOrder}
                  setSortOrder={setSortOrder}
                />
              </form>

              {sortedPhotos.length ? (
                <div className="photo-grid">
                  {sortedPhotos.map((photo) => (
                    <button
                      className="photo-card"
                      type="button"
                      key={photo.id}
                      onClick={() => openPhoto(photo)}
                    >
                      <img
                        src={imageUrl(photo)}
                        alt={photo.original_name || "Photo"}
                        loading="lazy"
                      />

                      {Array.isArray(photo.tags) && photo.tags.length > 0 && (
                        <span className="photo-tag-count">
                          <Tag size={11} />
                          {photo.tags.length}
                        </span>
                      )}

                      <span className="photo-overlay">
                        <span>{photo.original_name || "Untitled photo"}</span>
                        <span className="photo-open">↗</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <ImagePlus size={36} />
                  <h3>
                    {tagFilter
                      ? "No matching photos"
                      : "This album is waiting for memories"}
                  </h3>
                  <p>
                    {tagFilter
                      ? "Try different tags or clear the filter."
                      : "Upload a few photos to get started."}
                  </p>

                  {!tagFilter && (
                    <label className="primary-button upload-button">
                      <Upload size={15} />
                      Upload photos
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        hidden
                        onChange={uploadPhotos}
                      />
                    </label>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <section className="welcome-panel">
                <div className="welcome-copy">
                  <span className="eyebrow">A PLACE FOR YOUR MEMORIES</span>
                  <h1>
                    Keep your moments
                    <br />
                    close.
                  </h1>
                  <p>
                    A quiet space for the photographs, people, and places you
                    want to remember.
                  </p>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => setShowAlbumForm(true)}
                  >
                    <FolderPlus size={16} />
                    Create a collection
                  </button>
                </div>

                <div className="welcome-art" aria-hidden="true">
                  <div className="art-photo art-photo-one">MOMENTS</div>
                  <div className="art-photo art-photo-two">MEMORIES</div>
                  <div className="art-caption">
                    Little things,
                    <br />
                    <em>lasting forever.</em>
                  </div>
                </div>
              </section>

              <section className="collection-section">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">YOUR PERSONAL ARCHIVE</span>
                    <h2>
                      Collections <span>{albums.length}</span>
                    </h2>
                  </div>

                  <label className="search-box album-search">
                    <Search size={16} />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search collections..."
                      aria-label="Search collections"
                    />
                  </label>
                </div>

                {filteredAlbums.length ? (
                  <div className="album-grid">
                    {filteredAlbums.map((album, index) => {
                      const cover = albumCovers[album.id];

                      return (
                        <article className="album-card" key={album.id}>
                          <button
                            className="album-card-open"
                            type="button"
                            onClick={() => openAlbum(album)}
                          >
                            <div className={`album-art album-art-${index % 4}`}>
                              {cover ? (
                                <img
                                  src={imageUrl(cover)}
                                  alt=""
                                  loading="lazy"
                                />
                              ) : (
                                <div className="cover-placeholder">
                                  <Images size={30} />
                                  <span>STILLROOM</span>
                                </div>
                              )}

                              <span className="album-count">
                                {album.photo_count ?? " "} photos
                              </span>
                            </div>

                            <div className="album-info">
                              <div>
                                <h3>{album.name}</h3>
                                <p>
                                  {album.description ||
                                    "A collection of moments"}
                                </p>
                              </div>
                              <span className="album-arrow">↗</span>
                            </div>
                          </button>

                          <div className="album-card-actions">
                            <button
                              type="button"
                              className="icon-button"
                              title="Open and rename album"
                              aria-label={`Rename ${album.name}`}
                              onClick={() => {
                                setActiveAlbum(album);
                                startRename(album);
                              }}
                            >
                              <Pencil size={15} />
                            </button>

                            <button
                              type="button"
                              className="icon-button"
                              title="Delete album"
                              aria-label={`Delete ${album.name}`}
                              onClick={() => deleteAlbum(album)}
                              disabled={busy}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </article>
                      );
                    })}

                    <button
                      type="button"
                      className="new-album-card"
                      onClick={() => setShowAlbumForm(true)}
                    >
                      <span>
                        <FolderPlus size={22} />
                      </span>
                      <strong>Create a new collection</strong>
                      <small>A new home for your photographs</small>
                    </button>
                  </div>
                ) : (
                  <div className="empty-state">
                    <Images size={36} />
                    <h3>
                      {search
                        ? "No collections found"
                        : "Your story starts here"}
                    </h3>
                    <p>
                      {search
                        ? "Try another search."
                        : "Create your first collection and add your photos."}
                    </p>
                    {!search && (
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => setShowAlbumForm(true)}
                      >
                        <FolderPlus size={15} />
                        Create collection
                      </button>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      {showAlbumForm && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowAlbumForm(false);
            }
          }}
        >
          <form className="modal" onSubmit={createAlbum}>
            <button
              type="button"
              className="modal-close"
              aria-label="Close"
              onClick={() => setShowAlbumForm(false)}
            >
              <X size={18} />
            </button>

            <span className="eyebrow">MAKE SOME ROOM</span>
            <h2>New collection</h2>
            <p>Give this set of memories a name.</p>

            <label className="field-label">
              Collection name
              <input
                autoFocus
                required
                maxLength={100}
                value={albumName}
                onChange={(event) => setAlbumName(event.target.value)}
                placeholder="e.g. Weekend escapes"
              />
            </label>

            <label className="field-label">
              Description <span>OPTIONAL</span>
              <textarea
                rows={3}
                maxLength={500}
                value={albumDescription}
                onChange={(event) => setAlbumDescription(event.target.value)}
                placeholder="A few words about these memories..."
              />
            </label>

            <button
              className="primary-button full-button"
              type="submit"
              disabled={busy}
            >
              {busy ? "Creating..." : "Create collection"}
            </button>
          </form>
        </div>
      )}

      {showRenameForm && activeAlbum && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={renameAlbum}>
            <button
              type="button"
              className="modal-close"
              aria-label="Close"
              onClick={() => setShowRenameForm(false)}
            >
              <X size={18} />
            </button>

            <span className="eyebrow">COLLECTION SETTINGS</span>
            <h2>Rename collection</h2>
            <p>Choose a name that feels right.</p>

            <label className="field-label">
              Collection name
              <input
                autoFocus
                required
                maxLength={100}
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
              />
            </label>

            <button
              className="primary-button full-button"
              type="submit"
              disabled={busy}
            >
              {busy ? "Saving..." : "Save changes"}
            </button>
          </form>
        </div>
      )}

      {selectedPhoto && activeAlbum && (
        <div
          className="modal-backdrop photo-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedPhoto(null);
            }
          }}
        >
          <div className="photo-modal">
            <button
              type="button"
              className="modal-close photo-close"
              aria-label="Close photo"
              onClick={() => setSelectedPhoto(null)}
            >
              <X size={18} />
            </button>

            <img
              className="large-photo"
              src={imageUrl(selectedPhoto)}
              alt={selectedPhoto.original_name || "Photo"}
            />

            <div className="photo-details">
              <span className="eyebrow">PHOTO DETAILS</span>
              <h2>{selectedPhoto.original_name || "Untitled photo"}</h2>
              <p className="photo-date">{formatDate(selectedPhoto)}</p>

              <label className="field-label">
                Tags
                <span>SEPARATE TAGS WITH COMMAS</span>
                <input
                  value={tagText}
                  onChange={(event) => setTagText(event.target.value)}
                  placeholder="nature, family, travel"
                />
              </label>

              <button
                type="button"
                className="primary-button full-button"
                onClick={saveTags}
                disabled={busy}
              >
                <Tag size={15} />
                {busy ? "Saving..." : "Save tags"}
              </button>

              <button
                type="button"
                className="secondary-button full-button"
                onClick={() => setCover(selectedPhoto)}
                disabled={busy}
              >
                <ImagePlus size={15} />
                Set as album cover
              </button>

              <button
                type="button"
                className="delete-button"
                onClick={() => deletePhoto(selectedPhoto)}
                disabled={busy}
              >
                <Trash2 size={15} />
                Delete photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
