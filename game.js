const TANKS = {
  "pixel": {name: "Pixel", hp: 100, speed: 2.5, ability: "dash", color: "#d43d3d", cool: 5000, icon: "🟥"},
  "heavy": {name: "Heavy", hp: 180, speed: 1.6, ability: "shield", color: "#3d5fd4", cool: 9000, icon: "🟦"},
  "speedy": {name: "Speedy", hp: 70, speed: 4, ability: "sprint", color: "#f3d43d", cool: 4500, icon: "🟨"},
  "bomber": {name: "Bomber", hp: 110, speed: 1.8, ability: "bomb", color: "#a54224", cool: 8000, icon: "🟫"}
};

const GUNS = {
  "blaster": {name: "Blaster", fireRate: 420, bullet: "normal", speed: 8, price: 0, icon: "🔫"},
  "rapid":   {name: "Rapid",   fireRate: 170, bullet: "normal", speed: 9, price: 180, icon: "💥"},
  "bomb":    {name: "Bomb",    fireRate: 1200, bullet: "bomb", speed: 5, price: 220, icon: "💣"},
  "sniper":  {name: "Sniper",  fireRate: 900, bullet: "normal", speed: 14, price: 160, icon: "🎯"}
};
const POWERUP_ICONS = {heal: "❤", speed: "⚡", shield: "🛡️", rapid:"☄️"};
const ABILITY_ICONS = {dash:"💨", shield:"🛡️", sprint:"🏃", bomb:"💣"};

function drawTank(ctx, p, me=false) {
  if (p.dead) return;
  ctx.save();
  ctx.fillStyle = p.color || "#fff";
  ctx.globalAlpha = me ? 0.85 : 0.6;
  ctx.fillRect(p.x-19, p.y-19, 38, 38);
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 4;
  ctx.strokeRect(p.x-19.5, p.y-19.5, 39, 39);
  ctx.restore();

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle || 0);
  ctx.fillStyle = "#ffe100";
  ctx.fillRect(0, -6, 28, 12);
  ctx.restore();

  if (p.shield && p.shield > Date.now()) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = "#00fff7";
    ctx.lineWidth = 7;
    ctx.strokeRect(p.x-26, p.y-26, 52, 52);
    ctx.restore();
  }
  ctx.save();
  ctx.font = "13px 'Press Start 2P', monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.fillText(p.name, p.x, p.y-27);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#4d1818";
  ctx.fillRect(p.x-19, p.y+20, 38, 7);
  ctx.fillStyle = "#ff2222";
  ctx.fillRect(p.x-19, p.y+20, Math.max(0,38*(p.hp/(TANKS[p.tank].hp||100))), 7);
  ctx.strokeStyle = "#a12020";
  ctx.strokeRect(p.x-19, p.y+20, 38, 7);
  ctx.restore();

  if (p.powerup) {
    ctx.save();
    ctx.font = "22px VT323";
    ctx.fillStyle = "#ffe100";
    ctx.fillText(POWERUP_ICONS[p.powerup]||"?", p.x+22, p.y-8);
    ctx.restore();
  }
  ctx.save();
  ctx.font = "20px VT323";
  ctx.fillText(ABILITY_ICONS[TANKS[p.tank].ability], p.x-23, p.y-8);
  ctx.restore();

  if (p.abilityActive && p.abilityActive > Date.now()) {
    ctx.save();
    ctx.globalAlpha = .14;
    ctx.fillStyle = "#ffe100";
    ctx.fillRect(p.x-30, p.y-30, 60, 60);
    ctx.restore();
  }
}

function drawBullet(ctx, b) {
  ctx.save();
  if (b.isBomb || b.type==="bomb") {
    ctx.fillStyle = "#a54224";
    ctx.globalAlpha = 0.84;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 15, 0, Math.PI*2);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
  } else {
    ctx.fillStyle = "#ffe100";
    ctx.globalAlpha = 0.9;
    ctx.fillRect(b.x-5, b.y-5, 10, 10);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x-5, b.y-5, 10, 10);
  }
  ctx.restore();
}

function drawObstacle(ctx,o) {
  if (o.box) {
    ctx.save();
    ctx.fillStyle = o.color;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.strokeRect(o.x-1.5, o.y-1.5, o.w+3, o.h+3);
    ctx.restore();
  } else {
    ctx.save();
    ctx.fillStyle = o.color;
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
}

function drawPowerup(ctx,p) {
  ctx.save();
  ctx.fillStyle = p.color;
  ctx.globalAlpha = 0.74;
  ctx.fillRect(p.x-14, p.y-14, 28, 28);
  ctx.globalAlpha = 1.0;
  ctx.font = "21px VT323";
  ctx.fillText(POWERUP_ICONS[p.type]||"?", p.x, p.y+8);
  ctx.restore();
}