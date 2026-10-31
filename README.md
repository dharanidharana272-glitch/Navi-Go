# Navi Go AI – Explore the world with smart guidance

A static web app (no build step): open `index.html`, or serve the folder (`npm start`) to get the offline/installable (PWA) features.

## Features
- Sign-up / login with 18+ age check, profile, and 4 languages (English, Tamil, Hindi, Malayalam)
- 325 destinations in 33 countries (`data.js`, source `destinations.xlsx`): Europe, Japan (29 places), India's neighbours (Nepal, Bhutan, Sri Lanka, Maldives, Bangladesh, Myanmar, Pakistan, Afghanistan, China) and Thailand and Malaysia: photos, trip plans by traveller type, country pages, top-rated list, search
- **Live weather** on every destination page (current conditions only)
- **International flight search** between 171 airports, plus a "Find flights" button on every destination page
- Installable and available offline as an app shell (`manifest.webmanifest`, `sw.js`; only on http/https)

## Project layout
| File | Purpose |
|---|---|
| `index.html`, `style.css` | Page structure and styles |
| `script.js` | App logic: accounts, navigation, destinations, trip plans, flight search UI |
| `weather.js` | Live weather (Open-Meteo) |
| `flights.js`, `airports.js` | Flight model and the 171-airport table + airport of every destination |
| `visa.js` | Entry rules for Indian passport holders (visa-free section) |
| `data.js`, `destinations.xlsx` | Destination data (keep both in sync) |
| `i18n.js` | All texts in 4 languages |
| `media.js` | Place photos (Wikipedia), cached in the browser |
| `tools/check.js`, `tools/e2e.js`, `tools/build_dataset.js` | Quality checks, end-to-end test, CSV export |

## Visa-free countries for Indians (Home page)
The Home page has a "Visa-free countries for Indians" section, and each of these countries shows an "Entry for Indian passport holders" card. Verified on **12 Oct 2026** against the Ministry of External Affairs list (updated 2 Feb 2026) and official announcements:
| Country | Rule |
|---|---|
| Nepal | No visa; carry a passport or voter ID |
| Bhutan | No visa, but an entry permit and the daily Sustainable Development Fee apply |
| Maldives | Visa-free up to 90 days |
| Thailand | Visa-free up to **30 days** for tourism (reduced from 60 on 15 Sep 2026); register on TDAC |
| Malaysia | Visa-free up to 30 days for entry until 31 Dec 2026; MDAC arrival card |
| Sri Lanka | Free 30-day ETA – not strictly visa-free: apply online first (eta.gov.lk) |

All other countries in the app (Europe, Japan, China, Pakistan, Bangladesh, Myanmar, Afghanistan) need a visa or e-visa, so they are not listed. Visa rules change often: edit `VISA` and `VISA_CHECKED` in `visa.js` when they do, and confirm with the embassy before booking.

## India's neighbours and Japan
Pakistan: there are no direct India–Pakistan flights, so routes go through Gulf cities. Afghanistan: governments advise against all travel; routes are indicative only. Myanmar: armed conflict affects large parts of the country (Rakhine State destinations were left out). Bhutan: the only international airport is Paro. Visitor numbers in `data.js` are rounded estimates used for ranking, not official statistics. Photos use the optional `wiki` field (the exact Wikipedia article title) when a destination has one.

## Quality checks
```
node tools/check.js     # data, translations, airports, every flight route, HTML/JS wiring (no install needed)
npm install && npm run e2e   # sign-up, login, lockout, weather, flights and all 4 languages in a simulated browser
```

## Run (backend + frontend)
```
node server.js                      # Node 22+, no npm install; http://localhost:3000
ADMIN_EMAIL=you@example.com node server.js
```
Env: `PORT`, `DB_PATH` (SQLite file, default `storage/navigo.db`), `ADMIN_EMAIL` (that account becomes admin; if unset, the FIRST account registered becomes admin - always set it in production), `COOKIE_SECURE=1` behind HTTPS. Docker: `docker build -t navigo . && docker run -p 3000:3000 -v navigo:/data -e ADMIN_EMAIL=you@example.com navigo`. Host behind HTTPS (Render, Railway, Fly.io, Caddy, nginx).

## Backend (`server.js`) and client (`api.js`)
SQLite database; scrypt password hashes; random server sessions in an HttpOnly SameSite cookie (14 days); 18+ check on the server; login lockout (5 wrong tries, 30 s doubling to 5 min); 120 requests/min per IP; CSRF header required on POST; security headers and CSP on every response; private files (`server.js`, `storage/`, `tools/`, spreadsheets) are not served.
API: `POST /api/register|login|logout`, `GET /api/me`, `GET|POST /api/favorites` (POST toggles), `GET|POST /api/trips`, `GET|POST /api/reviews`, `GET /api/admin/stats`, `POST /api/admin/delete-review`, `GET /healthz`. Admin panel: `/admin`. Legal: `legal.html`.
Country pages also show emergency numbers, an INR currency converter (live rates from open.er-api.com) and a packing checklist (`extras.js`).
Not done: visa cards for 27 countries, new countries, translations of the 116 new places, email, payments/booking, live flight prices; `tools/e2e.js` still targets the old local login and needs updating.

## Accessibility
Labelled form controls, keyboard-friendly forms (Enter submits), skip link, one `main` landmark, `aria-current` on navigation, live-region toasts, visible focus rings, reduced-motion support, `lang` updated per language.

## Data quality
Every destination has a description, readable visitor numbers, currency with ISO code, and an honest safety note (Ukraine and Russia point to government travel advisories). Place names, airlines and cities are translated where a translation exists; brand names such as airlines stay in Latin script.

## Flight data (international)
| File | Content |
|---|---|
| `airports.js` | 171 airports (India, Gulf hubs, Europe, Japan, South and South-East Asia, China, Singapore, Hong Kong) and the airport for **every one of the 325 destinations** |
| `flights.js` | Non-stop and one/two-stop itineraries via hubs, airlines, time zones (incl. EU summer time), duration, fares in INR |
| `Airports.csv`, `Destination_Airports.csv`, `International_Flights.csv` | Exports (`npm run build:data`) |

Schedules and fares are **estimates** generated from distance, time zones and typical airline networks (deterministic: the same search always gives the same result). They are not live airline data – confirm on the airline's site before booking. Special cases: Monaco has no airport (use Nice); Ukraine's airspace is closed to commercial flights (use Rzeszów in Poland, then travel overland); some Russia routes are suspended.

## Photos and map
Place photos come from Wikipedia and the flight-map outline from Natural Earth (world-atlas); both are fetched once and cached in the browser. Without internet the app shows colour tiles with icons and the route without land outline.

## Live weather (right now only - no forecast)
Every destination page shows the **current** weather at the destination's exact latitude/longitude: a chip (icon + temperature) on the photo and a "Weather right now" card under the header with temperature, feels-like, condition, humidity, wind (speed, direction, gusts), precipitation, cloud cover, pressure and the destination's local time.
- Source: Open-Meteo `current` endpoint (free, no API key) - **needs an internet connection**. A new reading is published every 15 minutes; the page re-requests it every 60 seconds (HTTP cache bypassed) so it appears as soon as it exists.
- The card prints the reading's own timestamp (destination local time) and its age ("7 min ago"), so it can be checked against any other source ("Compare on Google" link included). Readings older than 35 min show a warning.
- Invalid or impossible data (e.g. 999 C, humidity above 100%) is rejected, never displayed.
- Offline: "No internet" message; old data is never shown as live. It loads again automatically when the connection returns.
- Values are model/analysis data for the map point, so they can differ by 1-2 C from a nearby weather station (that is also why Google can show a slightly different number).
- Code: `weather.js` (+ card styles in `style.css`, texts in `i18n.js` in 4 languages).

## Coordinate corrections (so the weather is for the right place)
77 destination coordinates in `data.js` / `destinations.xlsx` were wrong by 5-65 km (some lay in the sea or in another region) and were corrected to the town/landmark centre, e.g. Vladivostok (50 km too far north), Preikestolen (45 km), Fjallbacka (65 km), Reynisfjara (60 km), Pisa, Ostend, Delphi, Ephesus, Malta towns, Lake Baikal (now Listvyanka) and Kamchatka (now Petropavlovsk-Kamchatsky). The airport for every destination did not change; distances in `Destination_Airports.csv` were regenerated.
