const GameGlobal = global;

if (typeof Image === 'undefined') {
  global.Image = function() {
    const img = wx.createOffscreenCanvas ? wx.createOffscreenCanvas().getContext('2d').canvas : {};
    img.onload = null;
    img.onerror = null;
    img.src = '';
    return img;
  };
}

function getCanvasWidth() {
  return GameGlobal.canvasWidth || (typeof canvas !== 'undefined' ? canvas.width : 375);
}

function getCanvasHeight() {
  return GameGlobal.canvasHeight || (typeof canvas !== 'undefined' ? canvas.height : 667);
}

export default class Game {
  constructor() {
    console.log('Game constructor called');
    
    this.state = 'menu';
    GameGlobal.game = this;
    this.score = 0;
    this.level = 1;
    this.timeLeft = 60;
    this.board = null;
    this.selectedTile = null;
    this.isAnimating = false;
    this.hintTiles = null;
    this.hintBlinkTime = 0;
    this.bombAnimTiles = null;
    this.bombAnimTime = 0;
    
    this.gridRows = 8;
    this.gridCols = 6;
    
    this.levels = [
      { gemTypes: 4, targetScore: 500, time: 60 },
      { gemTypes: 4, targetScore: 800, time: 60 },
      { gemTypes: 5, targetScore: 1200, time: 55 },
      { gemTypes: 5, targetScore: 1600, time: 55 },
      { gemTypes: 6, targetScore: 2000, time: 50 },
      { gemTypes: 6, targetScore: 2500, time: 50 },
      { gemTypes: 7, targetScore: 3000, time: 45 },
      { gemTypes: 7, targetScore: 3500, time: 45 },
      { gemTypes: 7, targetScore: 4000, time: 40 },
      { gemTypes: 7, targetScore: 5000, time: 40 }
    ];
    
    this.colors = [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#96CEB4',
      '#FFEAA7',
      '#DDA0DD',
      '#FF8C00'
    ];
    
    this.specialColors = {
      100: '#FFFFFF',
      101: '#FF0000',
      102: '#FFD700'
    };
    
    this.tileImages = [];
    this.specialTileImages = {};
    this.bgImage = null;
    this.loadImagesDelayed();
    
    this.highScores = this.loadHighScores();
    
    this.hintCount = 1;
    this.shuffleCount = 1;
    this.bannerAd = null;
    this.adLoaded = false;
    this.adShowing = false;
    
    this.calculateBoardMetrics();
    this.init();
    console.log('Game initialized, state:', this.state);
  }
  
  calculateBoardMetrics() {
    const w = getCanvasWidth();
    const h = getCanvasHeight();
    this.tileSize = Math.min(w * 0.16, (h * 0.65) / 8);
    this.boardOffsetX = (w - this.tileSize * this.gridCols) / 2;
    this.boardOffsetY = h * 0.12;
    
    const btnWidth = Math.min(120, w * 0.3);
    const btnHeight = 45;
    const btnY = h - 80;
    const btnGap = 20;
    
    this.hintBtn = {
      x: w / 2 - btnWidth - btnGap / 2,
      y: btnY,
      width: btnWidth,
      height: btnHeight,
      label: '提示'
    };
    
    this.shuffleBtn = {
      x: w / 2 + btnGap / 2,
      y: btnY,
      width: btnWidth,
      height: btnHeight,
      label: '打乱'
    };
    
    console.log('Board metrics:', this.tileSize, this.boardOffsetX, this.boardOffsetY);
  }
  
  loadImages() {
    for (let i = 0; i < 7; i++) {
      this.tileImages[i] = { src: 'images/gem' + i + '.png', complete: false };
    }
    
    this.specialTileImages[100] = { src: 'images/bomb.png', complete: false };
    this.specialTileImages[101] = { src: 'images/question.png', complete: false };
    this.specialTileImages[102] = { src: 'images/universal.png', complete: false };
    this.bgImage = { src: 'images/bg.jpg', complete: false };
    this.topBarImage = { src: 'images/GameScoreTop.png', complete: false };
  }
  
  loadImagesDelayed() {
    const cache = GameGlobal.imageCache || {};
    for (let i = 0; i < 7; i++) {
      const src = 'images/gem' + i + '.png';
      this.tileImages[i] = cache[src] || { src: src, complete: false };
    }
    
    this.specialTileImages[100] = cache['images/bomb.png'] || { src: 'images/bomb.png', complete: false };
    this.specialTileImages[101] = cache['images/question.png'] || { src: 'images/question.png', complete: false };
    this.specialTileImages[102] = cache['images/universal.png'] || { src: 'images/universal.png', complete: false };
    this.bgImage = cache['images/bg.jpg'] || { src: 'images/bg.jpg', complete: false };
    this.topBarImage = cache['images/GameScoreTop.png'] || { src: 'images/GameScoreTop.png', complete: false };
  }
  
  init() {
    this.createBoard();
    this.setupEventListeners();
  }
  
  createBoard() {
    console.log('Creating board...');
    this.board = [];
    for (let row = 0; row < this.gridRows; row++) {
      this.board[row] = [];
      for (let col = 0; col < this.gridCols; col++) {
        this.board[row][col] = this.createRandomTile(row, col);
      }
    }
    console.log('Board created');
  }
  
  createRandomTile(row, col) {
    let type;
    let attempts = 0;
    const numTypes = this.gemTypes || 4;
    
    do {
      type = Math.floor(Math.random() * numTypes);
      attempts++;
    } while (attempts < 50 && this.wouldMatch(row, col, type));
    
    return {
      type: type,
      row: row,
      col: col,
      x: this.boardOffsetX + col * this.tileSize,
      y: this.boardOffsetY + row * this.tileSize,
      scale: 1,
      alpha: 1,
      state: 'idle'
    };
  }
  
  wouldMatch(row, col, type) {
    if (col >= 2) {
      if (this.board[row][col - 1] && this.board[row][col - 2] &&
          this.board[row][col - 1].type === type && 
          this.board[row][col - 2].type === type) {
        return true;
      }
    }
    
    if (row >= 2) {
      if (this.board[row - 1] && this.board[row - 2] &&
          this.board[row - 1][col] && this.board[row - 2][col] &&
          this.board[row - 1][col].type === type && 
          this.board[row - 2][col].type === type) {
        return true;
      }
    }
    
    return false;
  }
  
  createTile(row, col, type) {
    return {
      type: type,
      row: row,
      col: col,
      x: this.boardOffsetX + col * this.tileSize,
      y: this.boardOffsetY + row * this.tileSize,
      scale: 1,
      alpha: 1,
      state: 'idle'
    };
  }
  
  setupEventListeners() {
  }
  
  getTouchPos(res) {
    const touch = res.touches[0];
    return {
      x: touch.clientX,
      y: touch.clientY
    };
  }
  
  async handleInput(x, y) {
    if (this.state === 'levelComplete') {
      if (this.level < 10) {
        this.level++;
        await this.start();
      } else {
        this.level = 1;
        this.start();
      }
      return;
    }
    
    if (this.state === 'playing' && !this.isAnimating) {
      if (this.hintBtn && x >= this.hintBtn.x && x <= this.hintBtn.x + this.hintBtn.width &&
          y >= this.hintBtn.y && y <= this.hintBtn.y + this.hintBtn.height) {
        if (this.hintCount > 0) {
          this.hintCount--;
          this.showHintAd();
        } else {
          this.showRewardedAd('hint');
        }
        return;
      }
      
      if (this.shuffleBtn && x >= this.shuffleBtn.x && x <= this.shuffleBtn.x + this.shuffleBtn.width &&
          y >= this.shuffleBtn.y && y <= this.shuffleBtn.y + this.shuffleBtn.height) {
        if (this.shuffleCount > 0) {
          this.shuffleCount--;
          this.shuffleBoard();
        } else {
          this.showRewardedAd('shuffle');
        }
        return;
      }
    }
    
    if (this.state !== 'playing' || this.isAnimating) return;
    
    const col = Math.floor((x - this.boardOffsetX) / this.tileSize);
    const row = Math.floor((y - this.boardOffsetY) / this.tileSize);
    
    if (row < 0 || row >= this.gridRows || col < 0 || col >= this.gridCols) return;
    
    const clickedTile = this.board[row][col];
    if (!clickedTile) return;
    
    if (clickedTile.type === 100) {
      const toRemove = [{row, col}];
      if (row > 0) toRemove.push({row: row - 1, col});
      if (row < this.gridRows - 1) toRemove.push({row: row + 1, col});
      if (col > 0) toRemove.push({row, col: col - 1});
      if (col < this.gridCols - 1) toRemove.push({row, col: col + 1});
      
      this.bombAnimTiles = toRemove;
      this.bombAnimTime = 1000;
      this.isAnimating = true;
      
      await new Promise(r => setTimeout(r, 1000));
      
      toRemove.forEach(p => {
        if (this.board[p.row] && this.board[p.row][p.col]) {
          this.score += 10;
          this.board[p.row][p.col] = null;
        }
      });
      
      this.bombAnimTiles = null;
      
      for (let r = 0; r < this.gridRows; r++) {
        for (let c = 0; c < this.gridCols; c++) {
          if (this.board[r][c]) {
            this.board[r][c].scale = 1;
          }
        }
      }
      
      await this.dropTiles();
      await this.fillBoard();
      this.isAnimating = false;
      
      const matches = this.findAllMatches();
      if (matches.length > 0) {
        await this.processMatches();
      }
      return;
    }
    
    if (clickedTile.type === 101) {
      this.score += 20;
      const toRemove = [];
      for (let c = 0; c < this.gridCols; c++) {
        if (this.board[row][c]) toRemove.push({row, col: c});
      }
      for (let r = 0; r < this.gridRows; r++) {
        if (this.board[r][col]) toRemove.push({row: r, col});
      }
      
      this.bombAnimTiles = toRemove;
      this.bombAnimTime = 1000;
      this.isAnimating = true;
      
      await new Promise(r => setTimeout(r, 1000));
      
      toRemove.forEach(p => {
        this.board[p.row][p.col] = null;
      });
      
      this.bombAnimTiles = null;
      for (let r = 0; r < this.gridRows; r++) {
        for (let c = 0; c < this.gridCols; c++) {
          if (this.board[r][c]) {
            this.board[r][c].scale = 1;
          }
        }
      }
      
      await this.dropTiles();
      await this.fillBoard();
      this.isAnimating = false;
      
      const matches = this.findAllMatches();
      if (matches.length > 0) {
        await this.processMatches();
      }
      return;
    }
    
    if (clickedTile.type === 102) {
      return;
    }
    
    if (!this.selectedTile) {
      this.selectedTile = {row, col};
      this.board[row][col].state = 'selected';
      return;
    } else {
      const prevRow = this.selectedTile.row;
      const prevCol = this.selectedTile.col;
      
      this.board[prevRow][prevCol].state = 'idle';
      
      const isAdjacent = (Math.abs(row - prevRow) === 1 && col === prevCol) ||
                         (Math.abs(col - prevCol) === 1 && row === prevRow);
      
      if (isAdjacent) {
        this.swapTiles(prevRow, prevCol, row, col);
      }
      
      this.selectedTile = null;
    }
  }
  
  async processSpecialMatch() {
    await this.dropTiles();
    await this.fillBoard();
    
    const matches = this.findAllMatches();
    if (matches.length > 0) {
      await this.processMatches();
    }
    
    this.isAnimating = false;
  }
  
  findValidMove() {
    for (let row = 0; row < this.gridRows; row++) {
      for (let col = 0; col < this.gridCols; col++) {
        if (col < this.gridCols - 1) {
          this.swapInBoard(row, col, row, col + 1);
          if (this.findAllMatches().length > 0) {
            this.swapInBoard(row, col, row, col + 1);
            return { row1: row, col1: col, row2: row, col2: col + 1 };
          }
          this.swapInBoard(row, col, row, col + 1);
        }
        
        if (row < this.gridRows - 1) {
          this.swapInBoard(row, col, row + 1, col);
          if (this.findAllMatches().length > 0) {
            this.swapInBoard(row, col, row + 1, col);
            return { row1: row, col1: col, row2: row + 1, col2: col };
          }
          this.swapInBoard(row, col, row + 1, col);
        }
      }
    }
    return null;
  }
  
  swapInBoard(row1, col1, row2, col2) {
    const temp = this.board[row1][col1];
    this.board[row1][col1] = this.board[row2][col2];
    this.board[row2][col2] = temp;
  }
  
  showHint() {
    this.selectedTile = null;
    this.doShowHint();
  }
  
  doShowHint() {
    const move = this.findValidMove();
    if (move) {
      this.hintTiles = [
        { row: move.row1, col: move.col1 },
        { row: move.row2, col: move.col2 }
      ];
      this.hintBlinkTime = 1500;
      this.isAnimating = false;
    } else {
      this.doShuffleBoard();
    }
  }
  
  shuffleBoard() {
    this.selectedTile = null;
    this.doShuffleBoard();
  }
  
  doShuffleBoard() {
    this.isAnimating = true;
    const tiles = [];
    for (let row = 0; row < this.gridRows; row++) {
      for (let col = 0; col < this.gridCols; col++) {
        if (this.board[row][col]) {
          tiles.push(this.board[row][col].type);
          this.board[row][col] = null;
        }
      }
    }
    
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    
    let idx = 0;
    for (let row = 0; row < this.gridRows; row++) {
      for (let col = 0; col < this.gridCols; col++) {
        this.board[row][col] = this.createTile(row, col, tiles[idx++]);
      }
    }
    
    const matches = this.findAllMatches();
    if (matches.length > 0) {
      this.processMatches();
    } else {
      this.isAnimating = false;
    }
    
    setTimeout(() => {
      this.isAnimating = false;
    }, 1000);
  }
  
  async swapTiles(row1, col1, row2, col2) {
    this.isAnimating = true;
    
    const tile1 = this.board[row1][col1];
    const tile2 = this.board[row2][col2];
    
    const temp = this.board[row1][col1];
    this.board[row1][col1] = this.board[row2][col2];
    this.board[row2][col2] = temp;
    
    this.board[row1][col1].row = row1;
    this.board[row1][col1].col = col1;
    this.board[row2][col2].row = row2;
    this.board[row2][col2].col = col2;
    
    await this.animateSwap(row1, col1, row2, col2);
    
    const matches = this.findAllMatches();
    
    if (matches.length === 0) {
      const temp2 = this.board[row1][col1];
      this.board[row1][col1] = this.board[row2][col2];
      this.board[row2][col2] = temp2;
      
      this.board[row1][col1].row = row1;
      this.board[row1][col1].col = col1;
      this.board[row2][col2].row = row2;
      this.board[row2][col2].col = col2;
      
      await this.animateSwap(row1, col1, row2, col2);
      this.isAnimating = false;
    } else {
      await this.processMatches();
    }
  }
  
  animateSwap(row1, col1, row2, col2) {
    return new Promise(resolve => {
      const tile1 = this.board[row1][col1];
      const tile2 = this.board[row2][col2];
      
      const startX1 = tile1.x, startY1 = tile1.y;
      const startX2 = tile2.x, startY2 = tile2.y;
      const targetX1 = this.boardOffsetX + col1 * this.tileSize;
      const targetY1 = this.boardOffsetY + row1 * this.tileSize;
      const targetX2 = this.boardOffsetX + col2 * this.tileSize;
      const targetY2 = this.boardOffsetY + row2 * this.tileSize;
      
      const duration = 150;
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        tile1.x = startX1 + (targetX1 - startX1) * progress;
        tile1.y = startY1 + (targetY1 - startY1) * progress;
        tile2.x = startX2 + (targetX2 - startX2) * progress;
        tile2.y = startY2 + (targetY2 - startY2) * progress;
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      
      animate();
    });
  }
  
  findMatchesAt(row, col) {
    const tile = this.board[row][col];
    if (!tile) return [];
    
    const type = tile.type;
    const hMatch = [{row, col}];
    const vMatch = [{row, col}];
    
    for (let c = col - 1; c >= 0 && this.board[row][c]?.type === type; c--) {
      hMatch.unshift({row, col: c});
    }
    for (let c = col + 1; c < this.gridCols && this.board[row][c]?.type === type; c++) {
      hMatch.push({row, col: c});
    }
    
    for (let r = row - 1; r >= 0 && this.board[r]?.[col]?.type === type; r--) {
      vMatch.unshift({row: r, col});
    }
    for (let r = row + 1; r < this.gridRows && this.board[r]?.[col]?.type === type; r++) {
      vMatch.push({row: r, col});
    }
    
    const all = [];
    if (hMatch.length >= 3) all.push(...hMatch);
    if (vMatch.length >= 3) vMatch.forEach(m => {
      if (!all.some(am => am.row === m.row && am.col === m.col)) all.push(m);
    });
    
    return all;
  }
  
  findMatchFromPos(row, col) {
    const tile = this.board[row][col];
    if (!tile) return null;
    
    const colorCounts = {};
    
    let c = col - 1;
    while (c >= 0 && this.board[row][c]) {
      const t = this.board[row][c].type;
      if (t < 100) {
        colorCounts[t] = (colorCounts[t] || 0) + 1;
      }
      c--;
    }
    c = col + 1;
    while (c < this.gridCols && this.board[row][c]) {
      const t = this.board[row][c].type;
      if (t < 100) {
        colorCounts[t] = (colorCounts[t] || 0) + 1;
      }
      c++;
    }
    
    let r = row - 1;
    while (r >= 0 && this.board[r] && this.board[r][col]) {
      const t = this.board[r][col].type;
      if (t < 100) {
        colorCounts[t] = (colorCounts[t] || 0) + 1;
      }
      r--;
    }
    r = row + 1;
    while (r < this.gridRows && this.board[r] && this.board[r][col]) {
      const t = this.board[r][col].type;
      if (t < 100) {
        colorCounts[t] = (colorCounts[t] || 0) + 1;
      }
      r++;
    }
    
    let maxCount = 0;
    let bestColor = 0;
    for (const color in colorCounts) {
      if (colorCounts[color] >= 2 && colorCounts[color] > maxCount) {
        maxCount = colorCounts[color];
        bestColor = parseInt(color);
      }
    }
    
    if (maxCount >= 2) {
      return { colorType: bestColor };
    }
    
    return null;
  }
  
  findAllMatches() {
    const matchedTiles = new Map();
    
    for (let row = 0; row < this.gridRows; row++) {
      let col = 0;
      while (col < this.gridCols) {
        const tile = this.board[row][col];
        if (!tile) {
          col++;
          continue;
        }
        
        let matchLen = 1;
        while (col + matchLen < this.gridCols && 
               this.board[row][col + matchLen] && 
               this.board[row][col + matchLen].type === tile.type) {
          matchLen++;
        }
        
        if (matchLen >= 3) {
          const centerCol = col + Math.floor(matchLen / 2);
          for (let i = 0; i < matchLen; i++) {
            const key = `${row},${col + i}`;
            if (!matchedTiles.has(key)) {
              matchedTiles.set(key, { 
                row, 
                col: col + i, 
                isCenter: (col + i) === centerCol,
                matchLen 
              });
            } else if ((col + i) === centerCol) {
              const existing = matchedTiles.get(key);
              existing.isCenter = true;
            }
          }
        }
        col += matchLen;
      }
    }
    
    for (let col = 0; col < this.gridCols; col++) {
      let row = 0;
      while (row < this.gridRows) {
        const tile = this.board[row][col];
        if (!tile) {
          row++;
          continue;
        }
        
        let matchLen = 1;
        while (row + matchLen < this.gridRows && 
               this.board[row + matchLen]?.[col] && 
               this.board[row + matchLen][col].type === tile.type) {
          matchLen++;
        }
        
        if (matchLen >= 3) {
          const centerRow = row + Math.floor(matchLen / 2);
          for (let i = 0; i < matchLen; i++) {
            const key = `${row + i},${col}`;
            if (!matchedTiles.has(key)) {
              matchedTiles.set(key, { 
                row: row + i, 
                col, 
                isCenter: (row + i) === centerRow,
                matchLen 
              });
            } else if ((row + i) === centerRow) {
              const existing = matchedTiles.get(key);
              existing.isCenter = true;
            }
          }
        }
        row += matchLen;
      }
    }
    
    const horizontalMatches = new Map();
    for (let row = 0; row < this.gridRows; row++) {
      let col = 0;
      while (col < this.gridCols) {
        const tile = this.board[row][col];
        if (!tile) { col++; continue; }
        
        let matchLen = 1;
        while (col + matchLen < this.gridCols && 
               this.board[row][col + matchLen] && 
               this.board[row][col + matchLen].type === tile.type) {
          matchLen++;
        }
        
        if (matchLen >= 3) {
          const centerCol = col + Math.floor(matchLen / 2);
          for (let i = 0; i < matchLen; i++) {
            const key = `${row},${col + i}`;
            horizontalMatches.set(key, { row, col: col + i, centerCol, matchLen });
          }
        }
        col += matchLen;
      }
    }
    
    const verticalMatches = new Map();
    for (let col = 0; col < this.gridCols; col++) {
      let row = 0;
      while (row < this.gridRows) {
        const tile = this.board[row][col];
        if (!tile) { row++; continue; }
        
        let matchLen = 1;
        while (row + matchLen < this.gridRows && 
               this.board[row + matchLen]?.[col] && 
               this.board[row + matchLen][col].type === tile.type) {
          matchLen++;
        }
        
        if (matchLen >= 3) {
          const centerRow = row + Math.floor(matchLen / 2);
          for (let i = 0; i < matchLen; i++) {
            const key = `${row + i},${col}`;
            verticalMatches.set(key, { row: row + i, col, centerRow, matchLen });
          }
        }
        row += matchLen;
      }
    }
    
    const simpleMatchedTiles = new Map();
    const lShapeTiles = new Map();
    
    horizontalMatches.forEach((hMatch, key) => {
      const vMatch = verticalMatches.get(key);
      if (vMatch) {
        lShapeTiles.set(key, { 
          row: hMatch.row, 
          col: hMatch.col,
          hMatchLen: hMatch.matchLen,
          vMatchLen: vMatch.matchLen
        });
      } else {
        matchedTiles.set(key, { 
          row: hMatch.row, 
          col: hMatch.col, 
          isCenter: true,
          matchLen: hMatch.matchLen 
        });
      }
    });
    
    verticalMatches.forEach((vMatch, key) => {
      if (!lShapeTiles.has(key) && !matchedTiles.has(key)) {
        matchedTiles.set(key, { 
          row: vMatch.row, 
          col: vMatch.col, 
          isCenter: true,
          matchLen: vMatch.matchLen 
        });
      }
    });
    
    const result = Array.from(matchedTiles.values());
    result.lShapeTiles = Array.from(lShapeTiles.values());
    return result;
  }
  
  async processMatches() {
    let hasMatches = true;
    
    while (hasMatches) {
      const matches = this.findAllMatches();
      
      if (matches.length === 0) {
        hasMatches = false;
        break;
      }
      
      let maxMatchLen = 0;
      let specialTilePos = null;
      let lShapeTilePos = null;
      
      matches.forEach(m => {
        this.score += 10;
        if (m.matchLen > maxMatchLen) {
          maxMatchLen = m.matchLen;
        }
        if (m.isCenter && m.matchLen >= 4) {
          specialTilePos = { row: m.row, col: m.col, matchLen: m.matchLen };
        }
      });
      
      if (matches.lShapeTiles && matches.lShapeTiles.length > 0) {
        lShapeTilePos = matches.lShapeTiles[0];
        this.score += 30;
      }
      
      if (maxMatchLen >= 4) this.score += 20;
      if (maxMatchLen >= 5) this.score += 50;
      
      await new Promise(r => setTimeout(r, 200));
      
      const toRemove = new Set();
      matches.forEach(m => toRemove.add(`${m.row},${m.col}`));
      
      if (matches.lShapeTiles) {
        matches.lShapeTiles.forEach(l => {
          const row = l.row;
          const col = l.col;
          for (let c = 0; c < this.gridCols; c++) {
            if (this.board[row][c]) toRemove.add(`${row},${c}`);
          }
          for (let r = 0; r < this.gridRows; r++) {
            if (this.board[r][col]) toRemove.add(`${r},${col}`);
          }
        });
      }
      
      const specialTiles = [];
      if (lShapeTilePos) {
        specialTiles.push({
          row: lShapeTilePos.row,
          col: lShapeTilePos.col,
          type: 100
        });
        toRemove.delete(`${lShapeTilePos.row},${lShapeTilePos.col}`);
      } else if (specialTilePos) {
        const specialType = specialTilePos.matchLen >= 5 ? 101 : 100;
        specialTiles.push({
          row: specialTilePos.row,
          col: specialTilePos.col,
          type: specialType
        });
        toRemove.delete(`${specialTilePos.row},${specialTilePos.col}`);
      }
      
      toRemove.forEach(key => {
        const [r, c] = key.split(',').map(Number);
        this.board[r][c] = null;
      });
      
      if (specialTiles.length > 0) {
        specialTiles.forEach(s => {
          this.board[s.row][s.col] = this.createTile(s.row, s.col, s.type);
        });
      }
      
      await this.dropTiles();
      await this.fillBoard();
    }
    
    this.isAnimating = false;
  }
  
  async dropTiles() {
    for (let col = 0; col < this.gridCols; col++) {
      let empty = this.gridRows - 1;
      for (let row = this.gridRows - 1; row >= 0; row--) {
        if (this.board[row][col]) {
          if (row !== empty) {
            this.board[empty][col] = this.board[row][col];
            this.board[empty][col].row = empty;
            this.board[empty][col].y = this.boardOffsetY + empty * this.tileSize;
            this.board[row][col] = null;
          }
          empty--;
        }
      }
    }
    await new Promise(r => setTimeout(r, 150));
  }
  
  async fillBoard() {
    for (let col = 0; col < this.gridCols; col++) {
      for (let row = 0; row < this.gridRows; row++) {
        if (!this.board[row][col]) {
          const tile = this.createRandomTile(row, col);
          tile.y = this.boardOffsetY - this.tileSize * (this.gridRows - row);
          this.board[row][col] = tile;
        }
      }
    }
    await this.animateDrop();
  }
  
  async animateDrop() {
    const duration = 200;
    const startTime = Date.now();
    const startPositions = [];
    
    for (let row = 0; row < this.gridRows; row++) {
      for (let col = 0; col < this.gridCols; col++) {
        const tile = this.board[row][col];
        if (tile) {
          startPositions.push({
            tile: tile,
            startY: tile.y,
            targetY: this.boardOffsetY + row * this.tileSize
          });
        }
      }
    }
    
    return new Promise(resolve => {
      function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        startPositions.forEach(p => {
          p.tile.y = p.startY + (p.targetY - p.startY) * progress;
        });
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          startPositions.forEach(p => {
            p.tile.y = p.targetY;
          });
          resolve();
        }
      }
      animate();
    });
  }
  
  async start() {
    console.log('Game start called');
    this.calculateBoardMetrics();
    this.state = 'playing';
    this.score = 0;
    const levelConfig = this.levels[this.level - 1];
    this.timeLeft = levelConfig.time;
    this.targetScore = levelConfig.targetScore;
    this.gemTypes = levelConfig.gemTypes;
    this.selectedTile = null;
    this.isAnimating = false;
    this.hintCount = 1;
    this.shuffleCount = 1;
    this.createBannerAd();
    this.createBoard();
    
    const matches = this.findAllMatches();
    if (matches.length > 0) {
      await this.processMatches();
    }
  }
  
  createBannerAd() {
    // Banner ad disabled - add your adUnitId from WeChat MP dashboard
    // if (this.bannerAd) return;
    // try {
    //   this.bannerAd = wx.createBannerAd({
    //     adUnitId: 'your_ad_unit_id_here',
    //     style: {
    //       left: 0,
    //       top: canvas.height - 100,
    //       width: canvas.width
    //     },
    //     adIntervals: 60
    //   });
    //   this.bannerAd.onLoad(() => { this.adLoaded = true; });
    //   this.bannerAd.onError((err) => { console.log('Banner ad error:', err); });
    //   this.bannerAd.show();
    // } catch (e) { console.log('Failed to create banner ad:', e); }
  }
  
  showRewardedAd(type) {
    // Rewarded video ad disabled - add your adUnitId from WeChat MP dashboard
    // Shows hint/shuffle directly without ad for now
    if (type === 'hint') {
      this.showHint();
    } else {
      this.shuffleBoard();
    }
    return;
    
    // Original ad code:
    // if (!wx.createRewardedVideoAd) { ... }
  }
  
  showHintAd() {
    this.showHint();
  }
  
  update(dt) {
    if (this.state !== 'playing') return;
    
    if (!this.isAnimating) {
      this.timeLeft -= dt / 1000;
      
      if (this.score >= this.targetScore) {
        this.state = 'levelComplete';
      } else if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.saveScore(this.score);
        this.state = 'gameover';
      }
    }
    
    if (this.hintTiles && this.hintBlinkTime > 0) {
      this.hintBlinkTime -= dt;
      if (this.hintBlinkTime <= 0) {
        this.hintTiles = null;
      }
    }
  }
  
  render() {
    const ctx = GameGlobal.ctx || canvas.getContext('2d');
    if (!ctx) {
      console.log('No context');
      return;
    }
    
    const w = getCanvasWidth();
    const h = getCanvasHeight();
    
    if (this.bgImage) {
      const img = this.bgImage.src ? this.bgImage : GameGlobal.imageCache ? GameGlobal.imageCache[this.bgImage.src] : null;
      if (img && img.complete) {
        ctx.drawImage(img, 0, 0, w, h);
      } else {
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, w, h);
      }
    } else {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, w, h);
    }
    
    if (this.state === 'menu') {
      this.renderMenu(ctx);
    } else if (this.state === 'playing') {
      this.renderGame(ctx);
    } else if (this.state === 'levelComplete') {
      this.renderGame(ctx);
      this.renderLevelComplete(ctx);
    } else if (this.state === 'gameover') {
      this.renderGame(ctx);
      this.renderGameOver(ctx);
    }
  }
  
  renderMenu(ctx) {
    const w = getCanvasWidth();
    const h = getCanvasHeight();
    
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('宝石消除', w / 2, h * 0.3);
    
    ctx.fillStyle = '#FFD700';
    ctx.font = '24px Arial';
    ctx.fillText('点击开始游戏', w / 2, h * 0.5);
  }
  
  renderGame(ctx) {
    const w = getCanvasWidth();
    const h = getCanvasHeight();
    if (this.topBarImage) {
      const img = this.topBarImage.src ? this.topBarImage : GameGlobal.imageCache ? GameGlobal.imageCache[this.topBarImage.src] : null;
      if (img && img.complete) {
        ctx.drawImage(img, 0, 0, w, h * 0.12);
      }
    }
    this.renderBoard(ctx);
    this.renderUI(ctx);
  }
  
  renderBoard(ctx) {
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(
      this.boardOffsetX - 5,
      this.boardOffsetY - 5,
      this.tileSize * this.gridCols + 10,
      this.tileSize * this.gridRows + 10
    );
    
    for (let row = 0; row < this.gridRows; row++) {
      for (let col = 0; col < this.gridCols; col++) {
        const tile = this.board[row]?.[col];
        if (tile) {
          this.renderTile(ctx, tile);
        }
      }
    }
  }
  
  renderTile(ctx, tile) {
    const x = tile.x + this.tileSize / 2;
    const y = tile.y + this.tileSize / 2;
    const baseSize = this.tileSize * 0.85;
    const scale = tile.scale || 1;
    const size = baseSize * scale;
    
    ctx.globalAlpha = tile.alpha;
    
    if (tile.type >= 100) {
      const tileImg = this.specialTileImages[tile.type];
      const img = tileImg && tileImg.src ? (tileImg.complete ? tileImg : (GameGlobal.imageCache ? GameGlobal.imageCache[tileImg.src] : null)) : null;
      if (img && img.complete) {
        ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
      } else {
        ctx.fillStyle = this.specialColors[tile.type] || '#FFFFFF';
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const tileImg = this.tileImages[tile.type];
      const img = tileImg && tileImg.src ? (tileImg.complete ? tileImg : (GameGlobal.imageCache ? GameGlobal.imageCache[tileImg.src] : null)) : null;
      if (img && img.complete) {
        ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
      } else {
        const color = this.colors[tile.type] || '#FFFFFF';
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    if (tile.state === 'selected') {
      const blink = Math.sin(Date.now() / 150) > 0;
      ctx.strokeStyle = blink ? '#ff9089' : '#cc7069';
      ctx.lineWidth = 3;
      ctx.strokeRect(x - size / 2 - 2, y - size / 2 - 2, size + 4, size + 4);
    }
    
    ctx.globalAlpha = 1;
  }
  
  drawStar(ctx, cx, cy, outerR, innerR) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
  
  renderUI(ctx) {
    const w = getCanvasWidth();
    const h = getCanvasHeight();
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '28px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('分数: ' + this.score + ' / ' + this.targetScore, 20, 60);
    ctx.fillText('关卡: ' + this.level, 20, 95);
    
    ctx.textAlign = 'right';
    ctx.fillStyle = this.timeLeft <= 10 ? '#ff4444' : '#ffffff';
    ctx.fillText('时间: ' + Math.ceil(this.timeLeft), w - 20, 95);
    
    if (this.hintTiles) {
      this.hintTiles.forEach(hintPos => {
        const tile = this.board[hintPos.row]?.[hintPos.col];
        if (tile) {
          const x = tile.x;
          const y = tile.y;
          const blink = Math.sin(Date.now() / 100) > 0;
          
          ctx.strokeStyle = blink ? '#FFD700' : '#FFFFFF';
          ctx.lineWidth = 4;
          ctx.strokeRect(x + 2, y + 2, this.tileSize - 4, this.tileSize - 4);
        }
      });
    }
    
    if (this.bombAnimTiles && this.bombAnimTime > 0) {
      const pulse = Math.sin(Date.now() / 80);
      const centerTile = this.board[this.bombAnimTiles[0].row]?.[this.bombAnimTiles[0].col];
      const scale = 1 + pulse * 0.15;
      
      if (centerTile) {
        centerTile.scale = scale;
      }
      
      const blink = Math.sin(Date.now() / 60) > 0;
      this.bombAnimTiles.forEach(pos => {
        const tile = this.board[pos.row]?.[pos.col];
        if (tile) {
          const tx = tile.x;
          const ty = tile.y;
          
          ctx.strokeStyle = blink ? '#FF0000' : '#FFD700';
          ctx.lineWidth = 4;
          ctx.strokeRect(tx + 2, ty + 2, this.tileSize - 4, this.tileSize - 4);
        }
      });
    }
    
    if (this.hintBtn) {
      ctx.fillStyle = '#4ECDC4';
      ctx.fillRect(this.hintBtn.x, this.hintBtn.y, this.hintBtn.width, this.hintBtn.height);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(this.hintBtn.label, this.hintBtn.x + this.hintBtn.width / 2, this.hintBtn.y + this.hintBtn.height / 2 + 7);
      
      if (this.hintCount > 0) {
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('x' + this.hintCount, this.hintBtn.x + this.hintBtn.width - 15, this.hintBtn.y + 18);
      } else {
        ctx.fillStyle = '#FFEAA7';
        ctx.font = '12px Arial';
        ctx.fillText('Ad', this.hintBtn.x + this.hintBtn.width - 15, this.hintBtn.y + 18);
      }
    }
    
    if (this.shuffleBtn) {
      ctx.fillStyle = '#FF6B6B';
      ctx.fillRect(this.shuffleBtn.x, this.shuffleBtn.y, this.shuffleBtn.width, this.shuffleBtn.height);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(this.shuffleBtn.label, this.shuffleBtn.x + this.shuffleBtn.width / 2, this.shuffleBtn.y + this.shuffleBtn.height / 2 + 7);
      
      if (this.shuffleCount > 0) {
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('x' + this.shuffleCount, this.shuffleBtn.x + this.shuffleBtn.width - 15, this.shuffleBtn.y + 18);
      } else {
        ctx.fillStyle = '#FFEAA7';
        ctx.font = '12px Arial';
        ctx.fillText('Ad', this.shuffleBtn.x + this.shuffleBtn.width - 15, this.shuffleBtn.y + 18);
      }
    }
  }
  
  renderGameOver(ctx) {
    const w = getCanvasWidth();
    const h = getCanvasHeight();
    
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, w, h);
    
    ctx.fillStyle = '#FFD700';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('游戏结束！', w / 2, h * 0.2);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '32px Arial';
    ctx.fillText('最终分数: ' + this.score, w / 2, h * 0.32);
    
    ctx.fillStyle = '#FFEAA7';
    ctx.font = '28px Arial';
    ctx.fillText('🏆 排行榜', w / 2, h * 0.42);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    const scores = this.highScores;
    for (let i = 0; i < Math.min(5, scores.length); i++) {
      const y = h * 0.5 + i * 28;
      ctx.fillText(`${i + 1}. ${scores[i]}`, w / 2, y);
    }
    
    if (scores.length === 0 || this.score >= scores[scores.length - 1]) {
      ctx.fillStyle = '#4ECDC4';
      ctx.font = '24px Arial';
      ctx.fillText('新纪录！', w / 2, h * 0.7);
    }
    
    ctx.fillStyle = '#4ECDC4';
    ctx.font = '24px Arial';
    ctx.fillText('点击重新开始', w / 2, h * 0.82);
  }
  
  renderLevelComplete(ctx) {
    const w = getCanvasWidth();
    const h = getCanvasHeight();
    
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, w, h);
    
    ctx.fillStyle = '#4ECDC4';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('关卡完成！', w / 2, h * 0.3);
    
    ctx.fillStyle = '#FFD700';
    ctx.font = '32px Arial';
    ctx.fillText('分数: ' + this.score + ' / ' + this.targetScore, w / 2, h * 0.45);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Arial';
    if (this.level < 10) {
      ctx.fillText('点击进入下一关', w / 2, h * 0.6);
    } else {
      ctx.fillText('恭喜通关！', w / 2, h * 0.6);
    }
  }
  
  loadHighScores() {
    try {
      const data = wx.getStorageSync('highScores');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }
  
  saveScore(score) {
    if (!score || score <= 0) return;
    
    let scores = this.loadHighScores();
    scores.push(score);
    scores.sort((a, b) => b - a);
    scores = scores.slice(0, 10);
    
    try {
      wx.setStorageSync('highScores', JSON.stringify(scores));
    } catch (e) {
      console.log('Failed to save score');
    }
    
    this.highScores = scores;
  }
}
