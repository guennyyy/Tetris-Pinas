// ==========================================
// TETRIS PINAS
// ==========================================


// -------------------------------
// CANVAS
// -------------------------------

const canvas =
    document.getElementById("gameCanvas");

const context =
    canvas.getContext("2d");

const boardBackgroundImage = new Image();
boardBackgroundImage.src = "Assets/game/sun-panel-background.png";


const nextCanvas =
    document.getElementById("nextCanvas");

const nextContext =
    nextCanvas.getContext("2d");


// -------------------------------
// CONSTANTS
// -------------------------------

const COLS = 10;
const ROWS = 20;
const HIDDEN_ROWS = TetrisCore.HIDDEN_ROWS;
const BOARD_ROWS = TetrisCore.HEIGHT;
const BLOCK = 30;


// -------------------------------
// COLORS
// Filipino fiesta-inspired palette
// -------------------------------

const COLORS = {

    I: "#42c6d9",
    J: "#3f78d1",
    L: "#ef9d35",
    O: "#f4d447",
    S: "#48b96c",
    T: "#a866c7",
    Z: "#e95454"

};


// -------------------------------
// TETROMINO SHAPES
// -------------------------------

const SHAPES = {

    I: [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ],

    J: [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0]
    ],

    L: [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0]
    ],

    O: [
        [1, 1],
        [1, 1]
    ],

    S: [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0]
    ],

    T: [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0]
    ],

    Z: [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0]
    ]

};


const TYPES =
    Object.keys(SHAPES);


// -------------------------------
// GAME VARIABLES
// -------------------------------

let board;

let player;

let nextPiece;
let queue = [];
let heldType = null;
let holdUsed = false;
let lockElapsed = 0;
let lockResets = 0;
let combo = -1;
let backToBack = false;
let horizontalKey = null;
let horizontalHeld = 0;
let horizontalRepeat = 0;
let softDropHeld = false;
let softDropCounter = 0;

let score = 0;

let lines = 0;

let level = 1;

let gameOver = false;

let paused = false;

let dropCounter = 0;

let lastTime = 0;


// -------------------------------
// HTML ELEMENTS
// -------------------------------

const scoreElement =
    document.getElementById("score");

const levelElement =
    document.getElementById("level");

const linesElement =
    document.getElementById("lines");

const comboMessage =
    document.getElementById("comboMessage");

const gameMessage =
    document.getElementById("gameMessage");

const messageTitle =
    document.getElementById("messageTitle");

const messageText =
    document.getElementById("messageText");
const holdCanvas = document.getElementById('holdCanvas');
const holdContext = holdCanvas.getContext('2d');


// ==========================================
// CREATE BOARD
// ==========================================

function createBoard() {
    return TetrisCore.createBoard();
}


// ==========================================
// RANDOM PIECE
// ==========================================

function randomPiece() {
    TetrisCore.ensureQueue(queue,6);
    return TetrisCore.makePiece(queue.shift());
}


// ==========================================
// SPAWN PIECE
// ==========================================

function spawnPiece() {
    player = randomPiece();
    nextPiece = TetrisCore.makePiece(queue[0]);
    holdUsed = false;
    lockElapsed = 0;
    lockResets = 0;
    drawNextPiece();
    if (collision()) {
        endGame();
    }
}


// ==========================================
// COLLISION
// ==========================================

function collision(
    matrix = player.matrix,
    offsetX = player.x,
    offsetY = player.y
) {
    return TetrisCore.collides(board,matrix,offsetX,offsetY);
}


// ==========================================
// MERGE PIECE
// ==========================================

function mergePiece() {
    let lockedAboveVisible = false;
    player.matrix.forEach(
        (row, y) => {

            row.forEach(
                (value, x) => {

                    if (value) {

                        const boardY =
                            player.y + y;

                        const boardX =
                            player.x + x;


                        board[boardY][boardX] = player.type;
                        if (boardY < HIDDEN_ROWS) lockedAboveVisible = true;

                    }

                }
            );

        }
    );
    return lockedAboveVisible;
}


// ==========================================
// MOVE PLAYER
// ==========================================

function movePlayer(direction) {
    if (window.onlinePlay?.active) { window.onlinePlay.input(direction < 0 ? 'left' : 'right'); return; }

    if (
        paused ||
        gameOver
    ) {
        return;
    }


    const grounded = collision(player.matrix,player.x,player.y+1);
    if (!collision(player.matrix,player.x+direction,player.y)) {
        player.x += direction;
        player.lastRotation = false;
        if (grounded && lockResets < 15) { lockElapsed = 0; lockResets++; }
        if (!collision(player.matrix,player.x,player.y+1)) lockElapsed = 0;
    }

}


// ==========================================
// DROP PLAYER
// ==========================================

function playerDrop(manual = true) {
    if (window.onlinePlay?.active) { window.onlinePlay.input('down'); return; }

    if (
        paused ||
        gameOver
    ) {
        return;
    }


    if (!collision(player.matrix,player.x,player.y+1)) {
        player.y++;
        player.lastRotation = false;
        lockElapsed = 0;
        if (manual) { score++; updateStats(); }
    }

}


// ==========================================
// HARD DROP
// ==========================================

function hardDrop() {
    if (window.onlinePlay?.active) { window.onlinePlay.input('drop'); return; }

    if (
        paused ||
        gameOver
    ) {
        return;
    }


    let distance = 0;
    while (!collision(player.matrix,player.x,player.y+1)) { player.y++; distance++; }
    score += distance*2;


    lockPiece();

}


// ==========================================
// LOCK PIECE
// ==========================================

function lockPiece() {
    if (gameOver) return;
    if (!window.tetrisApp || window.tetrisApp.settings.effects) triggerHitEffect();
    const tSpin = TetrisCore.isTSpin(board,player);
    const lockedAboveVisible = mergePiece();
    clearLines(tSpin);
    if (window.tetrisApp) {
        window.tetrisApp.cue("lock");
        if (window.tetrisApp.checkGoal()) { updateStats(); return; }
    }
    if (lockedAboveVisible) { endGame(); updateStats(); return; }
    spawnPiece();
    updateStats();
    window.tetrisApp?.saveSession?.();

}


// ==========================================
// ROTATION
// ==========================================

function rotateMatrix(matrix) {

    return matrix[0].map(
        (_, index) =>
            matrix.map(
                row =>
                    row[index]
            ).reverse()
    );

}


function rotatePlayer(clockwise = true) {
    if (window.onlinePlay?.active) { window.onlinePlay.input(clockwise ? 'rotate' : 'rotateCCW'); return; }

    if (
        paused ||
        gameOver
    ) {
        return;
    }


    const grounded = collision(player.matrix,player.x,player.y+1);
    const rotated = TetrisCore.rotate(board,player,clockwise);
    if (!rotated) return;
    player = rotated;
    if (grounded && lockResets < 15) { lockElapsed = 0; lockResets++; }
    if (!collision(player.matrix,player.x,player.y+1)) lockElapsed = 0;

}

function holdPiece() {
    if (window.onlinePlay?.active) { window.onlinePlay.input('hold'); return; }
    if (paused || gameOver) return;
    const previous = heldType;
    heldType = player.type;
    if (previous) {
        player = TetrisCore.makePiece(previous);
        lockElapsed = 0;
        lockResets = 0;
        if (collision()) endGame();
    } else spawnPiece();
    holdUsed = true;
    drawHoldPiece();
    window.tetrisApp?.saveSession?.();
}


// ==========================================
// CLEAR LINES
// ==========================================

function clearLines(tSpin = false) {
    const clearedRows = TetrisCore.clearLines(board);
    const cleared = clearedRows.length;
    combo = cleared ? combo + 1 : -1;
    const perfectClear = cleared > 0 && board.every(row => row.every(cell => cell === null));
    const result = TetrisCore.scoreClear({ count:cleared, level, tSpin, backToBack, combo, perfectClear });
    score += result.points;
    lines += cleared;
    if (cleared) {
        triggerClearEffect(clearedRows.filter(y => y >= HIDDEN_ROWS).map(y => y - HIDDEN_ROWS));
        const label = tSpin ? 'T-SPIN' : ['', 'GALING!', 'AYOS!', 'ASTIG!', '★ PINAS TETRIS! ★'][cleared];
        showCombo(perfectClear ? 'PERFECT CLEAR!' : label);
        backToBack = result.difficult;
    } else if (tSpin) showCombo('T-SPIN!');
    else comboMessage.textContent = '';
    if (window.tetrisApp?.mode !== 'sprint') level = Math.floor(lines / 10) + 1;
}


// ==========================================
// COMBO MESSAGE
// ==========================================

let comboTimeout;

let effects = [];
let boardFlash = 0;

const introScreen = document.getElementById("introScreen");
const authScreen = document.getElementById("authScreen");
const gameScreen = document.getElementById("gameScreen");
const authForm = document.getElementById("authForm");
const authSubmit = document.getElementById("authSubmit");
const authMessage = document.getElementById("authMessage");
const guestButton = document.getElementById("guestButton");
const showLoginBtn = document.getElementById("showLogin");
const showSignupBtn = document.getElementById("showSignup");
const displayNameInput = document.getElementById("displayName");
const authEmailInput = document.getElementById("authEmail");
const authPasswordInput = document.getElementById("authPassword");
const displayNameField = document.getElementById("displayNameField");
let authMode = "login";

const firebaseReady = typeof firebase !== "undefined" && firebase.apps && firebase.apps.length > 0;

if (!firebaseReady) {
    document.querySelector('.social-button.google').disabled = true;
    document.querySelector('.social-button.facebook').disabled = true;

}

function isGmail(email) {
    return /[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email);
}

function setAuthMode(mode) {
    authMode = mode;
    const isLogin = mode === "login";

    showLoginBtn.classList.toggle("active", isLogin);
    showSignupBtn.classList.toggle("active", !isLogin);
    authSubmit.textContent = isLogin ? "LOG IN" : "CREATE ACCOUNT";
    document.getElementById('authHeading').textContent = isLogin ? 'Welcome back, Player!' : 'Join the Laro!';
    document.getElementById('authDescription').textContent = isLogin ? 'Sign in and continue your Tetris Pinas journey.' : 'Create your account and start climbing the ranks.';
    document.getElementById('forgotPassword').classList.toggle('hidden', !isLogin);
    document.getElementById('authPassword').autocomplete = isLogin ? 'current-password' : 'new-password';
    displayNameField.classList.toggle("hidden", isLogin);
    displayNameInput.required = !isLogin;
    requestAnimationFrame(fitAuthPanel);
    authMessage.textContent = "";
}

function showGameScreen() {
    if (window.tetrisApp) window.tetrisApp.enter();
}

function fitAuthPanel() {
    const panel = document.querySelector(".auth-panel");
    if (!panel || authScreen.classList.contains("hidden")) return;
    const viewport = window.visualViewport;
    const height = viewport?.height || window.innerHeight;
    const width = viewport?.width || window.innerWidth;
    const scale = Math.min(1, Math.max(1, height - 24) / panel.offsetHeight, Math.max(1, width - 24) / panel.offsetWidth);
    panel.style.setProperty("--auth-fit", String(scale));
}

function showAuthScreen() {
    gameScreen.classList.add("hidden");
    document.getElementById("hubScreen").classList.add("hidden");
    authScreen.classList.remove("hidden");
    requestAnimationFrame(fitAuthPanel);
}

async function continueAsGuest() {
    authMessage.textContent = "Starting without an account...";
    if (window.tetrisServerUser) {
        try { await fetch('/api/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Tetris-Request':'1'},body:'{}'}); } catch { /* File-only play has no server session. */ }
    }
    window.tetrisServerUser = null;
    window.tetrisGuestSession = true;
    setTimeout(() => showGameScreen(), 250);
}

async function serverAuthRequest(path,data) {
    await fetch('/api/session',{credentials:'same-origin'});
    const response=await fetch('/api/'+path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Tetris-Request':'1'},body:JSON.stringify(data)});
    const result=await response.json();
    if (!response.ok) throw new Error(result.error||'Sign-in failed.');
    return result;
}
async function restoreServerLogin() {
    if (firebaseReady || window.location?.protocol==='file:') return;
    try {
        await fetch('/api/session',{credentials:'same-origin'});
        const response=await fetch('/api/auth',{credentials:'same-origin'});
        const result=await response.json();
        if (result.user) { window.tetrisServerUser=result.user;window.tetrisGuestSession=false; }
    } catch { /* Login stays available when the server cannot be reached. */ }
}

window.continueAsGuest = continueAsGuest;

function handleErrorMessage(code) {
    const map = {
        "auth/operation-not-allowed": "Enable this sign-in method in Firebase Authentication first.",
        "auth/unauthorized-domain": "Add this website domain in Firebase Authentication settings.",
        "auth/invalid-credential": "Incorrect email or password.",
        "auth/network-request-failed": "Could not connect. Check your internet connection and try again.",
        "auth/user-not-found": "No account found. Please sign up first.",
        "auth/wrong-password": "Incorrect password.",
        "auth/email-already-in-use": "This Gmail account already exists. Please log in instead.",
        "auth/invalid-email": "Please use a valid Gmail address ending with @gmail.com.",
        "auth/weak-password": "Password is too weak. Use a stronger password.",
        "auth/popup-closed-by-user": "Login cancelled.",
        "auth/account-exists-with-different-credential": "An account already exists with a different sign-in method.",
        "auth/credential-already-in-use": "This account is already linked to another sign-in method."
    };

    authMessage.textContent = map[code] || "Authentication failed. Please try again.";
}

function handleAuthSubmit(event) {
    event.preventDefault();

    if (!firebaseReady) {
        if (location.protocol==='file:') { authMessage.textContent='Open the multiplayer server address to log in or sign up.'; return; }
        const email=authEmailInput.value.trim().toLowerCase(),password=authPasswordInput.value;
        const name=displayNameInput.value.trim();
        if (!isGmail(email)||password.length<8) { authMessage.textContent='Use a Gmail address and a password of at least 8 characters.'; return; }
        if (authMode==='signup'&&!name) { authMessage.textContent='Enter a display name.'; return; }
        authSubmit.disabled=true;
        serverAuthRequest(authMode==='signup'?'signup':'login',{email,password,name}).then(result=>{
            window.tetrisServerUser=result.user;window.tetrisGuestSession=false;
            authMessage.textContent=`Welcome, ${result.user.name}!`;
            showGameScreen();
        }).catch(error=>{authMessage.textContent=error.message;}).finally(()=>{authSubmit.disabled=false;});
        return;
    }

    const email = authEmailInput.value.trim().toLowerCase();
    const password = authPasswordInput.value;
    const displayName = displayNameInput.value.trim();

    if (!email || !password) {
        authMessage.textContent = authMode === "login"
            ? "Please enter your email and password."
            : "Please fill in your email and password.";
        return;
    }

    if (!isGmail(email)) {
        authMessage.textContent = "Please use a valid Gmail address ending with @gmail.com.";
        return;
    }

    if (authMode === "signup") {
        if (!displayName) {
            authMessage.textContent = "Please enter a display name.";
            return;
        }

        firebase.auth().createUserWithEmailAndPassword(email, password)
            .then(({ user }) => {
                return user.updateProfile({ displayName }).then(() => user);
            })
            .then((user) => {
                window.tetrisGuestSession = false;
                window.tetrisServerUser = null;
                authMessage.textContent = `Account created for ${user.displayName}!`;
                setTimeout(() => showGameScreen(), 500);
            })
            .catch((error) => {
                handleErrorMessage(error.code);
            });
        return;
    }

    firebase.auth().signInWithEmailAndPassword(email, password)
        .then(({ user }) => {
            window.tetrisGuestSession = false;
            window.tetrisServerUser = null;
            authMessage.textContent = `Welcome back, ${user.displayName || user.email.split("@")[0]}!`;
            setTimeout(() => showGameScreen(), 500);
        })
        .catch((error) => {
            handleErrorMessage(error.code);
        });
}

function signInWithProvider(provider) {
    if (!firebaseReady) {
        authMessage.textContent = "Online sign-in is not available yet. You can play without an account, but progress and history will not be saved.";
        return;
    }

    const authProvider = provider === "google"
        ? new firebase.auth.GoogleAuthProvider()
        : new firebase.auth.FacebookAuthProvider();

    firebase.auth().signInWithPopup(authProvider)
        .then(({ user }) => {
            window.tetrisGuestSession = false;
            window.tetrisServerUser = null;
            authMessage.textContent = `Signed in with ${provider}.`;
            setTimeout(() => showGameScreen(), 500);
        })
        .catch((error) => {
            handleErrorMessage(error.code);
        });
}

guestButton.addEventListener("click", continueAsGuest);
showLoginBtn.addEventListener("click", () => setAuthMode("login"));
showSignupBtn.addEventListener("click", () => setAuthMode("signup"));
authForm.addEventListener("submit", handleAuthSubmit);

document.querySelector(".social-button.google").addEventListener("click", () => signInWithProvider("google"));
document.querySelector(".social-button.facebook").addEventListener("click", () => signInWithProvider("facebook"));

function startAppIntro() {
    // Restore any existing account while the static logo is on screen.
    restoreServerLogin();
    function openDashboard() {
        authScreen.classList.add('hidden');
        showGameScreen();
        if (introScreen) introScreen.classList.add('hidden');
    }
    if (!introScreen) { openDashboard(); return; }
    introScreen.classList.remove('hidden');
    authScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    document.getElementById('hubScreen').classList.add('hidden');
    setTimeout(openDashboard, 3000);
}

startAppIntro();

function spawnBurst(x, y, color, amount = 12) {

    for (let i = 0; i < amount; i++) {

        const angle =
            Math.random() * Math.PI * 2;

        const speed =
            1.2 + Math.random() * 3.8;

        effects.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 0.8,
            life: 18 + Math.random() * 18,
            maxLife: 18 + Math.random() * 18,
            size: 3 + Math.random() * 4,
            color
        });

    }

}


function triggerHitEffect() {

    const activeCells = [];

    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                activeCells.push({
                    x: player.x + x,
                    y: player.y + y
                });
            }
        });
    });

    if (!activeCells.length) {
        return;
    }

    const center = activeCells.reduce((total, cell) => {
        total.x += cell.x;
        total.y += cell.y;
        return total;
    }, { x: 0, y: 0 });

    center.x /= activeCells.length;
    center.y /= activeCells.length;

    spawnBurst(
        (center.x + 0.5) * BLOCK,
        (center.y + 0.5) * BLOCK,
        COLORS[player.type],
        18
    );

    boardFlash = 0.9;

}


function triggerClearEffect(clearedRows) {

    clearedRows.forEach(rowIndex => {
        for (let x = 0; x < COLS; x++) {
            spawnBurst(
                (x + 0.5) * BLOCK,
                (rowIndex + 0.5) * BLOCK,
                COLORS[player.type] || "#ffd76a",
                8
            );
        }
    });

    boardFlash = 1;

}


function showCombo(text) {

    comboMessage.textContent =
        text;


    clearTimeout(
        comboTimeout
    );


    comboTimeout =
        setTimeout(
            () => {

                comboMessage.textContent =
                    "";

            },
            1200
        );

}


// ==========================================
// DRAW BLOCK
// ==========================================

function drawBlock(
    ctx,
    x,
    y,
    color,
    size,
    options = {}
) {

    const {
        glow = false,
        glowStrength = 14
    } = options;

    const px =
        x * size;

    const py =
        y * size;

    ctx.save();

    ctx.shadowColor = color;
    ctx.shadowBlur = glow ? glowStrength : 8;

    ctx.fillStyle = color;

    ctx.fillRect(
        px + 1,
        py + 1,
        size - 2,
        size - 2
    );

    ctx.restore();

    // Glow rim
    ctx.fillStyle =
        "rgba(255,255,255,0.18)";

    ctx.fillRect(
        px + 3,
        py + 3,
        size - 6,
        3
    );

    ctx.fillRect(
        px + 3,
        py + 3,
        3,
        size - 6
    );

    // Soft highlight
    ctx.fillStyle =
        "rgba(255,255,255,0.30)";

    ctx.fillRect(
        px + 5,
        py + 5,
        size - 10,
        4
    );

    // Shadow
    ctx.fillStyle =
        "rgba(0,0,0,0.22)";

    ctx.fillRect(
        px + 5,
        py + size - 7,
        size - 10,
        3
    );

    // Inner Filipino woven-style diamond
    ctx.strokeStyle =
        "rgba(255,255,255,0.18)";

    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(
        px + size / 2,
        py + 7
    );
    ctx.lineTo(
        px + size - 7,
        py + size / 2
    );
    ctx.lineTo(
        px + size / 2,
        py + size - 7
    );
    ctx.lineTo(
        px + 7,
        py + size / 2
    );
    ctx.closePath();
    ctx.stroke();

}


// ==========================================
// DRAW BOARD BACKGROUND
// ==========================================

function drawBackground() {
    context.fillStyle = "#1d1511";
    context.fillRect(0, 0, canvas.width, canvas.height);

    if (boardBackgroundImage.complete && boardBackgroundImage.naturalWidth) {
        const scale = Math.max(
            canvas.width / boardBackgroundImage.naturalWidth,
            canvas.height / boardBackgroundImage.naturalHeight
        );
        const imageWidth = boardBackgroundImage.naturalWidth * scale;
        const imageHeight = boardBackgroundImage.naturalHeight * scale;
        context.drawImage(
            boardBackgroundImage,
            (canvas.width - imageWidth) / 2,
            (canvas.height - imageHeight) / 2,
            imageWidth,
            imageHeight
        );

        context.fillStyle = "rgba(19, 13, 10, 0.66)";
        context.fillRect(0, 0, canvas.width, canvas.height);
    }


    if (window.tetrisApp?.settings?.grid === false) return;

    context.strokeStyle =
        "rgba(255,255,255,0.12)";


    context.lineWidth = 1;


    for (
        let x = 0;
        x <= COLS;
        x++
    ) {

        context.beginPath();

        context.moveTo(
            x * BLOCK,
            0
        );

        context.lineTo(
            x * BLOCK,
            canvas.height
        );

        context.stroke();

    }


    for (
        let y = 0;
        y <= ROWS;
        y++
    ) {

        context.beginPath();

        context.moveTo(
            0,
            y * BLOCK
        );

        context.lineTo(
            canvas.width,
            y * BLOCK
        );

        context.stroke();

    }

}


// ==========================================
// DRAW BOARD
// ==========================================

function drawBoard() {

    board.forEach(
        (row, y) => {

            row.forEach(
                (type, x) => {

                    if (type && y >= HIDDEN_ROWS) {

                        drawBlock(
                            context,
                            x,
                            y - HIDDEN_ROWS,
                            COLORS[type],
                            BLOCK,
                            {
                                glow: true,
                                glowStrength: 14
                            }
                        );

                    }

                }
            );

        }
    );

}


// ==========================================
// DRAW PLAYER
// ==========================================

function drawPlayer() {

    if (!player) {
        return;
    }


    player.matrix.forEach(
        (row, y) => {

            row.forEach(
                (value, x) => {

                    if (value && player.y + y >= HIDDEN_ROWS) {

                        drawBlock(
                            context,
                            player.x + x,
                            player.y + y - HIDDEN_ROWS,
                            COLORS[player.type],
                            BLOCK,
                            {
                                glow: true,
                                glowStrength: 18
                            }
                        );

                    }

                }
            );

        }
    );

}


// ==========================================
// GHOST PIECE
// ==========================================

function drawGhost() {
    if (!player) return;
    let ghostY = player.y;
    while (!collision(player.matrix, player.x, ghostY + 1)) ghostY++;
    if (ghostY === player.y) return;

    context.save();
    context.globalAlpha = 0.85;
    context.strokeStyle = COLORS[player.type];
    context.lineWidth = 2;
    context.shadowColor = COLORS[player.type];
    context.shadowBlur = 3;
    player.matrix.forEach((row, y) => row.forEach((value, x) => {
        if (!value || ghostY + y < HIDDEN_ROWS) return;
        const px = (player.x + x) * BLOCK;
        const py = (ghostY + y - HIDDEN_ROWS) * BLOCK;
        context.strokeRect(px + 2, py + 2, BLOCK - 4, BLOCK - 4);
    }));
    context.restore();
}


function drawPreviewPiece(ctx,type,top,height) {
    if (!type) return;
    const matrix = SHAPES[type];
    const canvasWidth = ctx === holdContext ? holdCanvas.width : nextCanvas.width;
    const size = Math.min(23,Math.floor((canvasWidth - 14)/matrix[0].length),Math.floor((height - 8)/matrix.length));
    const left = Math.floor((canvasWidth - matrix[0].length*size)/2);
    const offsetY = top + Math.floor((height - matrix.length*size)/2);
    ctx.save();
    ctx.translate(left,offsetY);
    matrix.forEach((row,y) => row.forEach((value,x) => {
        if (!value) return;
        drawBlock(ctx,x,y,COLORS[type],size);
    }));
    ctx.restore();
}
function drawNextPiece() {
    nextContext.clearRect(0,0,nextCanvas.width,nextCanvas.height);
    nextContext.fillStyle='rgba(18,9,3,.68)';
    nextContext.fillRect(0,0,nextCanvas.width,nextCanvas.height);
    queue.slice(0,5).forEach((type,index) => {
        if (index) {
            nextContext.fillStyle='rgba(255,255,255,.1)';
            nextContext.fillRect(12,index*80, nextCanvas.width-24,1);
        }
        drawPreviewPiece(nextContext,type,index*80,80);
    });
}
function drawHoldPiece() {
    document.getElementById('holdStatus').textContent = heldType ? '(SWAP)' : '';
    holdContext.clearRect(0,0,holdCanvas.width,holdCanvas.height);
    holdContext.fillStyle='rgba(18,9,3,.68)';
    holdContext.fillRect(0,0,holdCanvas.width,holdCanvas.height);
    drawPreviewPiece(holdContext,heldType,0,holdCanvas.height);
}


// ==========================================
// DRAW EVERYTHING
// ==========================================

function drawEffects() {

    effects.forEach(effect => {

        const alpha =
            Math.max(
                0,
                effect.life / effect.maxLife
            );

        context.save();
        context.globalAlpha = alpha;
        context.fillStyle = effect.color;
        context.shadowBlur = 14;
        context.shadowColor = effect.color;
        context.fillRect(
            effect.x,
            effect.y,
            effect.size,
            effect.size
        );
        context.restore();

    });

    if (boardFlash > 0) {
        context.fillStyle = `rgba(255, 255, 255, ${boardFlash * 0.18})`;
        context.fillRect(0, 0, canvas.width, canvas.height);
    }

}


function draw() {

    drawBackground();

    drawBoard();

    if (!window.tetrisApp || window.tetrisApp.settings.ghost || (window.tetrisApp.mode==='practice' && window.tetrisApp.settings.practiceHints)) drawGhost();

    drawPlayer();
    if (!window.tetrisApp || window.tetrisApp.settings.effects) drawEffects();

}


// ==========================================
// UPDATE SCORE DISPLAY
// ==========================================

function updateStats() {

    scoreElement.textContent =
        score.toLocaleString();

    linesElement.textContent =
        lines;

    levelElement.textContent =
        level;
    window.tetrisApp?.updateModeInfo?.();

}


// ==========================================
// GAME SPEED
// ==========================================

function getDropInterval() {
    const mode = window.tetrisApp?.mode;
    const settings = window.tetrisApp?.settings;
    if (mode === 'sprint') return TetrisCore.getGravityMs(1);
    if (mode === 'practice') return settings?.practiceGravity ? Number(settings.practiceSpeed || 1000) : Infinity;
    return TetrisCore.getGravityMs(level);
}


// ==========================================
// GAME LOOP
// ==========================================

function update(time = 0) {

    const deltaTime = Math.max(0, time - lastTime);


    lastTime = time;


    effects = effects.filter(effect => {
        effect.x += effect.vx * (deltaTime / 16.67);
        effect.y += effect.vy * (deltaTime / 16.67);
        effect.life -= deltaTime / 16.67;
        effect.vy += 0.04;
        return effect.life > 0;
    });

    boardFlash = Math.max(0, boardFlash - 0.03);


    if (
        !paused &&
        !gameOver &&
        !gameScreen.classList.contains("hidden") &&
        !window.onlinePlay?.active
    ) {

        if (window.tetrisApp) window.tetrisApp.tick(deltaTime);
        if (!gameOver) {
            const settings = window.tetrisApp?.settings || {};
            if (horizontalKey) {
                const before = horizontalHeld;
                horizontalHeld += deltaTime;
                if (horizontalHeld >= Number(settings.das || 150)) {
                    horizontalRepeat += horizontalHeld - Math.max(before,Number(settings.das || 150));
                    const arr = Math.max(10,Number(settings.arr || 30));
                    while (horizontalRepeat >= arr) {
                        movePlayer(horizontalKey === 'ArrowLeft' ? -1 : 1);
                        horizontalRepeat -= arr;
                    }
                }
            }
            if (softDropHeld) {
                softDropCounter += deltaTime;
                const softInterval = Math.min(getDropInterval()/Math.max(1,Number(settings.softDropFactor || 20)),50);
                while (softDropCounter >= softInterval && !gameOver && !collision(player.matrix,player.x,player.y+1)) {
                    playerDrop(true);
                    softDropCounter -= softInterval;
                }
                softDropCounter = Math.min(softDropCounter,softInterval);
            }
            const interval = getDropInterval();
            if (Number.isFinite(interval)) {
                dropCounter += deltaTime;
                let steps = 0;
                while (dropCounter >= interval && !gameOver && steps++ < 1000) {
                    dropCounter -= interval;
                    if (collision(player.matrix,player.x,player.y+1)) { dropCounter = 0; break; }
                    playerDrop(false);
                }
            }
            if (collision(player.matrix,player.x,player.y+1)) {
                lockElapsed += deltaTime;
                if (lockElapsed >= 500) lockPiece();
            } else lockElapsed = 0;
        }

    }


    if (window.onlinePlay?.active) window.onlinePlay.tick();
    syncMouseTarget();
    draw();


    requestAnimationFrame(
        update
    );

}


// ==========================================
// PAUSE
// ==========================================

function togglePause() {
    if (window.onlinePlay?.active) { window.onlinePlay.openMenu(); return; }

    if (gameOver) {
        return;
    }


    paused =
        !paused;


    if (paused) {
        horizontalKey = null;
        softDropHeld = false;
        window.tetrisApp?.saveSession?.();

        messageTitle.textContent =
            "PAUSED";

        messageText.textContent =
            "Tap the board or press P to continue";

        gameMessage.classList.remove(
            "hidden"
        );


        document.getElementById(
            "pauseButton"
        ).textContent =
            "CONTINUE";

    }

    else {

        gameMessage.classList.add(
            "hidden"
        );


        document.getElementById(
            "pauseButton"
        ).textContent =
            "PAUSE";


        lastTime =
            performance.now();

    }

}


// ==========================================
// GAME OVER
// ==========================================

function endGame() {
    if (gameOver) return;
    gameOver = true;
    if (window.tetrisApp) { window.tetrisApp.finish("topout"); return; }


    messageTitle.textContent =
        "GAME OVER";


    messageText.innerHTML =
        `
        Score: ${score.toLocaleString()}
        <br><br>
        Tap the board or press R to restart
        `;


    gameMessage.classList.remove(
        "hidden"
    );

}


// ==========================================
// RESET GAME
// ==========================================

function resetGame() {
    if (window.onlinePlay?.active) { window.onlinePlay.noRestart(); return; }
    if (window.tetrisApp) window.tetrisApp.onReset();

    board =
        createBoard();
    queue = [];
    heldType = null;
    holdUsed = false;
    lockElapsed = 0;
    lockResets = 0;
    combo = -1;
    backToBack = false;
    horizontalKey = null;
    horizontalHeld = 0;
    horizontalRepeat = 0;
    softDropHeld = false;
    softDropCounter = 0;


    score = 0;

    lines = 0;

    level = 1;


    paused = false;

    gameOver = false;


    spawnPiece();
    drawHoldPiece();


    updateStats();


    comboMessage.textContent =
        "";


    gameMessage.classList.add(
        "hidden"
    );


    document.getElementById(
        "pauseButton"
    ).textContent =
        "PAUSE";


    dropCounter = 0;

    lastTime =
        performance.now();

}

window.tetrisSession = {
    snapshot() {
        return {version:1,board:board.map(row=>row.slice()),player:{...player,matrix:player.matrix.map(row=>row.slice())},queue:queue.slice(),heldType,holdUsed,score,lines,level,dropCounter,lockElapsed,lockResets,combo,backToBack};
    },
    restore(state) {
        if (!state || state.version!==1 || !Array.isArray(state.board) || state.board.length!==BOARD_ROWS || !state.board.every(row=>Array.isArray(row)&&row.length===COLS&&row.every(cell=>cell===null||!!SHAPES[cell])) || !state.player || !SHAPES[state.player.type] || !Array.isArray(state.queue) || !Number.isInteger(state.player.x) || !Number.isInteger(state.player.y)) return false;
        const matrix=state.player.matrix;
        if (!Array.isArray(matrix)||matrix.length!==SHAPES[state.player.type].length||!matrix.every(row=>Array.isArray(row)&&row.length===matrix.length&&row.every(cell=>cell===0||cell===1))||matrix.flat().filter(Boolean).length!==4) return false;
        const candidateBoard=state.board.map(row=>row.slice());
        const candidatePlayer={...state.player,matrix:matrix.map(row=>row.slice())};
        if (TetrisCore.collides(candidateBoard,candidatePlayer.matrix,candidatePlayer.x,candidatePlayer.y)) return false;
        board=candidateBoard;
        player=candidatePlayer;
        queue=state.queue.filter(type=>SHAPES[type]).slice(0,50);
        TetrisCore.ensureQueue(queue,5);
        nextPiece=TetrisCore.makePiece(queue[0]);
        heldType=SHAPES[state.heldType]?state.heldType:null;
        holdUsed=!!state.holdUsed;
        score=Number(state.score)||0;
        lines=Number(state.lines)||0;
        level=Number(state.level)||1;
        dropCounter=Number(state.dropCounter)||0;
        lockElapsed=Number(state.lockElapsed)||0;
        lockResets=Number(state.lockResets)||0;
        combo=Number(state.combo ?? -1);
        backToBack=!!state.backToBack;
        paused=true;gameOver=false;
        drawNextPiece();drawHoldPiece();updateStats();
        return true;
    }
};


// ==========================================
// KEYBOARD CONTROLS
// ==========================================

document.addEventListener('keydown', event => {
    if (event.target.matches('input, textarea, select, [contenteditable="true"]') || gameScreen.classList.contains('hidden') || document.getElementById('matchMenu').open) return;
    const controls=window.tetrisApp?.settings?.controls || {};
    const action=Object.entries({
        left:'ArrowLeft',right:'ArrowRight',softDrop:'ArrowDown',hardDrop:'Space',
        rotateCW:'ArrowUp',rotateCCW:'KeyZ',hold:'KeyC'
    }).find(([name,defaultCode]) => (controls[name]||defaultCode)===event.code)?.[0];
    const key=action || ({KeyX:'rotateCW',ShiftLeft:'hold',ShiftRight:'hold',KeyP:'pause',KeyR:'restart'}[event.code]);
    if (!key) return;
    event.preventDefault();
    mouseColumn = null;
    window.onlinePlay?.point?.(null);
    if (key==='left' || key==='right') {
        if (event.repeat || horizontalKey===event.code) return;
        horizontalKey=event.code;
        horizontalHeld=0;horizontalRepeat=0;
        movePlayer(key==='left'?-1:1);
    } else if (key==='softDrop') {
        if (!event.repeat) { softDropHeld=true;softDropCounter=0;playerDrop(true); }
    } else if (event.repeat) return;
    else if (key==='hardDrop') hardDrop();
    else if (key==='rotateCW') rotatePlayer(true);
    else if (key==='rotateCCW') rotatePlayer(false);
    else if (key==='hold') holdPiece();
    else if (key==='pause') togglePause();
    else if (key==='restart') confirmRestart();
});
document.addEventListener('keyup', event => {
    if (event.code===horizontalKey) {horizontalKey=null;horizontalHeld=0;horizontalRepeat=0;}
    if (event.code===(window.tetrisApp?.settings?.controls?.softDrop||'ArrowDown')) {softDropHeld=false;softDropCounter=0;}
});
function confirmRestart() {
    if (window.onlinePlay?.active) { window.onlinePlay.noRestart(); return; }
    if (typeof window.confirm==='function' && !window.confirm('Restart this game? Your current run will end.')) return;
    resetGame();
}


// ==========================================
// BOARD GESTURES
// ==========================================

// Board gestures replace the hidden button panel.
const gestureBoard = canvas.closest('.board-frame');
let boardGesture = null;
let mouseColumn = null;
let boardHoldTimer;
function cancelBoardGesture() {
    clearTimeout(boardHoldTimer);
    boardGesture = null;
}
gestureBoard.addEventListener('pointerdown', event => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    followMouse(event);
    boardGesture = { pointerType:event.pointerType, id: event.pointerId, x: event.clientX, y: event.clientY, held: false };
    gestureBoard.setPointerCapture(event.pointerId);
    if (!paused && !gameOver) {
        boardHoldTimer = setTimeout(() => {
            if (!boardGesture) return;
            boardGesture.held = true;
            togglePause();
        }, 600);
    }
});
function followMouse(event) {
    if (event.pointerType !== 'mouse' || !player || gameScreen.classList.contains('hidden') || paused || gameOver || document.getElementById('matchMenu').open) return;
    const rect = canvas.getBoundingClientRect();
    mouseColumn = Math.max(0, Math.min(COLS - 1, Math.floor((event.clientX - rect.left) / (rect.width / COLS))));
    syncMouseTarget();
}
function syncMouseTarget() {
    if (mouseColumn === null || !player || gameScreen.classList.contains('hidden') || paused || gameOver || document.getElementById('matchMenu').open) return;
    if (window.onlinePlay?.active) { window.onlinePlay.point(mouseColumn); return; }
    const occupied = player.matrix.flatMap(row => row.flatMap((v, x) => v ? [x] : []));
    const target = mouseColumn - Math.min(...occupied);
    for (let step = 0; step < COLS && player.x !== target; step++) {
        const direction = Math.sign(target - player.x);
        if (collision(player.matrix, player.x + direction, player.y)) break;
        movePlayer(direction);
    }
}
gestureBoard.addEventListener('pointerleave', () => { mouseColumn = null; window.onlinePlay?.point?.(null); });
gestureBoard.addEventListener('pointermove', event => {
    followMouse(event);
    if (!boardGesture || boardGesture.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - boardGesture.x, event.clientY - boardGesture.y) > 12) {
        clearTimeout(boardHoldTimer);
    }
});
gestureBoard.addEventListener('pointerup', event => {
    if (!boardGesture || boardGesture.id !== event.pointerId) return;
    const gesture = boardGesture;
    cancelBoardGesture();
    if (gesture.held) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    const distance = Math.hypot(dx, dy);
    if (gameOver) { if (distance < 18) resetGame(); return; }
    if (paused) { if (distance < 18) togglePause(); return; }
    if (distance < 18) {
        if (gesture.pointerType === "mouse") hardDrop();
        else rotatePlayer();
        return;
    }
    if (gesture.pointerType === "mouse") return;
    if (Math.abs(dx) > Math.abs(dy)) {
        const cellWidth = canvas.getBoundingClientRect().width / COLS;
        const steps = Math.min(COLS, Math.max(1, Math.round(Math.abs(dx) / cellWidth)));
        for (let i = 0; i < steps; i++) movePlayer(Math.sign(dx));
    } else if (dy < -18) {
        hardDrop();
    } else {
        // One row per downward swipe avoids dropping a newly spawned piece.
        playerDrop();
    }
});
gestureBoard.addEventListener('pointercancel', cancelBoardGesture);
gestureBoard.addEventListener('lostpointercapture', cancelBoardGesture);
gestureBoard.addEventListener('wheel', event => {
    if (gameScreen.classList.contains('hidden') || document.getElementById('matchMenu').open || paused || gameOver || !event.deltaY) return;
    event.preventDefault();
    rotatePlayer(event.deltaY > 0);
    syncMouseTarget();
}, { passive:false });
gestureBoard.addEventListener('contextmenu', event => {
    event.preventDefault();
    if (!gameScreen.classList.contains('hidden') && !document.getElementById('matchMenu').open && !paused && !gameOver) rotatePlayer();
});
document
    .getElementById(
        "pauseButton"
    )
    .addEventListener(
        "click",
        togglePause
    );





// ==========================================
// START
// ==========================================

resetGame();
update();



// Shared login/signup panel controls.
document.getElementById('toggleAuthPassword').addEventListener('click', () => {
    const input = document.getElementById('authPassword');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    document.getElementById('toggleAuthPassword').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    document.getElementById('toggleAuthPassword').setAttribute('aria-pressed', String(show));
});
document.getElementById('forgotPassword').addEventListener('click', async () => {
    const email = document.getElementById('authEmail').value.trim();
    if (!firebaseReady || window.tetrisServerUser) { authMessage.textContent = 'Password recovery is not available yet.'; return; }
    if (!email) { authMessage.textContent = 'Enter your email address first.'; return; }
    try { await firebase.auth().sendPasswordResetEmail(email); authMessage.textContent = 'If an account exists for this email, you will receive a reset link.'; }
    catch { authMessage.textContent = 'Could not request a reset link. Please try again.'; }
});

window.addEventListener?.('resize', fitAuthPanel);
window.visualViewport?.addEventListener('resize', fitAuthPanel);
if (typeof ResizeObserver !== 'undefined') {
    const authPanelObserver = new ResizeObserver(fitAuthPanel);
    authPanelObserver.observe(document.querySelector('.auth-panel'));
}

// Restore Firebase identity if it arrives after the three-second intro.
if (firebaseReady) firebase.auth().onAuthStateChanged(user => {
    if (!user || window.tetrisGuestSession || !introScreen.classList.contains('hidden') || !authScreen.classList.contains('hidden') || !gameScreen.classList.contains('hidden')) return;
    window.tetrisApp?.enter();
});
