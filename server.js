const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let players = {};
let bullets = [];
let bots = {};
let powerups = [];
let obstacles = [];

const TANKS = {
  "pixel": {name: "Pixel", hp: 100, speed: 2.5, ability: "dash", color: "#d43d3d", cool: 5000},
  "heavy": {name: "Heavy", hp: 180, speed: 1.6, ability: "shield", color: "#3d5fd4", cool: 9000},
  "speedy": {name: "Speedy", hp: 70, speed: 4, ability: "sprint", color: "#f3d43d", cool: 4500},
  "bomber": {name: "Bomber", hp: 110, speed: 1.8, ability: "bomb", color: "#a54224", cool: 8000}
};

const GUNS = {
  "blaster": {name: "Blaster", fireRate: 420, bullet: "normal", speed: 8, price: 0},
  "rapid":   {name: "Rapid",   fireRate: 170, bullet: "normal", speed: 9, price: 180},
  "bomb":    {name: "Bomb",    fireRate: 1200, bullet: "bomb", speed: 5, price: 220},
  "sniper":  {name: "Sniper",  fireRate: 900, bullet: "normal", speed: 14, price: 160}
};

function spawnBrickWall(x, y, w, h) {
  for (let i=0;i<w;i++)
    for (let j=0;j<h;j++)
      obstacles.push({type:"brick",x:70+i*36,y:70+j*36,box:1,w:32,h:32,color:"#b55234"});
}

function spawnPowerup() {
  let types = ["heal", "speed", "shield", "rapid"];
  let type = types[Math.floor(Math.random()*types.length)];
  powerups.push({
    id: Math.random().toString(36).slice(2),
    x: 60+Math.random()*680,
    y: 60+Math.random()*480,
    type,
    color: {heal:"#ff4b8b",speed:"#ffe100",shield:"#00fff7",rapid:"#ff4b8b"}[type],
    expires: Date.now() + 9000 + Math.random()*7000
  });
}

function spawnBot(name, type) {
  bots[name] = {
    id: name,
    name,
    isBot: true,
    tank: "pixel",
    gun: "blaster",
    color: "#b0b0b0",
    x: 150 + Math.random()*500,
    y: 100 + Math.random()*400,
    angle: 0,
    hp: TANKS["pixel"].hp,
    coins: 0,
    score: 0,
    dead: false,
    respawn: 0,
    abilityCD: 0,
    abilityActive: 0,
    type: type||"aggressive",
    powerup: null,
    speed: TANKS["pixel"].speed,
    fireRate: GUNS["blaster"].fireRate,
  };
}

function canMoveTo(x, y, rad = 18) {
  for (let o of obstacles) {
    if (o.box && x > o.x-18 && x < o.x+o.w+18 && y > o.y-18 && y < o.y+o.h+18) return false;
    if (!o.box && Math.hypot(x-o.x, y-o.y) < (o.r||32) + rad) return false;
  }
  if (x < rad || x > 800-rad || y < rad || y > 600-rad) return false;
  return true;
}

app.use(express.static("public"));

io.on("connection", (socket) => {
  socket.emit("bots", bots);
  socket.emit("obstacles", obstacles);
  socket.emit("powerups", powerups);

  socket.on("tryLogin", ({ name, pass }) => {
    const taken = Object.values(players).some(p => p.name === name) || Object.values(bots).some(b => b.name === name);
    if (taken) {
      socket.emit("loginDenied", "Name taken!");
      return;
    }
    let data = {gun:"blaster",tank:"pixel",coins:0,fireRate:420,speed:2.5,upgrades:{}};
    let store = {};
    try { store = JSON.parse((pass && pass.length) ? (Buffer.from(pass,"base64").toString()) : "{}"); } catch {}
    data = {...data, ...store};
    players[socket.id] = {
      id: socket.id,
      name,
      gun: data.gun,
      tank: data.tank,
      color: TANKS[data.tank].color,
      x: 150 + Math.random()*500,
      y: 100 + Math.random()*400,
      angle: 0,
      hp: TANKS[data.tank].hp,
      coins: data.coins,
      score: 0,
      dead: false,
      respawn: 0,
      abilityCD: 0,
      abilityActive: 0,
      powerup: null,
      speed: TANKS[data.tank].speed + (data.upgrades?.speed||0),
      fireRate: GUNS[data.gun].fireRate - (data.upgrades?.fire||0),
      upgrades: data.upgrades||{}
    };
    socket.emit("loginAccepted", players[socket.id]);
    io.emit("players", players);
    io.emit("bots", bots);
    io.emit("obstacles", obstacles);
    io.emit("powerups", powerups);
  });

  socket.on("move", (data) => {
    let p = players[socket.id];
    if (p && !p.dead && canMoveTo(data.x, data.y, 18)) Object.assign(players[socket.id], data);
    io.emit("players", players);
  });

  socket.on("shoot", (bullet) => {
    let p = players[socket.id];
    if (p && !p.dead) bullets.push({ ...bullet, owner: socket.id, time: Date.now() });
    io.emit("bullets", bullets);
  });

  socket.on("shop", ({ type, item }) => {
    let p = players[socket.id];
    if (!p || p.dead) return;
    if (type==="gun" && GUNS[item] && p.coins>=GUNS[item].price) {
      p.gun = item; p.fireRate = GUNS[item].fireRate-(p.upgrades?.fire||0); p.coins -= GUNS[item].price;
    }
    if (type==="tank" && TANKS[item] && p.coins>=TANKS[item].price) {
      p.tank = item; p.hp = TANKS[item].hp; p.color = TANKS[item].color; p.speed = TANKS[item].speed+(p.upgrades?.speed||0); p.coins -= TANKS[item].price;
    }
    if (type==="upgrade" && item==="fire" && p.coins>=100) {
      p.upgrades.fire = (p.upgrades.fire||0)+60; p.fireRate -= 60; p.coins -= 100;
    }
    if (type==="upgrade" && item==="speed" && p.coins>=100) {
      p.upgrades.speed = (p.upgrades.speed||0)+0.4; p.speed += 0.4; p.coins -= 100;
    }
    io.emit("players", players);
    socket.emit("shopResult", { ok:true });
  });

  socket.on("usePowerup", () => {
    let p = players[socket.id];
    if (!p || !p.powerup || p.dead) return;
    if (p.powerup === "heal") p.hp = Math.min(p.hp + 50, TANKS[p.tank].hp);
    if (p.powerup === "speed") p.speedBoost = Date.now() + 5000;
    if (p.powerup === "shield") p.shield = Date.now() + 5000;
    if (p.powerup === "rapid") p.rapid = Date.now() + 5000;
    p.powerup = null;
    io.emit("players", players);
  });

  socket.on("useAbility", () => {
    let p = players[socket.id];
    if (!p || p.dead || p.abilityCD>Date.now()) return;
    let t = TANKS[p.tank];
    p.abilityCD = Date.now() + t.cool;
    if (t.ability==="dash"||t.ability==="sprint") p.abilityActive = Date.now() + 900;
    if (t.ability==="shield") p.shield = Date.now() + 3000;
    if (t.ability==="bomb") {
      bullets.push({x:p.x,y:p.y,angle:0,type:"bomb",owner:p.id,time:Date.now(),isBomb:true});
    }
    io.emit("players", players);
    io.emit("bullets", bullets);
  });

  socket.on("respawn", () => {
    let p = players[socket.id];
    if (!p) return;
    p.dead = false;
    p.hp = TANKS[p.tank].hp;
    p.x = 150 + Math.random()*500;
    p.y = 100 + Math.random()*400;
    io.emit("players", players);
  });

  socket.on("cheatCoins", () => {
    let p = players[socket.id];
    if (p) {
      p.coins += 1000000;
      io.emit("players", players);
    }
  });

  socket.on("chat", ({ name, msg }) => io.emit("chat", { name, msg }));

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("players", players);
  });
});

// Boxy map: bricks in a grid
spawnBrickWall(0,0,15,1);
spawnBrickWall(0,15,15,1);
spawnBrickWall(0,0,1,12);
spawnBrickWall(15,0,1,12);
spawnBrickWall(3,3,3,1);
spawnBrickWall(8,7,5,1);
spawnBrickWall(6,2,1,5);
spawnBrickWall(10,9,1,4);

setInterval(() => {
  if (!bots["Sam"]) spawnBot("Sam","aggressive");
  Object.values(bots).forEach(bot => {
    if (bot.dead && Date.now() > bot.respawn) {
      bot.dead = false;
      bot.hp = TANKS[bot.tank].hp;
      bot.x = 100 + Math.random()*600;
      bot.y = 100 + Math.random()*400;
    }
    if (bot.dead) return;
    let targets = Object.values(players).filter(p=>!p.dead);
    if (!targets.length) return;
    let t = targets.sort((a,b)=>Math.hypot(bot.x-a.x,bot.y-a.y)-Math.hypot(bot.x-b.x,bot.y-b.y))[0];
    let dx = t.x-bot.x, dy = t.y-bot.y;
    let dist = Math.hypot(dx,dy);
    let spd = TANKS[bot.tank].speed;
    let tx = bot.x + (dist>28 ? dx/dist*spd : 0);
    let ty = bot.y + (dist>28 ? dy/dist*spd : 0);
    if (canMoveTo(tx, ty, 18)) { bot.x = tx; bot.y = ty; }
    bot.angle = Math.atan2(dy,dx);
    if (bot.tank==="bomber" && dist<60 && bot.abilityCD<Date.now()) {
      bot.abilityCD = Date.now()+TANKS["bomber"].cool;
      bullets.push({x:bot.x,y:bot.y,angle:0,type:"bomb",owner:bot.id,time:Date.now(),isBomb:true});
    }
    if (!bot.lastShot || Date.now()-bot.lastShot>GUNS[bot.gun].fireRate) {
      bullets.push({
        x: bot.x + Math.cos(bot.angle)*32,
        y: bot.y + Math.sin(bot.angle)*32,
        angle: bot.angle,
        type: bot.gun,
        owner: bot.id,
        time: Date.now()
      });
      bot.lastShot = Date.now();
    }
  });
  io.emit("bots", bots);
}, 80);

setInterval(() => {
  if (powerups.length<3) spawnPowerup();
  powerups = powerups.filter(p => p.expires > Date.now());
  io.emit("powerups", powerups);
}, 3000);

setInterval(() => {
  bullets.forEach((b, i) => {
    let speed = b.isBomb?2.5: (GUNS[b.type||"blaster"].speed||8);
    if (b.isBomb) return;
    b.x += Math.cos(b.angle)*speed;
    b.y += Math.sin(b.angle)*speed;
    for (let o of obstacles) {
      if (o.box && b.x > o.x-8 && b.x < o.x+o.w+8 && b.y > o.y-8 && b.y < o.y+o.h+8) { bullets.splice(i,1); return; }
    }
    if (b.x<0||b.x>800||b.y<0||b.y>600) { bullets.splice(i,1); return; }
    Object.values(players).concat(Object.values(bots)).forEach(p => {
      if (b.owner!==p.id && !p.dead && Math.hypot(p.x-b.x,p.y-b.y)<20) {
        if (p.shield && p.shield>Date.now()) { bullets.splice(i,1); return; }
        let dmg = (b.type==="bomb"||b.isBomb)?70:20;
        p.hp -= dmg;
        if (p.hp<=0) {
          p.dead = true;
          p.respawn = Date.now()+2000;
          p.deaths = (p.deaths||0)+1;
          let killer = players[b.owner] || bots[b.owner];
          if (killer) killer.score += 1, killer.coins += 80;
        }
        bullets.splice(i,1);
      }
    });
  });
  io.emit("bullets", bullets);
  io.emit("players", players);
  io.emit("bots", bots);
}, 1000/40);

setInterval(() => {
  Object.values(players).concat(Object.values(bots)).forEach(p => {
    if (p.dead || p.powerup) return;
    for (let i=0;i<powerups.length;i++) {
      let pu = powerups[i];
      if (Math.hypot(p.x-pu.x,p.y-pu.y)<24) {
        p.powerup = pu.type;
        powerups.splice(i,1);
        break;
      }
    }
  });
  io.emit("players", players);
  io.emit("bots", bots);
  io.emit("powerups", powerups);
}, 60);

server.listen(3000, () => console.log("http://localhost:3000"));