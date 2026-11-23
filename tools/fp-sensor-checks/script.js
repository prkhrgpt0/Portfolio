const groups = [];
const group = (title, desc) => { const g = { title, desc, rows: [] }; groups.push(g); return g; };
const row = (g, label, value, status, note = "") => g.rows.push({ label, value: String(value), status, note });

const isNative = fn =>
  typeof fn === "function" && /\[native code\]/.test(Function.prototype.toString.call(fn));
const tryDo = (fn, fallback = "error") => { try { return fn(); } catch (e) { return fallback; } };

/* ---------- 1. navigator.webdriver ---------- */
function checkWebdriver() {
  const g = group("navigator.webdriver", "Value, deletion attempt and prototype integrity");

  const before = navigator.webdriver;
  row(g, "Value (before delete)", before,
    before === true ? "bad" : before === false ? "ok" : "warn",
    before === true ? "Automation flag is set." :
    before === undefined ? "Property missing: possibly removed by a spoof." : "");

  const inNav = "webdriver" in navigator;
  row(g, "'webdriver' in navigator", inNav, inNav ? "ok" : "bad",
    inNav ? "" : "Property absent (real Chrome always has it).");

  const own = Object.getOwnPropertyDescriptor(navigator, "webdriver");
  row(g, "Own property on navigator", !!own, own ? "bad" : "ok",
    own ? "Should live on Navigator.prototype, not the instance." : "");

  const proto = Object.getOwnPropertyDescriptor(Navigator.prototype, "webdriver");
  row(g, "Descriptor on Navigator.prototype", proto ? "present" : "missing", proto ? "ok" : "bad",
    proto ? "" : "Prototype property deleted.");
  if (proto && proto.get) {
    const nat = isNative(proto.get);
    row(g, "Getter is native code", nat, nat ? "ok" : "bad", nat ? "" : "Getter has been overridden.");
  }

  const del = tryDo(() => delete navigator.webdriver);
  row(g, "delete navigator.webdriver returned", del, "info",
    "Returns true even though nothing is removed (no own property).");

  const after = navigator.webdriver;
  row(g, "Value (after delete)", after, after === before ? "info" : "warn",
    after === before ? "Unchanged by delete." : "Value changed.");

  tryDo(() => { navigator.webdriver = "__test__"; });
  const writeIgnored = navigator.webdriver !== "__test__";
  tryDo(() => delete navigator.webdriver);
  row(g, "Write ignored (getter-only)", writeIgnored, writeIgnored ? "ok" : "bad",
    writeIgnored ? "" : "Assignment stuck: property is a plain data property.");
}

/* ---------- 2. Plugins ---------- */
function checkPlugins() {
  const g = group("navigator.plugins / mimeTypes", "Detects plain-array spoofs and empty lists");
  const p = navigator.plugins;

  const isPA = typeof PluginArray !== "undefined" && p instanceof PluginArray;
  row(g, "Is real PluginArray", isPA, isPA ? "ok" : "bad", isPA ? "" : "Plain array or custom object.");

  const hasItem = typeof p.item === "function";
  row(g, "item() method present", hasItem, hasItem ? "ok" : "bad");
  if (hasItem) {
    const wrapped = tryDo(() => p.item(2 ** 32) !== null);
    row(g, "item(2^32) wraps to item(0)", wrapped, wrapped || p.length === 0 ? "ok" : "warn",
      "Native lookup converts the index to unsigned 32-bit.");
  }

  row(g, "Plugin count", p.length, p.length > 0 ? "ok" : "warn",
    p.length ? "" : "Empty list is typical of headless browsers.");
  row(g, "Plugin names", Array.from(p).map(x => x.name).join(", ") || "(none)", "info");

  const mt = navigator.mimeTypes;
  row(g, "mimeTypes length", mt ? mt.length : "n/a", mt && mt.length > 0 ? "ok" : "warn");
  const tag = Object.prototype.toString.call(p);
  row(g, "Object tag", tag, tag === "[object PluginArray]" ? "ok" : "bad");
}

/* ---------- 3. window.chrome ---------- */
function checkChrome() {
  const g = group("window.chrome", "Presence and shape of the chrome object");
  const hasChrome = typeof window.chrome === "object" && window.chrome !== null;
  const ua = navigator.userAgent;
  const claimsChrome = /Chrome\//.test(ua) && !/Edg\/|OPR\//.test(ua);

  row(g, "window.chrome exists", hasChrome, hasChrome ? "ok" : claimsChrome ? "bad" : "info",
    hasChrome || !claimsChrome ? "" : "UA claims Chrome but object is missing.");
  if (!hasChrome) return;

  const keys = Object.keys(window.chrome);
  row(g, "Object.keys(chrome)", JSON.stringify(keys), keys.length ? "ok" : "warn",
    keys.length ? "" : "Empty object.");

  const rt = window.chrome.runtime;
  if (rt === undefined) {
    row(g, "chrome.runtime", "undefined", "ok", "Normal on regular web pages.");
  } else {
    const rtKeys = Object.keys(rt);
    const empty = rtKeys.length === 0;
    row(g, "chrome.runtime keys", JSON.stringify(rtKeys), empty ? "bad" : "ok",
      empty ? "Empty stub object (chrome.runtime = {})." : "");
    row(g, "chrome.runtime.connect is native", isNative(rt.connect), isNative(rt.connect) ? "ok" : "warn");
  }
}

/* ---------- 4. Languages ---------- */
function checkLanguages() {
  const g = group("navigator.languages", "Real value is a frozen, cached array");
  const l = navigator.languages;

  row(g, "Value", JSON.stringify(l), l && l.length ? "info" : "bad", l && l.length ? "" : "Empty or missing.");
  row(g, "Frozen", Object.isFrozen(l), Object.isFrozen(l) ? "ok" : "bad",
    Object.isFrozen(l) ? "" : "Plain array: native value is frozen.");
  const same = navigator.languages === navigator.languages;
  row(g, "Stable identity", same, same ? "ok" : "bad", same ? "" : "Getter returns a new array each call.");
  row(g, "language === languages[0]", navigator.language === (l && l[0]),
    navigator.language === (l && l[0]) ? "ok" : "warn");
  const d = Object.getOwnPropertyDescriptor(Navigator.prototype, "languages");
  row(g, "Getter is native code", !!(d && isNative(d.get)), d && isNative(d.get) ? "ok" : "bad");
}

/* ---------- 5. Permissions ---------- */
async function checkPermissions() {
  const g = group("Permissions API", "Notification state must match permissions.query");
  if (!navigator.permissions) { row(g, "navigator.permissions", "missing", "warn"); return; }

  row(g, "permissions.query is native", isNative(navigator.permissions.query),
    isNative(navigator.permissions.query) ? "ok" : "bad");
  try {
    const res = await navigator.permissions.query({ name: "notifications" });
    const np = Notification.permission;
    const mismatch = np === "denied" && res.state === "prompt";
    row(g, "Notification.permission", np, "info");
    row(g, "permissions.query state", res.state, "info");
    row(g, "Consistent", !mismatch, mismatch ? "bad" : "ok",
      mismatch ? "Classic headless Chrome inconsistency." : "");
  } catch (e) {
    row(g, "permissions.query", "error: " + e.message, "warn");
  }
}

/* ---------- 6. Extra checks ---------- */
function checkExtras() {
  const g = group("Additional signals", "Other common headless / automation indicators");
  const ua = navigator.userAgent;

  const headless = /HeadlessChrome/i.test(ua);
  row(g, "User agent", ua, headless ? "bad" : "info", headless ? "Contains HeadlessChrome." : "");

  const zero = window.outerWidth === 0 || window.outerHeight === 0;
  row(g, "Window outer size", `${window.outerWidth}×${window.outerHeight}`, zero ? "bad" : "ok",
    zero ? "Zero-size window." : "");

  row(g, "Screen", `${screen.width}×${screen.height}, ${screen.colorDepth}-bit`, "info");
  row(g, "hardwareConcurrency", navigator.hardwareConcurrency, navigator.hardwareConcurrency ? "ok" : "warn");
  row(g, "deviceMemory", navigator.deviceMemory ?? "n/a", "info");

  const gl = tryDo(() => {
    const c = document.createElement("canvas").getContext("webgl");
    const ext = c.getExtension("WEBGL_debug_renderer_info");
    return c.getParameter(ext.UNMASKED_RENDERER_WEBGL);
  }, null);
  const soft = gl && /SwiftShader|llvmpipe|Software/i.test(gl);
  row(g, "WebGL renderer", gl || "unavailable", !gl ? "warn" : soft ? "warn" : "ok",
    soft ? "Software renderer, common in headless setups." : "");

  const auto = ["__nightmare", "_phantom", "callPhantom", "__selenium_unwrapped", "_Selenium_IDE_Recorder",
    "domAutomation", "domAutomationController"].filter(k => k in window);
  const cdc = Object.keys(document).some(k => /^\$?cdc_/.test(k));
  row(g, "Automation globals", auto.concat(cdc ? ["cdc_*"] : []).join(", ") || "none",
    auto.length || cdc ? "bad" : "ok");
}

/* ---------- Render ---------- */
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function render() {
  const root = document.getElementById("results");
  const counts = { ok: 0, warn: 0, bad: 0 };

  groups.forEach(g => {
    const card = el("section", "card");
    card.append(el("h2", "", g.title), el("div", "desc", g.desc));
    g.rows.forEach(r => {
      if (counts[r.status] !== undefined) counts[r.status]++;
      const d = el("div", "row");
      d.append(el("span", "label", r.label),
               el("span", "badge " + r.status, r.status === "ok" ? "pass" : r.status === "bad" ? "fail" : r.status),
               el("span", "value", r.value));
      if (r.note) d.append(el("span", "note", r.note));
      card.append(d);
    });
    root.append(card);
  });

  const s = document.getElementById("summary");
  s.append(el("span", "pill ok", `${counts.ok} passed`),
           el("span", "pill warn", `${counts.warn} warnings`),
           el("span", "pill bad", `${counts.bad} failed`));
}

(async () => {
  checkWebdriver();
  checkPlugins();
  checkChrome();
  checkLanguages();
  await checkPermissions();
  checkExtras();
  render();
})();
