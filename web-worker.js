let tabIndex, windowIndex, isMain, numTabs, numWindows;
let bc,
  regInterval,
  registrationDone = false;

const PIXEL_COUNT = 4;
const FAVICON_SIZE = 16;
const MULT = FAVICON_SIZE / PIXEL_COUNT;
const TOP_TO_FAVICON = 13;
const HARDCODED_WINDOW_DIFF = 30;
let tabSingle;
let cellHorizontalSpacing = 1;
let lastPixels = null;

function intersects(fst, snd) {
  // Check if two rectangles intersect by comparing their bounds
  return !(
    (
      fst.x + fst.w < snd.x || // fst is left of snd
      snd.x + snd.w < fst.x || // fst is right of snd
      fst.y + fst.h < snd.y || // fst is above snd
      snd.y + snd.h < fst.y
    ) // fst is below snd
  );
}

function maybeDrawPixels(pixels) {
  if (lastPixels === null) {
    lastPixels = pixels;
    postMessage({ type: "pixels-bw", pixels });
  } else {
    const diff = pixels.filter((p, i) => p !== lastPixels[i]).length;
    if (diff > 0) {
      lastPixels = pixels;
      postMessage({ type: "pixels-bw", pixels });
    }
  }
}

// For non-main tabs, we offload BroadcastChannel logic.
onmessage = function (e) {
  const data = e.data;
  if (data.type === "init") {
    tabIndex = data.tabIndex;
    windowIndex = data.windowIndex;
    isMain = data.isMain;
    numTabs = data.numTabs;
    numWindows = data.numWindows;
    bc = new BroadcastChannel("bc");
    bc.addEventListener("message", (event) => {
      const msg = event.data;
      if (!msg) return;
      else if (
        msg.type === "ack" &&
        msg.tabIndex === tabIndex &&
        msg.windowIndex === windowIndex
      ) {
        clearInterval(regInterval);
        registrationDone = true;
        postMessage({ type: "registration-ack" });
      } else if (msg.type === "window-info") {
        tabSingle = msg.tabSingle;
        cellHorizontalSpacing = msg.cellHorizontalSpacing;
      } else if (msg.type === "square-position") {
        const square = msg.square;
        const pixels = [];
        for (let yy = 0; yy < PIXEL_COUNT; yy++) {
          for (let xx = 0; xx < PIXEL_COUNT; xx++) {
            const x =
              tabSingle * tabIndex + (tabSingle - FAVICON_SIZE) / 2 + xx * MULT;
            const y =
              TOP_TO_FAVICON + HARDCODED_WINDOW_DIFF * windowIndex + yy * MULT;
            let thisSquare = { x, y, w: MULT, h: MULT };
            const doesIntersect = intersects(square, thisSquare);
            pixels.push(doesIntersect ? 1 : 0);
          }
        }
        maybeDrawPixels(pixels);
      } else if (msg.type === "snake-position") {
        console.log("snake-position", msg.snake);
        const snake = msg.snake;
        const myX = tabIndex;
        const myY = windowIndex;
        const pixels = [];

        if (
          snake.occupied.some((coord) => coord[0] === myX && coord[1] === myY)
        ) {
          pixels.push(1);
        } else {
          pixels.push(0);
        }
        maybeDrawPixels(pixels);
      } else if (msg.type === "pong-position") {
        console.log("pong-position", msg.ourPaddle);
        const ourPaddle = msg.ourPaddle;
        const pixels = [];
        for (let yy = 0; yy < PIXEL_COUNT; yy++) {
          for (let xx = 0; xx < PIXEL_COUNT; xx++) {
            const x =
              tabSingle * tabIndex + (tabSingle - FAVICON_SIZE) / 2 + xx * MULT;
            // const y = FAVICON_SIZE * windowIndex + yy * MULT;
            const y =
              TOP_TO_FAVICON + HARDCODED_WINDOW_DIFF * windowIndex + yy * MULT;
            let thisSquare = { x, y, w: MULT, h: MULT };
            const doesIntersect = intersects(ourPaddle, thisSquare);
            pixels.push(doesIntersect ? 1 : 0);
          }
        }
        maybeDrawPixels(pixels);
      }
    });
    regInterval = setInterval(() => {
      bc.postMessage({ type: "register", tabIndex, windowIndex });
    }, 1000);
  } else if (data.type === "relay-to-bc") {
    console.log("relay-to-bc", data.msg);
    const message = { ...data.msg };
    bc.postMessage(message);
  }
};
