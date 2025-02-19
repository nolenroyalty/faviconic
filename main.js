const BLACK = "#000";
const WHITE = "#fff";

function setFaviconToUrl(url) {
  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = url;
  // we could try reloading here if need be?
}

let bwCanvas = null;
function faviconOfPixelsBW(pixels) {
  const len = pixels.length;
  const width = Math.floor(Math.sqrt(len));
  if (width * width !== len) {
    throw new Error(`Invalid pixel array: must be a square (${len} pixels)`);
  }
  if (bwCanvas === null) {
    bwCanvas = document.createElement("canvas");
    bwCanvas.width = width;
    bwCanvas.height = width;
  } else {
    bwCanvas.getContext("2d").clearRect(0, 0, width, width);
  }

  const ctx = bwCanvas.getContext("2d");
  for (let i = 0; i < len; i++) {
    const x = i % width;
    const y = Math.floor(i / width);
    const index = (y * width + x) * 4;
    ctx.fillStyle = pixels[i] ? BLACK : WHITE;
    ctx.fillRect(x, y, 1, 1);
  }
  return bwCanvas.toDataURL("image/png");
}

function squareImpl({
  bc,
  worker,
  numTabs,
  numWindows,
  fullWidth,
  tabFullWidth,
  leftPad,
  tabSingle,
  HARDCODED_HEIGHT,
  TOP_TO_FAVICON,
  topCanvasToBottomFavicon,
  HARDCODED_WINDOW_DIFF,
  playfieldHeightAboveCanvas,
  fullPlayfieldHeight,
  canvas,
  ctx,
}) {
  const square = {
    x: leftPad + tabSingle * 10 + 12,
    y: 200,
    w: tabSingle * 4,
    h: 80,
  };

  function transmitSquareCoords() {
    const msg = {
      type: "square-position",
      square,
    };
    worker.postMessage({ type: "relay-to-bc", msg });
  }

  const VELOCITY = 128;
  let DIRECTION = -1;

  function loop({ deltaSeconds }) {
    square.y += VELOCITY * deltaSeconds * DIRECTION;
    if (square.y < 0) {
      square.y = 0;
      DIRECTION *= -1;
    } else if (square.y + square.h > fullPlayfieldHeight) {
      square.y = fullPlayfieldHeight - square.h;
      DIRECTION *= -1;
    }

    const botOnCanvas = square.y + square.h - playfieldHeightAboveCanvas;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, tabFullWidth, HARDCODED_HEIGHT);
    ctx.fillStyle = "black";
    if (botOnCanvas > 0) {
      let topOnCanvas = square.y - playfieldHeightAboveCanvas;
      topOnCanvas = Math.max(0, topOnCanvas);
      const heightNow = botOnCanvas - topOnCanvas;
      ctx.fillRect(square.x, topOnCanvas, square.w, heightNow);
    }
  }

  return { transmit: transmitSquareCoords, loop };
}

function directionToDelta(direction) {
  if (direction === "right") {
    return [1, 0];
  } else if (direction === "left") {
    return [-1, 0];
  } else if (direction === "up") {
    return [0, -1];
  } else if (direction === "down") {
    return [0, 1];
  } else {
    throw new Error(`Unknown direction: ${direction}`);
  }
}

function pongImpl({
  bc,
  worker,
  numTabs,
  numWindows,
  fullWidth,
  tabFullWidth,
  leftPad,
  tabSingle,
  HARDCODED_HEIGHT,
  TOP_TO_FAVICON,
  topCanvasToBottomFavicon,
  HARDCODED_WINDOW_DIFF,
  playfieldHeightAboveCanvas,
  fullPlayfieldHeight,
  canvas,
  ctx,
}) {
  const CELL_SIZE = 16;
  const PLAYFIELD_WIDTH = tabFullWidth;
  // const FAVICON_HEIGHT = CELL_SIZE * numWindows;
  // const ABOVE_CANVAS_HEIGHT = FAVICON_HEIGHT + CELL_SIZE;
  // const PLAYFIELD_HEIGHT = HARDCODED_HEIGHT + ABOVE_CANVAS_HEIGHT;
  // const PLAYFIELD_HEIGHT = HARDCODED_HEIGHT * 2 + CELL_SIZE;
  const PLAYFIELD_WIDTH_IN_SQUARES = numTabs - 1; // don't draw to rightmost tab
  // const playfieldHeightAboveCanvas = fullPlayfieldHeight - HARDCODED_HEIGHT;

  const PADDLE_WIDTH = 12;
  const PADDLE_HEIGHT = 96;
  const PADDLE_SPEED = 128;

  const WIDTH_OF_ALL_FAVICONS = CELL_SIZE * PLAYFIELD_WIDTH_IN_SQUARES;
  const CELL_HORIZONTAL_SPACING =
    (tabFullWidth - WIDTH_OF_ALL_FAVICONS) / (PLAYFIELD_WIDTH_IN_SQUARES - 1);

  const ourPaddle = {
    x: CELL_SIZE + CELL_HORIZONTAL_SPACING,
    y: playfieldHeightAboveCanvas - CELL_SIZE * 2,
    w: PADDLE_WIDTH,
    h: PADDLE_HEIGHT,
  };

  function transmit() {
    const msg = {
      type: "pong-position",
      ourPaddle,
    };
    worker.postMessage({ type: "relay-to-bc", msg });
  }

  let downPressed = false;
  let upPressed = false;

  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      downPressed = true;
    } else if (event.key === "ArrowUp") {
      upPressed = true;
    }
  });

  document.addEventListener("keyup", (event) => {
    if (event.key === "ArrowDown") {
      downPressed = false;
    } else if (event.key === "ArrowUp") {
      upPressed = false;
    }
  });

  function loop({ deltaSeconds }) {
    if (downPressed && !upPressed) {
      ourPaddle.y += PADDLE_SPEED * deltaSeconds;
      if (ourPaddle.y + ourPaddle.h > fullPlayfieldHeight) {
        ourPaddle.y = fullPlayfieldHeight - ourPaddle.h;
      }
    } else if (upPressed && !downPressed) {
      ourPaddle.y -= PADDLE_SPEED * deltaSeconds;
      if (ourPaddle.y < 0) {
        ourPaddle.y = 0;
      }
    }

    const botOnCanvas = ourPaddle.y + ourPaddle.h - playfieldHeightAboveCanvas;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, tabFullWidth, HARDCODED_HEIGHT);
    ctx.fillStyle = "black";
    if (botOnCanvas > 0) {
      let topOnCanvas = ourPaddle.y - playfieldHeightAboveCanvas;
      topOnCanvas = Math.max(0, topOnCanvas);
      const heightNow = botOnCanvas - topOnCanvas;
      ctx.fillRect(ourPaddle.x, topOnCanvas, ourPaddle.w, heightNow);
    }
  }

  return { transmit, loop };
}

function snakeImpl({
  bc,
  worker,
  numTabs,
  numWindows,
  fullWidth,
  tabFullWidth,
  leftPad,
  tabSingle,
  HARDCODED_HEIGHT,
  TOP_TO_FAVICON,
  topCanvasToBottomFavicon,
  HARDCODED_WINDOW_DIFF,
  playfieldHeightAboveCanvas,
  fullPlayfieldHeight,
  canvas,
  ctx,
}) {
  const PLAYFIELD_WIDTH_IN_SQUARES = numTabs - 1; // don't draw to rightmost tab
  const PLAYFIELD_HEIGHT_IN_SQUARES = 1 + numWindows * 2; // 1 for bar between favicon and canvas

  const xStart = Math.floor(numTabs / 2);
  const yStart = numWindows + numWindows / 2;
  const snake = {
    occupied: [
      [xStart, yStart],
      [xStart + 1, yStart],
      [xStart + 2, yStart],
    ],
    direction: "right",
  };

  function transmitSnakeCoords() {
    const s = { ...snake };
    s.occupied = s.occupied.map((coord) => {
      return [Math.floor(coord[0]), Math.floor(coord[1])];
    });
    const msg = {
      type: "snake-position",
      snake: s,
    };
    worker.postMessage({ type: "relay-to-bc", msg });
  }

  const SQUARES_PER_SECOND = 4;
  const MS_TO_A_MOVE = 1000 / SQUARES_PER_SECOND;
  let accumulatedDelta = 0;

  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp") {
      snake.direction = "up";
    } else if (event.key === "ArrowDown") {
      snake.direction = "down";
    } else if (event.key === "ArrowLeft") {
      snake.direction = "left";
    } else if (event.key === "ArrowRight") {
      snake.direction = "right";
    }
  });

  function applyWraparound(coords) {
    let changed = false;
    if (coords[0] < 0) {
      coords[0] = PLAYFIELD_WIDTH_IN_SQUARES + coords[0];
      changed = true;
    } else if (coords[0] >= PLAYFIELD_WIDTH_IN_SQUARES) {
      coords[0] = coords[0] - PLAYFIELD_WIDTH_IN_SQUARES;
      changed = true;
    }
    if (coords[1] < 0) {
      coords[1] = PLAYFIELD_HEIGHT_IN_SQUARES + coords[1];
      changed = true;
    } else if (coords[1] >= PLAYFIELD_HEIGHT_IN_SQUARES) {
      coords[1] = coords[1] - PLAYFIELD_HEIGHT_IN_SQUARES;
      changed = true;
    }
    return [changed, coords];
  }

  const CELL_SIZE = 16;
  const WIDTH_OF_ALL_FAVICONS = CELL_SIZE * PLAYFIELD_WIDTH_IN_SQUARES;
  const CELL_HORIZONTAL_SPACING =
    (tabFullWidth - WIDTH_OF_ALL_FAVICONS) / (PLAYFIELD_WIDTH_IN_SQUARES - 1);
  const HEIGHT_OF_ALL_WINDOWS = CELL_SIZE * numWindows;
  const CELL_VERTICAL_SPACING =
    (HARDCODED_HEIGHT - HEIGHT_OF_ALL_WINDOWS) / (numWindows - 1);
  // draw the canvas portion. This means:
  // * clear the canvas
  // * find snake cells that are in the bottom half of the canvas
  // * divide the canvas into cells distributed evenly across the width and height
  // * draw the cells in the bottom half of the canvas
  // * draw the snake cells in the bottom half of the canvas
  function drawCanvasPortion() {
    ctx.clearRect(0, 0, tabFullWidth, HARDCODED_HEIGHT);
    const upperBound = numWindows + 1;
    let last = null;
    const xMult = CELL_SIZE + CELL_HORIZONTAL_SPACING;
    const yMult = CELL_SIZE + CELL_VERTICAL_SPACING;
    snake.occupied
      .filter((coord) => coord[1] >= upperBound)
      .reverse()
      .forEach((coord) => {
        const x = coord[0] * (CELL_SIZE + CELL_HORIZONTAL_SPACING);
        const y = (coord[1] - upperBound) * (CELL_SIZE + CELL_VERTICAL_SPACING);
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

        // nicely connect cells so that they're continuous when not favicons.
        if (last !== null) {
          if (coord[0] - 1 === last.coord[0] && coord[1] === last.coord[1]) {
            // we're one to the right of the last one
            ctx.fillRect(
              last.drawing[0] + CELL_SIZE - 1,
              last.drawing[1],
              x - last.drawing[0] - CELL_SIZE + 2,
              CELL_SIZE
            );
          } else if (
            coord[0] + 1 === last.coord[0] &&
            coord[1] === last.coord[1]
          ) {
            // we're one to the left of the last one
            ctx.fillRect(
              x + CELL_SIZE - 1,
              y,
              last.drawing[0] - x - CELL_SIZE + 2,
              CELL_SIZE
            );
          } else if (
            coord[1] + 1 === last.coord[1] &&
            coord[0] === last.coord[0]
          ) {
            // we're right above the last one
            ctx.fillRect(
              x,
              y + CELL_SIZE - 1,
              CELL_SIZE,
              last.drawing[1] - y - CELL_SIZE + 2
            );
          } else if (
            coord[1] - 1 === last.coord[1] &&
            coord[0] === last.coord[0]
          ) {
            // we're right below the last one
            ctx.fillRect(
              last.drawing[0],
              last.drawing[1] + CELL_SIZE - 1,
              CELL_SIZE,
              y - last.drawing[1] - CELL_SIZE + 2
            );
          }
        }
        last = { coord: [coord[0], coord[1]], drawing: [x, y] };
      });
  }

  function loop({ deltaSeconds }) {
    accumulatedDelta += deltaSeconds * 1000;
    let didMove = false;
    while (accumulatedDelta >= MS_TO_A_MOVE) {
      accumulatedDelta -= MS_TO_A_MOVE;
      const [dx, dy] = directionToDelta(snake.direction);
      const head = snake.occupied[snake.occupied.length - 1];
      const newHead = [head[0] + dx, head[1] + dy];
      snake.occupied.push(newHead);
      snake.occupied.shift();
      didMove = true;
    }
    if (didMove) {
      snake.occupied = snake.occupied.map((coord) => {
        const [changed, newCoord] = applyWraparound(coord);
        if (changed) {
          return newCoord;
        }
        return coord;
      });
      drawCanvasPortion();
    }
  }

  return { transmit: transmitSnakeCoords, loop };
}

function runLoopGeneric({ bc, worker, numTabs, numWindows, fullWidth, impl }) {
  console.log(`running loop: ${impl}`);
  const leftPad = 92; // number of pixels before left tab
  const rightPad = 120; // number of pixels after right tab
  const rightTab = 36; // the right tab is bigger because it's selected
  const HARDCODED_WINDOW_DIFF = 30; // number of pixels between windows
  const HARDCODED_HEIGHT = window.innerHeight; // height of this window (with the canvas)
  const TOP_TO_FAVICON = 13; // number of pixels between top of window and favicon
  const tabFullWidth = fullWidth - (leftPad + rightPad + rightTab); // width of all tabs
  const tabSingle = Number(tabFullWidth / (numTabs - 1)); // width of each tab
  const topCanvasToBottomFavicon = 58; // gap between bottom favicon and the canvas
  const fullPlayfieldHeight =
    HARDCODED_HEIGHT +
    TOP_TO_FAVICON +
    topCanvasToBottomFavicon +
    numWindows * HARDCODED_WINDOW_DIFF;

  // height of the playfield above the canvas
  const playfieldHeightAboveCanvas = fullPlayfieldHeight - HARDCODED_HEIGHT;
  const canvas = document.createElement("canvas");
  canvas.width = tabFullWidth;
  canvas.height = HARDCODED_HEIGHT;
  canvas.style.width = `${tabFullWidth}px`;
  canvas.style.height = `${HARDCODED_HEIGHT}px`;
  canvas.style.left = `${leftPad}px`;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  const args = {
    bc,
    worker,
    numTabs,
    numWindows,
    fullWidth,
    tabFullWidth,
    leftPad,
    tabSingle,
    HARDCODED_HEIGHT,
    TOP_TO_FAVICON,
    topCanvasToBottomFavicon,
    HARDCODED_WINDOW_DIFF,
    playfieldHeightAboveCanvas,
    fullPlayfieldHeight,
    canvas,
    ctx,
  };

  const CELL_SIZE = 16;
  const PLAYFIELD_WIDTH_IN_SQUARES = numTabs - 1; // don't draw to rightmost tab
  const WIDTH_OF_ALL_FAVICONS = CELL_SIZE * PLAYFIELD_WIDTH_IN_SQUARES;
  const CELL_HORIZONTAL_SPACING =
    (tabFullWidth - WIDTH_OF_ALL_FAVICONS) / (PLAYFIELD_WIDTH_IN_SQUARES - 1);

  bc.postMessage({ type: "window-info", tabSingle, CELL_HORIZONTAL_SPACING });

  let transmit, loop, transmitTime;
  if (impl === "square") {
    ({ transmit, loop } = squareImpl(args));
    transmitTime = 20;
  } else if (impl === "snake") {
    ({ transmit, loop } = snakeImpl(args));
    transmitTime = 20;
  } else if (impl === "pong") {
    ({ transmit, loop } = pongImpl(args));
    transmitTime = 20;
  } else {
    throw new Error(`Unknown impl: ${impl}`);
  }

  let past = 0;
  let lastTransmit = 0;
  function animationFrameLoop() {
    const realNow = performance.now();
    if (past === 0) {
      past = realNow;
      requestAnimationFrame(animationFrameLoop);
    }

    const deltaMs = realNow - past;
    const deltaSeconds = deltaMs / 1000;

    past = realNow;
    loop({ deltaSeconds });
    if (realNow - lastTransmit > transmitTime) {
      lastTransmit = realNow;
      console.log("TRANSMIT");
      transmit();
    }
    requestAnimationFrame(animationFrameLoop);
  }
  animationFrameLoop();
}

function initialize() {
  const params = new URLSearchParams(window.location.search);
  const tabIndex = Number(params.get("tabIndex") || 0);
  const windowIndex = Number(params.get("windowIndex") || 0);
  const isMain = params.get("isMain") === "true";
  const numTabs = Number(params.get("numTabs") || 1);
  const numWindows = Number(params.get("numWindows") || 1);
  const fullWidth = Number(params.get("fullWidth") || 800);

  // soon we'll vary this based on worker...
  const worker = new Worker("web-worker.js");
  worker.postMessage({
    type: "init",
    tabIndex,
    windowIndex,
    isMain,
    numTabs,
    numWindows,
    fullWidth,
  });

  worker.addEventListener("message", (event) => {
    const data = event.data;
    if (data && data.type === "pixels-bw") {
      const url = faviconOfPixelsBW(data.pixels);
      setFaviconToUrl(url);
    } else if (data && data.type === "registration-ack") {
      console.log("Registration acknowledged.");
    } else if (data && data.type === "doing-relay") {
      console.log("doing relay", data.msg);
    } else {
      console.log("unknown message", data);
    }
  });

  if (isMain) {
    console.log("isMain");

    const bc = new BroadcastChannel("bc");
    const registrations = {};

    bc.addEventListener("message", (event) => {
      const data = event.data;
      if (data && data.type === "register") {
        const key = `tab_${data.tabIndex}_${data.windowIndex}`;
        console.log(`Registered: ${key}`);
        registrations[key] = true;
        bc.postMessage({
          type: "ack",
          tabIndex: data.tabIndex,
          windowIndex: data.windowIndex,
        });

        const expected = numTabs * numWindows;
        if (Object.keys(registrations).length === expected) {
          console.log("All tabs registered. Beginning...");
          runLoopGeneric({
            bc,
            worker,
            numTabs,
            numWindows,
            fullWidth,
            impl: "pong",
          });
        }
      }
    });
  } else {
  }
}

initialize();
