#!/usr/bin/env node
/* Navi Go AI - automated quality checks.  Run:  node tools/check.js   (exit code 1 if anything fails)
   Checks: destination data, translations, airport mapping, every flight route, HTML/JS wiring. */
const fs = require("fs"), vm = require("vm"), path = require("path");
const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");
const noop = () => {};
const sandbox = { window: { addEventListener: noop }, document: { addEventListener: noop, querySelectorAll: () => [], getElementById: () => null, createElement: () => ({}), head: { appendChild: noop }, documentElement: {} },
  localStorage: { getItem: () => null, setItem: noop }, navigator: {}, console, Intl, Date, Math };
const ctx = vm.createContext(sandbox);
vm.runInContext(["data.js", "i18n.js", "airports.js", "flights.js", "visa.js"].map(read).join("\n") +
  ";this.X={demoData,I18N,VAL,AP,AIRPORT_LIST,generateFlights,airportFor,distKm,VISA}", ctx);
const { demoData, I18N, VAL, AP, AIRPORT_LIST, generateFlights, airportFor, distKm, VISA } = ctx.X;

let fails = 0, passes = 0;
const ok = (cond, msg, detail) => { if (cond) passes++; else { fails++; console.log("  FAIL  " + msg + (detail ? "  -> " + String(detail).slice(0, 300) : "")); } };
const section = n => console.log("\n" + n);

section("Destination data");
ok(demoData.length === 325, "325 destinations", demoData.length);
const nCountries = new Set(demoData.map(x => x.country)).size;
ok(nCountries === 33, "33 countries (" + nCountries + ")");
ok(["Japan"].every(c => demoData.filter(x => x.country === c).length >= 25), "Japan has 25+ destinations", demoData.filter(x => x.country === "Japan").length);
const NEIGHBOURS = ["Nepal", "Bhutan", "Sri Lanka", "Maldives", "Bangladesh", "Myanmar", "Pakistan", "Afghanistan", "China"];
ok(NEIGHBOURS.every(c => demoData.some(x => x.country === c)), "all India's neighbouring countries are covered");
const need = ["destination", "country", "region", "category", "lat", "lng", "tourists", "currency", "religion", "foods", "language", "best", "cost", "safety", "culture", "description"];
ok(demoData.every(x => need.every(k => String(x[k] ?? "").trim() !== "")), "no empty field in any destination",
  demoData.flatMap(x => need.filter(k => String(x[k] ?? "").trim() === "").map(k => x.destination + "." + k)).join(", "));
ok(new Set(demoData.map(x => x.destination + "|" + x.country)).size === demoData.length, "destination+country is unique");
ok(demoData.every(x => x.lat >= 0 && x.lat <= 72 && x.lng >= -25 && x.lng <= 180), "coordinates inside the Europe/Russia range");
ok(demoData.every(x => !/\.\d+$/.test(String(x.tourists)) || /million/.test(x.tourists)), "visitor numbers are readable (no 500000.0)");
ok(demoData.every(x => /\((EUR|DKK|RUB|NOK|SEK|CHF|TRY|UAH|GBP|ISK|RSD|JPY|NPR|BTN|LKR|MVR|BDT|MMK|PKR|AFN|CNY|THB|MYR)\)/.test(x.currency)), "currency always shows its ISO code");
ok(demoData.filter(x => x.country === "Ukraine").every(x => !/^Generally safe/.test(x.safety)), "Ukraine safety text reflects the war");
ok(demoData.filter(x => x.country === "Afghanistan").every(x => /^Do not travel/.test(x.safety)), "Afghanistan says do not travel");
ok(demoData.filter(x => ["Myanmar", "Pakistan"].includes(x.country)).every(x => /travel advisory/i.test(x.safety)), "Myanmar and Pakistan point to travel advisories");
ok(demoData.filter(x => x.country === "Russia").every(x => /advisory/i.test(x.safety)), "Russia safety text points to travel advisories");

section("Translations (English, Tamil, Hindi, Malayalam)");
const keys = Object.keys(I18N);
ok(keys.every(k => Array.isArray(I18N[k]) && I18N[k].length === 4 && I18N[k].every(s => typeof s === "string" && s.trim())), "every UI text has 4 non-empty translations", keys.filter(k => !(Array.isArray(I18N[k]) && I18N[k].length === 4 && I18N[k].every(s => s && s.trim()))).join(","));
const ph = s => (s.match(/\{[a-z]+\}/g) || []).sort().join();
ok(keys.every(k => I18N[k].every(s => ph(s) === ph(I18N[k][0]))), "{placeholders} are identical in all languages", keys.filter(k => !I18N[k].every(s => ph(s) === ph(I18N[k][0]))).join(","));
const used = new Set(), html = read("index.html");
for (const f of ["script.js", "weather.js", "media.js", "flights.js"]) for (const m of read(f).matchAll(/\bt\(\s*"([A-Za-z0-9_]+)"/g)) if (!m[1].endsWith("_")) used.add(m[1]);   // "wx_"+x style prefixes are built dynamically
for (const m of html.matchAll(/data-i18n(?:-html|-ph|-aria)?="([^"]+)"/g)) used.add(m[1]);
ok([...used].every(k => I18N[k]), "every text key used in the code exists", [...used].filter(k => !I18N[k]).join(","));
ok(AIRPORT_LIST.every(a => VAL.city[a.city]), "every airport city has a Tamil/Hindi/Malayalam name", AIRPORT_LIST.filter(a => !VAL.city[a.city]).map(a => a.city).join(", "));
for (const f of ["country", "category", "religion", "language", "best", "cost", "currency", "safety"]) {
  const miss = [...new Set(demoData.map(x => x[f]))].filter(v => !(VAL[f] && VAL[f][v]) && !Object.keys(VAL[f] || {}).some(k => v.includes(k)));
  ok(!miss.length, "'" + f + "' values have translations", miss.join(" | "));
}

section("Visa-free section");
ok(Object.keys(VISA).every(c => demoData.some(x => x.country === c)), "every visa-listed country has destinations");
ok(Object.values(VISA).every(v => I18N["visa_" + v.n] && I18N["vs_" + v.n]), "every visa entry has its texts");
ok(Object.keys(VISA).sort().join() === ["Bhutan", "Malaysia", "Maldives", "Nepal", "Sri Lanka", "Thailand"].join(), "visa-free list matches the verified list");
const flags = read("script.js").match(/FLAG_CC=\{([^}]*)\}/)[1];
ok([...new Set(demoData.map(x => x.country))].every(c => flags.includes(c + ":") || flags.includes('"' + c + '":')), "every country has a flag");

section("Airports");
ok(AIRPORT_LIST.length >= 100, "airport list loaded (" + AIRPORT_LIST.length + ")");
ok(demoData.every(x => AP[airportFor(x)]), "every destination maps to an airport");
const far = demoData.filter(x => x.country !== "Ukraine").filter(x => { const a = AP[airportFor(x)]; return require_km(+x.lat, +x.lng, a.lat, a.lng) > 330; });
ok(far.length === 0, "destinations are within 330 km of their airport (Ukraine is excluded: its airspace is closed, travellers use a Polish/Moldovan airport)", far.map(x => x.destination).join(", "));
function require_km(a, b, c, d) { const r = Math.PI / 180, h = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 2 * 6371 * Math.asin(Math.sqrt(h)); }

section("Flights: every airport pair");
const codes = AIRPORT_LIST.map(a => a.code); let rows = 0; const bad = [];
for (const f of codes) for (const t of codes) {
  if (f === t) continue;
  let r; try { r = generateFlights(f, t, "2026-12-20"); } catch (e) { bad.push(f + ">" + t + " throws"); continue; }
  if (!r || !r.length) { bad.push(f + ">" + t + " empty"); continue; }
  const d = distKm(f, t);
  for (const x of r) {
    rows++;
    const legs = x[7].split(" > ");
    if (x[0] !== f || x[1] !== t || legs[0] !== f || legs[legs.length - 1] !== t) bad.push(f + ">" + t + " endpoints");
    if (legs.length - 2 !== x[6]) bad.push(f + ">" + t + " stops");
    if (!/^\d\d:\d\d$/.test(x[3]) || !/^\d\d:\d\d( [+-]\d)?$/.test(x[4])) bad.push(f + ">" + t + " time format");
    if (!(x[5] > 0) || x[5] < d / 1000 * 60 * 0.9) bad.push(f + ">" + t + " impossible duration " + x[5]);
    if (!(x[9] > 0) || !isFinite(x[9])) bad.push(f + ">" + t + " price");
    if (new Set(legs).size !== legs.length) bad.push(f + ">" + t + " loop");
  }
}
ok(!bad.length, codes.length * (codes.length - 1) + " routes / " + rows + " flights are consistent", bad.slice(0, 5).join("; "));
ok(generateFlights("DEL", "FRA", "2026-12-20").length > 0 && JSON.stringify(generateFlights("DEL", "FRA", "2026-12-20")) === JSON.stringify(generateFlights("DEL", "FRA", "2026-12-20")), "results are deterministic");

section("HTML / JavaScript wiring");
const js = ["data.js", "i18n.js", "media.js", "airports.js", "flights.js", "weather.js", "script.js"].map(read).join("\n");
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
for (const m of js.matchAll(/\bid=\\?"([A-Za-z0-9_-]+)\\?"/g)) ids.add(m[1]);
const refs = [...new Set([...js.matchAll(/\$\("([A-Za-z0-9_-]+)"\)/g)].map(m => m[1]))];
ok(refs.every(i => ids.has(i)), "every $('id') in the code exists in the page", refs.filter(i => !ids.has(i)).join(","));
const fnDefs = new Set([...js.matchAll(/function\s+([A-Za-z0-9_]+)/g)].map(m => m[1]));
const handlers = [...new Set([...(html + js).matchAll(/on(?:click|change|input|keydown|submit)=\\?"[^"]*?\b([A-Za-z_][A-Za-z0-9_]*)\(/g)].map(m => m[1]))].filter(n => !["if", "event", "state", "preventDefault"].includes(n));
ok(handlers.every(n => fnDefs.has(n)), "every inline handler calls an existing function", handlers.filter(n => !fnDefs.has(n)).join(","));
ok(!/<button(?![^>]* type=)/.test(html + js), "every <button> has a type");
ok(!/\bpassword\s*[:,]\s*password\b/.test(read("script.js")), "passwords are not stored in plain text");
for (const f of ["manifest.webmanifest", "sw.js", "assets/icon-192.png", "assets/icon-512.png", "assets/logo.png", "assets/people/family.jpg"]) ok(fs.existsSync(path.join(root, f)), f + " exists");

console.log("\n" + (fails ? fails + " check(s) FAILED" : "All checks passed") + " (" + passes + " passed)");
process.exit(fails ? 1 : 0);
