# Tetris Pinas

A browser Tetris game with Marathon, 40-line Sprint, Blitz, Practice, and a server-controlled two-player race. The dashboard keeps its Filipino-inspired artwork and glass styling.

## Run

Use Node.js 22 or later. From this folder, run `node server.cjs` (or `npm start` if your PowerShell execution policy permits npm scripts), then open `http://localhost:3000`. The server is required for accounts, friends presence, and multiplayer. Opening `index.html` directly still allows guest solo play.

Sign Up and Log In work through the included Node server. Passwords are salted and hashed; account records are saved in `.tetris-accounts.json`, which is ignored by Git and never served as a public file. A signed-in account keeps a stable player ID on this server. Game progress, settings, favorites, and match history are saved locally in the browser under that player ID. Online rooms and presence use live server sessions.

Optional Google and Facebook buttons appear only after valid Firebase settings have been added to the `firebaseConfig` section of `index.html` and their providers have been enabled in Firebase. Email/password login works on the Node server without Firebase.

## Play

- Marathon: clear lines, gain a level every 10 lines, and try to beat your best score. Unfinished runs save automatically and can be resumed.
- 40-line Sprint: clear 40 lines as fast as possible. The best successful time, to the millisecond, determines your rank.
- Blitz: score as many points as possible in 120 seconds of active play.
- Practice: position pieces without automatic gravity by default. Optional gravity, fall interval, grid, and ghost can be set under Settings.
- Online: create a room, join by code or link, or find a real opponent. Both players receive the same 7-bag sequence and race on separate boards. The server determines results.

All modes use the shared 10-column, 20-visible-row rules with two hidden spawn rows, SRS kicks, Hold, five Next pieces, 500 ms lock delay, combos, T-Spins, Back-to-Back bonuses, Perfect Clears, and the same scoring rules. The online race runs the shared rules on the server, so clients cannot submit their own score or win result.

Keyboard: Left/Right move, Down soft drops, Space hard drops, Up or X rotates clockwise, Z rotates counterclockwise, C or Shift holds, P pauses, Esc opens the menu, and R restarts after confirmation. Hold a direction for DAS/ARR movement. Settings offers alternate key bindings and timing controls. On touchscreens, tap to rotate, swipe to move or drop, swipe up to hard drop, and hold the board to pause. Use C or Shift on a keyboard to hold a piece.

The combined Favorites/Online panel displays real server presence and locally saved favorites. The View all link opens the full list in the Online section. A green dot marks players currently online.

## Multiplayer deployment

Two players need different browser sessions, such as separate browsers or a normal and private window. For phones on the same Wi-Fi, open `http://YOUR-COMPUTER-WIFI-IP:3000`; allow the server through the computer's firewall. For internet play, deploy the Node server behind HTTPS, set `PORT`, `NODE_ENV=production`, and `PUBLIC_ORIGIN` to its exact public origin. The reverse proxy must support long-lived `/api/events` streams.

Rooms and live sessions are kept in server memory, so restarting the server ends active matches. Account records persist in `.tetris-accounts.json`; back up that file if accounts matter. Player progress and leaderboards remain local to each browser. Online XP is awarded only for server-confirmed completed races, with a daily cap and repeat-opponent cooldown. Cross-device progress sync and global leaderboards are not provided.

## Verify

Run `node tetris-core-test.cjs`, `node flow-smoke-test.cjs`, and `node multiplayer-test.cjs`. `npm test` runs the same suite where npm scripts are enabled. The tests cover the board, bag, gravity, SRS collision, scoring, Hold, lock delay, solo mode flow, account endpoints, and real HTTP multiplayer rooms.

## Current design and settings

The page loads all nine stylesheets in index.html, including how-to-play.css and settings.css. The Node server explicitly allows these files and the referenced artwork. Settings apply and save immediately: ghost, grid, visual effects, sound effects, separate music/effects volumes, supported-device vibration, Practice gravity/speed, keyboard bindings, and solo keyboard movement speed. Appearance selection and duplicate Practice hints were removed.

## Render deployment

Create a Node Web Service from this repository, use npm install as the build command and node server.cjs as the start command, and select the main branch. Set NODE_ENV=production and PUBLIC_ORIGIN to the exact HTTPS service URL. Deploy the latest commit after pushing changes; check the commit hash in Render if the site looks outdated.

Use one server instance: multiplayer rooms and sessions live in memory and reset on restarts. For durable accounts, attach a persistent disk and set ACCOUNT_FILE to a file on its mount, for example /var/data/accounts.json. Its parent directory must exist and be writable. Without a persistent disk, account changes can be lost on restarts or redeployments. The Docker image includes all current runtime files and defaults to /app/data/accounts.json; mount persistent storage at /app/data.

The tmp/ directory contains local previews and browser test profiles. It is not part of the game and must not be committed or included in deployment images.
