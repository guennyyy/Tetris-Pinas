/* Shared, deterministic Tetris rules used by every solo mode and the race server. */
(function (root, factory) {
    const core = factory();
    if (typeof module === 'object' && module.exports) module.exports = core;
    else root.TetrisCore = core;
})(typeof globalThis === 'object' ? globalThis : this, function () {
    'use strict';
    const WIDTH = 10, VISIBLE_ROWS = 20, HIDDEN_ROWS = 2, HEIGHT = 22;
    const SHAPES = {
        I:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
        O:[[1,1],[1,1]],
        T:[[0,1,0],[1,1,1],[0,0,0]],
        S:[[0,1,1],[1,1,0],[0,0,0]],
        Z:[[1,1,0],[0,1,1],[0,0,0]],
        J:[[1,0,0],[1,1,1],[0,0,0]],
        L:[[0,0,1],[1,1,1],[0,0,0]]
    };
    const TYPES = Object.keys(SHAPES);
    const NORMAL_POINTS = [0,100,300,500,800];
    const TSPIN_POINTS = [400,800,1200,1600];
    const PERFECT_CLEAR_POINTS = [0,800,1200,1800,2000];
    // SRS offsets are expressed in canvas coordinates (positive y is down).
    const KICKS = {
        '0>1':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
        '1>0':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],
        '1>2':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],
        '2>1':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
        '2>3':[[0,0],[1,0],[1,-1],[0,2],[1,2]],
        '3>2':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
        '3>0':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
        '0>3':[[0,0],[1,0],[1,-1],[0,2],[1,2]]
    };
    const I_KICKS = {
        '0>1':[[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
        '1>0':[[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
        '1>2':[[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
        '2>1':[[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
        '2>3':[[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
        '3>2':[[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
        '3>0':[[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
        '0>3':[[0,0],[-1,0],[2,0],[-1,-2],[2,1]]
    };
    const createBoard = () => Array.from({length:HEIGHT}, () => Array(WIDTH).fill(null));
    const makePiece = type => ({type, matrix:SHAPES[type].map(row => row.slice()), x:Math.floor((WIDTH-SHAPES[type][0].length)/2), y:HIDDEN_ROWS-SHAPES[type].findIndex(row => row.some(Boolean)), rotation:0});
    function refillBag(queue, random=Math.random) {
        const bag = TYPES.slice();
        for (let i=bag.length-1; i>0; i--) {
            const j=Math.floor(random()*(i+1));
            [bag[i],bag[j]]=[bag[j],bag[i]];
        }
        queue.push(...bag);
        return queue;
    }
    function ensureQueue(queue, count=6, random=Math.random) {
        while (queue.length<count) refillBag(queue,random);
        return queue;
    }
    function collides(board, matrix, x, y) {
        for (let row=0; row<matrix.length; row++) for (let col=0; col<matrix[row].length; col++) {
            if (!matrix[row][col]) continue;
            const bx=x+col, by=y+row;
            if (bx<0 || bx>=WIDTH || by<0 || by>=HEIGHT || board[by][bx]) return true;
        }
        return false;
    }
    function rotated(matrix, clockwise=true) {
        const result=matrix[0].map((_,i) => matrix.map(row => row[i]));
        return clockwise ? result.map(row => row.reverse()) : result.reverse();
    }
    function rotate(board, piece, clockwise=true) {
        if (piece.type==='O') return {...piece, rotation:(piece.rotation+(clockwise?1:3))%4, lastRotation:true};
        const from=piece.rotation||0, to=(from+(clockwise?1:3))%4;
        const matrix=rotated(piece.matrix,clockwise);
        const kicks=(piece.type==='I'?I_KICKS:KICKS)[`${from}>${to}`];
        for (const [dx,dy] of kicks) {
            if (!collides(board,matrix,piece.x+dx,piece.y+dy)) return {...piece,matrix,x:piece.x+dx,y:piece.y+dy,rotation:to,lastRotation:true};
        }
        return null;
    }
    function clearLines(board) {
        const rows=[];
        for (let y=HEIGHT-1; y>=0; y--) if (board[y].every(Boolean)) {
            board.splice(y,1);
            board.unshift(Array(WIDTH).fill(null));
            rows.push(y);
            y++;
        }
        return rows;
    }
    function isTSpin(board,piece) {
        if (piece.type!=='T' || !piece.lastRotation) return false;
        const cx=piece.x+1,cy=piece.y+1;
        let occupied=0;
        for (const [dx,dy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
            const x=cx+dx,y=cy+dy;
            if (x<0 || x>=WIDTH || y<0 || y>=HEIGHT || board[y][x]) occupied++;
        }
        return occupied>=3;
    }
    function scoreClear({count,level,tSpin=false,backToBack=false,combo=-1,perfectClear=false}) {
        const difficult=count===4 || (tSpin && count>0);
        const base=tSpin ? (TSPIN_POINTS[count]||0) : (NORMAL_POINTS[count]||0);
        const linePoints=Math.round(base*(difficult&&backToBack?1.5:1))*level;
        const comboPoints=count>0 ? 50*Math.max(0,combo)*level : 0;
        const perfectPoints=perfectClear&&count>0 ? (PERFECT_CLEAR_POINTS[count]||0)*level : 0;
        return {points:linePoints+comboPoints+perfectPoints,difficult,linePoints,comboPoints,perfectPoints};
    }
    function getGravityMs(level) {
        const base=Math.max(.01,.8-(Math.max(1,level)-1)*.007);
        return Math.max(1,500*Math.pow(base,Math.max(1,level)-1));
    }
    return {WIDTH,VISIBLE_ROWS,HIDDEN_ROWS,HEIGHT,SHAPES,TYPES,createBoard,makePiece,refillBag,ensureQueue,collides,rotated,rotate,clearLines,isTSpin,scoreClear,getGravityMs,PERFECT_CLEAR_POINTS};
});
