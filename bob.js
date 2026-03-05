(() => {

const PIPE_WIDTH = 60
const BIRD_X = 100
const BIRD_HALF_WIDTH = 17

const PIPE_CLEARANCE = 10

const TARGET_OFFSET = 25
const PREDICT_FRAMES = 1
const EARLY_DROP_PIXELS = 40
const FLAP_COOLDOWN_MS = 20

const DROP_DY = 120
const DROP_DX = 160
const DROP_RECOVERY = 40

const PIPE_MATCH_X = 24
const PIPE_STALE_MS = 200

let pipePairs = []

let birdY = null
let lastBirdY = null
let birdV = 0
let lastFlap = 0

let dropMode = false

function flap(){
  const now = performance.now()
  if (now - lastFlap < FLAP_COOLDOWN_MS) return
  lastFlap = now

  window.dispatchEvent(
    new KeyboardEvent("keydown",{key:" ",code:"Space",keyCode:32,bubbles:true})
  )
}

function getOrCreatePair(xLeft){
  let best = null
  let bestDx = Infinity
  for (const p of pipePairs){
    const dx = Math.abs(p.xLeft - xLeft)
    if (dx < bestDx){
      bestDx = dx
      best = p
    }
  }
  if (best && bestDx <= PIPE_MATCH_X) return best

  const p = { xLeft, top: null, bottom: null, center: null, lastSeen: performance.now() }
  pipePairs.push(p)
  return p
}

const oldFillRect = CanvasRenderingContext2D.prototype.fillRect
CanvasRenderingContext2D.prototype.fillRect = function(x,y,w,h){
  if (w === PIPE_WIDTH){
    const now = performance.now()

    const pair = getOrCreatePair(x)
    pair.xLeft = x
    pair.lastSeen = now

    const mid = y + h/2
    if (!pair.top || mid < (pair.top.y + pair.top.h/2)){
      pair.top = {y,h}
    }
    if (!pair.bottom || mid > (pair.bottom.y + pair.bottom.h/2)){
      pair.bottom = {y,h}
    }

    if (pair.top && pair.bottom){
      const gapTop = pair.top.y + pair.top.h
      const gapBottom = pair.bottom.y
      pair.center = (gapTop + gapBottom) / 2
    }
  }
  return oldFillRect.apply(this,arguments)
}

const oldTranslate = CanvasRenderingContext2D.prototype.translate
CanvasRenderingContext2D.prototype.translate = function(x,y){
  if (Math.abs(x - BIRD_X) < 5){
    if (lastBirdY !== null){
      birdV = y - lastBirdY
    }
    lastBirdY = y
    birdY = y
  }
  return oldTranslate.apply(this,arguments)
}

function pickPipe(){
  const now = performance.now()
  const birdLeft = BIRD_X - BIRD_HALF_WIDTH

  // Keep pipePairs fresh
  pipePairs = pipePairs.filter(p => now - p.lastSeen < PIPE_STALE_MS)

  const behindLimit = birdLeft - PIPE_CLEARANCE

  // 1) Prefer the most recently passed pipe, as long as it's not farther than PIPE_CLEARANCE behind
  //    (i.e. its right edge is still >= behindLimit).
  let current = null
  let currentCenterX = -Infinity

  for (const p of pipePairs){
    if (p.center == null) continue

    const pipeRight = p.xLeft + PIPE_WIDTH
    if (pipeRight < behindLimit) continue // too far behind, drop it

    const xCenter = p.xLeft + PIPE_WIDTH/2
    if (xCenter <= BIRD_X && xCenter > currentCenterX){
      current = p
      currentCenterX = xCenter
    }
  }

  if (current){
    return { xCenter: current.xLeft + PIPE_WIDTH/2, center: current.center }
  }

  // 2) Otherwise pick the next pipe ahead (closest positive dx)
  let best = null
  let bestDx = Infinity

  for (const p of pipePairs){
    if (p.center == null) continue
    const xCenter = p.xLeft + PIPE_WIDTH/2
    const dx = xCenter - BIRD_X
    if (dx <= 0) continue

    if (dx < bestDx){
      bestDx = dx
      best = p
    }
  }

  return best ? { xCenter: best.xLeft + PIPE_WIDTH/2, center: best.center } : null
}

function loop(){
  const pipe = pickPipe()

  if (pipe && birdY !== null){

    const dx = pipe.xCenter - BIRD_X

    let earlyBias = 0
    if (dx > 120) earlyBias = EARLY_DROP_PIXELS

    const target = pipe.center + TARGET_OFFSET + earlyBias
    const predictedY = birdY + birdV * PREDICT_FRAMES
    const dy = target - birdY

    if (dy > DROP_DY && dx > DROP_DX) dropMode = true
    if (dropMode && dx < 70) dropMode = false

    if (!dropMode){
      if (predictedY > target) flap()
    } else {
      if (predictedY > target + DROP_RECOVERY) flap()
    }
  }

  requestAnimationFrame(loop)
}

console.log("Flappy bot active")
setTimeout(flap,50)
loop()

})();