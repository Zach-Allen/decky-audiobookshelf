import {
  ButtonItem,
  DialogButton,
  Focusable,
  PanelSection,
  PanelSectionRow,
  SliderField,
  TextField,
  ToggleField,
  staticClasses,
} from "@decky/ui";
import { callable, definePlugin, toaster } from "@decky/api";
import { useCallback, useEffect, useState } from "react";
import {
  FaBookOpen,
  FaCog,
  FaPause,
  FaPlay,
  FaSearch,
  FaStepBackward,
  FaStepForward,
} from "react-icons/fa";

interface Library {
  id: string;
  name: string;
  mediaType: string;
}

interface Book {
  id: string;
  title: string;
  author: string;
  duration: number;
  currentTime: number;
  progress: number;
}

interface Chapter {
  id?: number;
  title?: string;
  start: number;
  end?: number;
}

interface Playback {
  available: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  position: number;
  duration: number;
  speed: number;
  session: null | {
    id: string;
    libraryItemId: string;
    title: string;
    author: string;
  };
  chapter: Chapter | null;
  chapterIndex: number;
}

interface PluginState {
  configured: boolean;
  serverUrl: string;
  username: string;
  verifyTls: boolean;
  error: string;
  playback: Playback;
}

type View = "home" | "library" | "search" | "settings";

const getState = callable<[], PluginState>("get_state");
const configure = callable<
  [serverUrl: string, username: string, password: string, verifyTls: boolean],
  { success: boolean; libraries: Library[] }
>("configure");
const logout = callable<[], { success: boolean }>("logout");
const getLibraries = callable<[], Library[]>("get_libraries");
const getContinueListening = callable<[libraryId: string], Book[]>("get_continue_listening");
const browseLibrary = callable<
  [libraryId: string, page: number, limit: number],
  { items: Book[]; total: number; page: number }
>("browse_library");
const searchLibrary = callable<[libraryId: string, query: string], Book[]>("search");
const getCover = callable<[itemId: string], string>("get_cover");
const playItem = callable<[itemId: string], Playback>("play_item");
const togglePlayPause = callable<[], Playback>("toggle_play_pause");
const seekRelative = callable<[seconds: number], Playback>("seek_relative");
const previousChapter = callable<[], Playback>("previous_chapter");
const nextChapter = callable<[], Playback>("next_chapter");
const setSpeed = callable<[speed: number], Playback>("set_speed");

const colors = {
  surface: "#17191d",
  raised: "#22252b",
  accent: "#f59e0b",
  text: "#f5f5f4",
  muted: "#a8a29e",
  error: "#fca5a5",
};

function formatTime(value: number): string {
  const seconds = Math.max(0, Math.floor(value || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`
    : `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function Setup({ initial, onConnected }: { initial: PluginState; onConnected: () => void }) {
  const [serverUrl, setServerUrl] = useState(initial.serverUrl || "http://");
  const [username, setUsername] = useState(initial.username || "");
  const [password, setPassword] = useState("");
  const [verifyTls, setVerifyTls] = useState(initial.verifyTls);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initial.error);

  const connect = async () => {
    setBusy(true);
    setError("");
    try {
      await configure(serverUrl, username, password, verifyTls);
      onConnected();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelSection title="Connect to Audiobookshelf">
      <PanelSectionRow>
        <TextField
          label="Server address"
          description="Include http:// or https:// and the port, if needed."
          value={serverUrl}
          onChange={(event) => setServerUrl(event.target.value)}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <TextField label="Username" value={username} onChange={(event) => setUsername(event.target.value)} />
      </PanelSectionRow>
      <PanelSectionRow>
        <TextField label="Password" value={password} bIsPassword onChange={(event) => setPassword(event.target.value)} />
      </PanelSectionRow>
      <PanelSectionRow>
        <ToggleField
          label="Verify HTTPS certificate"
          description="Disable only for a trusted self-signed server."
          checked={verifyTls}
          onChange={setVerifyTls}
        />
      </PanelSectionRow>
      {error && <div style={{ color: colors.error, padding: "8px 0" }}>{error}</div>}
      <PanelSectionRow>
        <ButtonItem layout="below" disabled={busy || !serverUrl || !username} onClick={connect}>
          {busy ? "Connecting…" : "Sign in"}
        </ButtonItem>
      </PanelSectionRow>
    </PanelSection>
  );
}

function Player({ playback, cover, run }: { playback: Playback; cover: string; run: (action: () => Promise<Playback>) => void }) {
  if (!playback.session) {
    return (
      <PanelSection title="Now Playing">
        <div style={{ color: colors.muted, padding: "10px 0" }}>
          Pick a book below to start or resume playback.
        </div>
      </PanelSection>
    );
  }

  const progress = playback.duration ? Math.min(100, (playback.position / playback.duration) * 100) : 0;
  return (
    <PanelSection title="Now Playing">
      <div style={{ display: "flex", gap: 12, padding: "4px 0 10px" }}>
        <div
          style={{
            width: 84,
            height: 126,
            borderRadius: 8,
            background: colors.raised,
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          {cover && <img src={cover} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        </div>
        <div style={{ minWidth: 0, alignSelf: "center" }}>
          <div style={{ color: colors.text, fontSize: 17, fontWeight: 700 }}>{playback.session.title}</div>
          <div style={{ color: colors.muted, marginTop: 3 }}>{playback.session.author}</div>
          <div style={{ color: colors.accent, marginTop: 12, fontWeight: 600 }}>
            {playback.chapter?.title || `Chapter ${playback.chapterIndex + 1}`}
          </div>
        </div>
      </div>
      <div style={{ height: 5, background: "#393c43", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progress}%`, background: colors.accent }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", color: colors.muted, fontVariantNumeric: "tabular-nums", margin: "5px 0 10px" }}>
        <span>{formatTime(playback.position)}</span>
        <span>{formatTime(playback.duration)}</span>
      </div>
      <Focusable flow-children="horizontal" style={{ display: "flex", gap: 8 }}>
        <DialogButton onClick={() => run(() => seekRelative(-15))}>◀ 15s</DialogButton>
        <DialogButton onClick={() => run(togglePlayPause)}>
          {playback.isPlaying ? <><FaPause /> Pause</> : <><FaPlay /> Play</>}
        </DialogButton>
        <DialogButton onClick={() => run(() => seekRelative(15))}>15s ▶</DialogButton>
      </Focusable>
      <Focusable flow-children="horizontal" style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <DialogButton onClick={() => run(previousChapter)}><FaStepBackward /> Chapter</DialogButton>
        <DialogButton onClick={() => run(nextChapter)}>Chapter <FaStepForward /></DialogButton>
      </Focusable>
      <PanelSectionRow>
        <SliderField
          label="Playback speed"
          value={playback.speed}
          min={0.5}
          max={3}
          step={0.05}
          showValue
          valueSuffix="×"
          onChange={(value) => run(() => setSpeed(value))}
        />
      </PanelSectionRow>
    </PanelSection>
  );
}

function BookList({ title, books, onPlay }: { title: string; books: Book[]; onPlay: (book: Book) => void }) {
  return (
    <PanelSection title={title}>
      {books.length === 0 && <div style={{ color: colors.muted, padding: "8px 0" }}>No books found.</div>}
      {books.map((book) => (
        <PanelSectionRow key={book.id}>
          <ButtonItem
            layout="below"
            label={book.title}
            description={`${book.author || "Unknown author"}${book.currentTime ? ` • ${formatTime(book.currentTime)} listened` : ""}`}
            onClick={() => onPlay(book)}
          >
            Play
          </ButtonItem>
        </PanelSectionRow>
      ))}
    </PanelSection>
  );
}

function Content() {
  const [state, setState] = useState<PluginState | null>(null);
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [libraryId, setLibraryId] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [view, setView] = useState<View>("home");
  const [query, setQuery] = useState("");
  const [cover, setCover] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setState(await getState());
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 1000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!state?.configured) return;
    getLibraries()
      .then((result) => {
        setLibraries(result);
        if (!libraryId && result[0]) setLibraryId(result[0].id);
      })
      .catch((reason) => setError(errorMessage(reason)));
  }, [state?.configured]);

  useEffect(() => {
    const itemId = state?.playback.session?.libraryItemId;
    if (!itemId) {
      setCover("");
      return;
    }
    getCover(itemId).then(setCover).catch(() => setCover(""));
  }, [state?.playback.session?.libraryItemId]);

  const loadHome = useCallback(async () => {
    if (!libraryId) return;
    setBusy(true);
    try {
      setBooks(await getContinueListening(libraryId));
      setError("");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }, [libraryId]);

  useEffect(() => {
    if (view === "home") loadHome();
  }, [view, loadHome]);

  const runPlayback = async (action: () => Promise<Playback>) => {
    try {
      const playback = await action();
      setState((current) => current ? { ...current, playback } : current);
      setError("");
    } catch (reason) {
      const message = errorMessage(reason);
      setError(message);
      toaster.toast({ title: "Audiobookshelf", body: message });
    }
  };

  const play = (book: Book) => runPlayback(() => playItem(book.id));

  const openView = async (next: View) => {
    setView(next);
    setBooks([]);
    if (!libraryId) return;
    setBusy(true);
    try {
      if (next === "library") {
        setBooks((await browseLibrary(libraryId, 0, 24)).items);
      } else if (next === "home") {
        setBooks(await getContinueListening(libraryId));
      }
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const doSearch = async () => {
    if (!libraryId || !query.trim()) return;
    setBusy(true);
    try {
      setBooks(await searchLibrary(libraryId, query));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  if (!state) return <div style={{ padding: 16 }}>Loading Audiobookshelf…</div>;
  if (!state.configured) return <Setup initial={state} onConnected={refresh} />;

  return (
    <div style={{ background: colors.surface, minHeight: "100%" }}>
      <Player playback={state.playback} cover={cover} run={runPlayback} />
      {!state.playback.available && (
        <div style={{ color: colors.error, padding: "0 12px 8px" }}>
          Audio engine unavailable. Install a release that includes the bundled player.
        </div>
      )}
      {error && <div style={{ color: colors.error, padding: "0 12px 8px" }}>{error}</div>}
      <PanelSection title="Browse">
        {libraries.length > 1 && libraries.map((library) => (
          <PanelSectionRow key={library.id}>
            <ButtonItem layout="below" onClick={() => setLibraryId(library.id)}>
              {library.id === libraryId ? `✓ ${library.name}` : library.name}
            </ButtonItem>
          </PanelSectionRow>
        ))}
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={() => openView("home")}>Continue Listening</ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={() => openView("library")}>Library</ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={() => openView("search")}><FaSearch /> Search</ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={() => setView("settings")}><FaCog /> Settings</ButtonItem>
        </PanelSectionRow>
      </PanelSection>

      {view === "search" && (
        <PanelSection title="Search">
          <PanelSectionRow>
            <TextField label="Title, author, or series" value={query} onChange={(event) => setQuery(event.target.value)} />
          </PanelSectionRow>
          <PanelSectionRow>
            <ButtonItem layout="below" disabled={!query.trim() || busy} onClick={doSearch}>Search</ButtonItem>
          </PanelSectionRow>
        </PanelSection>
      )}

      {view === "settings" ? (
        <PanelSection title="Settings">
          <div style={{ color: colors.muted, padding: "8px 0" }}>{state.serverUrl}</div>
          <PanelSectionRow>
            <ButtonItem
              layout="below"
              onClick={async () => {
                await logout();
                await refresh();
              }}
            >
              Sign out
            </ButtonItem>
          </PanelSectionRow>
        </PanelSection>
      ) : (
        <BookList
          title={busy ? "Loading…" : view === "home" ? "Continue Listening" : view === "library" ? "Library" : "Results"}
          books={books}
          onPlay={play}
        />
      )}
    </div>
  );
}

export default definePlugin(() => ({
  name: "Audiobookshelf",
  titleView: <div className={staticClasses.Title}>Audiobookshelf</div>,
  content: <Content />,
  icon: <FaBookOpen />,
}));
