const GRID_COLS = 6;
const GRID_ROWS = 8;
const GEM_TYPES = 7;
const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#F0E68C'
];

const SPECIAL_NONE = 0;
const SPECIAL_HORIZONTAL = 1;
const SPECIAL_VERTICAL = 2;
const SPECIAL_BOMB = 3;
const SPECIAL_RAINBOW = 4;

let canvas, ctx;
let gameWidth, gameHeight;
let tileSize, offsetX, offsetY;
let board = [];
let selectedTile = null;
let score = 0;
let targetScore = 1000;
let timeLeft = 60;
let level = 1;
let state = 'menu';
let isAnimating = false;
let animations = [];
let gameInterval = null;

const levels = [
  { target: 1000, time: 60, gems: 5 },
  { target: 2000, time: 55, gems: 5 },
  { target: 3000, time: 50, gems: 6 },
  { target: 4000, time: 50, gems: 6 },
  { target: 5000, time: 45, gems: 7 },
  { target: 6000, time: 45, gems: 7 },
  { target: 8000, time: 40, gems: 7 },
  { target: 10000, time: 40, gems: 7 },
  { target: 12000, time: 35, gems: 7 },
  { target: 15000, time: 30, gems: 7 },
];

function initGame() {
  const levelConfig = levels[Math.min(level - 1, levels.length - 1)];
  targetScore = levelConfig.target;
  timeLeft = levelConfig.time;
  
  createBoard();
  startTimer();
}

function startTimer() {
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(() => {
    if (state === 'playing' && !isAnimating) {
      timeLeft--;
      if (timeLeft <= 0) {
        if (score >= targetScore) {
          levelComplete();
        } else {
          gameOver();
        }
      }
    }
  }, 1000);
}

function createBoard() {
  board = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    board[row] = [];
    for (let col = 0; col < GRID_COLS; col++) {
      let type;
      do {
        type = Math.floor(Math.random() * GEM_TYPES);
      } while (wouldMatch(row, col, type));
      board[row][col] = createTile(row, col, type, SPECIAL_NONE);
    }
  }
}

function createTile(row, col, type, special) {
  return { 
    type, 
    special,
    row, col,
    x: col * tileSize, 
    y: row * tileSize, 
    targetX: col * tileSize, 
    targetY: row * tileSize, 
    scale: 1,
    alpha: 1
  };
}

function wouldMatch(row, col, type) {
  if (!board[row]) return false;
  if (col >= 2 && board[row][col-1] && board[row][col-1].type === type && board[row][col-2] && board[row][col-2].type === type) return true;
  if (row >= 2 && board[row-1] && board[row-1][col] && board[row-1][col].type === type && board[row-2] && board[row-2][col] && board[row-2][col].type === type) return true;
  return false;
}

function getTileAt(x, y) {
  const col = Math.floor((x - offsetX) / tileSize);
  const row = Math.floor((y - offsetY) / tileSize);
  if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
    return { row, col };
  }
  return null;
}

function handleTap(x, y) {
  if (state === 'menu') {
    state = 'playing';
    initGame();
    return;
  }
  
  if (state === 'gameover' || state === 'levelComplete') {
    if (state === 'gameover') {
      level = 1;
      score = 0;
    }
    state = 'playing';
    initGame();
    return;
  }
  
  if (state !== 'playing' || isAnimating) return;
  
  const tile = getTileAt(x, y);
  if (!tile) return;
  
  if (!selectedTile) {
    selectedTile = tile;
  } else {
    const dRow = Math.abs(tile.row - selectedTile.row);
    const dCol = Math.abs(tile.col - selectedTile.col);
    
    if ((dRow === 1 && dCol === 0) || (dRow === 0 && dCol === 1)) {
      swapTiles(selectedTile, tile);
    }
    selectedTile = null;
  }
}

function swapTiles(t1, t2) {
  isAnimating = true;
  
  const temp = board[t1.row][t1.col];
  board[t1.row][t1.col] = board[t2.row][t2.col];
  board[t2.row][t2.col] = temp;
  
  board[t1.row][t1.col].row = t1.row;
  board[t1.row][t1.col].col = t1.col;
  board[t1.row][t1.col].targetX = t1.col * tileSize;
  board[t1.row][t1.col].targetY = t1.row * tileSize;
  
  board[t2.row][t2.col].row = t2.row;
  board[t2.row][t2.col].col = t2.col;
  board[t2.row][t2.col].targetX = t2.col * tileSize;
  board[t2.row][t2.col].targetY = t2.row * tileSize;
  
  setTimeout(() => {
    const matches = findAllMatches();
    if (matches.length > 0) {
      processMatches(matches);
    } else {
      const temp = board[t1.row][t1.col];
      board[t1.row][t1.col] = board[t2.row][t2.col];
      board[t2.row][t2.col] = temp;
      
      board[t1.row][t1.col].row = t1.row;
      board[t1.row][t1.col].col = t1.col;
      board[t1.row][t1.col].targetX = t1.col * tileSize;
      board[t1.row][t1.col].targetY = t1.row * tileSize;
      
      board[t2.row][t2.col].row = t2.row;
      board[t2.row][t2.col].col = t2.col;
      board[t2.row][t2.col].targetX = t2.col * tileSize;
      board[t2.row][t2.col].targetY = t2.row * tileSize;
      
      setTimeout(() => { isAnimating = false; }, 200);
    }
  }, 250);
}

function findAllMatches() {
  if (!board || board.length === 0) return [];
  
  const matched = [];
  const checked = [];
  
  for (let row = 0; row < GRID_ROWS; row++) {
    checked[row] = [];
    for (let col = 0; col < GRID_COLS; col++) {
      checked[row][col] = false;
    }
  }
  
  for (let row = 0; row < GRID_ROWS; row++) {
    if (!board[row]) continue;
    for (let col = 0; col < GRID_COLS; col++) {
      if (!board[row][col] || board[row][col].type < 0 || checked[row][col]) continue;
      
      const hMatch = findHorizontalMatch(row, col);
      const vMatch = findVerticalMatch(row, col);
      
      if (hMatch.length >= 3 || vMatch.length >= 3) {
        const matchType = determineMatchType(hMatch, vMatch);
        
        if (matchType.type === 'line') {
          const tiles = matchType.direction === 'horizontal' ? hMatch : vMatch;
          tiles.forEach(t => {
            if (!checked[t.row][t.col]) {
              checked[t.row][t.col] = true;
              matched.push({ row: t.row, col: t.col, special: matchType.special });
            }
          });
        } else if (matchType.type === 'l' || matchType.type === 't') {
          const allTiles = [...hMatch, ...vMatch];
          const center = matchType.center;
          allTiles.forEach(t => {
            if (!checked[t.row][t.col]) {
              checked[t.row][t.col] = true;
              matched.push({ row: t.row, col: t.col, special: SPECIAL_BOMB });
            }
          });
        }
      }
    }
  }
  
  return matched;
}

function findHorizontalMatch(row, col) {
  if (!board[row] || !board[row][col]) return [];
  const type = board[row][col].type;
  const tiles = [{ row, col }];
  
  for (let c = col + 1; c < GRID_COLS && board[row][c] && board[row][c].type === type; c++) {
    tiles.push({ row, col: c });
  }
  
  return tiles;
}

function findVerticalMatch(row, col) {
  if (!board[row] || !board[row][col]) return [];
  const type = board[row][col].type;
  const tiles = [{ row, col }];
  
  for (let r = row + 1; r < GRID_ROWS && board[r] && board[r][col] && board[r][col].type === type; r++) {
    tiles.push({ row: r, col });
  }
  
  return tiles;
}

function determineMatchType(hMatch, vMatch) {
  if (hMatch.length >= 5 || vMatch.length >= 5) {
    return { type: 'line', direction: hMatch.length >= vMatch.length ? 'horizontal' : 'vertical', special: SPECIAL_RAINBOW };
  }
  
  if (hMatch.length >= 4 || vMatch.length >= 4) {
    return { type: 'line', direction: hMatch.length >= vMatch.length ? 'horizontal' : 'vertical', special: hMatch.length >= vMatch.length ? SPECIAL_HORIZONTAL : SPECIAL_VERTICAL };
  }
  
  if (hMatch.length >= 3 && vMatch.length >= 3) {
    return { type: 't', center: hMatch[0], special: SPECIAL_BOMB };
  }
  
  if (hMatch.length >= 3) {
    return { type: 'line', direction: 'horizontal', special: SPECIAL_NONE };
  }
  
  if (vMatch.length >= 3) {
    return { type: 'line', direction: 'vertical', special: SPECIAL_NONE };
  }
  
  return { type: 'none', special: SPECIAL_NONE };
}

function processMatches(matches) {
  let points = 0;
  const specialTiles = [];
  
  matches.forEach(m => {
    const tile = board[m.row][m.col];
    points += 10;
    
    if (tile.special === SPECIAL_HORIZONTAL || tile.special === SPECIAL_VERTICAL) {
      points += 20;
      if (tile.special === SPECIAL_HORIZONTAL) {
        for (let c = 0; c < GRID_COLS; c++) {
          if (board[m.row][c].type >= 0) {
            matches.push({ row: m.row, col: c });
            points += 5;
          }
        }
      } else {
        for (let r = 0; r < GRID_ROWS; r++) {
          if (board[r][m.col].type >= 0) {
            matches.push({ row: r, col: m.col });
            points += 5;
          }
        }
      }
    }
    
    if (tile.special === SPECIAL_BOMB) {
      points += 30;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = m.row + dr;
          const c = m.col + dc;
          if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS && board[r][c].type >= 0) {
            matches.push({ row: r, col: c });
            points += 5;
          }
        }
      }
    }
    
    if (tile.special === SPECIAL_RAINBOW) {
      points += 50;
    }
    
    if (m.special !== SPECIAL_NONE && !specialTiles.find(t => t.row === m.row && t.col === m.col)) {
      specialTiles.push({ row: m.row, col: m.col, special: m.special });
    }
    
    tile.type = -1;
  });
  
  if (specialTiles.length > 0) {
    const center = matches[0];
    if (center) {
      const special = specialTiles[0].special;
      board[center.row][center.col] = createTile(center.row, center.col, board[center.row][center.col].type >= 0 ? board[center.row][center.col].type : 0, special);
    }
  }
  
  score += points;
  
  if (score >= targetScore && state === 'playing') {
    setTimeout(() => { levelComplete(); }, 500);
    return;
  }
  
  setTimeout(() => {
    dropTiles();
  }, 300);
}

function dropTiles() {
  for (let col = 0; col < GRID_COLS; col++) {
    let emptyRow = GRID_ROWS - 1;
    
    for (let row = GRID_ROWS - 1; row >= 0; row--) {
      if (board[row] && board[row][col] && board[row][col].type >= 0) {
        if (row !== emptyRow) {
          board[emptyRow][col] = board[row][col];
          board[emptyRow][col].row = emptyRow;
          board[emptyRow][col].targetY = emptyRow * tileSize;
          board[row][col] = null;
        }
        emptyRow--;
      }
    }
    
    for (let row = emptyRow; row >= 0; row--) {
      board[row][col] = createTile(row, col, Math.floor(Math.random() * GEM_TYPES), SPECIAL_NONE);
      board[row][col].y = (row - emptyRow - 1) * tileSize - tileSize;
      board[row][col].targetY = row * tileSize;
    }
  }
  
  setTimeout(() => {
    const matches = findAllMatches();
    if (matches.length > 0) {
      processMatches(matches);
    } else {
      isAnimating = false;
    }
  }, 400);
}

function levelComplete() {
  state = 'levelComplete';
  if (gameInterval) clearInterval(gameInterval);
  level++;
}

function gameOver() {
  state = 'gameover';
  if (gameInterval) clearInterval(gameInterval);
}

function update(dt) {
  animations = animations.filter(a => {
    a.time -= dt;
    return a.time > 0;
  });
  
  if (!board || board.length === 0) return;
  
  for (let row = 0; row < GRID_ROWS; row++) {
    if (!board[row]) continue;
    for (let col = 0; col < GRID_COLS; col++) {
      if (!board[row][col]) continue;
      const tile = board[row][col];
      tile.x += (tile.targetX - tile.x) * 0.15;
      tile.y += (tile.targetY - tile.y) * 0.15;
    }
  }
}

function render() {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, gameWidth, gameHeight);
  
  if (state === 'menu') {
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('宝石消除', gameWidth / 2, gameHeight * 0.3);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '24px Arial';
    ctx.fillText('点击开始游戏', gameWidth / 2, gameHeight * 0.5);
    return;
  }
  
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, 0, gameWidth, 50);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '20px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('分数: ' + score + ' / ' + targetScore, 20, 33);
  ctx.textAlign = 'right';
  ctx.fillStyle = timeLeft <= 10 ? '#FF4444' : '#FFFFFF';
  ctx.fillText('时间: ' + timeLeft, gameWidth - 20, 33);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFD700';
  ctx.fillText('关卡: ' + level, gameWidth / 2 - 30, 33);
  
  if (!board || board.length === 0) return;
  
  for (let row = 0; row < GRID_ROWS; row++) {
    if (!board[row]) continue;
    for (let col = 0; col < GRID_COLS; col++) {
      if (!board[row][col] || board[row][col].type < 0) continue;
      
      const tile = board[row][col];
      const x = offsetX + tile.x + tileSize / 2;
      const y = offsetY + tile.y + tileSize / 2;
      const size = tileSize * 0.75 * tile.scale;
      
      ctx.globalAlpha = tile.alpha;
      
      ctx.fillStyle = COLORS[tile.type];
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.fill();
      
      if (tile.special === SPECIAL_HORIZONTAL) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - size * 0.3, y - 4, size * 0.6, 8);
      } else if (tile.special === SPECIAL_VERTICAL) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - 4, y - size * 0.3, 8, size * 0.6);
      } else if (tile.special === SPECIAL_BOMB) {
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(x, y, size * 0.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (tile.special === SPECIAL_RAINBOW) {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(x, y, size * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
      
      if (selectedTile && selectedTile.row === row && selectedTile.col === col) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      
      ctx.globalAlpha = 1;
    }
  }
  
  if (state === 'gameover') {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, gameWidth, gameHeight);
    
    ctx.fillStyle = '#FF4444';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('游戏结束!', gameWidth / 2, gameHeight * 0.35);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '28px Arial';
    ctx.fillText('最终分数: ' + score, gameWidth / 2, gameHeight * 0.5);
    
    ctx.font = '22px Arial';
    ctx.fillText('点击重新开始', gameWidth / 2, gameHeight * 0.65);
  }
  
  if (state === 'levelComplete') {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, gameWidth, gameHeight);
    
    ctx.fillStyle = '#4ECDC4';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('关卡完成!', gameWidth / 2, gameHeight * 0.35);
    
    ctx.fillStyle = '#FFD700';
    ctx.font = '28px Arial';
    ctx.fillText('分数: ' + score, gameWidth / 2, gameHeight * 0.5);
    
    ctx.font = '22px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('点击进入下一关', gameWidth / 2, gameHeight * 0.65);
  }
}

let lastTime = 0;
function gameLoop(timestamp) {
  const dt = timestamp - lastTime;
  lastTime = timestamp;
  
  update(dt);
  render();
  
  requestAnimationFrame(gameLoop);
}

canvas = wx.createCanvas();
ctx = canvas.getContext('2d');

const info = wx.getSystemInfoSync();
const dpr = info.pixelRatio;
gameWidth = info.windowWidth;
gameHeight = info.windowHeight;
canvas.width = gameWidth * dpr;
canvas.height = gameHeight * dpr;
ctx.scale(dpr, dpr);

tileSize = Math.min(gameWidth * 0.15, gameHeight * 0.09);
offsetX = (gameWidth - tileSize * GRID_COLS) / 2;
offsetY = (gameHeight - tileSize * GRID_ROWS) / 2 + 20;

wx.onTouchStart((res) => {
  const touch = res.touches[0];
  handleTap(touch.clientX, touch.clientY);
});

gameLoop(0);
