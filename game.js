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
boardBackgroundImage.src = "board-background.jfif";


const nextCanvas =
    document.getElementById("nextCanvas");

const nextContext =
    nextCanvas.getContext("2d");


// -------------------------------
// CONSTANTS
// -------------------------------

const COLS = 10;
const ROWS = 20;
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


// ==========================================
// CREATE BOARD
// ==========================================

function createBoard() {

    return Array.from(
        { length: ROWS },
        () => Array(COLS).fill(null)
    );

}


// ==========================================
// RANDOM PIECE
// ==========================================

function randomPiece() {

    const type =
        TYPES[
            Math.floor(
                Math.random() *
                TYPES.length
            )
        ];


    return {

        type: type,

        matrix:
            SHAPES[type].map(
                row => [...row]
            ),

        x: 0,

        y: 0

    };

}


// ==========================================
// SPAWN PIECE
// ==========================================

function spawnPiece() {

    player = nextPiece || randomPiece();

    nextPiece = randomPiece();


    player.x =
        Math.floor(
            COLS / 2
        )
        -
        Math.ceil(
            player.matrix[0].length / 2
        );


    player.y = 0;


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

    for (
        let y = 0;
        y < matrix.length;
        y++
    ) {

        for (
            let x = 0;
            x < matrix[y].length;
            x++
        ) {

            if (!matrix[y][x]) {
                continue;
            }


            const newX =
                x + offsetX;

            const newY =
                y + offsetY;


            if (
                newX < 0 ||
                newX >= COLS ||
                newY >= ROWS
            ) {

                return true;

            }


            if (
                newY >= 0 &&
                board[newY][newX]
            ) {

                return true;

            }

        }

    }


    return false;

}


// ==========================================
// MERGE PIECE
// ==========================================

function mergePiece() {

    player.matrix.forEach(
        (row, y) => {

            row.forEach(
                (value, x) => {

                    if (value) {

                        const boardY =
                            player.y + y;

                        const boardX =
                            player.x + x;


                        if (boardY >= 0) {

                            board[boardY][boardX] =
                                player.type;

                        }

                    }

                }
            );

        }
    );

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


    player.x += direction;


    if (collision()) {

        player.x -= direction;

    }

}


// ==========================================
// DROP PLAYER
// ==========================================

function playerDrop() {
    if (window.onlinePlay?.active) { window.onlinePlay.input('down'); return; }

    if (
        paused ||
        gameOver
    ) {
        return;
    }


    player.y++;


    if (collision()) {

        player.y--;

        lockPiece();

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


    while (!collision()) {

        player.y++;

        distance++;

    }


    player.y--;

    distance--;


    score +=
        Math.max(
            distance,
            0
        ) * 2;


    lockPiece();

}


// ==========================================
// LOCK PIECE
// ==========================================

function lockPiece() {

    if (!window.tetrisApp || window.tetrisApp.settings.effects) triggerHitEffect();
    mergePiece();
    clearLines();
    if (window.tetrisApp) {
        window.tetrisApp.cue("lock");
        if (window.tetrisApp.checkGoal()) { updateStats(); return; }
    }
    spawnPiece();
    updateStats();

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


function rotatePlayer() {
    if (window.onlinePlay?.active) { window.onlinePlay.input('rotate'); return; }

    if (
        paused ||
        gameOver
    ) {
        return;
    }


    const oldMatrix =
        player.matrix;

    const oldX =
        player.x;


    player.matrix =
        rotateMatrix(
            player.matrix
        );


    const kicks =
        [0, -1, 1, -2, 2];


    for (
        const offset of kicks
    ) {

        player.x =
            oldX + offset;


        if (!collision()) {

            return;

        }

    }


    player.matrix =
        oldMatrix;

    player.x =
        oldX;

}


// ==========================================
// CLEAR LINES
// ==========================================

function clearLines() {

    let cleared = 0;
    const clearedRows = [];


    for (
        let y = ROWS - 1;
        y >= 0;
        y--
    ) {

        const full =
            board[y].every(
                cell => cell !== null
            );


        if (full) {

            clearedRows.push(y);

            board.splice(y, 1);

            board.unshift(
                Array(COLS).fill(null)
            );

            cleared++;

            y++;

        }

    }


    if (cleared === 0) {

        comboMessage.textContent = "";

        return;

    }

    triggerClearEffect(clearedRows);


    lines += cleared;


    const points = [
        0,
        100,
        300,
        500,
        800
    ];


    score +=
        points[cleared] *
        level;


    if (cleared === 1) {

        showCombo(
            "GALING!"
        );

    }


    if (cleared === 2) {

        showCombo(
            "AYOS!"
        );

    }


    if (cleared === 3) {

        showCombo(
            "ASTIG!"
        );

    }


    if (cleared >= 4) {

        showCombo(
            "â˜… PINAS COMBO! â˜…"
        );

    }


    level =
        Math.floor(
            lines / 10
        ) + 1;

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
    authMessage.textContent = "Online sign-in is not available yet. Continue as guest to play and save progress on this browser.";
}

function isGmail(email) {
    return /[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email);
}

function setAuthMode(mode) {
    authMode = mode;
    const isLogin = mode === "login";

    showLoginBtn.classList.toggle("active", isLogin);
    showSignupBtn.classList.toggle("active", !isLogin);
    authSubmit.textContent = isLogin ? "LOG IN" : "SIGN UP";
    displayNameField.classList.toggle("hidden", isLogin);
    displayNameInput.required = !isLogin;
    authMessage.textContent = "";
}

function showGameScreen() {
    if (window.tetrisApp) window.tetrisApp.enter();
}

function showAuthScreen() {
    gameScreen.classList.add("hidden");
    document.getElementById("hubScreen").classList.add("hidden");
    authScreen.classList.remove("hidden");
}

function continueAsGuest() {
    authMessage.textContent = "Continuing as guest...";
    window.tetrisGuestSession = true;
    setTimeout(() => showGameScreen(), 250);
}

window.continueAsGuest = continueAsGuest;

function handleErrorMessage(code) {
    const map = {
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
        authMessage.textContent = "Online sign-in is not available yet. Continue as guest to play and save progress on this browser.";
        return;
    }

    const email = authEmailInput.value.trim().toLowerCase();
    const password = authPasswordInput.value.trim();
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
            authMessage.textContent = `Welcome back, ${user.displayName || user.email.split("@")[0]}!`;
            setTimeout(() => showGameScreen(), 500);
        })
        .catch((error) => {
            handleErrorMessage(error.code);
        });
}

function signInWithProvider(provider) {
    if (!firebaseReady) {
        authMessage.textContent = "Online sign-in is not available yet. Continue as guest to play and save progress on this browser.";
        return;
    }

    const authProvider = provider === "google"
        ? new firebase.auth.GoogleAuthProvider()
        : new firebase.auth.FacebookAuthProvider();

    firebase.auth().signInWithPopup(authProvider)
        .then(({ user }) => {
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
    if (!introScreen) {
        setAuthMode("login");
        showAuthScreen();
        return;
    }

    introScreen.classList.remove("hidden");
    authScreen.classList.add("hidden");
    gameScreen.classList.add("hidden");

    setTimeout(() => {
        introScreen.classList.add("fade-out");

        setTimeout(() => {
            introScreen.classList.add("hidden");
            setAuthMode("login");
            showAuthScreen();
        }, 1250);
    }, 1500);
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

                    if (type) {

                        drawBlock(
                            context,
                            x,
                            y,
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

                    if (value) {

                        drawBlock(
                            context,
                            player.x + x,
                            player.y + y,
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

    if (!player) {
        return;
    }


    let ghostY =
        player.y;


    while (
        !collision(
            player.matrix,
            player.x,
            ghostY + 1
        )
    ) {

        ghostY++;

    }


    context.save();


    context.globalAlpha =
        0.22;


    player.matrix.forEach(
        (row, y) => {

            row.forEach(
                (value, x) => {

                    if (value) {

                        drawBlock(
                            context,
                            player.x + x,
                            ghostY + y,
                            COLORS[player.type],
                            BLOCK,
                            {
                                glow: true,
                                glowStrength: 10
                            }
                        );

                    }

                }
            );

        }
    );


    context.restore();

}


// ==========================================
// DRAW NEXT PIECE
// ==========================================

function drawNextPiece() {

    nextContext.clearRect(
        0,
        0,
        nextCanvas.width,
        nextCanvas.height
    );


    nextContext.fillStyle =
        "#211711";


    nextContext.fillRect(
        0,
        0,
        nextCanvas.width,
        nextCanvas.height
    );


    if (!nextPiece) {
        return;
    }


    const matrix =
        nextPiece.matrix;


    const size = 25;


    const width =
        matrix[0].length *
        size;


    const height =
        matrix.length *
        size;


    const startX =
        (
            nextCanvas.width -
            width
        ) / 2;


    const startY =
        (
            nextCanvas.height -
            height
        ) / 2;


    matrix.forEach(
        (row, y) => {

            row.forEach(
                (value, x) => {

                    if (!value) {
                        return;
                    }


                    const px =
                        startX +
                        x * size;


                    const py =
                        startY +
                        y * size;


                    nextContext.fillStyle =
                        COLORS[
                            nextPiece.type
                        ];


                    nextContext.fillRect(
                        px + 1,
                        py + 1,
                        size - 2,
                        size - 2
                    );


                    nextContext.strokeStyle =
                        "rgba(255,255,255,0.25)";


                    nextContext.strokeRect(
                        px + 4,
                        py + 4,
                        size - 8,
                        size - 8
                    );

                }
            );

        }
    );

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

    if (!window.tetrisApp || window.tetrisApp.settings.ghost) drawGhost();

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

}


// ==========================================
// GAME SPEED
// ==========================================

function getDropInterval() {

    return Math.max(
        100,
        850 -
        (
            level - 1
        ) * 70
    );

}


// ==========================================
// GAME LOOP
// ==========================================

function update(time = 0) {

    const deltaTime = Math.min(250, Math.max(0, time - lastTime));


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
        dropCounter += deltaTime;


        if (
            dropCounter >
            getDropInterval() && !gameOver &&
            (!window.tetrisApp || window.tetrisApp.mode !== "practice")
        ) {

            playerDrop();

            dropCounter = 0;

        }

    }


    if (window.onlinePlay?.active) window.onlinePlay.tick();
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


    score = 0;

    lines = 0;

    level = 1;


    paused = false;

    gameOver = false;


    nextPiece =
        randomPiece();


    spawnPiece();


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


// ==========================================
// KEYBOARD CONTROLS
// ==========================================

document.addEventListener(
    "keydown",
    event => {
        if (event.target.matches('input, textarea, select, [contenteditable="true"]') || gameScreen.classList.contains('hidden') || document.getElementById('matchMenu').open) return;

        if (
            event.code === "ArrowLeft"
        ) {

            event.preventDefault();

            movePlayer(-1);

        }


        else if (
            event.code === "ArrowRight"
        ) {

            event.preventDefault();

            movePlayer(1);

        }


        else if (
            event.code === "ArrowDown"
        ) {

            event.preventDefault();

            playerDrop();

        }


        else if (
            event.code === "ArrowUp"
        ) {

            event.preventDefault();

            rotatePlayer();

        }


        else if (
            event.code === "Space"
        ) {

            event.preventDefault();

            hardDrop();

        }


        else if (
            event.key.toLowerCase() === "p"
        ) {

            togglePause();

        }

    }
);


// ==========================================
// BOARD GESTURES
// ==========================================

// Board gestures replace the hidden button panel.
const gestureBoard = canvas.closest('.board-frame');
let boardGesture = null;
let boardHoldTimer;
function cancelBoardGesture() {
    clearTimeout(boardHoldTimer);
    boardGesture = null;
}
gestureBoard.addEventListener('pointerdown', event => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    boardGesture = { id: event.pointerId, x: event.clientX, y: event.clientY, held: false };
    gestureBoard.setPointerCapture(event.pointerId);
    if (!paused && !gameOver) {
        boardHoldTimer = setTimeout(() => {
            if (!boardGesture) return;
            boardGesture.held = true;
            togglePause();
        }, 600);
    }
});
gestureBoard.addEventListener('pointermove', event => {
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
    if (distance < 18) { rotatePlayer(); return; }
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
gestureBoard.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('keydown', event => {
    if (gameScreen.classList.contains('hidden') || document.getElementById('matchMenu').open || event.target.matches('input, textarea, select, [contenteditable="true"]')) return;
    if (event.key.toLowerCase() === 'r' && !event.repeat) resetGame();
});

// // BUTTON CONTROLS
// ==========================================

document
    .getElementById(
        "leftButton"
    )
    .addEventListener(
        "click",
        () => movePlayer(-1)
    );


document
    .getElementById(
        "rightButton"
    )
    .addEventListener(
        "click",
        () => movePlayer(1)
    );


document
    .getElementById(
        "downButton"
    )
    .addEventListener(
        "click",
        playerDrop
    );


document
    .getElementById(
        "rotateButton"
    )
    .addEventListener(
        "click",
        rotatePlayer
    );


document
    .getElementById(
        "dropButton"
    )
    .addEventListener(
        "click",
        hardDrop
    );


document
    .getElementById(
        "pauseButton"
    )
    .addEventListener(
        "click",
        togglePause
    );


document
    .getElementById(
        "restartButton"
    )
    .addEventListener(
        "click",
        resetGame
    );


// ==========================================
// START
// ==========================================

resetGame();
update();


