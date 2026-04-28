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
let levelHueRotation = 0;
let totalTime = 0;
let state = 'loading';
let fromPlaying = false;
let lastInteractionTime = 0;
let idleRotation = 0;
let buttonAnimations = [];
let gemCollection = [];
let touchStartTile = null;
let touchStartPos = null;
const SWIPE_THRESHOLD = 30;
let gemHues = [];
const TOTAL_GEMS = 11;

for (let i = 0; i < TOTAL_GEMS; i++) {
  gemCollection.push({ id: i, collected: false });
  gemHues.push(Math.random() * 360);
}
let isAnimating = false;
let animations = [];
let tweens = [];
let selectedAnimation = null;
let leaderboard = [];
let levelLeaderboard = [];

function getLeaderboard() {
  return leaderboard.sort((a, b) => a.time - b.time);
}

function getLevelLeaderboard() {
  return levelLeaderboard.sort((a, b) => b.level - a.level || a.time - b.time);
}

function saveLevelScore(currentLevel, time) {
  levelLeaderboard.push({ level: currentLevel, time: time });
  if (levelLeaderboard.length > 10) {
    levelLeaderboard = getLevelLeaderboard().slice(0, 10);
  }
  try {
    wx.setStorageSync('sushi_levelLeaderboard', levelLeaderboard);
  } catch (e) {}
}

function loadLevelLeaderboard() {
  try {
    const data = wx.getStorageSync('sushi_levelLeaderboard');
    if (data) {
      levelLeaderboard = data;
    }
  } catch (e) {}
}

function saveScore(time) {
  leaderboard.push({ time: time });
  if (leaderboard.length > 10) {
    leaderboard = getLeaderboard().slice(0, 10);
  }
  try {
    wx.setStorageSync('sushi_leaderboard', leaderboard);
  } catch (e) {}
}

function loadLeaderboard() {
  try {
    const data = wx.getStorageSync('sushi_leaderboard');
    if (data) {
      leaderboard = data;
    }
  } catch (e) {}
}

function loadGemCollection() {
  try {
    const data = wx.getStorageSync('sushi_gemCollection');
    if (data && data.length === TOTAL_GEMS) {
      gemCollection = data;
    }
  } catch (e) {}
}

const gsap = {
  to(target, props) {
    const duration = props.duration || 0.3;
    const ease = props.ease || 'power2out';
    const onComplete = props.onComplete;
    
    const startValues = {};
    const endValues = {};
    
    for (const key in props) {
      if (key === 'duration' || key === 'ease' || key === 'onComplete') continue;
      startValues[key] = target[key];
      endValues[key] = props[key];
    }
    
    const startTime = Date.now();
    
    const tween = {
      target,
      startValues,
      endValues,
      duration: duration * 1000,
      startTime,
      ease,
      onComplete,
      active: true
    };
    
    tweens.push(tween);
    return tween;
  },
  
  update() {
    const now = Date.now();
    tweens = tweens.filter(tween => {
      if (!tween.active) return false;
      
      const elapsed = now - tween.startTime;
      const progress = Math.min(elapsed / tween.duration, 1);
      const easedProgress = easeWithGSAP(progress, tween.ease);
      
      for (const key in tween.startValues) {
        const start = tween.startValues[key];
        const end = tween.endValues[key];
        tween.target[key] = start + (end - start) * easedProgress;
      }
      
      if (progress >= 1) {
        if (tween.onComplete) {
          tween.onComplete();
        }
        return false;
      }
      
      return true;
    });
  },
  
  kill(tween) {
    if (tween) {
      tween.active = false;
    }
  },
  
  remove(tween) {
    tween.active = false;
  }
};

function easeWithGSAP(t, ease) {
  switch (ease) {
    case 'power1out': return 1 - Math.pow(1 - t, 1);
    case 'power2out': return 1 - Math.pow(1 - t, 2);
    case 'power3out': return 1 - Math.pow(1 - t, 3);
    case 'power4out': return 1 - Math.pow(1 - t, 4);
    case 'elasticout': return Math.sin(-13 * Math.PI / 2 * (t + 1)) * Math.pow(2, -10 * t) + 1;
    case 'bounceout': return bounceOut(t);
    case 'backout': return backOut(t);
    case 'none': return t;
    default: return 1 - Math.pow(1 - t, 2);
  }
}

function bounceOut(t) {
  if (t < 1 / 2.75) {
    return 7.5625 * t * t;
  } else if (t < 2 / 2.75) {
    t -= 1.5 / 2.75;
    return 7.5625 * t * t + 0.75;
  } else if (t < 2.5 / 2.75) {
    t -= 2.25 / 2.75;
    return 7.5625 * t * t + 0.9375;
  } else {
    t -= 2.625 / 2.75;
    return 7.5625 * t * t + 0.984375;
  }
}

function backOut(t) {
  return 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
}

function startSelectedAnimation(row, col) {
  selectedAnimation = {
    row: row,
    col: col,
    time: 0,
    duration: 2000
  };
}

function clearSelection() {
  if (selectedTile && board[selectedTile.row] && board[selectedTile.row][selectedTile.col]) {
    board[selectedTile.row][selectedTile.col].selected = false;
  }
  selectedTile = null;
  selectedAnimation = null;
}
let gameInterval = null;
let hintAnimation = null;

const buttons = [
  { id: 'hint', label: '提示', x: 0, y: 0, width: 80, height: 40 },
  { id: 'shuffle', label: '乱序', x: 0, y: 0, width: 80, height: 40 },
  { id: 'book', label: '图鉴', x: 0, y: 0, width: 80, height: 40 }
];
let imageCache = {};
let loadedCount = 0;
let totalToLoad = 0;
let audioCache = {};
let bgmManager = null;
let lastBubblePopTime = 0;

function preloadAudio() {
  audioCache['bubblepop'] = 'audio/linhmitto-bubblepop-254773.mp3';
  const audio = wx.createInnerAudioContext();
  audio.src = audioCache['bubblepop'];
  audio.onPlay(() => {});
  audio.onError((err) => {
    console.error('Failed to load audio:', err);
  });
  
  bgmManager = wx.createInnerAudioContext();
  bgmManager.src = 'audio/bgm.mp3';
  bgmManager.loop = true;
  bgmManager.play();
}

function playBubblePop() {
  const now = Date.now();
  if (now - lastBubblePopTime < 300) {
    return;
  }
  lastBubblePopTime = now;
  
  const audio = wx.createInnerAudioContext();
  audio.src = 'audio/linhmitto-bubblepop-254773.mp3';
  audio.play();
}

function preloadImages() {
  const images = [];
  for (let i = 0; i < TOTAL_GEMS; i++) {
    const numStr = i < 10 ? `0${i}` : `${i}`;
    images.push(`images/shousi${numStr}_256.png`);
    images.push(`images/shousi${numStr}_normal.png`);
  }
  images.push('images/bg.jpg');
  images.push('images/Button_002.png');
  images.push('images/Button_003.png');
  images.push('images/Button_128.png');
  images.push('images/Fengmian.png');
  
  totalToLoad = images.length;
  loadedCount = 0;
  
  images.forEach(src => {
    const img = wx.createImage();
    img.onload = function() {
      imageCache[src] = img;
      loadedCount++;
      if (loadedCount >= totalToLoad) {
        onAssetsLoaded();
      }
    };
    img.onerror = function(err) {
      console.error('Failed to load image:', src, err);
      loadedCount++;
      if (loadedCount >= totalToLoad) {
        onAssetsLoaded();
      }
    };
    img.src = src;
  });
}

function onAssetsLoaded() {
  preloadAudio();
  state = 'menu';
}

function getGemImageSrc(type) {
  if (type < 10) {
    return `images/shousi0${type}_256.png`;
  } else {
    return `images/shousi${type}_256.png`;
  }
}

const levels = [
  { target: 600, time: 60 },
  { target: 800, time: 60 },
  { target: 1000, time: 60 },
  { target: 1300, time: 55 },
  { target: 1600, time: 55 },
  { target: 1900, time: 55 },
  { target: 2300, time: 50 },
  { target: 2700, time: 50 },
  { target: 3200, time: 50 },
  { target: 3700, time: 45 },
  { target: 4300, time: 45 },
  { target: 5000, time: 45 },
  { target: 5700, time: 40 },
  { target: 6500, time: 40 },
  { target: 7400, time: 40 },
  { target: 8400, time: 38 },
  { target: 9500, time: 38 },
  { target: 10700, time: 38 },
  { target: 12000, time: 35 },
  { target: 13400, time: 35 },
  { target: 15000, time: 35 },
  { target: 16700, time: 32 },
  { target: 18500, time: 32 },
  { target: 20500, time: 32 },
  { target: 22700, time: 30 },
  { target: 25000, time: 30 },
  { target: 27500, time: 28 },
  { target: 30200, time: 28 },
  { target: 33000, time: 25 },
  { target: 36000, time: 25 },
  { target: 40000, time: 25 },
  { target: 45000, time: 25 },
  { target: 50000, time: 25 },
  { target: 55000, time: 25 },
  { target: 60000, time: 25 },
  { target: 65000, time: 25 },
];

function initGame() {
  isAnimating = false;
  selectedTile = null;
  selectedAnimation = null;
  hintAnimation = null;
  fromPlaying = false;
  
  if (board) {
    for (let row = 0; row < GRID_ROWS; row++) {
      if (!board[row]) continue;
      for (let col = 0; col < GRID_COLS; col++) {
        if (board[row][col]) {
          board[row][col].selected = false;
          board[row][col].matched = false;
          board[row][col].matchAnimTime = 0;
          board[row][col].scale = 1;
        }
      }
    }
  }
  
  const levelConfig = levels[Math.min(level - 1, levels.length - 1)];
  targetScore = levelConfig.target;
  timeLeft = levelConfig.time;
  
  createBoard();
  startTimer();
}

function startTimer() {
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(() => {
    if (state === 'playing') {
      timeLeft--;
      totalTime++;
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
  const gemTypesForLevel = Math.min(5 + Math.floor((level - 1) / 5), TOTAL_GEMS);
  
  board = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    board[row] = [];
    for (let col = 0; col < GRID_COLS; col++) {
      let type;
      do {
        type = Math.floor(Math.random() * gemTypesForLevel);
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
    alpha: 1,
    matched: false,
    selected: false,
    matchAnimTime: 0
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
  if (state === 'loading') return;
  
  if (state === 'playing') {
    lastInteractionTime = Date.now();
    idleRotation = 0;
  }
  
  if (state === 'menu') {
    const btnImg = imageCache['images/Button_002.png'];
    const btnScale = 1;
    const startBtnY = gameHeight * 0.3 + 30;
    
    const startBtnAnim = buttonAnimations.find(a => a.index === 'start');
    const startScale = startBtnAnim ? 1 + Math.sin(startBtnAnim.progress * Math.PI) * 0.15 : 1;
    if (startBtnAnim) {
      startBtnAnim.progress -= 0.08;
      if (startBtnAnim.progress <= 0) {
        buttonAnimations = buttonAnimations.filter(a => a.index !== 'start');
      }
    }
    
    if (btnImg && btnImg.width > 0) {
      const btnWidth = btnImg.width * btnScale * startScale;
      const btnHeight = btnImg.height * btnScale * startScale;
      
      const startBtnX = gameWidth / 2 - btnWidth / 2 - 80;
      if (x >= startBtnX && x <= startBtnX + btnWidth && y >= startBtnY && y <= startBtnY + btnHeight) {
        buttonAnimations.push({ index: 'start', progress: 1 });
        levelHueRotation = 0;
        state = 'playing';
        initGame();
        return;
      }
      
      const bookBtnX = gameWidth / 2 + 80 - btnWidth / 2;
      if (x >= bookBtnX && x <= bookBtnX + btnWidth && y >= startBtnY && y <= startBtnY + btnHeight) {
        buttonAnimations.push({ index: 'book', progress: 1 });
        fromPlaying = false;
        state = 'collection';
        return;
      }
    } else {
      const collectionBtnY = gameHeight * 0.65;
      if (y > collectionBtnY - 15 && y < collectionBtnY + 15) {
        fromPlaying = false;
        state = 'collection';
        return;
      }
    }
    
    state = 'playing';
    initGame();
    return;
  }
  
  if (state === 'collection') {
    const btnImg = imageCache['images/Button_002.png'];
    const backBtnY = gameHeight - 200;
    
    if (btnImg && btnImg.width > 0) {
      const backBtnWidth = btnImg.width;
      const backBtnHeight = btnImg.height;
      const backBtnX = gameWidth / 2 - backBtnWidth / 2;
      
      if (x >= backBtnX && x <= backBtnX + backBtnWidth && y >= backBtnY && y <= backBtnY + backBtnHeight) {
        if (fromPlaying) {
          state = 'playing';
        } else {
          state = 'menu';
        }
        return;
      }
    } else {
      const backBtnWidth = 120;
      const backBtnHeight = 40;
      const backBtnX = gameWidth / 2 - backBtnWidth / 2;
      
      if (x >= backBtnX && x <= backBtnX + backBtnWidth && y >= backBtnY && y <= backBtnY + backBtnHeight) {
        if (fromPlaying) {
          state = 'playing';
        } else {
          state = 'menu';
        }
        return;
      }
    }
    
    const cols = 3;
    const cellWidth = gameWidth / cols;
    const cellHeight = 120;
    const startY = 130;
    const imgSize = 70;
    
    for (let i = 0; i < TOTAL_GEMS; i++) {
      if (!gemCollection[i].collected) continue;
      
      const col = i % cols;
      const row = Math.floor(i / cols);
      const gx = col * cellWidth + cellWidth / 2;
      const gy = startY + row * cellHeight + cellHeight / 2;
      
      const dist = Math.sqrt((x - gx) ** 2 + (y - gy) ** 2);
      if (dist <= imgSize / 2) {
        collectionAnimations.push({
          index: i,
          time: 300,
          x: gx,
          y: gy
        });
        playBubblePop();
        return;
      }
    }
    
    return;
  }
  
  if (state === 'gameover' || state === 'levelComplete' || state === 'gameComplete') {
    const btnImg = imageCache['images/Button_002.png'];
    
    let btnWidth, btnHeight;
    if (btnImg && btnImg.width > 0) {
      btnWidth = btnImg.width;
      btnHeight = btnImg.height;
    } else {
      btnWidth = 200;
      btnHeight = 60;
    }
    const btnX = gameWidth / 2 - btnWidth / 2;
    let btnY;
    if (state === 'gameComplete') {
      btnY = gameHeight * 0.85 - btnHeight / 2;
    } else if (state === 'gameover') {
      btnY = gameHeight * 0.80 - btnHeight / 2;
    } else {
      btnY = gameHeight * 0.65 - btnHeight / 2;
    }
    
    if (x >= btnX && x <= btnX + btnWidth && y >= btnY && y <= btnY + btnHeight) {
      if (state === 'gameover') {
        level = 1;
        levelHueRotation = 0;
        score = 0;
      } else if (state === 'gameComplete') {
        level = 1;
        levelHueRotation = 0;
        score = 0;
        totalTime = 0;
      }
      if (state === 'levelComplete') {
        state = 'playing';
        initGame();
      } else {
        state = 'menu';
      }
      return;
    }
    return;
  }
  
  for (const btn of buttons) {
    if (x >= btn.x && x <= btn.x + btn.width && y >= btn.y && y <= btn.y + btn.height) {
      handleButtonClick(btn.id);
      return;
    }
  }
  
  if (state !== 'playing' || isAnimating) return;
  
  const tile = getTileAt(x, y);
  if (!tile) return;
  
  if (!selectedTile) {
    selectedTile = tile;
    if (board[tile.row] && board[tile.row][tile.col]) {
      board[tile.row][tile.col].selected = true;
    }
    startSelectedAnimation(tile.row, tile.col);
  } else if (tile.row === selectedTile.row && tile.col === selectedTile.col) {
    clearSelection();
  } else {
    const dRow = Math.abs(tile.row - selectedTile.row);
    const dCol = Math.abs(tile.col - selectedTile.col);
    
    if ((dRow === 1 && dCol === 0) || (dRow === 0 && dCol === 1)) {
      swapTiles(selectedTile, tile);
    }
    clearSelection();
  }
}

function swapTiles(t1, t2) {
  isAnimating = true;
  
  const tile1 = board[t1.row][t1.col];
  const tile2 = board[t2.row][t2.col];
  
  const t1Row = t1.row;
  const t1Col = t1.col;
  const t2Row = t2.row;
  const t2Col = t2.col;
  
  board[t1Row][t1Col] = tile2;
  board[t2Row][t2Col] = tile1;
  
  tile2.row = t1Row;
  tile2.col = t1Col;
  tile2.targetX = t1Col * tileSize;
  tile2.targetY = t1Row * tileSize;
  
  tile1.row = t2Row;
  tile1.col = t2Col;
  tile1.targetX = t2Col * tileSize;
  tile1.targetY = t2Row * tileSize;
  
  gsap.to(tile2, {
    x: tile2.targetX,
    y: tile2.targetY,
    duration: 0.25,
    ease: 'power2out'
  });
  
  gsap.to(tile1, {
    x: tile1.targetX,
    y: tile1.targetY,
    duration: 0.25,
    ease: 'power2out',
    onComplete: () => {
      const matches = findAllMatches();
      if (matches.length > 0) {
        processMatches(matches);
      } else {
        const currentTile1 = board[t1Row][t1Col];
        const currentTile2 = board[t2Row][t2Col];
        
        board[t1Row][t1Col] = currentTile2;
        board[t2Row][t2Col] = currentTile1;
        
        currentTile2.row = t1Row;
        currentTile2.col = t1Col;
        currentTile2.targetX = t1Col * tileSize;
        currentTile2.targetY = t1Row * tileSize;
        
        currentTile1.row = t2Row;
        currentTile1.col = t2Col;
        currentTile1.targetX = t2Col * tileSize;
        currentTile1.targetY = t2Row * tileSize;
        
        gsap.to(currentTile2, {
          x: currentTile2.targetX,
          y: currentTile2.targetY,
          duration: 0.2,
          ease: 'power2out'
        });
        
        gsap.to(currentTile1, {
          x: currentTile1.targetX,
          y: currentTile1.targetY,
          duration: 0.2,
          ease: 'power2out',
          onComplete: () => { isAnimating = false; }
        });
      }
    }
  });
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
  const hasSpecialMatch = matches.some(m => board[m.row][m.col] && board[m.row][m.col].special !== SPECIAL_NONE);
  
  if (hasSpecialMatch) {
    let points = 0;
    matches.forEach(m => {
      const tile = board[m.row][m.col];
      if (!tile) return;
      
      points += 10;
      
      if (tile.type >= 0 && tile.type < gemCollection.length) {
        gemCollection[tile.type].collected = true;
        try {
          wx.setStorageSync('sushi_gemCollection', gemCollection);
        } catch (e) {}
      }
      
      tile.matched = true;
      tile.scale = 1;
      playBubblePop();
    });
    
    setTimeout(() => {
      matches.forEach(m => {
        const tile = board[m.row][m.col];
        if (tile) {
          tile.scale = 1;
          tile.type = -1;
        }
      });
      
      score += points;
      
      if (score >= targetScore && state === 'playing') {
        setTimeout(() => { levelComplete(); }, 500);
        return;
      }
      
      setTimeout(() => {
        dropTiles();
      }, 200);
      
      isAnimating = false;
    }, 500);
    return;
  }
  
  let points = 0;
  const matchedTiles = [];

  matches.forEach(m => {
    const tile = board[m.row][m.col];
    if (!tile) return;

    points += 10;
    matchedTiles.push(tile);

    if (tile.type >= 0 && tile.type < gemCollection.length) {
      gemCollection[tile.type].collected = true;
      try {
        wx.setStorageSync('sushi_gemCollection', gemCollection);
      } catch (e) {}
    }

    tile.matched = true;
    tile.scale = 1;
    playBubblePop();
  });

  setTimeout(() => {
    matchedTiles.forEach(t => {
      if (t) t.scale = 1.3;
    });

    setTimeout(() => {
      matchedTiles.forEach(t => {
        if (t) t.scale = 0;
      });

      setTimeout(() => {
        matchedTiles.forEach(t => {
          if (t) {
            t.scale = 1;
            t.type = -1;
          }
        });

        score += points;

        if (score >= targetScore && state === 'playing') {
          setTimeout(() => { levelComplete(); }, 500);
          return;
        }

        setTimeout(() => {
          dropTiles();
        }, 200);

        isAnimating = false;
      }, 150);
    }, 150);
  }, 100);
}

function dropTiles() {
  let pendingTiles = 0;
  
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
      const gemTypesForLevel = Math.min(5 + Math.floor((level - 1) / 5), TOTAL_GEMS);
      board[row][col] = createTile(row, col, Math.floor(Math.random() * gemTypesForLevel), SPECIAL_NONE);
      board[row][col].y = (row - emptyRow - 1) * tileSize - tileSize;
      board[row][col].targetY = row * tileSize;
    }
  }
  
  for (let col = 0; col < GRID_COLS; col++) {
    for (let row = 0; row < GRID_ROWS; row++) {
      if (!board[row][col]) continue;
      const tile = board[row][col];
      pendingTiles++;
      
      gsap.to(tile, {
        y: tile.targetY,
        duration: 0.4,
        ease: 'bounceout',
        onComplete: () => {
          pendingTiles--;
          if (pendingTiles <= 0) {
            const matches = findAllMatches();
            if (matches.length > 0) {
              processMatches(matches);
            } else {
              isAnimating = false;
            }
          }
        }
      });
    }
  }
}

function levelComplete() {
  if (gameInterval) clearInterval(gameInterval);
  
  const winAudio = wx.createInnerAudioContext();
  winAudio.src = 'audio/win.mp3';
  winAudio.play();
  
  if (level >= levels.length) {
    state = 'gameComplete';
    saveScore(totalTime);
  } else {
    state = 'levelComplete';
    level++;
    levelHueRotation = Math.random() * 360;
  }
}

function gameOver() {
  state = 'gameover';
  saveLevelScore(level, totalTime);
  if (gameInterval) clearInterval(gameInterval);
}

function update(dt) {
  animations = animations.filter(a => {
    a.time -= dt;
    return a.time > 0;
  });
  
  collectionAnimations = collectionAnimations.filter(a => {
    a.time -= dt;
    return a.time > 0;
  });
  
  gsap.update();
  
  if (selectedAnimation) {
    selectedAnimation.time += dt;
    if (selectedAnimation.time >= selectedAnimation.duration) {
      clearSelection();
    }
  }
  
  if (hintAnimation) {
    hintAnimation.time += dt;
    if (hintAnimation.time >= hintAnimation.duration) {
      hintAnimation = null;
    }
  }
}

function render() {
  if (state === 'menu') {
    idleRotation += 0.02;
  }
  
  if (state === 'loading') {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, gameWidth, gameHeight);
    
    ctx.fillStyle = '#4ECDC4';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Loading...', gameWidth / 2, gameHeight / 2 - 20);
    
    const progress = totalToLoad > 0 ? loadedCount / totalToLoad : 0;
    ctx.fillStyle = '#333333';
    ctx.fillRect(gameWidth / 2 - 100, gameHeight / 2 + 20, 200, 20);
    ctx.fillStyle = '#4ECDC4';
    ctx.fillRect(gameWidth / 2 - 100, gameHeight / 2 + 20, 200 * progress, 20);
    return;
  }
  
  const bgImg = imageCache['images/bg.jpg'];
  if (bgImg && bgImg.width > 0) {
    if (level >= 2) {
      ctx.save();
      ctx.filter = `hue-rotate(${levelHueRotation}deg)`;
      ctx.drawImage(bgImg, 0, 0, gameWidth, gameHeight);
      ctx.restore();
    } else {
      ctx.drawImage(bgImg, 0, 0, gameWidth, gameHeight);
    }
  } else {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, gameWidth, gameHeight);
  }
  
  if (state === 'menu') {
    ctx.fillStyle = '#e0eed7';
    ctx.fillRect(0, 0, gameWidth, gameHeight);
    
    const fengmianImg = imageCache['images/Fengmian.png'];
    if (fengmianImg && fengmianImg.width > 0) {
      const imgAspect = fengmianImg.width / fengmianImg.height;
      const screenAspect = gameWidth / gameHeight;
      let drawWidth, drawHeight;
      if (imgAspect > screenAspect) {
        drawWidth = gameWidth;
        drawHeight = gameWidth / imgAspect;
      } else {
        drawHeight = gameHeight;
        drawWidth = gameHeight * imgAspect;
      }
      const drawX = (gameWidth - drawWidth) / 2;
      const drawY = gameHeight - drawHeight;
      ctx.drawImage(fengmianImg, drawX, drawY, drawWidth, drawHeight);
    }
    
    const btnImg = imageCache['images/Button_002.png'];
    const btnOverlayImg = imageCache['images/Button_003.png'];
    const startBtnY = gameHeight * 0.3 + 30;
    const btnScale = 1;
    
    const startBtnAnim = buttonAnimations.find(a => a.index === 'start');
    const startScale = startBtnAnim ? 1 + Math.sin(startBtnAnim.progress * Math.PI) * 0.15 : 1;
    if (startBtnAnim) {
      startBtnAnim.progress -= 0.08;
      if (startBtnAnim.progress <= 0) {
        buttonAnimations = buttonAnimations.filter(a => a.index !== 'start');
      }
    }
    
    if (btnImg && btnImg.width > 0) {
      const btnWidth = btnImg.width * btnScale * startScale;
      const btnHeight = btnImg.height * btnScale * startScale;
      const btnX = gameWidth / 2 - btnWidth / 2 - 80;
      
      ctx.save();
      ctx.filter = 'saturate(0) brightness(1.4)';
      ctx.drawImage(btnImg, btnX, startBtnY, btnWidth, btnHeight);
      ctx.restore();
      
      if (btnOverlayImg && btnOverlayImg.width > 0) {
        ctx.save();
        ctx.translate(gameWidth / 2 - 80, startBtnY + btnHeight / 2);
        ctx.rotate(idleRotation);
        ctx.drawImage(btnOverlayImg, -btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
        ctx.restore();
      }
      
      ctx.font = '20px Arial';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText('开始', gameWidth / 2 - 80, startBtnY + btnHeight / 2 + 7);
    }
    
    const bookBtnY = startBtnY;
    const bookBtnAnim = buttonAnimations.find(a => a.index === 'book');
    const bookScale = bookBtnAnim ? 1 + Math.sin(bookBtnAnim.progress * Math.PI) * 0.15 : 1;
    if (bookBtnAnim) {
      bookBtnAnim.progress -= 0.08;
      if (bookBtnAnim.progress <= 0) {
        buttonAnimations = buttonAnimations.filter(a => a.index !== 'book');
      }
    }
    
    if (btnImg && btnImg.width > 0) {
      const btnWidth = btnImg.width * btnScale * bookScale;
      const btnHeight = btnImg.height * btnScale * bookScale;
      const btnX = gameWidth / 2 - btnWidth / 2 + 80;
      ctx.drawImage(btnImg, btnX, bookBtnY, btnWidth, btnHeight);
      
      if (btnOverlayImg && btnOverlayImg.width > 0) {
        ctx.save();
        ctx.translate(gameWidth / 2 + 80, bookBtnY + btnHeight / 2);
        ctx.rotate(idleRotation);
        ctx.drawImage(btnOverlayImg, -btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
        ctx.restore();
      }
      
      ctx.font = '20px Arial';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText('图鉴', gameWidth / 2 + 80, bookBtnY + btnHeight / 2 + 7);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(gameWidth / 2 - 60, bookBtnY - 20, 120, 40);
      ctx.font = '20px Arial';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('图鉴', gameWidth / 2, bookBtnY + 6);
    }
    return;
  }
  
  if (state === 'collection') {
    renderCollection();
    return;
  }
  
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, 0, gameWidth, 120);
  
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '20px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('分数: ' + score + ' / ' + targetScore, 20, 50);
  ctx.fillStyle = '#FFD700';
  ctx.fillText('关卡: ' + level, 20, 80);
  ctx.fillStyle = timeLeft <= 10 ? '#FF4444' : '#FFFFFF';
  ctx.fillText('时间: ' + timeLeft, 20, 110);
  
  if (!board || board.length === 0) return;
  
  for (let row = 0; row < GRID_ROWS; row++) {
    if (!board[row]) continue;
    for (let col = 0; col < GRID_COLS; col++) {
      if (!board[row][col] || board[row][col].type < 0) continue;
      
      const tile = board[row][col];
      const x = offsetX + tile.x + tileSize / 2;
      const y = offsetY + tile.y + tileSize / 2;
      const size = tileSize * tile.scale;
      
      ctx.globalAlpha = tile.alpha;
      
      let imgSrc;
      if (tile.matched || tile.selected) {
        if (tile.type < 10) {
          imgSrc = `images/shousi0${tile.type}_256.png`;
        } else {
          imgSrc = `images/shousi${tile.type}_256.png`;
        }
      } else {
        if (tile.type < 10) {
          imgSrc = `images/shousi0${tile.type}_normal.png`;
        } else {
          imgSrc = `images/shousi${tile.type}_normal.png`;
        }
      }
      const img = imageCache[imgSrc];
      if (img && img.width > 0) {
        ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
      } else {
        ctx.fillStyle = COLORS[tile.type];
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      
      if (selectedAnimation && selectedAnimation.row === row && selectedAnimation.col === col) {
        const progress = selectedAnimation.time / selectedAnimation.duration;
        const maxRadius = size * 0.8;
        const minRadius = size * 0.4;
        const radius = minRadius + (maxRadius - minRadius) * progress;
        
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 182, 193, ${0.5 * (1 - progress)})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      
      if (hintAnimation) {
        const isHint1 = hintAnimation.t1.row === row && hintAnimation.t1.col === col;
        const isHint2 = hintAnimation.t2.row === row && hintAnimation.t2.col === col;
        if (isHint1 || isHint2) {
          ctx.strokeStyle = '#FFFF00';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
          ctx.stroke();
        }
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
    ctx.fillText('游戏结束!', gameWidth / 2, gameHeight * 0.20);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '28px Arial';
    ctx.fillText('最终分数: ' + score, gameWidth / 2, gameHeight * 0.32);
    
    ctx.fillStyle = '#4ECDC4';
    ctx.font = 'bold 32px Arial';
    ctx.fillText('历史记录', gameWidth / 2, gameHeight * 0.44);
    
    const levelLeaderboard = getLevelLeaderboard();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '22px Arial';
    for (let i = 0; i < Math.min(5, levelLeaderboard.length); i++) {
      const mins = Math.floor(levelLeaderboard[i].time / 60);
      const secs = levelLeaderboard[i].time % 60;
      ctx.fillText((i + 1) + '. 第' + levelLeaderboard[i].level + '关 - ' + mins + '分' + secs + '秒', gameWidth / 2, gameHeight * 0.52 + i * 30);
    }
    
    const btnImg = imageCache['images/Button_002.png'];
    if (btnImg && btnImg.width > 0) {
      const btnWidth = btnImg.width;
      const btnHeight = btnImg.height;
      const btnX = gameWidth / 2 - btnWidth / 2;
      const btnY = gameHeight * 0.80 - btnHeight / 2;
      ctx.drawImage(btnImg, btnX, btnY, btnWidth, btnHeight);
      ctx.font = '20px Arial';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText('返回主菜单', gameWidth / 2, btnY + btnHeight / 2 + 7);
    } else {
      ctx.font = '22px Arial';
      ctx.fillText('点击返回主菜单', gameWidth / 2, gameHeight * 0.80);
    }
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
    
    const btnImg = imageCache['images/Button_002.png'];
    const btnOverlayImg = imageCache['images/Button_003.png'];
    
    let btnWidth, btnHeight;
    if (btnImg && btnImg.width > 0) {
      btnWidth = btnImg.width;
      btnHeight = btnImg.height;
    } else {
      btnWidth = 200;
      btnHeight = 60;
    }
    const btnX = gameWidth / 2 - btnWidth / 2;
    const btnY = gameHeight * 0.65 - btnHeight / 2;
    
    if (btnImg && btnImg.width > 0) {
      ctx.drawImage(btnImg, btnX, btnY, btnWidth, btnHeight);
      
      if (btnOverlayImg && btnOverlayImg.width > 0) {
        ctx.save();
        ctx.translate(gameWidth / 2, btnY + btnHeight / 2);
        ctx.rotate(idleRotation);
        ctx.drawImage(btnOverlayImg, -btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
        ctx.restore();
      }
      
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText('下一关', gameWidth / 2, btnY + btnHeight / 2 + 8);
    } else {
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(btnX, btnY, btnWidth, btnHeight);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '24px Arial';
      ctx.fillText('下一关', gameWidth / 2, btnY + btnHeight / 2 + 8);
    }
  }
  
  if (state === 'gameComplete') {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, gameWidth, gameHeight);
    
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 56px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('恭喜通关!', gameWidth / 2, gameHeight * 0.25);
    
    const minutes = Math.floor(totalTime / 60);
    const seconds = totalTime % 60;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '32px Arial';
    ctx.fillText('总耗时: ' + minutes + '分' + seconds + '秒', gameWidth / 2, gameHeight * 0.4);
    
    ctx.fillStyle = '#4ECDC4';
    ctx.font = 'bold 36px Arial';
    ctx.fillText('排行榜', gameWidth / 2, gameHeight * 0.52);
    
    const leaderboard = getLeaderboard();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '24px Arial';
    for (let i = 0; i < Math.min(5, leaderboard.length); i++) {
      const mins = Math.floor(leaderboard[i].time / 60);
      const secs = leaderboard[i].time % 60;
      ctx.fillText((i + 1) + '. ' + mins + '分' + secs + '秒', gameWidth / 2, gameHeight * 0.60 + i * 35);
    }
    
    const btnImg = imageCache['images/Button_002.png'];
    const btnOverlayImg = imageCache['images/Button_003.png'];
    
    let btnWidth, btnHeight;
    if (btnImg && btnImg.width > 0) {
      btnWidth = btnImg.width;
      btnHeight = btnImg.height;
    } else {
      btnWidth = 200;
      btnHeight = 60;
    }
    const btnX = gameWidth / 2 - btnWidth / 2;
    const btnY = gameHeight * 0.85 - btnHeight / 2;
    
    if (btnImg && btnImg.width > 0) {
      ctx.drawImage(btnImg, btnX, btnY, btnWidth, btnHeight);
      
      if (btnOverlayImg && btnOverlayImg.width > 0) {
        ctx.save();
        ctx.translate(gameWidth / 2, btnY + btnHeight / 2);
        ctx.rotate(idleRotation);
        ctx.drawImage(btnOverlayImg, -btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
        ctx.restore();
      }
      
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText('再来一局', gameWidth / 2, btnY + btnHeight / 2 + 8);
    } else {
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(btnX, btnY, btnWidth, btnHeight);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '24px Arial';
      ctx.fillText('再来一局', gameWidth / 2, btnY + btnHeight / 2 + 8);
    }
  }
  
  if (state === 'playing') {
    drawButtons();
  }
}

function drawButtons() {
  const btnY = gameHeight - 128;
  const bgHeight = 128;
  
  const bottomBarImg = imageCache['images/Button_128.png'];
  if (bottomBarImg && bottomBarImg.width > 0) {
    const tileWidth = bottomBarImg.width * 0.8;
    const tileCount = Math.ceil(gameWidth / tileWidth) + 1;
    for (let i = 0; i < tileCount; i++) {
      ctx.drawImage(bottomBarImg, i * tileWidth, btnY, tileWidth, bgHeight);
    }
  } else {
    ctx.fillStyle = '#4ECDC4';
    ctx.fillRect(0, btnY, gameWidth, bgHeight);
  }
  
  const btnSpacing = 20;
  const totalWidth = buttons.length * 80 + (buttons.length - 1) * btnSpacing;
  const startX = (gameWidth - totalWidth) / 2;
  const btnImg = imageCache['images/Button_002.png'];
  const btnOverlayImg = imageCache['images/Button_003.png'];
  
  const now = Date.now();
  const isIdle = state === 'playing' && (now - lastInteractionTime > 3000);
  if (isIdle) {
    idleRotation += 0.02;
  } else if (state !== 'menu') {
    idleRotation = 0;
  }
  
  buttons.forEach((btn, i) => {
    btn.x = startX + i * (80 + btnSpacing);
    btn.y = btnY + (bgHeight - 40) / 2;
    
    const btnAspect = btn.width / btn.height;
    
    const btnAnim = buttonAnimations.find(a => a.index === i);
    let btnScale = 1;
    if (btnAnim) {
      btnScale = 1 + Math.sin(btnAnim.progress * Math.PI) * 0.2;
    }
    
    if (btnImg && btnImg.width > 0) {
      const imgAspect = btnImg.width / btnImg.height;
      let drawWidth, drawHeight;
      if (imgAspect > btnAspect) {
        drawHeight = btn.height;
        drawWidth = drawHeight * imgAspect;
      } else {
        drawWidth = btn.width;
        drawHeight = drawWidth / imgAspect;
      }
      const drawX = btn.x + (btn.width - drawWidth) / 2;
      const drawY = btn.y + (btn.height - drawHeight) / 2;
      
      let filterStr = '';
      if (i === 0) {
        filterStr = 'saturate(0) brightness(1.7)';
      } else if (i === 2) {
        filterStr = 'saturate(0) brightness(0.61)';
      }
      
      ctx.save();
      ctx.translate(btn.x + btn.width / 2, btn.y + btn.height / 2);
      ctx.scale(btnScale, btnScale);
      ctx.translate(-(btn.x + btn.width / 2), -(btn.y + btn.height / 2));
      
      if (filterStr) {
        ctx.save();
        ctx.filter = filterStr;
        ctx.drawImage(btnImg, drawX, drawY, drawWidth, drawHeight);
        ctx.restore();
      } else {
        ctx.drawImage(btnImg, drawX, drawY, drawWidth, drawHeight);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
    }
    
    if (btnOverlayImg && btnOverlayImg.width > 0) {
      const overlayAspect = btnOverlayImg.width / btnOverlayImg.height;
      let overlayWidth, overlayHeight;
      if (overlayAspect > btnAspect) {
        overlayHeight = btn.height;
        overlayWidth = overlayHeight * overlayAspect;
      } else {
        overlayWidth = btn.width;
        overlayHeight = overlayWidth / overlayAspect;
      }
      
      const btnAnim = buttonAnimations.find(a => a.index === i);
      let scale = 1;
      if (btnAnim) {
        scale = 1 + Math.sin(btnAnim.progress * Math.PI) * 0.2;
      }
      
      if (btnAnim) {
        btnAnim.progress -= 0.05;
        if (btnAnim.progress <= 0) {
          buttonAnimations = buttonAnimations.filter(a => a.index !== i);
        }
      }
      
      ctx.save();
      ctx.translate(btn.x + btn.width / 2, btn.y + btn.height / 2);
      ctx.scale(scale, scale);
      ctx.rotate(idleRotation);
      ctx.drawImage(btnOverlayImg, -overlayWidth / 2, -overlayHeight / 2, overlayWidth, overlayHeight);
      ctx.restore();
    }
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 21px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(btn.label, btn.x + btn.width / 2, btn.y + btn.height / 2 + 6);
  });
}

function renderCollection() {
  ctx.fillStyle = '#fae8de';
  ctx.fillRect(0, 0, gameWidth, gameHeight / 2);
  ctx.fillStyle = '#def3ca';
  ctx.fillRect(0, gameHeight / 2, gameWidth, gameHeight / 2);
  
  ctx.fillStyle = '#9b8169';
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('寿司图鉴', gameWidth / 2, 70);
  
  const collectedCount = gemCollection.filter(g => g.collected).length;
  ctx.fillStyle = '#888888';
  ctx.font = '20px Arial';
  ctx.fillText(`已收集: ${collectedCount} / ${TOTAL_GEMS}`, gameWidth / 2, 110);
  
  const cols = 3;
  const cellWidth = gameWidth / cols;
  const cellHeight = 120;
  const startY = 130;
  const imgSize = 70;
  
  for (let i = 0; i < TOTAL_GEMS; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cellWidth + cellWidth / 2;
    const y = startY + row * cellHeight + cellHeight / 2;
    
    if (gemCollection[i].collected) {
      const imgSrc = getGemImageSrc(i);
      const img = imageCache[imgSrc];
      
      let drawSize = imgSize;
      for (const anim of collectionAnimations) {
        if (anim.index === i) {
          const progress = 1 - (anim.time / 300);
          drawSize = imgSize * (1 + Math.sin(progress * Math.PI) * 0.2);
          break;
        }
      }
      
      if (img && img.width > 0) {
        ctx.drawImage(img, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
      } else {
        ctx.fillStyle = COLORS[i];
        ctx.beginPath();
        ctx.arc(x, y, drawSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#333333';
      ctx.beginPath();
      ctx.arc(x, y, imgSize / 2, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#666666';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('?', x, y + 8);
    }
  }
  
  const btnImg = imageCache['images/Button_002.png'];
  const btnOverlayImg = imageCache['images/Button_003.png'];
  const backBtnY = gameHeight - 200;
  
  if (btnImg && btnImg.width > 0) {
    const btnWidth = btnImg.width;
    const btnHeight = btnImg.height;
    const btnX = gameWidth / 2 - btnWidth / 2;
    ctx.drawImage(btnImg, btnX, backBtnY);
    
    if (btnOverlayImg && btnOverlayImg.width > 0) {
      ctx.save();
      ctx.translate(gameWidth / 2, backBtnY + btnHeight / 2);
      ctx.rotate(idleRotation);
      ctx.drawImage(btnOverlayImg, -btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
      ctx.restore();
    }
    
    ctx.font = '18px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText('返回', gameWidth / 2, backBtnY + btnHeight / 2 + 6);
  } else {
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(gameWidth / 2 - 60, gameHeight - 50, 120, 40);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    if (fromPlaying) {
      ctx.fillText('回到游戏', gameWidth / 2, gameHeight - 22);
    } else {
      ctx.fillText('返回', gameWidth / 2, gameHeight - 22);
    }
  }
}

let lastTime = 0;
let collectionAnimations = [];

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

preloadImages();
loadLeaderboard();
loadLevelLeaderboard();
loadGemCollection();

function findHint() {
  for (let row = 0; row < GRID_ROWS; row++) {
    if (!board[row]) continue;
    for (let col = 0; col < GRID_COLS; col++) {
      if (!board[row][col] || board[row][col].type < 0) continue;
      
      if (col < GRID_COLS - 1 && board[row][col + 1] && board[row][col + 1].type >= 0) {
        const temp = board[row][col].type;
        board[row][col].type = board[row][col + 1].type;
        board[row][col + 1].type = temp;
        
        if (findAllMatches().length > 0) {
          board[row][col + 1].type = board[row][col].type;
          board[row][col].type = temp;
          return { t1: { row, col }, t2: { row, col: col + 1 } };
        }
        
        board[row][col + 1].type = board[row][col].type;
        board[row][col].type = temp;
      }
      
      if (row < GRID_ROWS - 1 && board[row + 1] && board[row + 1][col] && board[row + 1][col].type >= 0) {
        const temp = board[row][col].type;
        board[row][col].type = board[row + 1][col].type;
        board[row + 1][col].type = temp;
        
        if (findAllMatches().length > 0) {
          board[row + 1][col].type = board[row][col].type;
          board[row][col].type = temp;
          return { t1: { row, col }, t2: { row: row + 1, col } };
        }
        
        board[row + 1][col].type = board[row][col].type;
        board[row][col].type = temp;
      }
    }
  }
  return null;
}

function doHint() {
  if (isAnimating) return;
  const hint = findHint();
  if (hint) {
    hintAnimation = {
      t1: hint.t1,
      t2: hint.t2,
      time: 0,
      duration: 2000
    };
  }
}

function doShuffle() {
  if (isAnimating) return;
  
  const gemTypesForLevel = Math.min(5 + Math.floor((level - 1) / 5), TOTAL_GEMS);
  
  for (let row = 0; row < GRID_ROWS; row++) {
    if (!board[row]) continue;
    for (let col = 0; col < GRID_COLS; col++) {
      if (board[row][col] && board[row][col].type >= 0) {
        board[row][col].type = Math.floor(Math.random() * gemTypesForLevel);
      }
    }
  }
  
  isAnimating = true;
  
  const matches = findAllMatches();
  if (matches.length > 0) {
    processMatches(matches);
  } else {
    setTimeout(() => { isAnimating = false; }, 300);
  }
}

function doClear() {
  if (!selectedTile || isAnimating) return;
  
  const selectedType = board[selectedTile.row][selectedTile.col].type;
  if (selectedType < 0) return;
  
  const matches = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    if (!board[row]) continue;
    for (let col = 0; col < GRID_COLS; col++) {
      if (board[row][col] && board[row][col].type === selectedType) {
        matches.push({ row, col, special: SPECIAL_NONE });
      }
    }
  }
  
  if (matches.length >= 3) {
    isAnimating = true;
    processMatches(matches);
    clearSelection();
  }
}

function handleButtonClick(btnId) {
  const btnIndex = buttons.findIndex(b => b.id === btnId);
  if (btnIndex >= 0) {
    buttonAnimations.push({ index: btnIndex, progress: 1 });
  }
  
  if (btnId === 'hint') {
    doHint();
  } else if (btnId === 'shuffle') {
    doShuffle();
  } else if (btnId === 'clear') {
    doClear();
  } else if (btnId === 'book') {
    fromPlaying = state === 'playing';
    state = 'collection';
  }
}

wx.onTouchStart((res) => {
  const touch = res.touches[0];
  const x = touch.clientX;
  const y = touch.clientY;
  
  if (state === 'loading') return;
  
  if (state === 'playing') {
    lastInteractionTime = Date.now();
    idleRotation = 0;
  }
  
  if (state === 'playing' && !isAnimating) {
    const tile = getTileAt(x, y);
    if (tile) {
      touchStartTile = tile;
      touchStartPos = { x, y };
    } else {
      handleTap(x, y);
    }
  } else {
    handleTap(x, y);
  }
});

wx.onTouchMove((res) => {
  if (!touchStartTile || !touchStartPos) return;
  
  const touch = res.touches[0];
  const dx = touch.clientX - touchStartPos.x;
  const dy = touch.clientY - touchStartPos.y;
  
  if (Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(dy) > SWIPE_THRESHOLD) {
    let targetTile = null;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0 && touchStartTile.col < GRID_COLS - 1) {
        targetTile = { row: touchStartTile.row, col: touchStartTile.col + 1 };
      } else if (dx < 0 && touchStartTile.col > 0) {
        targetTile = { row: touchStartTile.row, col: touchStartTile.col - 1 };
      }
    } else {
      if (dy > 0 && touchStartTile.row < GRID_ROWS - 1) {
        targetTile = { row: touchStartTile.row + 1, col: touchStartTile.col };
      } else if (dy < 0 && touchStartTile.row > 0) {
        targetTile = { row: touchStartTile.row - 1, col: touchStartTile.col };
      }
    }
    
    if (targetTile) {
      swapTiles(touchStartTile, targetTile);
      touchStartTile = null;
      touchStartPos = null;
    }
  }
});

wx.onTouchEnd((res) => {
  if (touchStartTile && touchStartPos) {
    const touch = res.changedTouches[0];
    const dx = touch.clientX - touchStartPos.x;
    const dy = touch.clientY - touchStartPos.y;
    
    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) {
      handleTap(touch.clientX, touch.clientY);
    }
  }
  
  touchStartTile = null;
  touchStartPos = null;
});

gameLoop(0);
