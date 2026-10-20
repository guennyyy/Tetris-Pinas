'use strict';
const assert=require('node:assert/strict');
const core=require('./tetris-core.js');
const race=require('./multiplayer-engine.cjs');

assert.equal(core.createBoard().length,22);
assert(core.createBoard().every(row=>row.length===10));
const queue=[];
core.ensureQueue(queue,14,()=>.37);
assert.equal(new Set(queue.slice(0,7)).size,7,'Each bag contains all seven pieces');
assert.equal(new Set(queue.slice(7,14)).size,7,'The next bag is complete');
assert.equal(core.getGravityMs(1),500);
assert(Math.abs(core.getGravityMs(2)-396.5)<2);
assert(core.getGravityMs(10)<70);

for(const type of core.TYPES){
    const p=core.makePiece(type);
    const cells=p.matrix.flatMap((row,y)=>row.flatMap((v,x)=>v?[{x:p.x+x,y:p.y+y}]:[]));
    assert.equal(cells.length,4);
    assert.equal(Math.min(...cells.map(c=>c.y)),core.HIDDEN_ROWS,'Spawn begins at the first visible row');
    assert(cells.every(c=>c.y>=core.HIDDEN_ROWS&&c.y<core.HEIGHT),'All four blocks are visible immediately');
}
const board=core.createBoard();
const piece=core.makePiece('I');
piece.matrix=core.rotated(piece.matrix,true);piece.rotation=1;piece.x=7;
assert(!core.collides(board,piece.matrix,piece.x,piece.y));
const kicked=core.rotate(board,piece,true);
assert(kicked && kicked.x<piece.x,'I rotation kicks away from the wall');
assert(!core.collides(board,kicked.matrix,kicked.x,kicked.y));
assert(core.collides(board,kicked.matrix,-3,kicked.y),'Collision prevents passing through a wall');
for(let x=0;x<10;x++)board[21][x]='I';
assert.deepEqual(core.clearLines(board),[21]);
assert(board.every(row=>row.every(cell=>cell===null)),'A full row clears exactly once');
assert.deepEqual(core.clearLines(board),[]);
assert.equal(core.scoreClear({count:4,level:5}).points,4000);
assert.equal(core.scoreClear({count:4,level:5,backToBack:true}).points,6000);
assert.equal(core.scoreClear({count:2,level:1,combo:2,perfectClear:true}).points,1600);
assert.equal(core.scoreClear({count:0,level:3,tSpin:true}).points,1200);

const game=race.createGame(123);
const initial=game.player.type;
race.action(game,'hold');
assert.equal(game.heldType,initial);
const active=game.player.type;
race.action(game,'hold');
assert.equal(game.player.type,initial,'Second hold restores the held piece');
assert.equal(game.heldType,active,'Second hold stores the outgoing piece');
const queueBeforeSwap=game.queue.slice();
race.action(game,'hold');
assert.equal(game.player.type,active,'Further presses keep swapping');
assert.deepEqual(game.queue,queueBeforeSwap,'Swapping does not consume the next queue');
game.player=core.makePiece('O');game.player.y=20;
race.tick(game,499);assert.equal(game.board[21].filter(Boolean).length,0,'Piece waits during lock delay');
race.tick(game,1);assert.equal(game.board[21].filter(Boolean).length,2,'Piece locks after 500 ms');
const goal=race.createGame(456);goal.lines=40;
const frozen=JSON.stringify(race.snapshot(goal));
race.action(goal,'drop');race.tick(goal,5000);
assert.equal(JSON.stringify(race.snapshot(goal)),frozen,'Completed Sprint ignores further input');
const topout=race.createGame(789);topout.player=core.makePiece('O');topout.player.y=0;
topout.board[2][topout.player.x]='Z';
race.action(topout,'drop');
assert(topout.over,'Locking entirely in the hidden spawn area ends the game');
console.log('PASS: 22-row board, 7-bag, gravity, wall kicks, collision, line clearing, scoring, hold, lock delay, Sprint completion, top-out.');

const mouse=race.createGame(99);mouse.player=core.makePiece('O');race.action(mouse,'moveTo',9);assert.equal(mouse.player.x,8);race.action(mouse,'moveTo',0);assert.equal(mouse.player.x,0);mouse.board[2][2]='I';race.action(mouse,'moveTo',9);assert.equal(mouse.player.x,0,'Server mouse movement cannot tunnel through blocks');race.action(mouse,'moveTo',NaN);assert.equal(mouse.player.x,0,'Invalid mouse column is ignored');console.log('PASS: mouse targeting respects walls, stacks and input bounds.');
