const groups = [];
const group = (title, desc) => { const g = { title, desc, rows: [] }; groups.push(g); return g; };
const row = (g, label, value, status, note = "") => g.rows.push({ label, value: String(value), status, note });

const isNative = fn =>
  typeof fn === "function" && /\[native code\]/.test(Function.prototype.toString.call(fn));
const tryDo = (fn, fallback = "error") => { try { return fn(); } catch (e) { return fallback; } };

/* ---------- 0. Error stack ---------- */
function checkErrorStack() {
  const g = group("new Error(\"sample error\").stack", "Stack-trace shape exposes automation harnesses");
  const stack = tryDo(() => new Error("sample error").stack, null);

  const raw = typeof stack === "string" ? stack : String(stack ?? "");
  row(g, "Actual stack", raw || "(empty)", raw ? "info" : "bad",
    raw ? "" : "No stack trace: stripped by the environment.");

  const lines = raw.split("\n");
  const first = lines[0] || "";
  row(g, "First line", first, first === "Error: sample error" ? "ok" : "bad",
    first === "Error: sample error" ? "" : "Expected 'Error: sample error'.");

  const frames = lines.slice(1).filter(l => /^\s+at\s/.test(l));
  row(g, "Frame count", frames.length, frames.length ? "ok" : "bad",
    frames.length ? "" : "No frames: stack may be faked or suppressed.");

  const markers = ["puppeteer", "playwright", "selenium", "webdriver", "phantom", "nightmare",
    "__puppeteer_evaluation_script__", "__playwright_evaluation_script__", "EvaluationScript",
    "isolated world", "Automation"];
  const hits = markers.filter(m => raw.toLowerCase().includes(m.toLowerCase()));
  row(g, "Automation markers", hits.join(", ") || "none", hits.length ? "bad" : "ok",
    hits.length ? "Injected harness frames are visible in the stack." : "");

  row(g, "Correct value", "Error: sample error\n    at <anonymous>:1:9", "info",
    "Real page script: a plain file/URL frame with line and column.");
  row(g, "Bad value", "Error: sample error\n    at __puppeteer_evaluation_script__:1:9", "info",
    "Automation: the injected evaluation frame names the harness.");
}

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


/* =====================================================================
   TAMPER / INTEGRITY TESTS
   Pattern for every test:  grab value -> modify it -> verify the change
   behaves like the native engine would -> restore -> verify the restore.
   All modifications are local to this page and are always reverted.
   ===================================================================== */
const ND = Navigator.prototype;
const getDesc = (o, p) => Object.getOwnPropertyDescriptor(o, p);
const getterOf = (o, p) => (getDesc(o, p) || {}).get;
const put = (o, p, d) => { try { d ? Object.defineProperty(o, p, d) : Reflect.deleteProperty(o, p); } catch (e) {} };
const fmt = v => {
  if (v === undefined) return "undefined";
  if (typeof v === "string") return JSON.stringify(v);
  try { return JSON.stringify(v) ?? String(v); } catch (e) { return String(v); }
};
const hash = s => { let h = 5381; for (const ch of String(s)) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0; return h.toString(16); };
const dHash = (o, p) => {
  const d = getDesc(o, p);
  return d ? hash(Object.keys(d).map(k => k + ":" + typeof d[k] + (typeof d[k] === "function" ? d[k].name : "")).join("|")) : "none";
};
const frameNav = fn => {
  const f = document.createElement("iframe");
  f.style.display = "none";
  document.body.appendChild(f);
  try { return fn(f.contentWindow); } finally { f.remove(); }
};

// expectation helpers: (valueBefore, valueAfter) => boolean
const to   = x => (b, a) => fmt(a) === fmt(x);
const same = (b, a) => fmt(a) === fmt(b);
const diff = (b, a) => fmt(a) !== fmt(b);
const flip = (x, y) => (b, a) => b === x && a === y;
const chk  = (label, read, expect, note = "") => ({ label, read, expect, note });

const getterNative = (o, p) => () => isNative(getterOf(o, p));
const getterName   = (o, p) => () => (getterOf(o, p) || {}).name;
const illegal = (o, p) => () => {
  const g = getterOf(o, p);
  if (!g) return "no getter";
  try { g.call({}); return "no throw"; } catch (e) { return e.name; }
};

async function scenario(g, s) {
  const rd = async f => { try { return await f(); } catch (e) { return "error: " + e.name; } };
  const desc = s.obj ? getDesc(s.obj, s.prop) : null;

  const before = []; for (const c of s.checks) before.push(await rd(c.read));
  let err = null;
  try { await s.mutate(); } catch (e) { err = e; }
  const after = []; for (const c of s.checks) after.push(await rd(c.read));
  try { if (s.restore) await s.restore(); else if (s.obj) put(s.obj, s.prop, desc); } catch (e) {}
  const restored = []; for (const c of s.checks) restored.push(await rd(c.read));

  const failed = x => typeof x === "string" && x.startsWith("error:");
  s.checks.forEach((c, i) => {
    let status, note = c.note;
    if (err) { status = "warn"; note = `Mutation blocked (${err.name}). ${note}`; }
    else if (failed(before[i]) || failed(after[i])) { status = "warn"; note = `API unavailable or threw. ${note}`; }
    else { let ok = false; try { ok = c.expect(before[i], after[i]); } catch (e) {} status = ok ? "ok" : "bad"; }
    g.rows.push({
      label: `${s.name} → ${c.label}`, before: fmt(before[i]), after: fmt(after[i]),
      restored: fmt(restored[i]) === fmt(before[i]), status, note
    });
  });
}

/* ---------- T1. navigator.webdriver ---------- */
async function tamperWebdriver() {
  const g = group("Tamper · navigator.webdriver", "Grab → modify → verify change → restore");
  const frameEq = () => frameNav(w => w.navigator.webdriver === navigator.webdriver);
  const inNav = () => "webdriver" in navigator;

  await scenario(g, {
    name: "Override getter", obj: ND, prop: "webdriver",
    mutate: () => Object.defineProperty(ND, "webdriver", { get: () => "tampered", configurable: true, enumerable: true }),
    checks: [
      chk("value", () => navigator.webdriver, to("tampered"), "Override must be readable."),
      chk("'webdriver' in navigator", inNav, same, "Still present."),
      chk("getter is native", getterNative(ND, "webdriver"), flip(true, false), "toString exposes the override."),
      chk("getter name", getterName(ND, "webdriver"), (b, a) => b === "get webdriver" && a !== b, "Native name is 'get webdriver'."),
      chk("illegal-invocation throws", illegal(ND, "webdriver"), flip("TypeError", "no throw"), "Native getter rejects foreign receivers."),
      chk("iframe realm agrees", frameEq, flip(true, false), "Patch applied to top frame only is exposed."),
    ]
  });

  await scenario(g, {
    name: "Delete prototype property", obj: ND, prop: "webdriver",
    mutate: () => { delete ND.webdriver; },
    checks: [
      chk("String(webdriver)", () => String(navigator.webdriver), (b, a) => a === "undefined" && b !== a, "e.g. \"false\" → \"undefined\"."),
      chk("'webdriver' in navigator", inNav, flip(true, false), "1 → 0."),
      chk("prototype descriptor present", () => !!getDesc(ND, "webdriver"), flip(true, false)),
      chk("write-test creates own prop", () => {
        navigator.webdriver = "w";
        const created = Object.prototype.hasOwnProperty.call(navigator, "webdriver");
        delete navigator.webdriver;
        return created;
      }, flip(false, true), "Native getter-only ignores writes."),
      chk("descriptor hash", () => dHash(ND, "webdriver"), (b, a) => a === "none" && b !== a, "Descriptor hash cleared."),
      chk("listed in Object.keys(prototype)", () => Object.keys(ND).includes("webdriver"), flip(true, false)),
      chk("prototype property count", () => Object.getOwnPropertyNames(ND).length, (b, a) => a === b - 1, "Exactly one fewer."),
      chk("prototype names hash", () => hash(Object.getOwnPropertyNames(ND).join()), diff, "Resource hash changed."),
    ]
  });

  await scenario(g, {
    name: "Own property on navigator", obj: navigator, prop: "webdriver",
    mutate: () => Object.defineProperty(navigator, "webdriver", { get: () => false, configurable: true }),
    checks: [
      chk("value", () => navigator.webdriver, to(false)),
      chk("own property present", () => Object.prototype.hasOwnProperty.call(navigator, "webdriver"), flip(false, true), "Real browsers expose none."),
      chk("own property count", () => Object.getOwnPropertyNames(navigator).length, (b, a) => a === b + 1),
    ]
  });

  let del;
  await scenario(g, {
    name: "delete navigator.webdriver", obj: navigator, prop: "webdriver",
    mutate: () => { del = delete navigator.webdriver; },
    checks: [
      chk("delete returned", () => del, to(true), "Returns true but nothing is removed."),
      chk("value unchanged", () => navigator.webdriver, same),
      chk("'webdriver' in navigator", inNav, same),
    ]
  });

  await scenario(g, {
    name: "Assign navigator.webdriver", obj: navigator, prop: "webdriver",
    mutate: () => { navigator.webdriver = !navigator.webdriver; },
    checks: [chk("write ignored", () => navigator.webdriver, same, "Getter-only accessor ignores writes.")]
  });
}

/* ---------- T2. plugins / mimeTypes ---------- */
async function tamperPlugins() {
  const g = group("Tamper · plugins / mimeTypes", "Plain-array spoof vs native PluginArray / MimeTypeArray");
  const fakeMime = { type: "application/x-fake", suffixes: "fk", description: "Fake" };
  const fakePlugin = { name: "Fake Plugin", filename: "fake.so", description: "Fake", length: 1, 0: fakeMime };
  fakeMime.enabledPlugin = fakePlugin;
  const p = () => navigator.plugins, m = () => navigator.mimeTypes;
  const tag = o => () => Object.prototype.toString.call(o());
  const getter = v => ({ get: () => v, configurable: true, enumerable: true });

  await scenario(g, {
    name: "Override plugins", obj: ND, prop: "plugins",
    mutate: () => Object.defineProperty(ND, "plugins", getter([fakePlugin])),
    checks: [
      chk("plugin count", () => p().length, to(1)),
      chk("plugin list", () => Array.from(p()).map(x => x.name).join(", "), to("Fake Plugin"), "List changed."),
      chk("instanceof PluginArray", () => p() instanceof PluginArray, flip(true, false)),
      chk("object tag", tag(p), (b, a) => b === "[object PluginArray]" && a === "[object Array]"),
      chk("item() present", () => typeof p().item === "function", flip(true, false)),
      chk("item(2^32) test", () => typeof p().item === "function" ? (p().item(2 ** 32) ? "wraps" : "null") : "absent", (b, a) => a === "absent", "Native wraps index to 0."),
      chk("namedItem() present", () => typeof p().namedItem === "function", flip(true, false)),
      chk("refresh() present", () => typeof p().refresh === "function", flip(true, false)),
      chk("getter is native", getterNative(ND, "plugins"), flip(true, false)),
      chk("getter name", getterName(ND, "plugins"), (b, a) => b === "get plugins" && a !== b),
      chk("illegal-invocation throws", illegal(ND, "plugins"), flip("TypeError", "no throw")),
      chk("mimeTypes length (CW) not synced", () => m().length, same, "Native mimeTypes is independent of the plugins getter."),
      chk("unique plugin MIME types == mimeTypes.length", () => {
        const s = new Set();
        for (const x of p()) for (let i = 0; i < x.length; i++) s.add(x[i].type);
        return s.size === m().length;
      }, (b, a) => a === false, "Cross-check exposes the spoof."),
      chk("every enabledPlugin listed in plugins", () => Array.from(m()).every(t => Array.from(p()).includes(t.enabledPlugin)), (b, a) => a === false),
      chk("iframe realm agrees", () => frameNav(w => Object.prototype.toString.call(w.navigator.plugins)) === Object.prototype.toString.call(p()), flip(true, false)),
    ]
  });

  await scenario(g, {
    name: "Override mimeTypes", obj: ND, prop: "mimeTypes",
    mutate: () => Object.defineProperty(ND, "mimeTypes", getter([fakeMime])),
    checks: [
      chk("mimeTypes length", () => m().length, to(1), "e.g. -1 → 1 when absent before."),
      chk("instanceof MimeTypeArray", () => m() instanceof MimeTypeArray, flip(true, false)),
      chk("object tag", tag(m), (b, a) => b === "[object MimeTypeArray]" && a === "[object Array]"),
      chk("namedItem() present", () => typeof m().namedItem === "function", flip(true, false)),
      chk("mimeTypes[0].enabledPlugin is a Plugin", () => m()[0] ? m()[0].enabledPlugin instanceof Plugin : false, (b, a) => a === false),
    ]
  });

  await scenario(g, {
    name: "In-place edit of native list",
    mutate: () => { navigator.plugins.length = 99; navigator.plugins[5] = "x"; navigator.mimeTypes.length = 99; },
    checks: [
      chk("plugins.length ignored", () => navigator.plugins.length, same),
      chk("plugins[5] ignored", () => String(navigator.plugins[5]), same),
      chk("mimeTypes.length ignored", () => navigator.mimeTypes.length, same),
    ]
  });
}

/* ---------- T3. window.chrome ---------- */
async function tamperChrome() {
  const g = group("Tamper · window.chrome", "chrome.runtime stub, hidden keys and API overrides");
  const had = typeof window.chrome === "object" && window.chrome !== null;
  const rtDesc = had ? getDesc(window.chrome, "runtime") : null;
  const keys = () => JSON.stringify(window.chrome ? Object.keys(window.chrome) : null);
  const run = (name, mutate, checks) => scenario(g, {
    name,
    mutate: () => { if (!had) window.chrome = {}; return mutate(); },
    restore: () => { if (!had) delete window.chrome; else put(window.chrome, "runtime", rtDesc); },
    checks
  });

  await run("chrome.runtime = {}", () => { window.chrome.runtime = {}; }, [
    chk("Object.keys(chrome)", keys, (b, a) => a.includes('"runtime"'), "[] → [\"runtime\"] expected."),
    chk("typeof chrome.runtime", () => typeof window.chrome.runtime, to("object")),
    chk("runtime key count", () => window.chrome.runtime ? Object.keys(window.chrome.runtime).length : -1, (b, a) => a === 0, "-1 → 0 reveals an empty stub."),
    chk("runtime.connect is function", () => typeof window.chrome.runtime.connect === "function", to(false), "Stub lacks the real API."),
    chk("runtime.sendMessage is function", () => typeof window.chrome.runtime.sendMessage === "function", to(false)),
    chk("key-length fingerprint", () => Object.keys(window.chrome || {}).map(k => k.length).join("|"), diff, "Bd()-style key fingerprint changed."),
    chk("chrome keys hash", () => hash(Object.keys(window.chrome || {}).join()), diff),
    chk("chrome descriptor hash", () => dHash(window.chrome || {}, "runtime"), diff),
  ]);

  await run("Hidden chrome.runtime (non-enumerable)",
    () => Object.defineProperty(window.chrome, "runtime", { value: {}, enumerable: false, configurable: true }), [
    chk("Object.keys(chrome) hides it", keys, same),
    chk("'runtime' in chrome", () => "runtime" in window.chrome, to(true), "Visible via `in`."),
    chk("listed in getOwnPropertyNames", () => Object.getOwnPropertyNames(window.chrome).includes("runtime"), to(true)),
  ]);

  for (const fn of ["loadTimes", "csi"]) {
    if (!had || typeof window.chrome[fn] !== "function") {
      row(g, `chrome.${fn}`, "not present", "info", "Missing in this browser or context.");
      continue;
    }
    await scenario(g, {
      name: `Overwrite chrome.${fn}`, obj: window.chrome, prop: fn,
      mutate: () => { window.chrome[fn] = function () { return {}; }; },
      checks: [
        chk("is native", () => isNative(window.chrome[fn]), flip(true, false), "JS function is detectable."),
        chk("name", () => window.chrome[fn].name, (b, a) => b === fn && a !== fn),
        chk("returns object", () => typeof window.chrome[fn](), to("object")),
      ]
    });
  }
}

/* ---------- T4. languages ---------- */
async function tamperLanguages() {
  const g = group("Tamper · navigator.languages / language", "Frozen native array vs plain-array spoof");
  const L = () => navigator.languages;
  const fake = ["xx-XX", "xx"];

  await scenario(g, {
    name: "Override languages", obj: ND, prop: "languages",
    mutate: () => Object.defineProperty(ND, "languages", { get: () => ["xx-XX", "xx"], configurable: true, enumerable: true }),
    checks: [
      chk("value", L, to(fake)),
      chk("Array.isArray", () => Array.isArray(L()), flip(true, true), "Still an array either way."),
      chk("frozen", () => Object.isFrozen(L()), flip(true, false), "Native array is frozen."),
      chk("stable identity", () => L() === L(), flip(true, false), "Native returns the same object."),
      chk("push() throws", () => { try { L().push("z"); return "no throw"; } catch (e) { return e.name; } }, flip("TypeError", "no throw")),
      chk("language === languages[0]", () => navigator.language === L()[0], flip(true, false)),
      chk("getter is native", getterNative(ND, "languages"), flip(true, false)),
      chk("illegal-invocation throws", illegal(ND, "languages"), flip("TypeError", "no throw")),
      chk("object tag", () => Object.prototype.toString.call(L()), same),
      chk("iframe realm agrees", () => frameNav(w => Object.isFrozen(w.navigator.languages)) === Object.isFrozen(L()), flip(true, false)),
    ]
  });

  await scenario(g, {
    name: "Override language", obj: ND, prop: "language",
    mutate: () => Object.defineProperty(ND, "language", { get: () => "zz", configurable: true, enumerable: true }),
    checks: [
      chk("value", () => navigator.language, to("zz")),
      chk("matches languages[0]", () => navigator.language === navigator.languages[0], (b, a) => a === false),
      chk("matches Intl locale", () => Intl.DateTimeFormat().resolvedOptions().locale.split("-")[0] === navigator.language.split("-")[0], (b, a) => a === false),
    ]
  });

  await scenario(g, {
    name: "Assign navigator.languages", obj: navigator, prop: "languages",
    mutate: () => { navigator.languages = ["q"]; },
    checks: [chk("write ignored", L, same)]
  });

  await scenario(g, {
    name: "In-place edit of languages",
    mutate: () => { try { navigator.languages.length = 0; } catch (e) {} },
    checks: [chk("length unchanged", () => navigator.languages.length, same, "Frozen array.")]
  });
}

/* ---------- T5. permissions ---------- */
async function tamperPermissions() {
  const g = group("Tamper · Permissions / Notification", "State consistency and native-ness of the Permissions API");
  if (typeof Permissions === "undefined" || !navigator.permissions || typeof Notification === "undefined") {
    row(g, "Permissions API", "unavailable", "info", "No visible change expected (e.g. jsdom).");
    return;
  }
  const q = n => () => navigator.permissions.query({ name: n });
  const map = { default: "prompt" };
  const cur = Notification.permission;
  const other = cur === "granted" ? "denied" : "granted";

  await scenario(g, {
    name: "Override Notification.permission", obj: Notification, prop: "permission",
    mutate: () => Object.defineProperty(Notification, "permission", { get: () => other, configurable: true }),
    checks: [
      chk("value", () => Notification.permission, to(other)),
      chk("matches permissions.query", async () => {
        const r = await navigator.permissions.query({ name: "notifications" });
        return (map[Notification.permission] || Notification.permission) === r.state;
      }, flip(true, false), "Native values stay in sync."),
      chk("getter is native", getterNative(Notification, "permission"), flip(true, false)),
    ]
  });

  await scenario(g, {
    name: "Override permissions.query", obj: Permissions.prototype, prop: "query",
    mutate: () => { Permissions.prototype.query = function () { return Promise.resolve({ state: "granted" }); }; },
    checks: [
      chk("result state", async () => (await q("notifications")()).state, to("granted")),
      chk("result instanceof PermissionStatus", async () => (await q("notifications")()) instanceof PermissionStatus, flip(true, false)),
      chk("is native", () => isNative(Permissions.prototype.query), flip(true, false)),
      chk("name", () => Permissions.prototype.query.name, (b, a) => b === "query" && a !== b),
      chk("length", () => Permissions.prototype.query.length, (b, a) => b === 1 && a === 0),
      chk("invalid name rejects with TypeError", async () => { try { await q("bogus")(); return "resolved"; } catch (e) { return e.name; } }, flip("TypeError", "resolved")),
    ]
  });
}

/* ---------- T6. Function.prototype.toString ---------- */
async function tamperToString() {
  const g = group("Tamper · Function.prototype.toString", "The usual way spoofs hide themselves");
  await scenario(g, {
    name: "Override toString", obj: Function.prototype, prop: "toString",
    mutate: () => { Function.prototype.toString = function () { return "function () { [native code] }"; }; },
    checks: [
      chk("JS arrow looks native", () => isNative(() => 1), flip(false, true), "Spoof defeats native-code checks."),
      chk("toString has own 'prototype'", () => Object.prototype.hasOwnProperty.call(Function.prototype.toString, "prototype"), flip(false, true), "Native methods have none."),
      chk("name", () => Function.prototype.toString.name, (b, a) => b === "toString" && a !== b),
    ]
  });
}

/* ---------- T7. Navigator / Screen / Window / Date / Canvas ---------- */
async function tamperEnvironment() {
  const g = group("Tamper · navigator, screen, window, date, canvas", "Override a value and verify related values react correctly");
  const nav = async (prop, value, extra = []) => {
    if (!(prop in navigator)) { row(g, `navigator.${prop}`, "not supported", "info"); return; }
    await scenario(g, {
      name: `Override ${prop}`, obj: ND, prop,
      mutate: () => Object.defineProperty(ND, prop, { get: () => value, configurable: true, enumerable: true }),
      checks: [
        chk("value", () => navigator[prop], to(value)),
        chk("getter is native", getterNative(ND, prop), flip(true, false)),
        ...extra
      ]
    });
  };

  await nav("userAgent", "TamperedUA/1.0", [
    chk("appVersion consistent", () => navigator.userAgent.includes(navigator.appVersion), flip(true, false), "appVersion derives from UA natively."),
  ]);
  await nav("platform", navigator.platform === "Win32" ? "Linux x86_64" : "Win32");
  await nav("hardwareConcurrency", 99, [
    chk("stays a positive integer", () => Number.isInteger(navigator.hardwareConcurrency) && navigator.hardwareConcurrency > 0, to(true)),
  ]);
  await nav("deviceMemory", 99);
  await nav("vendor", "Tampered Inc.");
  await nav("maxTouchPoints", navigator.maxTouchPoints > 0 ? 0 : 5, [
    chk("agrees with 'ontouchstart'", () => (navigator.maxTouchPoints > 0) === ("ontouchstart" in window), flip(true, false)),
  ]);

  await scenario(g, {
    name: "Override screen.width", obj: Screen.prototype, prop: "width",
    mutate: () => Object.defineProperty(Screen.prototype, "width", { get: () => 1, configurable: true, enumerable: true }),
    checks: [
      chk("value", () => screen.width, to(1)),
      chk("availWidth <= width", () => screen.availWidth <= screen.width, flip(true, false)),
      chk("getter is native", getterNative(Screen.prototype, "width"), flip(true, false)),
    ]
  });

  await scenario(g, {
    name: "Override window.outerWidth", obj: window, prop: "outerWidth",
    mutate: () => Object.defineProperty(window, "outerWidth", { get: () => 0, configurable: true }),
    checks: [
      chk("value", () => window.outerWidth, to(0)),
      chk("outerWidth >= innerWidth", () => window.outerWidth >= window.innerWidth, flip(true, false)),
    ]
  });

  const realTZ = Date.prototype.getTimezoneOffset;
  const tzOk = () => {
    const m = /GMT([+-])(\d{2})(\d{2})/.exec(new Date().toString());
    return m ? (m[1] === "+" ? 1 : -1) * (+m[2] * 60 + +m[3]) === -new Date().getTimezoneOffset() : "n/a";
  };
  await scenario(g, {
    name: "Override getTimezoneOffset", obj: Date.prototype, prop: "getTimezoneOffset",
    mutate: () => { Date.prototype.getTimezoneOffset = function () { return realTZ.call(this) + 120; }; },
    checks: [
      chk("offset shifted by 120", () => new Date().getTimezoneOffset() - realTZ.call(new Date()), to(120)),
      chk("matches Date.toString() zone", tzOk, flip(true, false)),
      chk("is native", () => isNative(Date.prototype.getTimezoneOffset), flip(true, false)),
    ]
  });

  const origURL = HTMLCanvasElement.prototype.toDataURL;
  const canvasStable = () => { const c = document.createElement("canvas"); c.width = c.height = 8; return c.toDataURL() === c.toDataURL(); };
  await scenario(g, {
    name: "Add noise to canvas.toDataURL", obj: HTMLCanvasElement.prototype, prop: "toDataURL",
    mutate: () => { HTMLCanvasElement.prototype.toDataURL = function (...a) { return origURL.apply(this, a) + Math.random(); }; },
    checks: [
      chk("two reads are identical", canvasStable, flip(true, false), "Native output is deterministic."),
      chk("is native", () => isNative(HTMLCanvasElement.prototype.toDataURL), flip(true, false)),
    ]
  });
}

/* ---------- T8. static integrity signals ---------- */
function checkIntegrity() {
  const g = group("Integrity signals", "Read-only checks that spoofs commonly break");
  const yes = (cond, label, note) => row(g, label, cond, cond ? "ok" : "bad", cond ? "" : note);

  yes(Object.getPrototypeOf(navigator) === ND, "navigator prototype chain intact", "navigator proto replaced (Proxy?).");
  yes(Object.prototype.toString.call(navigator) === "[object Navigator]", "navigator toStringTag", "Unexpected tag.");
  yes(Object.getOwnPropertyNames(navigator).length === 0, "navigator has no own properties", "Own properties were added.");
  yes(getterName(ND, "webdriver")() === "get webdriver", "webdriver getter name", "Getter renamed or missing.");
  yes(illegal(ND, "webdriver")() === "TypeError", "webdriver getter illegal-invocation", "Getter does not reject foreign receivers.");
  yes(illegal(ND, "plugins")() === "TypeError", "plugins getter illegal-invocation", "Getter does not reject foreign receivers.");
  yes(illegal(ND, "languages")() === "TypeError", "languages getter illegal-invocation", "Getter does not reject foreign receivers.");
  yes(isNative(Function.prototype.toString), "Function.prototype.toString native", "toString was replaced.");
  yes(!Object.prototype.hasOwnProperty.call(Function.prototype.toString, "prototype"), "toString has no 'prototype'", "toString is a JS function.");

  const attr = document.documentElement.getAttribute("webdriver");
  row(g, "<html webdriver> attribute", attr === null ? "none" : attr, attr === null ? "ok" : "bad");

  const rtt = navigator.connection ? navigator.connection.rtt : undefined;
  row(g, "connection.rtt", rtt ?? "n/a", rtt === 0 ? "warn" : "info", rtt === 0 ? "Zero RTT is common in headless Chrome." : "");

  const uad = navigator.userAgentData;
  const brands = uad ? uad.brands.map(b => b.brand).join(", ") : "n/a";
  row(g, "userAgentData brands", brands, /Headless/i.test(brands) ? "bad" : "info");
  if (uad) {
    const mobUA = /Mobi|Android/i.test(navigator.userAgent);
    row(g, "userAgentData.mobile matches UA", uad.mobile === mobUA, uad.mobile === mobUA ? "ok" : "bad");
  }

  row(g, "pdfViewerEnabled", navigator.pdfViewerEnabled ?? "n/a", navigator.pdfViewerEnabled === false ? "warn" : "info");
  row(g, "document.visibilityState", document.visibilityState, "info");
  const chromeH = window.outerHeight - window.innerHeight;
  row(g, "outerHeight − innerHeight", chromeH, chromeH === 0 ? "warn" : "ok", chromeH === 0 ? "No browser UI: kiosk or headless." : "");

  const kw = /puppeteer|playwright|selenium|webdriver|phantom|nightmare/i.exec(String(new Error().stack));
  row(g, "Error stack keywords", kw ? kw[0] : "none", kw ? "bad" : "ok");

  const nodeGlobals = ["process", "Buffer", "require", "module"].filter(k => typeof window[k] !== "undefined");
  row(g, "Node-style globals", nodeGlobals.join(", ") || "none", nodeGlobals.length ? "bad" : "ok");

  const loc = Intl.DateTimeFormat().resolvedOptions().locale;
  row(g, "Intl locale vs navigator.language", `${loc} / ${navigator.language}`,
    loc.split("-")[0] === navigator.language.split("-")[0] ? "ok" : "warn");
  row(g, "Timezone", Intl.DateTimeFormat().resolvedOptions().timeZone, "info");
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
  let total = 0;

  groups.forEach(g => {
    const card = el("section", "card");
    card.append(el("h2", "", g.title), el("div", "desc", g.desc));
    g.rows.forEach(r => {
      total++;
      if (counts[r.status] !== undefined) counts[r.status]++;
      const d = el("div", "row");
      d.dataset.status = r.status;
      d.append(el("span", "label", r.label),
               el("span", "badge " + r.status, r.status === "ok" ? "pass" : r.status === "bad" ? "fail" : r.status));

      const v = el("span", "value");
      if (r.before !== undefined) {
        v.append(el("span", "chip", r.before), el("span", "arrow", " → "), el("span", "chip", r.after));
        v.append(el("span", r.restored ? "rest yes" : "rest no", r.restored ? "↺ restored" : "↺ not restored"));
      } else {
        v.textContent = r.value;
      }
      d.append(v);
      if (r.note) d.append(el("span", "note", r.note));
      card.append(d);
    });
    root.append(card);
  });

  const s = document.getElementById("summary");
  s.replaceChildren(el("span", "pill info", `${total} checks`),
                    el("span", "pill ok", `${counts.ok} passed`),
                    el("span", "pill warn", `${counts.warn} warnings`),
                    el("span", "pill bad", `${counts.bad} failed`));
}

document.getElementById("onlyIssues").addEventListener("change", e =>
  document.getElementById("results").classList.toggle("hide-ok", e.target.checked));

(async () => {
  checkErrorStack();
  checkWebdriver();
  checkPlugins();
  checkChrome();
  checkLanguages();
  await checkPermissions();
  checkExtras();
  checkIntegrity();
  await tamperWebdriver();
  await tamperPlugins();
  await tamperChrome();
  await tamperLanguages();
  await tamperPermissions();
  await tamperToString();
  await tamperEnvironment();
  render();
})();
