const manifest = {"name":"Audiobookshelf"};
const API_VERSION = 2;
const internalAPIConnection = window.__DECKY_SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED_deckyLoaderAPIInit;
if (!internalAPIConnection) {
    throw new Error('[@decky/api]: Failed to connect to the loader as as the loader API was not initialized. This is likely a bug in Decky Loader.');
}
let api;
try {
    api = internalAPIConnection.connect(API_VERSION, manifest.name);
}
catch {
    api = internalAPIConnection.connect(1, manifest.name);
    console.warn(`[@decky/api] Requested API version ${API_VERSION} but the running loader only supports version 1. Some features may not work.`);
}
if (api._version != API_VERSION) {
    console.warn(`[@decky/api] Requested API version ${API_VERSION} but the running loader only supports version ${api._version}. Some features may not work.`);
}
const callable = api.callable;
const toaster = api.toaster;
const definePlugin = (fn) => {
    return (...args) => {
        return fn(...args);
    };
};

var DefaultContext = {
  color: undefined,
  size: undefined,
  className: undefined,
  style: undefined,
  attr: undefined
};
var IconContext = SP_REACT.createContext && /*#__PURE__*/SP_REACT.createContext(DefaultContext);

var _excluded = ["attr", "size", "title"];
function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }
function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } } return target; }
function _extends() { _extends = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), true).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function Tree2Element(tree) {
  return tree && tree.map((node, i) => /*#__PURE__*/SP_REACT.createElement(node.tag, _objectSpread({
    key: i
  }, node.attr), Tree2Element(node.child)));
}
function GenIcon(data) {
  return props => /*#__PURE__*/SP_REACT.createElement(IconBase, _extends({
    attr: _objectSpread({}, data.attr)
  }, props), Tree2Element(data.child));
}
function IconBase(props) {
  var elem = conf => {
    var {
        attr,
        size,
        title
      } = props,
      svgProps = _objectWithoutProperties(props, _excluded);
    var computedSize = size || conf.size || "1em";
    var className;
    if (conf.className) className = conf.className;
    if (props.className) className = (className ? className + " " : "") + props.className;
    return /*#__PURE__*/SP_REACT.createElement("svg", _extends({
      stroke: "currentColor",
      fill: "currentColor",
      strokeWidth: "0"
    }, conf.attr, attr, svgProps, {
      className: className,
      style: _objectSpread(_objectSpread({
        color: props.color || conf.color
      }, conf.style), props.style),
      height: computedSize,
      width: computedSize,
      xmlns: "http://www.w3.org/2000/svg"
    }), title && /*#__PURE__*/SP_REACT.createElement("title", null, title), props.children);
  };
  return IconContext !== undefined ? /*#__PURE__*/SP_REACT.createElement(IconContext.Consumer, null, conf => elem(conf)) : elem(DefaultContext);
}

// THIS FILE IS AUTO GENERATED
function FaBookOpen (props) {
  return GenIcon({"attr":{"viewBox":"0 0 576 512"},"child":[{"tag":"path","attr":{"d":"M542.22 32.05c-54.8 3.11-163.72 14.43-230.96 55.59-4.64 2.84-7.27 7.89-7.27 13.17v363.87c0 11.55 12.63 18.85 23.28 13.49 69.18-34.82 169.23-44.32 218.7-46.92 16.89-.89 30.02-14.43 30.02-30.66V62.75c.01-17.71-15.35-31.74-33.77-30.7zM264.73 87.64C197.5 46.48 88.58 35.17 33.78 32.05 15.36 31.01 0 45.04 0 62.75V400.6c0 16.24 13.13 29.78 30.02 30.66 49.49 2.6 149.59 12.11 218.77 46.95 10.62 5.35 23.21-1.94 23.21-13.46V100.63c0-5.29-2.62-10.14-7.27-12.99z"},"child":[]}]})(props);
}function FaCog (props) {
  return GenIcon({"attr":{"viewBox":"0 0 512 512"},"child":[{"tag":"path","attr":{"d":"M487.4 315.7l-42.6-24.6c4.3-23.2 4.3-47 0-70.2l42.6-24.6c4.9-2.8 7.1-8.6 5.5-14-11.1-35.6-30-67.8-54.7-94.6-3.8-4.1-10-5.1-14.8-2.3L380.8 110c-17.9-15.4-38.5-27.3-60.8-35.1V25.8c0-5.6-3.9-10.5-9.4-11.7-36.7-8.2-74.3-7.8-109.2 0-5.5 1.2-9.4 6.1-9.4 11.7V75c-22.2 7.9-42.8 19.8-60.8 35.1L88.7 85.5c-4.9-2.8-11-1.9-14.8 2.3-24.7 26.7-43.6 58.9-54.7 94.6-1.7 5.4.6 11.2 5.5 14L67.3 221c-4.3 23.2-4.3 47 0 70.2l-42.6 24.6c-4.9 2.8-7.1 8.6-5.5 14 11.1 35.6 30 67.8 54.7 94.6 3.8 4.1 10 5.1 14.8 2.3l42.6-24.6c17.9 15.4 38.5 27.3 60.8 35.1v49.2c0 5.6 3.9 10.5 9.4 11.7 36.7 8.2 74.3 7.8 109.2 0 5.5-1.2 9.4-6.1 9.4-11.7v-49.2c22.2-7.9 42.8-19.8 60.8-35.1l42.6 24.6c4.9 2.8 11 1.9 14.8-2.3 24.7-26.7 43.6-58.9 54.7-94.6 1.5-5.5-.7-11.3-5.6-14.1zM256 336c-44.1 0-80-35.9-80-80s35.9-80 80-80 80 35.9 80 80-35.9 80-80 80z"},"child":[]}]})(props);
}function FaPause (props) {
  return GenIcon({"attr":{"viewBox":"0 0 448 512"},"child":[{"tag":"path","attr":{"d":"M144 479H48c-26.5 0-48-21.5-48-48V79c0-26.5 21.5-48 48-48h96c26.5 0 48 21.5 48 48v352c0 26.5-21.5 48-48 48zm304-48V79c0-26.5-21.5-48-48-48h-96c-26.5 0-48 21.5-48 48v352c0 26.5 21.5 48 48 48h96c26.5 0 48-21.5 48-48z"},"child":[]}]})(props);
}function FaPlay (props) {
  return GenIcon({"attr":{"viewBox":"0 0 448 512"},"child":[{"tag":"path","attr":{"d":"M424.4 214.7L72.4 6.6C43.8-10.3 0 6.1 0 47.9V464c0 37.5 40.7 60.1 72.4 41.3l352-208c31.4-18.5 31.5-64.1 0-82.6z"},"child":[]}]})(props);
}function FaSearch (props) {
  return GenIcon({"attr":{"viewBox":"0 0 512 512"},"child":[{"tag":"path","attr":{"d":"M505 442.7L405.3 343c-4.5-4.5-10.6-7-17-7H372c27.6-35.3 44-79.7 44-128C416 93.1 322.9 0 208 0S0 93.1 0 208s93.1 208 208 208c48.3 0 92.7-16.4 128-44v16.3c0 6.4 2.5 12.5 7 17l99.7 99.7c9.4 9.4 24.6 9.4 33.9 0l28.3-28.3c9.4-9.4 9.4-24.6.1-34zM208 336c-70.7 0-128-57.2-128-128 0-70.7 57.2-128 128-128 70.7 0 128 57.2 128 128 0 70.7-57.2 128-128 128z"},"child":[]}]})(props);
}function FaStepBackward (props) {
  return GenIcon({"attr":{"viewBox":"0 0 448 512"},"child":[{"tag":"path","attr":{"d":"M64 468V44c0-6.6 5.4-12 12-12h48c6.6 0 12 5.4 12 12v176.4l195.5-181C352.1 22.3 384 36.6 384 64v384c0 27.4-31.9 41.7-52.5 24.6L136 292.7V468c0 6.6-5.4 12-12 12H76c-6.6 0-12-5.4-12-12z"},"child":[]}]})(props);
}function FaStepForward (props) {
  return GenIcon({"attr":{"viewBox":"0 0 448 512"},"child":[{"tag":"path","attr":{"d":"M384 44v424c0 6.6-5.4 12-12 12h-48c-6.6 0-12-5.4-12-12V291.6l-195.5 181C95.9 489.7 64 475.4 64 448V64c0-27.4 31.9-41.7 52.5-24.6L312 219.3V44c0-6.6 5.4-12 12-12h48c6.6 0 12 5.4 12 12z"},"child":[]}]})(props);
}

const getState = callable("get_state");
const configure = callable("configure");
const logout = callable("logout");
const getLibraries = callable("get_libraries");
const getContinueListening = callable("get_continue_listening");
const browseLibrary = callable("browse_library");
const searchLibrary = callable("search");
const getCover = callable("get_cover");
const playItem = callable("play_item");
const togglePlayPause = callable("toggle_play_pause");
const seekRelative = callable("seek_relative");
const previousChapter = callable("previous_chapter");
const nextChapter = callable("next_chapter");
const setSpeed = callable("set_speed");
const colors = {
    surface: "#17191d",
    raised: "#22252b",
    accent: "#f59e0b",
    text: "#f5f5f4",
    muted: "#a8a29e",
    error: "#fca5a5",
};
function formatTime(value) {
    const seconds = Math.max(0, Math.floor(value || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    return hours > 0
        ? `${hours}:${minutes.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`
        : `${minutes}:${remainder.toString().padStart(2, "0")}`;
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function Setup({ initial, onConnected }) {
    const [serverUrl, setServerUrl] = SP_REACT.useState(initial.serverUrl || "http://");
    const [username, setUsername] = SP_REACT.useState(initial.username || "");
    const [password, setPassword] = SP_REACT.useState("");
    const [verifyTls, setVerifyTls] = SP_REACT.useState(initial.verifyTls);
    const [busy, setBusy] = SP_REACT.useState(false);
    const [error, setError] = SP_REACT.useState(initial.error);
    const connect = async () => {
        setBusy(true);
        setError("");
        try {
            await configure(serverUrl, username, password, verifyTls);
            onConnected();
        }
        catch (reason) {
            setError(errorMessage(reason));
        }
        finally {
            setBusy(false);
        }
    };
    return (SP_JSX.jsxs(DFL.PanelSection, { title: "Connect to Audiobookshelf", children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.TextField, { label: "Server address", description: "Include http:// or https:// and the port, if needed.", value: serverUrl, onChange: (event) => setServerUrl(event.target.value) }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.TextField, { label: "Username", value: username, onChange: (event) => setUsername(event.target.value) }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.TextField, { label: "Password", value: password, bIsPassword: true, onChange: (event) => setPassword(event.target.value) }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ToggleField, { label: "Verify HTTPS certificate", description: "Disable only for a trusted self-signed server.", checked: verifyTls, onChange: setVerifyTls }) }), error && SP_JSX.jsx("div", { style: { color: colors.error, padding: "8px 0" }, children: error }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || !serverUrl || !username, onClick: connect, children: busy ? "Connecting…" : "Sign in" }) })] }));
}
function Player({ playback, cover, run }) {
    if (!playback.session) {
        return (SP_JSX.jsx(DFL.PanelSection, { title: "Now Playing", children: SP_JSX.jsx("div", { style: { color: colors.muted, padding: "10px 0" }, children: "Pick a book below to start or resume playback." }) }));
    }
    const progress = playback.duration ? Math.min(100, (playback.position / playback.duration) * 100) : 0;
    return (SP_JSX.jsxs(DFL.PanelSection, { title: "Now Playing", children: [SP_JSX.jsxs("div", { style: { display: "flex", gap: 12, padding: "4px 0 10px" }, children: [SP_JSX.jsx("div", { style: {
                            width: 84,
                            height: 126,
                            borderRadius: 8,
                            background: colors.raised,
                            flexShrink: 0,
                            overflow: "hidden",
                        }, children: cover && SP_JSX.jsx("img", { src: cover, style: { width: "100%", height: "100%", objectFit: "cover" } }) }), SP_JSX.jsxs("div", { style: { minWidth: 0, alignSelf: "center" }, children: [SP_JSX.jsx("div", { style: { color: colors.text, fontSize: 17, fontWeight: 700 }, children: playback.session.title }), SP_JSX.jsx("div", { style: { color: colors.muted, marginTop: 3 }, children: playback.session.author }), SP_JSX.jsx("div", { style: { color: colors.accent, marginTop: 12, fontWeight: 600 }, children: playback.chapter?.title || `Chapter ${playback.chapterIndex + 1}` })] })] }), SP_JSX.jsx("div", { style: { height: 5, background: "#393c43", borderRadius: 99, overflow: "hidden" }, children: SP_JSX.jsx("div", { style: { height: "100%", width: `${progress}%`, background: colors.accent } }) }), SP_JSX.jsxs("div", { style: { display: "flex", justifyContent: "space-between", color: colors.muted, fontVariantNumeric: "tabular-nums", margin: "5px 0 10px" }, children: [SP_JSX.jsx("span", { children: formatTime(playback.position) }), SP_JSX.jsx("span", { children: formatTime(playback.duration) })] }), SP_JSX.jsxs(DFL.Focusable, { "flow-children": "horizontal", style: { display: "flex", gap: 8 }, children: [SP_JSX.jsx(DFL.DialogButton, { onClick: () => run(() => seekRelative(-30)), children: "\u25C0 30s" }), SP_JSX.jsx(DFL.DialogButton, { onClick: () => run(togglePlayPause), children: playback.isPlaying ? SP_JSX.jsx(FaPause, {}) : SP_JSX.jsx(FaPlay, {}) }), SP_JSX.jsx(DFL.DialogButton, { onClick: () => run(() => seekRelative(30)), children: "30s \u25B6" })] }), SP_JSX.jsxs(DFL.Focusable, { "flow-children": "horizontal", style: { display: "flex", gap: 8, marginTop: 8 }, children: [SP_JSX.jsxs(DFL.DialogButton, { onClick: () => run(previousChapter), children: [SP_JSX.jsx(FaStepBackward, {}), " Chapter"] }), SP_JSX.jsxs(DFL.DialogButton, { onClick: () => run(nextChapter), children: ["Chapter ", SP_JSX.jsx(FaStepForward, {})] })] }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.SliderField, { label: "Playback speed", value: playback.speed, min: 0.5, max: 3, step: 0.05, showValue: true, valueSuffix: "\u00D7", onChange: (value) => run(() => setSpeed(value)) }) })] }));
}
function BookList({ title, books, onPlay }) {
    return (SP_JSX.jsxs(DFL.PanelSection, { title: title, children: [books.length === 0 && SP_JSX.jsx("div", { style: { color: colors.muted, padding: "8px 0" }, children: "No books found." }), books.map((book) => (SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", label: book.title, description: `${book.author || "Unknown author"}${book.currentTime ? ` • ${formatTime(book.currentTime)} listened` : ""}`, onClick: () => onPlay(book), children: "Play" }) }, book.id)))] }));
}
function Content() {
    const [state, setState] = SP_REACT.useState(null);
    const [libraries, setLibraries] = SP_REACT.useState([]);
    const [libraryId, setLibraryId] = SP_REACT.useState("");
    const [books, setBooks] = SP_REACT.useState([]);
    const [view, setView] = SP_REACT.useState("home");
    const [query, setQuery] = SP_REACT.useState("");
    const [cover, setCover] = SP_REACT.useState("");
    const [busy, setBusy] = SP_REACT.useState(false);
    const [error, setError] = SP_REACT.useState("");
    const refresh = SP_REACT.useCallback(async () => {
        try {
            setState(await getState());
        }
        catch (reason) {
            setError(errorMessage(reason));
        }
    }, []);
    SP_REACT.useEffect(() => {
        refresh();
        const timer = window.setInterval(refresh, 1000);
        return () => window.clearInterval(timer);
    }, [refresh]);
    SP_REACT.useEffect(() => {
        if (!state?.configured)
            return;
        getLibraries()
            .then((result) => {
            setLibraries(result);
            if (!libraryId && result[0])
                setLibraryId(result[0].id);
        })
            .catch((reason) => setError(errorMessage(reason)));
    }, [state?.configured]);
    SP_REACT.useEffect(() => {
        const itemId = state?.playback.session?.libraryItemId;
        if (!itemId) {
            setCover("");
            return;
        }
        getCover(itemId).then(setCover).catch(() => setCover(""));
    }, [state?.playback.session?.libraryItemId]);
    const loadHome = SP_REACT.useCallback(async () => {
        if (!libraryId)
            return;
        setBusy(true);
        try {
            setBooks(await getContinueListening(libraryId));
            setError("");
        }
        catch (reason) {
            setError(errorMessage(reason));
        }
        finally {
            setBusy(false);
        }
    }, [libraryId]);
    SP_REACT.useEffect(() => {
        if (view === "home")
            loadHome();
    }, [view, loadHome]);
    const runPlayback = async (action) => {
        try {
            const playback = await action();
            setState((current) => current ? { ...current, playback } : current);
            setError("");
        }
        catch (reason) {
            const message = errorMessage(reason);
            setError(message);
            toaster.toast({ title: "Audiobookshelf", body: message });
        }
    };
    const play = (book) => runPlayback(() => playItem(book.id));
    const openView = async (next) => {
        setView(next);
        setBooks([]);
        if (!libraryId)
            return;
        setBusy(true);
        try {
            if (next === "library") {
                setBooks((await browseLibrary(libraryId, 0, 24)).items);
            }
            else if (next === "home") {
                setBooks(await getContinueListening(libraryId));
            }
        }
        catch (reason) {
            setError(errorMessage(reason));
        }
        finally {
            setBusy(false);
        }
    };
    const doSearch = async () => {
        if (!libraryId || !query.trim())
            return;
        setBusy(true);
        try {
            setBooks(await searchLibrary(libraryId, query));
        }
        catch (reason) {
            setError(errorMessage(reason));
        }
        finally {
            setBusy(false);
        }
    };
    if (!state)
        return SP_JSX.jsx("div", { style: { padding: 16 }, children: "Loading Audiobookshelf\u2026" });
    if (!state.configured)
        return SP_JSX.jsx(Setup, { initial: state, onConnected: refresh });
    return (SP_JSX.jsxs("div", { style: { background: colors.surface, minHeight: "100%" }, children: [SP_JSX.jsx(Player, { playback: state.playback, cover: cover, run: runPlayback }), error && SP_JSX.jsx("div", { style: { color: colors.error, padding: "0 12px 8px" }, children: error }), SP_JSX.jsxs(DFL.PanelSection, { title: "Browse", children: [libraries.length > 1 && libraries.map((library) => (SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: () => setLibraryId(library.id), children: library.id === libraryId ? `✓ ${library.name}` : library.name }) }, library.id))), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: () => openView("home"), children: "Continue Listening" }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: () => openView("library"), children: "Library" }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs(DFL.ButtonItem, { layout: "below", onClick: () => openView("search"), children: [SP_JSX.jsx(FaSearch, {}), " Search"] }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs(DFL.ButtonItem, { layout: "below", onClick: () => setView("settings"), children: [SP_JSX.jsx(FaCog, {}), " Settings"] }) })] }), view === "search" && (SP_JSX.jsxs(DFL.PanelSection, { title: "Search", children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.TextField, { label: "Title, author, or series", value: query, onChange: (event) => setQuery(event.target.value) }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: !query.trim() || busy, onClick: doSearch, children: "Search" }) })] })), view === "settings" ? (SP_JSX.jsxs(DFL.PanelSection, { title: "Settings", children: [SP_JSX.jsx("div", { style: { color: colors.muted, padding: "8px 0" }, children: state.serverUrl }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: async () => {
                                await logout();
                                await refresh();
                            }, children: "Sign out" }) })] })) : (SP_JSX.jsx(BookList, { title: busy ? "Loading…" : view === "home" ? "Continue Listening" : view === "library" ? "Library" : "Results", books: books, onPlay: play }))] }));
}
var index = definePlugin(() => ({
    name: "Audiobookshelf",
    titleView: SP_JSX.jsx("div", { className: DFL.staticClasses.Title, children: "Audiobookshelf" }),
    content: SP_JSX.jsx(Content, {}),
    icon: SP_JSX.jsx(FaBookOpen, {}),
}));

export { index as default };
//# sourceMappingURL=index.js.map
