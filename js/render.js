const GameGlobal = global;
GameGlobal.Image = function() {
  const img = {};
  img.onload = null;
  img.onerror = null;
  img.src = '';
  img.complete = false;
  return img;
};

let canvas;
let ctx;
const imageCache = {};

function preloadImages() {
  const images = [
    'images/gem0.png', 'images/gem1.png', 'images/gem2.png',
    'images/gem3.png', 'images/gem4.png', 'images/gem5.png', 'images/gem6.png',
    'images/bomb.png', 'images/question.png', 'images/universal.png',
    'images/bg.jpg', 'images/GameScoreTop.png'
  ];
  
  images.forEach(src => {
    wx.getImageInfo({
      src: src,
      success(res) {
        const img = new GameGlobal.Image();
        img.src = res.path;
        img.complete = true;
        imageCache[src] = img;
      },
      fail(err) {
        console.error('Failed to load image:', src, err);
      }
    });
  });
  
  GameGlobal.imageCache = imageCache;
}

function getImage(src) {
  return imageCache[src];
}

GameGlobal.getImage = getImage;

function initCanvas() {
  const query = wx.createSelectorQuery();
  query.select('#gameCanvas')
    .fields({ node: true, size: true })
    .exec((res) => {
      if (res[0]) {
        canvas = res[0];
        ctx = canvas.getContext('2d');
        
        const dpr = wx.getSystemInfoSync().pixelRatio;
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);
        
        GameGlobal.canvas = canvas;
        GameGlobal.ctx = ctx;
        GameGlobal.canvasWidth = res[0].width;
        GameGlobal.canvasHeight = res[0].height;
        
        console.log('Canvas initialized:', canvas.width, canvas.height);
        preloadImages();
        checkAndStart();
      }
    });
}

const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();

console.log('Window:', windowInfo.screenWidth, windowInfo.screenHeight);

let lastTime = Date.now();
let gameStarted = false;

function checkAndStart() {
  if (GameGlobal.game && GameGlobal.game.render && !gameStarted) {
    gameStarted = true;
    if (GameGlobal.game.loadImagesDelayed) {
      GameGlobal.game.loadImagesDelayed();
    }
    startGameLoop();
  } else {
    setTimeout(checkAndStart, 50);
  }
}

function startGameLoop() {
  console.log('Starting game loop');
  
  function gameLoop() {
    const currentTime = Date.now();
    const dt = currentTime - lastTime;
    lastTime = currentTime;
    
    const game = GameGlobal.game;
    if (game && game.render && ctx) {
      try {
        game.update(dt);
        game.render(ctx);
      } catch (e) {
        console.error('Game error:', e);
      }
    }

    requestAnimationFrame(gameLoop);
  }
  
  gameLoop();
}

initCanvas();
