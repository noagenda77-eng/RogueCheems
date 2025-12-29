const canvas = document.getElementById("game");
const statusText = document.getElementById("status");
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
};

const sprites = Object.fromEntries(
  Object.entries(spritePaths).map(([key, path]) => {
    const img = new Image();
    img.src = path;
    return [key, img];
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
  spawnEnemies();
  updateCamera();
}

function isWalkable(x, y) {
  if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) {
    return false;
  }
  return dungeon[y][x] !== TILE.WALL;
}

function movePlayer(dx, dy) {
  const nextX = player.x + dx;
  const nextY = player.y + dy;

  if (!isWalkable(nextX, nextY)) {
    statusText.textContent = "A wall blocks your path.";
    return;
  }

  if (nextX === exit.x && nextY === exit.y) {
    createDungeon();
    statusText.textContent = "You descend to the next floor.";
    return;
  }

  player = { x: nextX, y: nextY };
  playerFrameIndex = (playerFrameIndex + 1) % 4;
  moveEnemies();
  updateCamera();
  statusText.textContent = "Explore the dungeon.";
}

function drawTile(x, y, type) {
  const pixelX = x * TILE_SIZE;
  const pixelY = y * TILE_SIZE;

  if (type === TILE.WALL) {
    ctx.fillStyle = palette.wall;
    ctx.fillRect(pixelX, pixelY, TILE_SIZE, TILE_SIZE);
    return;
  }

  if (type === TILE.FLOOR) {
    ctx.fillStyle = palette.floor;
    ctx.fillRect(pixelX, pixelY, TILE_SIZE, TILE_SIZE);
    return;
  }

  if (type === TILE.EXIT) {
    ctx.fillStyle = palette.exit;
    ctx.fillRect(pixelX, pixelY, TILE_SIZE, TILE_SIZE);
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

function drawEnemies() {
  enemies.forEach((enemy) => {
    drawSprite(sprites.enemy, enemy.x, enemy.y, palette.enemy, "!");
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
    });
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
    if (!isWithinLeash(enemy, nextX, nextY)) {
      continue;
    }
    enemy.x = nextX;
    enemy.y = nextY;
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
    if (!isWithinLeash(enemy, nextX, nextY)) {
      continue;
    }
    enemy.x = nextX;
    enemy.y = nextY;
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
}

function updateCamera() {
  camera = {
    x: player.x * TILE_SIZE - canvas.width / (2 * zoom) + TILE_SIZE / 2,
    y: player.y * TILE_SIZE - canvas.height / (2 * zoom) + TILE_SIZE / 2,
  };
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(-camera.x, -camera.y);

  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      drawTile(x, y, dungeon[y][x]);

      if (dungeon[y][x] === TILE.EXIT) {
        drawSprite(sprites.exit, x, y, palette.exit, "E");
      }
    }
  }

  drawEnemies();
  drawPlayer();
  ctx.restore();
}

function handleKeydown(event) {
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

createDungeon();
render();

Object.values(sprites).forEach((img) => {
  img.addEventListener("load", render);
});

window.addEventListener("keydown", handleKeydown);
window.addEventListener("resize", resizeCanvas);
canvas.addEventListener("wheel", handleWheel, { passive: false });

resizeCanvas();
