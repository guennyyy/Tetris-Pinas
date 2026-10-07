# Tetris-Pinas

This project is ready for a real Firebase Authentication flow for:
- Email/password sign up and login
- Google sign in
- Facebook sign in

## Step 1: Create a Firebase project
1. Go to https://console.firebase.google.com/
2. Create a new project
3. Add a web app to the project
4. Copy the Firebase config values

## Step 2: Fill in the Firebase config
Open [index.html](index.html) and replace the placeholder values in the `firebaseConfig` object:

```js
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

## Step 3: Enable auth providers
In Firebase Console:
- Authentication > Sign-in method
- Enable:
  - Email/Password
  - Google
  - Facebook

For Facebook, you also need to configure a Facebook app and add the App ID / secret in Firebase.

## Step 4: Run locally
Open the project in a browser or use a local static server.

## Notes
- Gmail sign-up and sign-in are restricted to addresses ending in `@gmail.com`.
- Unknown email accounts trigger a "No account found" style message from Firebase auth.
- This app uses Firebase Auth for real sign-in flow, not local fake accounts.

## Game flow and player features

Intro → Login or Continue as guest → Home → Choose a mode → Play → Results.

The home navigation includes Profile, Leaderboard, How to play, and Settings.
During a match, Menu pauses play and offers Resume, Restart, Settings, How to play,
and Home. Going home preserves the current paused match for Resume. Starting a
new match ends the previous match early. Early-ended games appear in history but
are excluded from leaderboard rankings. Switching browser tabs pauses gameplay.

Modes:
- Marathon: increasing speed; ends when the board tops out.
- 40-line Sprint: clear 40 lines; successful runs rank by fastest time.
- Blitz: score within two minutes of active gameplay.
- Practice: no automatic falling; no leaderboard ranking.

Profile display name/avatar, results, milestones, and settings save locally in
this browser. Firebase users have separate local profiles keyed by their user ID.
The leaderboard shows the best eligible result per local player and mode.
There are no invented competitors or remote rankings. Online rooms and matchmaking
are now provided by the Node server below. Cross-device profile sync and global
leaderboards are not implemented. Firebase authentication remains optional and
still requires project credentials. Guest online play does not require Firebase.

Touch: tap to rotate; swipe left/right to move; down to drop one row; up to hard
 drop; hold 0.6 seconds to pause. Tap the paused board to resume. Use Menu for
navigation. Keyboard: arrows, Space, P (pause), R (restart), Escape (menu).
Optional touch buttons can be enabled under Settings; hidden by default.

Settings include ghost preview, visual effects, short sound cues, vibration on
supported devices, gesture hints, touch buttons, and Fiesta/Night appearance.

Verification: `node flow-smoke-test.cjs` runs game lifecycle and local persistence
checks in a simulated DOM. It does not replace real-device/browser testing.

## Online multiplayer (friends and public opponents)

The dependency-free Node server serves both the website and multiplayer API.
Do not use VS Code Live Server or open index.html directly for online play.

1. Install Node.js 22 or later if it is not already available.
2. Open a terminal in this folder and run `npm start` (or `node server.cjs`).
3. Open http://localhost:3000, choose Continue as guest, then Play online.
4. Create a private room and send the invite code/link to your friend, or choose
   Find a match to join the public queue.
5. Both players start after a three-second countdown. The first to clear 40 lines
   wins. If one tops out, forfeits, or stays disconnected for 30 seconds, the other
   player wins. Both players receive the same shuffled seven-piece bags.

Testing with two players on one computer: use different browsers, or a normal
window and a private window. Tabs in the same browser share one player session.
On phones on your home Wi-Fi, use http://YOUR-COMPUTER-WIFI-IP:3000 instead of
localhost. Both phones and the computer must be on the same Wi-Fi, and the
computer's firewall must allow the server. An invite copied from localhost is
only usable on the same computer; phone invites must use the Wi-Fi address.

For friends outside your Wi-Fi or public internet players, deploy the Node server
on a public HTTPS host. Everyone must use the same public game URL. Set PORT to
the host's assigned port, NODE_ENV=production, and PUBLIC_ORIGIN to your exact
public origin (for example https://your-game.example). PUBLIC_ORIGIN has no trailing
slash. The supplied Dockerfile can run the app on a container-capable Node host.
Static-only hosting cannot run this multiplayer server. A reverse proxy must allow
long-lived event streams and disable response buffering for /api/events.

The server controls movement, gravity, collisions, score, and victory conditions.
Clients send inputs, not scores. Private rooms have two-player limits; public
matching uses actual connected players. No bots or fabricated opponents are added.
Live state uses HTTP server-sent events, with same-origin POST requests for inputs.

Rooms and online guest sessions are held in server memory. A server restart clears
active rooms. Run one server instance; multiple independent instances need a shared
room store and coordination before scaling. Match history remains local to each
browser. Firebase accounts are optional; online guest identities use separate
HttpOnly session cookies. Guest online names are display names, not verified accounts.
This is a first playable one-versus-one race, without garbage attacks, chat,
friend lists, persistent online rankings, or multiplayer tournament brackets.

Tests: `npm test` checks solo flow and real HTTP multiplayer sessions, including
room joins, public queue, countdown, live snapshots, input validation, score
ownership, forfeit, disconnects, and private session IDs. A two-profile Edge browser
check also verified live room play and the game fit at 375×667 and 393×852.
