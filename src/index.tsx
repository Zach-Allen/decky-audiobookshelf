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
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FaBookOpen,
  FaCog,
  FaPause,
  FaPlay,
  FaSearch,
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

interface Diagnostics {
  playerFound: boolean;
  playerRunning: boolean;
  playerExitCode: number | null;
  playerLogTail: string;
  playerError: string;
  pulseServer: string;
  pulseSocketExists: boolean;
  lastError: string;
}

type View = "menu" | "player" | "home" | "library" | "search" | "settings";

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
const getDiagnostics = callable<[], Diagnostics>("get_diagnostics");

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
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;
    for (const key of ["message", "error", "result"]) {
      if (value[key] && value[key] !== error) return errorMessage(value[key]);
    }
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown playback error";
    }
  }
  return String(error);
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
            width: 68,
            height: 102,
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
      <Focusable
        flow-children="horizontal"
        style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}
      >
        <DialogButton
          style={{ minWidth: 0, width: "100%", padding: "10px 2px", fontSize: 12 }}
          onClick={() => run(() => seekRelative(-15))}
        >
          ◀ 15s
        </DialogButton>
        <DialogButton
          style={{ minWidth: 0, width: "100%", padding: "10px 2px", fontSize: 12 }}
          onClick={() => run(togglePlayPause)}
        >
          {playback.isPlaying ? <><FaPause /> Pause</> : <><FaPlay /> Play</>}
        </DialogButton>
        <DialogButton
          style={{ minWidth: 0, width: "100%", padding: "10px 2px", fontSize: 12 }}
          onClick={() => run(() => seekRelative(15))}
        >
          15s ▶
        </DialogButton>
      </Focusable>
      <Focusable
        flow-children="horizontal"
        style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6, marginTop: 8 }}
      >
        <DialogButton
          style={{ minWidth: 0, width: "100%", padding: "10px 2px", fontSize: 12 }}
          onClick={() => run(previousChapter)}
        >
          ◀ Chapter
        </DialogButton>
        <DialogButton
          style={{ minWidth: 0, width: "100%", padding: "10px 2px", fontSize: 12 }}
          onClick={() => run(nextChapter)}
        >
          Chapter ▶
        </DialogButton>
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

function BookList({
  title,
  books,
  onPlay,
  startingBookId,
  failedBookId,
  playbackError,
}: {
  title: string;
  books: Book[];
  onPlay: (book: Book) => void;
  startingBookId: string;
  failedBookId: string;
  playbackError: string;
}) {
  return (
    <PanelSection title={title}>
      {books.length === 0 && <div style={{ color: colors.muted, padding: "8px 0" }}>No books found.</div>}
      {books.map((book) => (
        <PanelSectionRow key={book.id}>
          <ButtonItem
            layout="below"
            label={book.title}
            description={`${book.author || "Unknown author"}${book.currentTime ? ` • ${formatTime(book.currentTime)} listened` : ""}`}
            disabled={Boolean(startingBookId)}
            onClick={() => onPlay(book)}
          >
            {startingBookId === book.id ? "Starting…" : failedBookId === book.id ? "Retry" : "Play"}
          </ButtonItem>
          {failedBookId === book.id && playbackError && (
            <div style={{ color: colors.error, padding: "8px 4px 2px", overflowWrap: "anywhere" }}>
              Playback failed: {playbackError}
            </div>
          )}
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
  const [view, setView] = useState<View>("menu");
  const [returnView, setReturnView] = useState<View>("menu");
  const [query, setQuery] = useState("");
  const [cover, setCover] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [startingBookId, setStartingBookId] = useState("");
  const [failedBookId, setFailedBookId] = useState("");
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const initializedView = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const next = await getState();
      setState(next);
      if (!initializedView.current) {
        initializedView.current = true;
        if (next.playback.session) setView("player");
      }
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
        setLibraryId((current) => current || result[0]?.id || "");
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

  const runPlayback = async (action: () => Promise<Playback>): Promise<boolean> => {
    try {
      const playback = await action();
      setState((current) => current ? { ...current, playback } : current);
      setError("");
      return true;
    } catch (reason) {
      const message = errorMessage(reason);
      setError(message);
      toaster.toast({ title: "Audiobookshelf", body: message });
      return false;
    }
  };

  const play = async (book: Book) => {
    const sourceView = view;
    setStartingBookId(book.id);
    setFailedBookId("");
    setError("");
    const started = await runPlayback(() => playItem(book.id));
    setStartingBookId("");
    setFailedBookId(started ? "" : book.id);
    if (started) {
      setReturnView(sourceView);
      setView("player");
    }
  };

  const openView = async (next: View) => {
    setView(next);
    setFailedBookId("");
    setError("");
    if (next !== "home" && next !== "library") return;
    if (!libraryId) return;
    setBooks([]);
    setBusy(true);
    try {
      if (next === "library") {
        setBooks((await browseLibrary(libraryId, 0, 24)).items);
      } else if (next === "home") {
        setBooks(await getContinueListening(libraryId));
      }
      setError("");
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
      setFailedBookId("");
      setError("");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  if (!state) return <div style={{ padding: 16 }}>Loading Audiobookshelf…</div>;
  if (!state.configured) return <Setup initial={state} onConnected={refresh} />;

  const errorBanner = error || state.error;
  const returnLabel = returnView === "home"
    ? "Continue Listening"
    : returnView === "library"
      ? "Library"
      : returnView === "search"
        ? "Search"
        : "Browse";

  if (view === "player") {
    return (
      <div style={{ background: colors.surface, minHeight: "100%", overflowX: "hidden" }}>
        <Player playback={state.playback} cover={cover} run={runPlayback} />
        {errorBanner && <div style={{ color: colors.error, padding: "0 12px 8px", overflowWrap: "anywhere" }}>{errorBanner}</div>}
        <PanelSection>
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={() => setView(returnView)}>← Back to {returnLabel}</ButtonItem>
          </PanelSectionRow>
        </PanelSection>
      </div>
    );
  }

  if (view === "menu") {
    return (
      <div style={{ background: colors.surface, minHeight: "100%", overflowX: "hidden" }}>
        {errorBanner && <div style={{ color: colors.error, padding: "8px 12px", overflowWrap: "anywhere" }}>{errorBanner}</div>}
        <PanelSection title="Audiobookshelf">
          {state.playback.session && (
            <PanelSectionRow>
              <ButtonItem
                layout="below"
                label={state.playback.session.title}
                description={state.playback.chapter?.title || "Now Playing"}
                onClick={() => {
                  setReturnView("menu");
                  setView("player");
                }}
              >
                Open Player
              </ButtonItem>
            </PanelSectionRow>
          )}
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
            <ButtonItem layout="below" onClick={() => openView("settings")}><FaCog /> Settings</ButtonItem>
          </PanelSectionRow>
        </PanelSection>
        <PanelSection title="Library">
          {libraries.length > 1 && libraries.map((library) => (
            <PanelSectionRow key={library.id}>
              <ButtonItem layout="below" onClick={() => setLibraryId(library.id)}>
                {library.id === libraryId ? `✓ ${library.name}` : library.name}
              </ButtonItem>
            </PanelSectionRow>
          ))}
          {libraries.length === 1 && <div style={{ color: colors.muted, padding: "8px 0" }}>{libraries[0].name}</div>}
        </PanelSection>
      </div>
    );
  }

  if (view === "settings") {
    return (
      <div style={{ background: colors.surface, minHeight: "100%", overflowX: "hidden" }}>
        <PanelSection title="Settings">
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={() => setView("menu")}>← Back to Browse</ButtonItem>
          </PanelSectionRow>
          <div style={{ color: colors.muted, padding: "8px 0", overflowWrap: "anywhere" }}>{state.serverUrl}</div>
          <PanelSectionRow>
            <ButtonItem
              layout="below"
              onClick={async () => {
                try {
                  setDiagnostics(await getDiagnostics());
                } catch (reason) {
                  setError(errorMessage(reason));
                }
              }}
            >
              Refresh Diagnostics
            </ButtonItem>
          </PanelSectionRow>
          {diagnostics && (
            <div style={{ color: colors.muted, fontSize: 11, padding: "8px 0", overflowWrap: "anywhere" }}>
              <div>Pulse socket: {diagnostics.pulseServer} ({diagnostics.pulseSocketExists ? "found" : "missing"})</div>
              <div>Player: {diagnostics.playerRunning ? "running" : `stopped (${diagnostics.playerExitCode ?? "no exit code"})`}</div>
              {(diagnostics.lastError || diagnostics.playerError) && <div>Error: {diagnostics.lastError || diagnostics.playerError}</div>}
              {diagnostics.playerLogTail && <div>mpv: {diagnostics.playerLogTail}</div>}
            </div>
          )}
          <PanelSectionRow>
            <ButtonItem
              layout="below"
              onClick={async () => {
                await logout();
                setView("menu");
                await refresh();
              }}
            >
              Sign out
            </ButtonItem>
          </PanelSectionRow>
        </PanelSection>
      </div>
    );
  }

  return (
    <div style={{ background: colors.surface, minHeight: "100%", overflowX: "hidden" }}>
      <PanelSection>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={() => setView("menu")}>← Back to Browse</ButtonItem>
        </PanelSectionRow>
      </PanelSection>
      {errorBanner && <div style={{ color: colors.error, padding: "0 12px 8px", overflowWrap: "anywhere" }}>{errorBanner}</div>}
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
      {busy ? (
        <PanelSection title="Loading…">
          <div style={{ color: colors.muted, padding: "8px 0" }}>Loading books…</div>
        </PanelSection>
      ) : (
        <BookList
          title={view === "home" ? "Continue Listening" : view === "library" ? "Library" : "Results"}
          books={books}
          onPlay={play}
          startingBookId={startingBookId}
          failedBookId={failedBookId}
          playbackError={errorBanner}
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
