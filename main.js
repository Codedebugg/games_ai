// ===== ENTRY FLOW: SCREENS =====
window.onload = function() {
  // Only show liability at start
  document.getElementById("liability").style.display = "";
  document.getElementById("loginPage").style.display = "none";
  document.getElementById("intro").style.display = "none";
  document.getElementById("gameWrap").style.display = "none";
  document.getElementById("instructionsPanel").style.display = "none";
};

// --- Liability screen logic ---
document.getElementById("liabBtn").onclick = function() {
  if (!document.getElementById("liabCheck").checked) {
    alert("You must agree to the liability terms to play!");
    return;
  }
  document.getElementById("liability").style.display = "none";
  document.getElementById("loginPage").style.display = "";
};

// --- Login screen logic ---
document.getElementById("loginBtn").onclick = function() {
  let user = document.getElementById("loginUser").value.trim();
  let pass = document.getElementById("loginPass").value;
  if (!user) {
    document.getElementById("loginMsg").innerText = "Username required!";
    return;
  }
  localStorage.setItem("arenaName", user);
  localStorage.setItem("arenaPass", pass);
  document.getElementById("loginPage").style.display = "none";
  document.getElementById("intro").style.display = "";
};

// --- Intro screen logic ---
document.getElementById("startBtn").onclick = function() {
  document.getElementById("intro").style.display = "none";
  document.getElementById("instructionsPanel").style.display = "";
};

// --- Instructions panel logic ---
document.getElementById("closeInstr").onclick = function() {
  document.getElementById("instructionsPanel").style.display = "none";
  document.getElementById("gameWrap").style.display = "";
  connectGame();
};

// == Main Game Logic ==
let socket = io();
let canvas = document.getElementById("game");
let ctx = canvas.getContext("2d");
let players = {}, bots = {}, bullets = [], obstacles = [], powerups = [], me = null, myId = null;
let keys = {};
let leaderboard = document.getElementById("leaderboard");
let killFeed = document.getElementById("killFeed");
let joystick = document.getElementById("joystick");
let joystickWrap = document.getElementById("joystickWrap");
let chatInput = null, chatFeed = null;
let joyX=0, joyY=0, joystickActive=false;

let redBlur = document.createElement("div");
redBlur.className = "red-blur";
document.body.appendChild(redBlur);

// == Socket Events ==
socket.on("loginDenied", msg => {alert(msg); location.reload();});
socket.on("loginAccepted", (player) => {myId=player.id; me=player;});
socket.on("players", (ps) => {players=ps;if (myId&&players[myId]) me=players[myId];});
socket.on("bots", (bs) => {bots=bs;});
socket.on("bullets", (bs) => {bullets=bs;});
socket.on("obstacles", (os) => {obstacles=os;});
socket.on("powerups", (ps) => {powerups=ps;});

function connectGame() {
  let name = localStorage.getItem("arenaName") || document.getElementById("loginUser").value;
  let pass = localStorage.getItem("arenaPass") || document.getElementById("loginPass").value;
  socket.emit("tryLogin", { name, pass });
  localStorage.setItem("arenaName", name);
  localStorage.setItem("arenaPass", pass);
}

// == Game Loop/Rendering ==
function drawAll() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  obstacles.forEach(o=>drawObstacle(ctx,o));
  powerups.forEach(p=>drawPowerup(ctx,p));
  Object.values(bots).forEach(b => drawTank(ctx, b));
  Object.values(players).forEach(p => drawTank(ctx, p, p.id===myId));
  bullets.forEach(b => drawBullet(ctx, b));
}
function updateUI() {
  if (!me) return;
  let hpFrac = me.hp/(TANKS[me.tank].hp||100);
  document.getElementById("healthBar").style.width = (hpFrac*220)+"px";
  redBlur.style.opacity = Math.max(0, 1-hpFrac)*0.85;
  document.getElementById("coinAmount").innerText = me.coins||0;
  let tnk = TANKS[me.tank];
  document.getElementById("abilityIcon").innerText = ABILITY_ICONS[tnk.ability];
  let cdBar = document.getElementById("abilityCDBar");
  cdBar.innerHTML = "";
  let cd = me.abilityCD && me.abilityCD>Date.now()? (me.abilityCD-Date.now())/tnk.cool:0;
  let inner = document.createElement("div");
  inner.className = "cd-inner";
  inner.style.width = (60*(1-cd))+"px";
  cdBar.appendChild(inner);
  if (me.abilityActive && me.abilityActive>Date.now()) {
    document.getElementById("abilityIcon").style.background="#ffe100";
  } else {
    document.getElementById("abilityIcon").style.background=tnk.color;
  }
  let pwrIcon = document.getElementById("powerupIcon");
  pwrIcon.innerText = me.powerup? POWERUP_ICONS[me.powerup] : "";
  let pwrBar = document.getElementById("powerupBar");
  pwrBar.innerHTML = "";
  if (me.powerup) {
    let inner = document.createElement("div");
    inner.className = "pwr-inner";
    inner.style.width = "60px";
    pwrBar.appendChild(inner);
  }
  let all = Object.values(players).concat(Object.values(bots));
  all.sort((a,b)=>(b.score||0)-(a.score||0));
  leaderboard.innerHTML = all.map(p =>
    `<li style="color:${p.isBot?"#ffe100":p.color}">${p.name}: ${p.score||0}</li>`
  ).join("");
}
function gameLoop() {drawAll();updateUI();requestAnimationFrame(gameLoop);}
gameLoop();

// == Controls ==
document.addEventListener("keydown", e => {
  if (e.key === ";" && document.activeElement !== chatInput) {
    socket.emit("cheatCoins");
  }
  if (me && !me.dead) {
    if (e.key===" " && (!me.abilityCD||me.abilityCD<Date.now())) socket.emit("useAbility");
    if (e.key.toLowerCase()==="x" && me.powerup) socket.emit("usePowerup");
  }
  if (e.key.toLowerCase()==="r" && me && me.dead) socket.emit("respawn");
});
canvas.addEventListener("mousemove", (e) => {
  if (!me || me.dead) return;
  let rect = canvas.getBoundingClientRect();
  let mx = e.clientX - rect.left, my = e.clientY - rect.top;
  me.angle = Math.atan2(my-me.y, mx-me.x);
  socket.emit("move", { angle: me.angle });
});
canvas.addEventListener("mousedown", (e) => {
  if (!me || me.dead) return;
  let fireRate = GUNS[me.gun].fireRate-(me.upgrades?.fire||0);
  if (me.rapid && me.rapid>Date.now()) fireRate = 120;
  if (!me.lastShot || Date.now() - me.lastShot > fireRate) {
    socket.emit("shoot", {
      x: me.x + Math.cos(me.angle)*32,
      y: me.y + Math.sin(me.angle)*32,
      angle: me.angle,
      type: me.gun
    });
    me.lastShot = Date.now();
  }
});
function movePlayer() {
  if (!me || me.dead) return;
  let t = TANKS[me.tank];
  let spd = t.speed+(me.upgrades?.speed||0);
  if (me.speedBoost && me.speedBoost>Date.now()) spd *= 2.1;
  if (me.abilityActive && me.abilityActive>Date.now()) spd *= 2.3;
  let vx=0,vy=0;
  if (keys["w"]||keys["arrowup"]) vy-=spd;
  if (keys["s"]||keys["arrowdown"]) vy+=spd;
  if (keys["a"]||keys["arrowleft"]) vx-=spd;
  if (keys["d"]||keys["arrowright"]) vx+=spd;
  if (joystickActive) {vx+=joyX*spd; vy+=joyY*spd;}
  let tx = me.x+vx, ty = me.y+vy;
  let valid = true;
  for (let o of obstacles) {
    if (o.box && tx > o.x-18 && tx < o.x+o.w+18 && ty > o.y-18 && ty < o.y+o.h+18) valid = false;
  }
  if (valid && tx>18 && tx<782 && ty>18 && ty<582) {
    me.x = tx; me.y = ty;
    socket.emit("move", { x: me.x, y: me.y, angle: me.angle });
  }
}
setInterval(movePlayer, 1000/60);

// == Shop UI ==
document.getElementById("shopBtn").onclick = () => {
  let sp = document.getElementById("shopPanel");
  sp.style.display = "";
  renderShop();
};
function renderShop() {
  let sp = document.getElementById("shopPanel");
  let shopHTML = `<h2>SHOP</h2>
    <div class="shop-cat">TANKS</div>`;
  for (let [id,t] of Object.entries(TANKS)) {
    shopHTML += `<div class="shop-item${me.tank===id?" selected":""}" onclick="window.buyTank&&buyTank('${id}')">
      ${t.icon} <b>${t.name}</b> <span class="item-price">${t.price||0} 🪙</span>
      <br><small>HP:${t.hp} SPD:${t.speed} <b>${t.ability.toUpperCase()}</b></small>
      ${me.tank===id?'<br><span class="equip">[EQUIPPED]</span>':""}
    </div>`;
  }
  shopHTML += `<div class="shop-cat">GUNS</div>`;
  for (let [id,g] of Object.entries(GUNS)) {
    shopHTML += `<div class="shop-item${me.gun===id?" selected":""}" onclick="window.buyGun&&buyGun('${id}')">
      ${g.icon} <b>${g.name}</b> <span class="item-price">${g.price} 🪙</span>
      <br><small>Firerate:${g.fireRate} Spd:${g.speed}</small>
      ${me.gun===id?'<br><span class="equip">[EQUIPPED]</span>':""}
    </div>`;
  }
  shopHTML += `<div class="shop-cat">UPGRADES</div>
    <div class="shop-item" onclick="window.buyUpgrade&&buyUpgrade('fire')">
      ⏩ <b>Firerate +</b> <span class="item-price">100 🪙</span>
    </div>
    <div class="shop-item" onclick="window.buyUpgrade&&buyUpgrade('speed')">
      🏃 <b>Speed +</b> <span class="item-price">100 🪙</span>
    </div>
    <button id="closeShop" class="pixel-btn" onclick="document.getElementById('shopPanel').style.display='none'">Close</button>`;
  sp.innerHTML = shopHTML;
}
window.buyTank = (id) => { socket.emit("shop", { type: "tank", item: id }); document.getElementById("shopPanel").style.display = "none"; };
window.buyGun = (id) => { socket.emit("shop", { type: "gun", item: id }); document.getElementById("shopPanel").style.display = "none"; };
window.buyUpgrade = (type) => { socket.emit("shop", { type: "upgrade", item: type }); document.getElementById("shopPanel").style.display = "none"; };

// == Chat ==
chatInput = document.createElement("input");
chatInput.id = "chatInput";
chatInput.placeholder = "Type message...";
chatInput.className = "neon-text";
document.body.appendChild(chatInput);
chatInput.style.position = "absolute";
chatInput.style.bottom = "30px";
chatInput.style.left = "50%";
chatInput.style.transform = "translateX(-50%)";
chatInput.style.width = "340px";
chatInput.style.display = "none";
chatFeed = document.createElement("div");
chatFeed.id = "chatFeed";
chatFeed.className = "neon-text";
chatFeed.style.position = "absolute";
chatFeed.style.bottom = "110px";
chatFeed.style.left = "50%";
chatFeed.style.transform = "translateX(-50%)";
chatFeed.style.width = "420px";
chatFeed.style.maxHeight = "130px";
chatFeed.style.overflowY = "auto";
chatFeed.style.textAlign = "left";
chatFeed.style.pointerEvents = "none";
chatFeed.style.fontSize = "19px";
document.body.appendChild(chatFeed);

let chatHistory = [];
chatInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && chatInput.value) {
    socket.emit("chat", { name: me.name, msg: chatInput.value });
    chatInput.value = "";
    chatInput.style.display = "none";
    canvas.focus();
  }
});
socket.on("chat", ({ name, msg }) => {
  chatHistory.push(`<b style="color:#ffe100">${name}</b>: ${msg}`);
  if (chatHistory.length > 8) chatHistory.shift();
  chatFeed.innerHTML = chatHistory.join("<br>");
});
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && document.activeElement !== chatInput) {
    chatInput.style.display = "";
    chatInput.focus();
  }
});

// == Joystick for mobile ==
let isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
if (isMobile) joystickWrap.style.display="";
let joyOrigin=null;
joystick.addEventListener("touchstart",e=>{
  joystickActive=true;
  joyOrigin={x:e.touches[0].clientX,y:e.touches[0].clientY};
});
joystick.addEventListener("touchmove",e=>{
  if (!joyOrigin) return;
  let dx = e.touches[0].clientX-joyOrigin.x, dy = e.touches[0].clientY-joyOrigin.y;
  let dist = Math.min(1, Math.hypot(dx,dy)/40);
  joyX=dx/40; joyY=dy/40;
});
joystick.addEventListener("touchend",e=>{
  joystickActive=false; joyX=0; joyY=0;
});

// == Kill Feed ==
let lastKills = [];
setInterval(() => {
  let all = Object.values(players).concat(Object.values(bots));
  let deaths = all.filter(p => p.dead && !lastKills.includes(p.name));
  if (deaths.length) {
    killFeed.innerText = `${deaths[0].name} was destroyed!`;
    setTimeout(()=>killFeed.innerText="", 1600);
    lastKills.push(deaths[0].name); if (lastKills.length>8) lastKills.shift();
  }
}, 600);

// Fullscreen
document.getElementById("fullscreenBtn").onclick = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
};