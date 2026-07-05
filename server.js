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

io.on('connection', (socket) => {
  let currentUser = 'guest';
  socket.emit('init', { files: state.files, accounts: state.accounts, news: state.news, scores: state.scores, missions: state.missions, treaty: state.treaty, logs: state.logs });

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

  socket.on('disconnect', () => {
    if (currentUser !== 'guest' && state.accounts[currentUser]) {
      state.accounts[currentUser].lastSeen = 0;
      io.emit('accounts', state.accounts);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Meelis.Com server running on port ${PORT}`);
});
