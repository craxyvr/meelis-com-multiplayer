const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(__dirname + '/meelis_com_oliver_peil_files_v2.html'));

const DEFAULT_FILES = {
  "oliver": "Oliver Peil Files — Fiction Archive\n\nOliver Peil is a fictional character from the Meelis.Com universe. The archive says Oliver grew up with very little money, and his parents also had a hard time. When he got older, the lore says he moved to a secret street when he was 5 years old.\n\nThere he dropped a legendary joke song called \"Onga Bonga Shakaday.\" The song did extremely well in the archive: 5 views and 1 like. Oliver was very happy about this.\n\nLater, Edvyn Kaevats brought Oliver to a dramatic cartoon-style court case and said the song sounded suspicious. In the Meelis.Com lore, Edvyn won the case.\n\nOliver is written as a chaotic character: messy, weird, and always causing trouble. One legend says he scared everyone away from a backyard hangout with his terrible smell. Other names in the file are treated as story nicknames and secret code names.\n\nHow did Oliver become like this? The archive says nobody really knows. The answer is still classified.",
  "war": "Great War Of Suur Jahu — Improved Archive Text\n\nThe Great War of Suur Jahu began when Meelis started a conflict against Edvyn. At first, Edvyn controlled a powerful country and had an alliance with Vitja. Edvyn sent Vitja to attack Meelis, but the plan changed fast. Vitja and Meelis secretly formed their own alliance and began planning an attack on Edvyn.\n\nEdvyn did not know what was coming. He was not ready when the news broke: Suur Jahu was under attack, and half of the land had already been taken. In the capital, crowds started protesting and demanding a new president. Many people blamed Edvyn for the disaster.\n\nLater, Edvyn gave a huge speech. The speech changed the mood of the capital, and many people started supporting him again. After that, Edvyn went back to his office and tried to relax.\n\nBut then Meelis and Vitja broke into the office. They demanded that Edvyn hand over his land and come with them to jail. Edvyn simply said, \"No.\" Vitja was furious and pushed Edvyn to the ground. Meelis tripped and fell onto a stack of papers. Vitja jumped on top of them and started wrestling.\n\nEdvyn escaped through a hidden bunker entrance beneath the floor. The bunker was full of old war plans. Meelis and Vitja tried to follow but the bunker had counterattacks, and they had to escape.",
  "kaevats": "Kaevats Files — Protected Dossier\n\nEdvyn Kaevats is a strategic commander from Suur Jahu. The classified archive says he is known for stopping a MIRV missile attack at Kaevatsi Laid, a small but important island.\n\nAfter the war, he became a local leader in the rebuilding efforts. His current status is unknown.\n\nDetails of his operations remain classified until the release timer ends."
};

const chatHistory = [];

const state = {
  files: JSON.parse(JSON.stringify(DEFAULT_FILES)),
  accounts: {},
  news: [],
  scores: {},
  missions: [],
  treaty: null,
  logs: []
};

function addLog(user, message) {
  state.logs.unshift({ u: user, t: Date.now(), m: message });
  if (state.logs.length > 120) state.logs.length = 120;
}

const gameRooms = {};
function genId(){return Math.random().toString(36).substring(2,6).toUpperCase()}
function initGame(type){
  switch(type){
    case 'tictactoe': return {board:Array(9).fill(null),turn:0,winner:null,cats:false};
    case 'connect4': return {board:Array.from({length:6},()=>Array(7).fill(null)),turn:0,winner:null};
    case 'rps': return {p1:null,p2:null,round:0,wins:[0,0],done:false};
    case 'numberguess': return {target:Math.floor(Math.random()*100)+1,guesses:[],turn:0,winner:null};
    case 'conquest': return {grid:Array.from({length:5},()=>Array(5).fill(-1)),turn:0,scores:[0,0],winner:null};
  }
}
function checkGameWin(room){
  const g=room.state;
  if(room.type==='tictactoe'){
    const w=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for(const [a,b,c] of w)if(g.board[a]&&g.board[a]===g.board[b]&&g.board[a]===g.board[c])return g.board[a];
    if(g.board.every(x=>x))return 'cats';
  }
  if(room.type==='connect4'){
    for(let r=0;r<6;r++)for(let c=0;c<7;c++){
      const p=g.board[r][c];if(!p)continue;
      if(c+3<7&&p===g.board[r][c+1]&&p===g.board[r][c+2]&&p===g.board[r][c+3])return p;
      if(r+3<6&&p===g.board[r+1][c]&&p===g.board[r+2][c]&&p===g.board[r+3][c])return p;
      if(r+3<6&&c+3<7&&p===g.board[r+1][c+1]&&p===g.board[r+2][c+2]&&p===g.board[r+3][c+3])return p;
      if(r+3<6&&c-3>=0&&p===g.board[r+1][c-1]&&p===g.board[r+2][c-2]&&p===g.board[r+3][c-3])return p;
    }
  }
  if(room.type==='conquest'){
    if(g.scores[0]+g.scores[1]===25)return g.scores[0]>g.scores[1]?0:1;
  }
  return null;
}

io.on('connection', (socket) => {
  let currentUser = 'guest';
  socket.emit('init', { files: state.files, accounts: state.accounts, news: state.news, scores: state.scores, missions: state.missions, treaty: state.treaty, logs: state.logs, chat: chatHistory.slice(-50) });

  socket.on('findGame', ({ type }) => {
    let room = Object.values(gameRooms).find(r => r.type === type && r.players.length === 1 && !r.players.includes(socket.id));
    if (!room) {
      const id = genId();
      room = { id, type, players: [socket.id], state: initGame(type), ready: 0 };
      gameRooms[id] = room;
      socket.emit('gameCreated', { roomId: id, player: 0 });
    } else {
      room.players.push(socket.id);
      room.state.turn = 0;
      socket.emit('gameCreated', { roomId: room.id, player: 1 });
      io.to(room.players[0]).to(room.players[1]).emit('gameStart', { roomId: room.id, state: room.state });
      socket.to(room.players[0]).emit('gameStart', { roomId: room.id, state: room.state });
    }
    socket.join(room.id);
  });

  socket.on('gameMove', ({ roomId, move }) => {
    const room = gameRooms[roomId];
    if (!room) return;
    const pi = room.players.indexOf(socket.id);
    if (pi === -1 || pi !== room.state.turn) return;
    const g = room.state;
    if (room.type === 'tictactoe') {
      if (g.board[move] !== null) return;
      g.board[move] = pi === 0 ? 'X' : 'O';
      g.turn = 1 - g.turn;
    } else if (room.type === 'connect4') {
      let col = move;
      for (let r = 5; r >= 0; r--) {
        if (g.board[r][col] === null) { g.board[r][col] = pi === 0 ? 'R' : 'Y'; break; }
      }
      g.turn = 1 - g.turn;
    } else if (room.type === 'rps') {
      if (pi === 0) g.p1 = move;
      else g.p2 = move;
      if (g.p1 && g.p2) {
        const w = g.p1 === g.p2 ? -1 : (g.p1==='rock'?g.p2==='scissors'?0:1:g.p1==='paper'?g.p2==='rock'?0:1:g.p2==='paper'?0:1);
        if (w >= 0) g.wins[w]++;
        g.round++;
        if (g.wins[0] >= 2 || g.wins[1] >= 2) g.done = true;
        else { g.p1 = null; g.p2 = null; }
      }
    } else if (room.type === 'numberguess') {
      g.guesses.push({ player: pi, guess: move });
      if (g.guesses.length % 2 === 0) {
        const p1g = g.guesses[g.guesses.length - 2].guess;
        const p2g = g.guesses[g.guesses.length - 1].guess;
        const d1 = Math.abs(p1g - g.target);
        const d2 = Math.abs(p2g - g.target);
        if (d1 < d2) g.winner = 0; else if (d2 < d1) g.winner = 1; else g.winner = -1;
      }
    } else if (room.type === 'conquest') {
      const [r, c] = move;
      if (g.grid[r][c] !== -1) return;
      g.grid[r][c] = pi;
      g.scores[pi]++;
      g.turn = 1 - g.turn;
    }
    const win = checkGameWin(room);
    if (win !== null) g.winner = win === 'cats' ? -1 : (win === 'X' || win === 'R' || win === 0 ? 0 : 1);
    io.to(room.id).emit('gameState', { roomId, state: g });
    if (g.winner !== null) {
      setTimeout(() => { delete gameRooms[roomId]; io.to(room.id).emit('gameEnd', { roomId }); }, 2000);
    }
  });

  socket.on('leaveGame', ({ roomId }) => {
    const room = gameRooms[roomId];
    if (!room) return;
    room.players = room.players.filter(p => p !== socket.id);
    socket.leave(roomId);
    if (room.players.length === 0) delete gameRooms[roomId];
    else io.to(room.id).emit('gameEnd', { roomId });
  });

  socket.on('login', (name) => {
    currentUser = name;
    if (!state.accounts[name]) {
      state.accounts[name] = { pass: '', created: Date.now(), lastSeen: Date.now() };
    } else {
      state.accounts[name].lastSeen = Date.now();
    }
    addLog(name, 'logged in');
    io.emit('accounts', state.accounts);
  });

  socket.on('signup', ({ name, pass }) => {
    if (state.accounts[name]) return socket.emit('authError', 'Name already exists');
    state.accounts[name] = { pass, created: Date.now(), lastSeen: Date.now() };
    currentUser = name;
    addLog(name, 'signed up');
    io.emit('accounts', state.accounts);
    socket.emit('authOk', name);
  });

  socket.on('loginAttempt', ({ name, pass }) => {
    const a = state.accounts[name];
    if (!a || a.pass !== pass) return socket.emit('authError', 'Wrong login');
    a.lastSeen = Date.now();
    currentUser = name;
    addLog(name, 'logged in');
    io.emit('accounts', state.accounts);
    socket.emit('authOk', name);
  });

  socket.on('logout', () => {
    if (currentUser !== 'guest') {
      addLog(currentUser, 'logged out');
      if (state.accounts[currentUser]) state.accounts[currentUser].lastSeen = 0;
    }
    currentUser = 'guest';
    io.emit('accounts', state.accounts);
  });

  socket.on('saveFiles', (files) => {
    state.files = files;
    addLog(currentUser, 'edited files');
    socket.broadcast.emit('files', state.files);
  });

  socket.on('postNews', (item) => {
    state.news.unshift(item);
    if (state.news.length > 50) state.news.length = 50;
    addLog(currentUser, 'posted news');
    io.emit('news', state.news);
  });

  socket.on('saveScore', ({ game, value }) => {
    if (value > (state.scores[game] || 0)) {
      state.scores[game] = value;
      io.emit('scores', state.scores);
    }
  });

  socket.on('saveMissions', (missions) => {
    state.missions = missions;
    io.emit('missions', state.missions);
  });

  socket.on('saveTreaty', (treaty) => {
    state.treaty = treaty;
    addLog(currentUser, 'made treaty');
    io.emit('treaty', state.treaty);
  });

  socket.on('chatMessage', (msg) => {
    const entry = { u: currentUser, msg, t: Date.now() };
    chatHistory.push(entry);
    if (chatHistory.length > 100) chatHistory.shift();
    io.emit('chatMessage', entry);
  });

  socket.on('radioMessage', (msg) => {
    addLog(currentUser, 'broadcast: ' + msg);
    io.emit('radioMessage', { u: currentUser, msg, t: Date.now() });
  });

  socket.on('log', ({ u, m }) => {
    addLog(u, m);
    io.emit('logs', state.logs);
  });

  socket.on('disconnect', () => {
    if (currentUser !== 'guest' && state.accounts[currentUser]) {
      state.accounts[currentUser].lastSeen = 0;
      io.emit('accounts', state.accounts);
    }
    for (const roomId in gameRooms) {
      const room = gameRooms[roomId];
      if (room.players.includes(socket.id)) {
        room.players = room.players.filter(p => p !== socket.id);
        io.to(room.id).emit('gameEnd', { roomId });
        socket.leave(roomId);
        if (room.players.length === 0) delete gameRooms[roomId];
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Meelis.Com server running on port ${PORT}`);
});
