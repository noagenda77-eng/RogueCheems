const canvas = document.getElementById("game");
const statusText = document.getElementById("status");
const playerHpText = document.getElementById("player-hp");
const floorLevelText = document.getElementById("floor-level");
const playerLevelText = document.getElementById("player-level");
const playerXpText = document.getElementById("player-xp");
const statDamageText = document.getElementById("stat-damage");
const statCritText = document.getElementById("stat-crit");
const statRegenText = document.getElementById("stat-regen");
const equipWeaponText = document.getElementById("equip-weapon");
const equipArmorText = document.getElementById("equip-armor");
const equipAccessoryText = document.getElementById("equip-accessory");
const inventoryList = document.getElementById("inventory-list");
const hpFill = document.getElementById("hp-fill");
const xpFill = document.getElementById("xp-fill");
const menuToggle = document.getElementById("menu-toggle");
const menuPanel = document.getElementById("menu-panel");
const menuClose = document.getElementById("menu-close");
const menuButtons = Array.from(document.querySelectorAll(".menu-button"));
const lootOverlay = document.getElementById("loot-overlay");
const lootDescription = document.getElementById("loot-description");
const lootEquipButton = document.getElementById("loot-equip");
const lootStoreButton = document.getElementById("loot-store");
const lootIgnoreButton = document.getElementById("loot-ignore");
const gameOverOverlay = document.getElementById("game-over");
const restartButton = document.getElementById("restart");
const ctx = canvas.getContext("2d");

const TILE_SIZE = 32;
const MAP_WIDTH = 60;
const MAP_HEIGHT = 45;
const MAX_ROOMS = 16;
const ROOM_MIN_SIZE = 4;
const ROOM_MAX_SIZE = 7;
const BASE_CANVAS_WIDTH = 800;
const BASE_CANVAS_HEIGHT = 608;
const ZOOM_MIN = 0.75;
const ZOOM_MAX = 12;
const ZOOM_STEP = 0.1;
const FOG_RADIUS = 7;

const TILE = {
  WALL: 0,
  FLOOR: 1,
  EXIT: 2,
};

const spritePaths = {
  floor: "assets/sprites/floor.png",
  wall: "assets/sprites/wall.png",
  player: "assets/sprites/player.png",
  exit: "assets/sprites/exit.png",
  enemy: "assets/sprites/enemy.png",
  cheeseburger: "assets/sprites/cheeseburger.png",
  chest: "assets/sprites/chest.png",
};

const audioPaths = {
  bgm: "assets/audio/bgm.wav",
  attack: "assets/audio/attack.wav",
};

const sprites = Object.fromEntries(
  Object.entries(spritePaths).map(([key, path]) => {
    const img = new Image();
    img.src = path;
    return [key, img];
  })
);

const audio = Object.fromEntries(
  Object.entries(audioPaths).map(([key, path]) => {
    const sound = new Audio(path);
    return [key, sound];
  })
);

let dungeon = [];
let player = { x: 0, y: 0 };
let exit = { x: 0, y: 0 };
let playerFrameIndex = 0;
let playerFacing = 1;
let camera = { x: 0, y: 0 };
let zoom = 1;
let enemies = [];
let floorVariants = [];
let wallVariants = [];
let playerHp = 0;
let playerMaxHp = 0;
let damageFloats = [];
let isGameOver = false;
const playerDamageRange = { min: 1, max: 3 };
const enemyDamageRange = { min: 1, max: 2 };
let floorLevel = 1;
let playerLevel = 1;
let playerXp = 0;
let playerXpToNext = 5;
let cheeseburgers = [];
let visibleTiles = [];
let discoveredTiles = [];
let isPanning = false;
let panOffset = { x: 0, y: 0 };
let panStart = { x: 0, y: 0 };
let activePanel = null;
let pendingLoot = null;
let isLootPromptOpen = false;
let hasStartedAudio = false;
let chests = [];
let inventory = [];
let equipped = {
  weapon: null,
  armor: null,
  accessory: null,
};
const rarities = [
  { name: "common", weight: 60, color: "#f1f3f5" },
  { name: "rare", weight: 25, color: "#4dabf7" },
  { name: "epic", weight: 10, color: "#f06595" },
  { name: "legendary", weight: 5, color: "#f59f00" },
];
const equipmentSlots = ["weapon", "armor", "accessory"];

const palette = {
  floor: "#2b3142",
  wall: "#0f121b",
  exit: "#2f9e44",
  player: "#f08c00",
  enemy: "#e03131",
  text: "#fef9c3",
};

const rooms = [];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function carveRoom(room) {
  for (let y = room.y; y < room.y + room.height; y += 1) {
    for (let x = room.x; x < room.x + room.width; x += 1) {
      dungeon[y][x] = TILE.FLOOR;
    }
  }
}

function carveHorizontalTunnel(x1, x2, y) {
  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x += 1) {
    dungeon[y][x] = TILE.FLOOR;
  }
}

function carveVerticalTunnel(y1, y2, x) {
  for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y += 1) {
    dungeon[y][x] = TILE.FLOOR;
  }
}

function roomsIntersect(roomA, roomB) {
  return !(
    roomA.x + roomA.width < roomB.x ||
    roomB.x + roomB.width < roomA.x ||
    roomA.y + roomA.height < roomB.y ||
    roomB.y + roomB.height < roomA.y
  );
}

function createDungeon() {
  dungeon = Array.from({ length: MAP_HEIGHT }, () =>
    Array.from({ length: MAP_WIDTH }, () => TILE.WALL)
  );
  rooms.length = 0;
  playerFrameIndex = 0;
  playerFacing = 1;
  zoom = 1;
  enemies = [];
  cheeseburgers = [];
  chests = [];
  floorVariants = Array.from({ length: MAP_HEIGHT }, () =>
    Array.from({ length: MAP_WIDTH }, () => null)
  );
  wallVariants = Array.from({ length: MAP_HEIGHT }, () =>
    Array.from({ length: MAP_WIDTH }, () => null)
  );
  visibleTiles = Array.from({ length: MAP_HEIGHT }, () =>
    Array.from({ length: MAP_WIDTH }, () => false)
  );
  discoveredTiles = Array.from({ length: MAP_HEIGHT }, () =>
    Array.from({ length: MAP_WIDTH }, () => false)
  );
  damageFloats = [];
  isGameOver = false;
  gameOverOverlay.classList.add("hidden");

  for (let i = 0; i < MAX_ROOMS; i += 1) {
    const width = randomInt(ROOM_MIN_SIZE, ROOM_MAX_SIZE);
    const height = randomInt(ROOM_MIN_SIZE, ROOM_MAX_SIZE);
    const x = randomInt(1, MAP_WIDTH - width - 2);
    const y = randomInt(1, MAP_HEIGHT - height - 2);

    const newRoom = { x, y, width, height };

    if (rooms.some((room) => roomsIntersect(room, newRoom))) {
      continue;
    }

    carveRoom(newRoom);

    if (rooms.length > 0) {
      const previous = rooms[rooms.length - 1];
      const prevCenter = {
        x: Math.floor(previous.x + previous.width / 2),
        y: Math.floor(previous.y + previous.height / 2),
      };
      const newCenter = {
        x: Math.floor(newRoom.x + newRoom.width / 2),
        y: Math.floor(newRoom.y + newRoom.height / 2),
      };

      if (Math.random() < 0.5) {
        carveHorizontalTunnel(prevCenter.x, newCenter.x, prevCenter.y);
        carveVerticalTunnel(prevCenter.y, newCenter.y, newCenter.x);
      } else {
        carveVerticalTunnel(prevCenter.y, newCenter.y, prevCenter.x);
        carveHorizontalTunnel(prevCenter.x, newCenter.x, newCenter.y);
      }
    }

    rooms.push(newRoom);
  }

  const firstRoom = rooms[0];
  const lastRoom = rooms[rooms.length - 1];

  player = {
    x: Math.floor(firstRoom.x + firstRoom.width / 2),
    y: Math.floor(firstRoom.y + firstRoom.height / 2),
  };

  exit = {
    x: Math.floor(lastRoom.x + lastRoom.width / 2),
    y: Math.floor(lastRoom.y + lastRoom.height / 2),
  };

  dungeon[exit.y][exit.x] = TILE.EXIT;
  assignFloorVariants();
  assignWallVariants();
  spawnEnemies();
  spawnCheeseburgers();
  spawnChests();
  updateCamera();
  updateHud();
}

function isWalkable(x, y) {
  if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) {
    return false;
  }
  return dungeon[y][x] !== TILE.WALL;
}

function isOccupiedByEnemy(x, y) {
  return enemies.some((enemy) => enemy.x === x && enemy.y === y);
}

function movePlayer(dx, dy) {
  if (isGameOver) {
    return;
  }
  startAudioIfNeeded();
  const nextX = player.x + dx;
  const nextY = player.y + dy;

  if (!isWalkable(nextX, nextY)) {
    statusText.textContent = "A wall blocks your path.";
    return;
  }

  if (isOccupiedByEnemy(nextX, nextY)) {
    attackEnemyAt(nextX, nextY);
    return;
  }

  if (isChestAt(nextX, nextY)) {
    player = { x: nextX, y: nextY };
    playerFrameIndex = (playerFrameIndex + 1) % 4;
    openChestAt(nextX, nextY);
    moveEnemies();
    applyRegen();
    updateCamera();
    updateHud();
    render();
    return;
  }

  if (nextX === exit.x && nextY === exit.y) {
    floorLevel += 1;
    createDungeon();
    statusText.textContent = "You descend to the next floor.";
    return;
  }

  player = { x: nextX, y: nextY };
  playerFrameIndex = (playerFrameIndex + 1) % 4;
  let statusMessage = "Explore the dungeon.";
  if (pickupCheeseburger(nextX, nextY)) {
    statusMessage = "You enjoy a cheeseburger and recover health.";
  }
  statusText.textContent = statusMessage;
  moveEnemies();
  applyRegen();
  updateCamera();
  updateHud();
}

function drawTile(x, y, type) {
  if (type === TILE.WALL) {
    drawWallTile(x, y);
    return;
  }

  if (type === TILE.FLOOR) {
    drawFloorTile(x, y);
    return;
  }

  if (type === TILE.EXIT) {
    drawSprite(sprites.exit, x, y, palette.exit, "E");
  }
}

function drawSprite(img, x, y, fallbackColor, label) {
  const pixelX = x * TILE_SIZE;
  const pixelY = y * TILE_SIZE;

  if (img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, pixelX, pixelY, TILE_SIZE, TILE_SIZE);
    return;
  }

  ctx.fillStyle = fallbackColor;
  ctx.fillRect(pixelX, pixelY, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = palette.text;
  ctx.font = "bold 16px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, pixelX + TILE_SIZE / 2, pixelY + TILE_SIZE / 2);
}

function drawEnemy(enemy) {
  const img = sprites.enemy;
  const pixelX = enemy.x * TILE_SIZE;
  const pixelY = enemy.y * TILE_SIZE;

  if (img.complete && img.naturalWidth > 0) {
    const frameWidth = img.naturalWidth / 2;
    const frameHeight = img.naturalHeight / 2;
    const frameX = (enemy.frameIndex % 2) * frameWidth;
    const frameY = Math.floor(enemy.frameIndex / 2) * frameHeight;
    ctx.save();
    if (enemy.facing === -1) {
      ctx.translate(pixelX + TILE_SIZE, pixelY);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(pixelX, pixelY);
    }
    ctx.drawImage(
      img,
      frameX,
      frameY,
      frameWidth,
      frameHeight,
      0,
      0,
      TILE_SIZE,
      TILE_SIZE
    );
    ctx.restore();
    return;
  }

  drawSprite(img, enemy.x, enemy.y, palette.enemy, "!");
}

function drawEnemies() {
  enemies.forEach((enemy) => {
    if (isVisible(enemy.x, enemy.y)) {
      drawEnemy(enemy);
    }
  });
}

function drawPlayer() {
  const img = sprites.player;
  const pixelX = player.x * TILE_SIZE;
  const pixelY = player.y * TILE_SIZE;

  if (img.complete && img.naturalWidth > 0) {
    const frameWidth = img.naturalWidth / 2;
    const frameHeight = img.naturalHeight / 2;
    const frameX = (playerFrameIndex % 2) * frameWidth;
    const frameY = Math.floor(playerFrameIndex / 2) * frameHeight;
    ctx.save();
    if (playerFacing === -1) {
      ctx.translate(pixelX + TILE_SIZE, pixelY);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(pixelX, pixelY);
    }
    ctx.drawImage(
      img,
      frameX,
      frameY,
      frameWidth,
      frameHeight,
      0,
      0,
      TILE_SIZE,
      TILE_SIZE
    );
    ctx.restore();
    return;
  }

  ctx.save();
  if (playerFacing === -1) {
    ctx.translate(pixelX + TILE_SIZE, pixelY);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(pixelX, pixelY);
  }
  ctx.fillStyle = palette.player;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = palette.text;
  ctx.font = "bold 16px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("@", TILE_SIZE / 2, TILE_SIZE / 2);
  ctx.restore();
}

function drawCheeseburgers() {
  cheeseburgers.forEach((cheeseburger) => {
    if (!isVisible(cheeseburger.x, cheeseburger.y)) {
      return;
    }
    drawSprite(
      sprites.cheeseburger,
      cheeseburger.x,
      cheeseburger.y,
      "#f59f00",
      "C"
    );
  });
}

function drawChests() {
  chests.forEach((chest) => {
    if (!isVisible(chest.x, chest.y)) {
      return;
    }
    drawSprite(
      sprites.chest,
      chest.x,
      chest.y,
      "#fab005",
      "T"
    );
  });
}

function drawEnemyHealthBars() {
  enemies.forEach((enemy) => {
    if (!isVisible(enemy.x, enemy.y)) {
      return;
    }
    const barWidth = TILE_SIZE - 6;
    const barHeight = 4;
    const pixelX = enemy.x * TILE_SIZE + 3;
    const pixelY = enemy.y * TILE_SIZE - 6;
    const ratio = Math.max(0, enemy.hp / enemy.maxHp);
    ctx.fillStyle = "#0b0d12";
    ctx.fillRect(pixelX, pixelY, barWidth, barHeight);
    ctx.fillStyle = "#e03131";
    ctx.fillRect(pixelX, pixelY, barWidth * ratio, barHeight);
  });
}

function drawDamageFloats() {
  damageFloats.forEach((float) => {
    ctx.fillStyle = float.color;
    ctx.globalAlpha = float.alpha;
    ctx.font = "bold 14px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(float.text, float.x, float.y);
    ctx.globalAlpha = 1;
  });
}

function updateHud() {
  playerHpText.textContent = `${playerHp}/${playerMaxHp}`;
  floorLevelText.textContent = `${floorLevel}`;
  playerLevelText.textContent = `${playerLevel}`;
  playerXpText.textContent = `${playerXp}/${playerXpToNext}`;
  statDamageText.textContent = formatDamageRange(getPlayerDamageRange());
  statCritText.textContent = `${Math.round(getPlayerCritChance() * 100)}%`;
  statRegenText.textContent = `${getPlayerRegen()}`;
  equipWeaponText.textContent = equipped.weapon?.name ?? "None";
  equipArmorText.textContent = equipped.armor?.name ?? "None";
  equipAccessoryText.textContent = equipped.accessory?.name ?? "None";
  if (hpFill) {
    const hpRatio = playerMaxHp > 0 ? (playerHp / playerMaxHp) * 100 : 0;
    hpFill.style.width = `${Math.min(100, Math.max(0, hpRatio))}%`;
  }
  if (xpFill) {
    const xpRatio = playerXpToNext > 0 ? (playerXp / playerXpToNext) * 100 : 0;
    xpFill.style.width = `${Math.min(100, Math.max(0, xpRatio))}%`;
  }
  renderInventory();
}

function drawFloorTile(x, y) {
  const img = sprites.floor;
  const pixelX = x * TILE_SIZE;
  const pixelY = y * TILE_SIZE;
  const variant = floorVariants[y][x] ?? 0;

  if (img.complete && img.naturalWidth > 0) {
    const columns = 4;
    const rows = 2;
    const frameWidth = img.naturalWidth / columns;
    const frameHeight = img.naturalHeight / rows;
    const frameX = (variant % columns) * frameWidth;
    const frameY = Math.floor(variant / columns) * frameHeight;
    ctx.drawImage(
      img,
      frameX,
      frameY,
      frameWidth,
      frameHeight,
      pixelX,
      pixelY,
      TILE_SIZE,
      TILE_SIZE
    );
    return;
  }

  drawSprite(img, x, y, palette.floor, ".");
}

function drawWallTile(x, y) {
  const img = sprites.wall;
  const pixelX = x * TILE_SIZE;
  const pixelY = y * TILE_SIZE;
  const variant = wallVariants[y][x] ?? 0;

  if (img.complete && img.naturalWidth > 0) {
    const columns = 3;
    const rows = 2;
    const frameWidth = img.naturalWidth / columns;
    const frameHeight = img.naturalHeight / rows;
    const frameX = (variant % columns) * frameWidth;
    const frameY = Math.floor(variant / columns) * frameHeight;
    ctx.drawImage(
      img,
      frameX,
      frameY,
      frameWidth,
      frameHeight,
      pixelX,
      pixelY,
      TILE_SIZE,
      TILE_SIZE
    );
    return;
  }

  drawSprite(img, x, y, palette.wall, "#");
}

function assignFloorVariants() {
  const maxVariants = 8;
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      if (dungeon[y][x] === TILE.FLOOR) {
        floorVariants[y][x] = randomInt(0, maxVariants - 1);
      }
    }
  }
}

function assignWallVariants() {
  const maxVariants = 6;
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      if (dungeon[y][x] === TILE.WALL) {
        wallVariants[y][x] = randomInt(0, maxVariants - 1);
      }
    }
  }
}

function randomFloorTile() {
  while (true) {
    const room = rooms[randomInt(0, rooms.length - 1)];
    const x = randomInt(room.x, room.x + room.width - 1);
    const y = randomInt(room.y, room.y + room.height - 1);
    if (dungeon[y][x] === TILE.FLOOR) {
      return { x, y };
    }
  }
}

function spawnEnemies() {
  const enemyCount = Math.max(4, Math.floor(rooms.length / 2));
  const usedPositions = new Set([`${player.x},${player.y}`, `${exit.x},${exit.y}`]);
  const baseHp = 3 + floorLevel;
  const hpBoost = Math.floor(floorLevel / 2);
  const enemyHp = baseHp + hpBoost;
  const enemyMaxHp = enemyHp;

  for (let i = 0; i < enemyCount; i += 1) {
    let position = randomFloorTile();
    while (usedPositions.has(`${position.x},${position.y}`)) {
      position = randomFloorTile();
    }
    usedPositions.add(`${position.x},${position.y}`);
    enemies.push({
      x: position.x,
      y: position.y,
      spawnX: position.x,
      spawnY: position.y,
      leash: randomInt(4, 7),
      aggro: false,
      frameIndex: 0,
      facing: 1,
      hp: enemyHp,
      maxHp: enemyMaxHp,
    });
  }
}

function spawnCheeseburgers() {
  const cheeseburgerCount = Math.max(2, Math.floor(rooms.length / 3));
  const usedPositions = new Set([
    `${player.x},${player.y}`,
    `${exit.x},${exit.y}`,
  ]);
  enemies.forEach((enemy) => usedPositions.add(`${enemy.x},${enemy.y}`));
  chests.forEach((chest) => usedPositions.add(`${chest.x},${chest.y}`));

  for (let i = 0; i < cheeseburgerCount; i += 1) {
    let position = randomFloorTile();
    while (usedPositions.has(`${position.x},${position.y}`)) {
      position = randomFloorTile();
    }
    usedPositions.add(`${position.x},${position.y}`);
    cheeseburgers.push({ x: position.x, y: position.y, heal: 4 });
  }
}

function spawnChests() {
  const chestCount = Math.max(2, Math.floor(rooms.length / 4));
  const usedPositions = new Set([
    `${player.x},${player.y}`,
    `${exit.x},${exit.y}`,
  ]);
  enemies.forEach((enemy) => usedPositions.add(`${enemy.x},${enemy.y}`));
  cheeseburgers.forEach((cheeseburger) =>
    usedPositions.add(`${cheeseburger.x},${cheeseburger.y}`)
  );

  for (let i = 0; i < chestCount; i += 1) {
    let position = randomFloorTile();
    while (usedPositions.has(`${position.x},${position.y}`)) {
      position = randomFloorTile();
    }
    usedPositions.add(`${position.x},${position.y}`);
    chests.push({ x: position.x, y: position.y, opened: false });
  }
}

function hasLineOfSight(source, target) {
  if (source.x === target.x) {
    const step = source.y < target.y ? 1 : -1;
    for (let y = source.y + step; y !== target.y; y += step) {
      if (dungeon[y][source.x] === TILE.WALL) {
        return false;
      }
    }
    return true;
  }

  if (source.y === target.y) {
    const step = source.x < target.x ? 1 : -1;
    for (let x = source.x + step; x !== target.x; x += step) {
      if (dungeon[source.y][x] === TILE.WALL) {
        return false;
      }
    }
    return true;
  }

  return false;
}

function isWithinLeash(enemy, x, y) {
  if (enemy.aggro) {
    return true;
  }
  return (
    Math.abs(x - enemy.spawnX) + Math.abs(y - enemy.spawnY) <= enemy.leash
  );
}

function moveEnemyRandom(enemy) {
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];
  const shuffled = directions.sort(() => Math.random() - 0.5);

  for (const dir of shuffled) {
    const nextX = enemy.x + dir.dx;
    const nextY = enemy.y + dir.dy;
    if (!isWalkable(nextX, nextY)) {
      continue;
    }
    if (isOccupiedByEnemy(nextX, nextY)) {
      continue;
    }
    if (player.x === nextX && player.y === nextY) {
      attackPlayer(enemy);
      return;
    }
    if (!isWithinLeash(enemy, nextX, nextY)) {
      continue;
    }
    if (dir.dx !== 0) {
      enemy.facing = dir.dx > 0 ? -1 : 1;
    }
    enemy.x = nextX;
    enemy.y = nextY;
    enemy.frameIndex = (enemy.frameIndex + 1) % 4;
    return;
  }
}

function moveEnemyToward(enemy, target) {
  const dx = Math.sign(target.x - enemy.x);
  const dy = Math.sign(target.y - enemy.y);
  const options = Math.abs(target.x - enemy.x) >= Math.abs(target.y - enemy.y)
    ? [{ dx, dy: 0 }, { dx: 0, dy }]
    : [{ dx: 0, dy }, { dx, dy: 0 }];

  for (const option of options) {
    const nextX = enemy.x + option.dx;
    const nextY = enemy.y + option.dy;
    if (!isWalkable(nextX, nextY)) {
      continue;
    }
    if (isOccupiedByEnemy(nextX, nextY)) {
      continue;
    }
    if (player.x === nextX && player.y === nextY) {
      attackPlayer(enemy);
      return;
    }
    if (!isWithinLeash(enemy, nextX, nextY)) {
      continue;
    }
    if (option.dx !== 0) {
      enemy.facing = option.dx > 0 ? -1 : 1;
    }
    enemy.x = nextX;
    enemy.y = nextY;
    enemy.frameIndex = (enemy.frameIndex + 1) % 4;
    return;
  }

  moveEnemyRandom(enemy);
}

function moveEnemies() {
  enemies.forEach((enemy) => {
    if (hasLineOfSight(enemy, player)) {
      enemy.aggro = true;
    }

    if (enemy.aggro) {
      moveEnemyToward(enemy, player);
      return;
    }

    moveEnemyRandom(enemy);
  });

  enemies.forEach((enemy) => {
    const distance =
      Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y);
    if (distance === 1) {
      attackPlayer(enemy);
    }
  });
}

function rollDamage(range) {
  return randomInt(range.min, range.max);
}

function getPlayerDamageRange() {
  const bonus = Math.floor((playerLevel - 1) / 2);
  const gearBonus = getEquipmentStat("damage");
  return {
    min: playerDamageRange.min + bonus + gearBonus,
    max: playerDamageRange.max + bonus + gearBonus,
  };
}

function getEnemyDamageRange() {
  const minBonus = Math.floor(floorLevel / 3);
  const maxBonus = Math.floor(floorLevel / 2);
  return {
    min: enemyDamageRange.min + minBonus,
    max: enemyDamageRange.max + maxBonus,
  };
}

function getPlayerCritChance() {
  const baseChance = 0.05;
  return baseChance + getEquipmentStat("crit");
}

function getPlayerRegen() {
  return getEquipmentStat("regen");
}

function formatDamageRange(range) {
  return `${range.min}-${range.max}`;
}

function addDamageFloat(x, y, amount, color) {
  damageFloats.push({
    x: x * TILE_SIZE + TILE_SIZE / 2,
    y: y * TILE_SIZE - 4,
    text: `-${amount}`,
    color,
    alpha: 1,
    life: 0.9,
    speed: 14,
  });
}

function updateDamageFloats(deltaSeconds) {
  damageFloats = damageFloats
    .map((float) => ({
      ...float,
      y: float.y - float.speed * deltaSeconds,
      life: float.life - deltaSeconds,
      alpha: Math.max(0, float.life),
    }))
    .filter((float) => float.life > 0);
}

function attackEnemyAt(x, y) {
  const enemy = enemies.find((target) => target.x === x && target.y === y);
  if (!enemy) {
    return;
  }
  const playerDamage = rollDamage(getPlayerDamageRange());
  const enemyDamage = rollDamage(getEnemyDamageRange());
  const critChance = getPlayerCritChance();
  const crit = Math.random() < critChance;
  const finalPlayerDamage = crit ? playerDamage * 2 : playerDamage;
  enemy.hp -= finalPlayerDamage;
  playerHp = Math.max(0, playerHp - enemyDamage);
  enemy.aggro = true;
  playAttackSound();
  statusText.textContent = "You trade blows with an enemy.";
  addDamageFloat(enemy.x, enemy.y, finalPlayerDamage, "#f03e3e");
  addDamageFloat(player.x, player.y, enemyDamage, "#ff6b6b");
  if (enemy.hp <= 0) {
    enemies = enemies.filter((target) => target !== enemy);
    statusText.textContent = "You defeated an enemy.";
    awardExperience(2 + floorLevel);
  }
  if (playerHp <= 0) {
    triggerGameOver();
  }
  updateHud();
  render();
}

function attackPlayer(enemy) {
  const damage = rollDamage(getEnemyDamageRange());
  playerHp = Math.max(0, playerHp - damage);
  enemy.aggro = true;
  playAttackSound();
  statusText.textContent = "An enemy strikes you!";
  addDamageFloat(player.x, player.y, damage, "#ff6b6b");
  if (playerHp <= 0) {
    triggerGameOver();
  }
  updateHud();
}

function awardExperience(amount) {
  playerXp += amount;
  while (playerXp >= playerXpToNext) {
    playerXp -= playerXpToNext;
    playerLevel += 1;
    playerXpToNext = Math.floor(playerXpToNext * 1.35) + 2;
    playerMaxHp += 2;
    playerHp = Math.min(playerMaxHp, playerHp + 2);
    statusText.textContent = `Level up! You reached level ${playerLevel}.`;
  }
  updateHud();
}

function pickupCheeseburger(x, y) {
  const index = cheeseburgers.findIndex(
    (item) => item.x === x && item.y === y
  );
  if (index === -1) {
    return false;
  }
  const [item] = cheeseburgers.splice(index, 1);
  playerHp = Math.min(playerMaxHp, playerHp + item.heal);
  updateHud();
  return true;
}

function isChestAt(x, y) {
  return chests.some((chest) => chest.x === x && chest.y === y);
}

function openChestAt(x, y) {
  const index = chests.findIndex((chest) => chest.x === x && chest.y === y);
  if (index === -1) {
    return;
  }
  chests.splice(index, 1);
  const item = generateItem();
  pendingLoot = item;
  isLootPromptOpen = true;
  statusText.textContent = `You found ${item.name}.`;
  showLootPrompt(item);
}

function generateItem() {
  const rarity = rollRarity();
  const slot = equipmentSlots[randomInt(0, equipmentSlots.length - 1)];
  const baseName = {
    weapon: "Blade",
    armor: "Guard",
    accessory: "Charm",
  }[slot];
  const prefix = {
    common: "Worn",
    rare: "Fine",
    epic: "Fabled",
    legendary: "Mythic",
  }[rarity.name];
  const name = `${prefix} ${baseName}`;
  const scale = {
    common: 1,
    rare: 1.5,
    epic: 2.2,
    legendary: 3.2,
  }[rarity.name];
  const damage = slot === "weapon" ? Math.round(scale + floorLevel / 3) : 0;
  const crit = slot === "accessory" ? 0.02 * scale : 0;
  const regen = slot === "armor" ? Math.round(scale / 1.5) : 0;
  return {
    id: `${Date.now()}-${Math.random()}`,
    slot,
    name,
    rarity,
    stats: { damage, crit, regen },
  };
}

function rollRarity() {
  const total = rarities.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const rarity of rarities) {
    if (roll < rarity.weight) {
      return rarity;
    }
    roll -= rarity.weight;
  }
  return rarities[0];
}

function getEquipmentStat(stat) {
  return Object.values(equipped).reduce((sum, item) => {
    if (!item) {
      return sum;
    }
    return sum + (item.stats[stat] ?? 0);
  }, 0);
}

function renderInventory() {
  inventoryList.innerHTML = "";
  inventory.forEach((item) => {
    const li = document.createElement("li");
    li.className = "inventory-item";
    const label = document.createElement("span");
    label.textContent = `${item.name} (+${item.stats.damage} dmg, +${Math.round(
      item.stats.crit * 100
    )}% crit, +${item.stats.regen} regen)`;
    label.classList.add(`rarity-${item.rarity.name}`);
    const button = document.createElement("button");
    button.textContent = "Equip";
    button.dataset.itemId = item.id;
    li.append(label, button);
    inventoryList.appendChild(li);
  });

  equipWeaponText.classList.remove(
    "rarity-common",
    "rarity-rare",
    "rarity-epic",
    "rarity-legendary"
  );
  equipArmorText.classList.remove(
    "rarity-common",
    "rarity-rare",
    "rarity-epic",
    "rarity-legendary"
  );
  equipAccessoryText.classList.remove(
    "rarity-common",
    "rarity-rare",
    "rarity-epic",
    "rarity-legendary"
  );

  if (equipped.weapon?.rarity) {
    equipWeaponText.classList.add(`rarity-${equipped.weapon.rarity.name}`);
  }
  if (equipped.armor?.rarity) {
    equipArmorText.classList.add(`rarity-${equipped.armor.rarity.name}`);
  }
  if (equipped.accessory?.rarity) {
    equipAccessoryText.classList.add(`rarity-${equipped.accessory.rarity.name}`);
  }
}

function applyRegen() {
  const regen = getPlayerRegen();
  if (regen <= 0) {
    return;
  }
  playerHp = Math.min(playerMaxHp, playerHp + regen);
}

function triggerGameOver() {
  isGameOver = true;
  statusText.textContent = "You have fallen.";
  gameOverOverlay.classList.remove("hidden");
}

function showLootPrompt(item) {
  if (!lootOverlay || !lootDescription) {
    return;
  }
  lootDescription.textContent = `${item.name} (+${item.stats.damage} dmg, +${Math.round(
    item.stats.crit * 100
  )}% crit, +${item.stats.regen} regen)`;
  lootDescription.className = `rarity-${item.rarity.name}`;
  lootOverlay.classList.remove("hidden");
}

function closeLootPrompt() {
  isLootPromptOpen = false;
  pendingLoot = null;
  lootOverlay?.classList.add("hidden");
}

function startAudioIfNeeded() {
  if (hasStartedAudio) {
    return;
  }
  hasStartedAudio = true;
  audio.bgm.loop = true;
  audio.bgm.volume = 0.4;
  audio.bgm.play().catch(() => {});
}

function playAttackSound() {
  if (!hasStartedAudio) {
    return;
  }
  audio.attack.currentTime = 0;
  audio.attack.volume = 0.6;
  audio.attack.play().catch(() => {});
}

function updateVisibility() {
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      visibleTiles[y][x] = false;
    }
  }

  for (let y = player.y - FOG_RADIUS; y <= player.y + FOG_RADIUS; y += 1) {
    for (let x = player.x - FOG_RADIUS; x <= player.x + FOG_RADIUS; x += 1) {
      if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) {
        continue;
      }
      const dx = x - player.x;
      const dy = y - player.y;
      if (dx * dx + dy * dy <= FOG_RADIUS * FOG_RADIUS) {
        visibleTiles[y][x] = true;
        discoveredTiles[y][x] = true;
      }
    }
  }
}

function isVisible(x, y) {
  return visibleTiles[y]?.[x];
}

function updateCamera() {
  camera = {
    x:
      player.x * TILE_SIZE -
      canvas.width / (2 * zoom) +
      TILE_SIZE / 2 +
      panOffset.x,
    y:
      player.y * TILE_SIZE -
      canvas.height / (2 * zoom) +
      TILE_SIZE / 2 +
      panOffset.y,
  };
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(-camera.x, -camera.y);
  updateVisibility();

  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      if (!discoveredTiles[y][x]) {
        ctx.fillStyle = "#05070c";
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        continue;
      }

      drawTile(x, y, dungeon[y][x]);
      if (!visibleTiles[y][x]) {
        ctx.fillStyle = "rgba(5, 7, 12, 0.65)";
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  drawCheeseburgers();
  drawChests();
  drawEnemies();
  if (isVisible(player.x, player.y)) {
    drawPlayer();
  }
  drawEnemyHealthBars();
  drawDamageFloats();
  ctx.restore();
}

function handleKeydown(event) {
  if (isLootPromptOpen) {
    return;
  }
  switch (event.key) {
    case "ArrowUp":
    case "w":
    case "W":
      movePlayer(0, -1);
      break;
    case "ArrowDown":
    case "s":
    case "S":
      movePlayer(0, 1);
      break;
    case "ArrowLeft":
    case "a":
    case "A":
      playerFacing = 1;
      movePlayer(-1, 0);
      break;
    case "ArrowRight":
    case "d":
    case "D":
      playerFacing = -1;
      movePlayer(1, 0);
      break;
    case "1":
      toggleMenu("stats");
      return;
    case "2":
      toggleMenu("equipment");
      return;
    case "3":
      toggleMenu("controls");
      return;
    default:
      return;
  }

  render();
}

function handleWheel(event) {
  event.preventDefault();
  const direction = Math.sign(event.deltaY);
  if (direction === 0) {
    return;
  }
  const multiplier = direction > 0 ? 1 - ZOOM_STEP : 1 + ZOOM_STEP;
  zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom * multiplier));
  updateCamera();
  render();
}

function resizeCanvas() {
  const width = Math.min(window.innerWidth - 48, BASE_CANVAS_WIDTH);
  canvas.width = Math.max(480, width);
  canvas.height = Math.max(360, Math.floor(canvas.width * 0.76));
  updateCamera();
  render();
}

function toggleMenu(panelName = null) {
  if (!menuPanel || !menuToggle) {
    return;
  }
  if (!panelName || activePanel === panelName) {
    activePanel = null;
    menuPanel.classList.add("hidden");
    menuToggle.classList.remove("active");
    menuButtons.forEach((button) => button.classList.remove("active"));
    return;
  }

  activePanel = panelName;
  menuPanel.classList.remove("hidden");
  menuToggle.classList.add("active");
  menuButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.menu === panelName);
  });
  menuPanel.querySelectorAll(".panel-section").forEach((section) => {
    section.classList.toggle("hidden", section.dataset.panel !== panelName);
  });
}

function handleMouseDown(event) {
  if (event.button !== 1) {
    return;
  }
  event.preventDefault();
  startAudioIfNeeded();
  isPanning = true;
  panStart = { x: event.clientX, y: event.clientY };
}

function handleMouseMove(event) {
  if (!isPanning) {
    return;
  }
  const deltaX = (event.clientX - panStart.x) / zoom;
  const deltaY = (event.clientY - panStart.y) / zoom;
  panOffset = { x: -deltaX, y: -deltaY };
  updateCamera();
  render();
}

function handleMouseUp(event) {
  if (event.button !== 1) {
    return;
  }
  isPanning = false;
  panOffset = { x: 0, y: 0 };
  updateCamera();
  render();
}

function handleCanvasClick(event) {
  if (isGameOver || isLootPromptOpen) {
    return;
  }
  startAudioIfNeeded();
  const rect = canvas.getBoundingClientRect();
  const clickX = (event.clientX - rect.left) / zoom + camera.x;
  const clickY = (event.clientY - rect.top) / zoom + camera.y;
  const targetX = Math.floor(clickX / TILE_SIZE);
  const targetY = Math.floor(clickY / TILE_SIZE);

  const dx = targetX - player.x;
  const dy = targetY - player.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) {
    return;
  }
  movePlayer(Math.sign(dx), Math.sign(dy));
  render();
}

playerMaxHp = 10;
playerHp = playerMaxHp;
createDungeon();
render();

Object.values(sprites).forEach((img) => {
  img.addEventListener("load", render);
});

window.addEventListener("keydown", handleKeydown);
restartButton.addEventListener("click", () => {
  floorLevel = 1;
  playerLevel = 1;
  playerXp = 0;
  playerXpToNext = 5;
  playerMaxHp = 10;
  playerHp = playerMaxHp;
  inventory = [];
  equipped = { weapon: null, armor: null, accessory: null };
  createDungeon();
  render();
});
lootEquipButton?.addEventListener("click", () => {
  if (!pendingLoot) {
    return;
  }
  equipped[pendingLoot.slot] = pendingLoot;
  statusText.textContent = `Equipped ${pendingLoot.name}.`;
  closeLootPrompt();
  updateHud();
});
lootStoreButton?.addEventListener("click", () => {
  if (!pendingLoot) {
    return;
  }
  inventory.push(pendingLoot);
  statusText.textContent = `Stored ${pendingLoot.name}.`;
  closeLootPrompt();
  updateHud();
});
lootIgnoreButton?.addEventListener("click", () => {
  if (!pendingLoot) {
    return;
  }
  statusText.textContent = `Left ${pendingLoot.name} behind.`;
  closeLootPrompt();
  updateHud();
});
menuToggle?.addEventListener("click", () =>
  toggleMenu(activePanel ? null : "stats")
);
menuClose?.addEventListener("click", () => toggleMenu());
menuButtons.forEach((button) => {
  button.addEventListener("click", () => {
    startAudioIfNeeded();
    toggleMenu(button.dataset.menu);
  });
});
inventoryList.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }
  const itemId = button.dataset.itemId;
  const item = inventory.find((entry) => entry.id === itemId);
  if (!item) {
    return;
  }
  equipped[item.slot] = item;
  statusText.textContent = `Equipped ${item.name}.`;
  updateHud();
});
window.addEventListener("resize", resizeCanvas);
canvas.addEventListener("wheel", handleWheel, { passive: false });
canvas.addEventListener("click", handleCanvasClick);
canvas.addEventListener("mousedown", handleMouseDown);
window.addEventListener("mousemove", handleMouseMove);
window.addEventListener("mouseup", handleMouseUp);

resizeCanvas();

let lastTimestamp = performance.now();
function tick(timestamp) {
  const deltaSeconds = Math.min(0.05, (timestamp - lastTimestamp) / 1000);
  lastTimestamp = timestamp;
  updateDamageFloats(deltaSeconds);
  render();
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
