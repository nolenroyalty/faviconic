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

function runLoop({ bc, worker, numTabs, numWindows, fullWidth }) {
  console.log("running loop");
  const leftPad = 92; // number of pixels before left tab
  const rightPad = 120; // number of pixels after right tab
  const rightTab = 36; // the right tab is bigger because it's selected
  const HARDCODED_WINDOW_DIFF = 30; // number of pixels between windows
  const HARDCODED_HEIGHT = window.innerHeight; // height of this window (with the canvas)
  const TOP_TO_FAVICON = 13; // number of pixels between top of window and favicon
  const tabFullWidth = fullWidth - (leftPad + rightPad + rightTab); // width of all tabs
  const tabSingle = Number(tabFullWidth / (numTabs - 1)); // width of each tab
  const topCanvasToBottomFavicon = 58; // gap between bottom favicon and the canvas
  const canvas = document.createElement("canvas");
  canvas.width = tabFullWidth;
  canvas.height = HARDCODED_HEIGHT;
  canvas.style.width = `${tabFullWidth}px`;
  canvas.style.height = `${HARDCODED_HEIGHT}px`;
  canvas.style.left = `${leftPad}px`;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "black";

  bc.postMessage({ type: "window-info", tabSingle });

  // height of playfield including canvas and tabs
  const fullPlayfieldHeight =
    HARDCODED_HEIGHT +
    TOP_TO_FAVICON +
    topCanvasToBottomFavicon +
    numWindows * HARDCODED_WINDOW_DIFF;

  // height of the playfield above the canvas
  const playfieldHeightAboveCanvas = fullPlayfieldHeight - HARDCODED_HEIGHT;

  // code below this is square-specific...
  function transmitSquareCoords() {
    const msg = {
      type: "square-position",
      square,
    };
    // console.log("transmitting square coords", msg);
    bc.postMessage(msg);
    // worker.postMessage({ type: "relay-to-bc", msg });
  }

  const VELOCITY = 128;
  let DIRECTION = -1;
  let past = 0;
  let square = {
    x: leftPad + tabSingle * 10 + 12,
    y: 200,
    w: tabSingle * 4,
    h: 80,
  };

  let lastTransmit = 0;
  function animationFrameLoop() {
    const realNow = performance.now();

    if (past === 0) {
      past = realNow;
      requestAnimationFrame(animationFrameLoop);
    }

    const deltaMs = realNow - past;
    const deltaSeconds = deltaMs / 1000;

    if (realNow - lastTransmit > 20) {
      lastTransmit = realNow;
      transmitSquareCoords();
    }

    past = realNow;
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
      // ctx.clearRect(0, 0, tabFullWidth, HARDCODED_HEIGHT);
      let topOnCanvas = square.y - playfieldHeightAboveCanvas;
      topOnCanvas = Math.max(0, topOnCanvas);
      const heightNow = botOnCanvas - topOnCanvas;
      ctx.fillRect(square.x, topOnCanvas, square.w, heightNow);
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
          runLoop({ bc, worker, numTabs, numWindows, fullWidth });
        }
      }
    });
  } else {
  }
}

initialize();
