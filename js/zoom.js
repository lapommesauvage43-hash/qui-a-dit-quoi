// Zoom pincé (deux doigts) + déplacement de l'image zoomée (un doigt).
// Le glissement horizontal d'une page à l'autre (quand l'image n'est PAS
// zoomée) reste entièrement géré par le scroll natif du carrousel : ce
// module ne touche jamais à ce cas, il se contente de ne rien empêcher.

const MAX_SCALE = 4;
const MIN_SCALE = 1;

export function enableZoom(frameEl, imgEl) {
  let scale = 1;
  let originX = 0, originY = 0; // translation actuelle
  let mode = null; // 'pinch' | 'pan' | null
  let startDist = 0;
  let startScale = 1;
  let startOriginX = 0, startOriginY = 0;
  let startTouchX = 0, startTouchY = 0;
  let pinchAnchorX = 0, pinchAnchorY = 0;

  function apply() {
    imgEl.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;
  }

  function reset() {
    scale = 1;
    originX = 0;
    originY = 0;
    mode = null;
    apply();
  }

  function distance(t0, t1) {
    const dx = t1.clientX - t0.clientX;
    const dy = t1.clientY - t0.clientY;
    return Math.hypot(dx, dy);
  }

  function midpoint(t0, t1) {
    return {
      x: (t0.clientX + t1.clientX) / 2,
      y: (t0.clientY + t1.clientY) / 2,
    };
  }

  function clampOrigin() {
    // Empêche l'image de partir trop loin hors cadre.
    const rect = frameEl.getBoundingClientRect();
    const maxX = (rect.width * (scale - 1)) / 2 + rect.width * 0.15;
    const maxY = (rect.height * (scale - 1)) / 2 + rect.height * 0.15;
    originX = Math.min(maxX, Math.max(-maxX, originX));
    originY = Math.min(maxY, Math.max(-maxY, originY));
  }

  frameEl.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
      mode = "pinch";
      startDist = distance(e.touches[0], e.touches[1]);
      startScale = scale;
      const mid = midpoint(e.touches[0], e.touches[1]);
      pinchAnchorX = mid.x;
      pinchAnchorY = mid.y;
      startOriginX = originX;
      startOriginY = originY;
      e.preventDefault();
    } else if (e.touches.length === 1) {
      if (scale > 1.001) {
        mode = "pan";
        startTouchX = e.touches[0].clientX;
        startTouchY = e.touches[0].clientY;
        startOriginX = originX;
        startOriginY = originY;
        e.preventDefault();
      } else {
        mode = null; // laisse le carrousel gérer le glissement horizontal
      }
    }
  }, { passive: false });

  frameEl.addEventListener("touchmove", (e) => {
    if (mode === "pinch" && e.touches.length === 2) {
      const newDist = distance(e.touches[0], e.touches[1]);
      const ratio = newDist / (startDist || 1);
      scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, startScale * ratio));
      originX = startOriginX;
      originY = startOriginY;
      clampOrigin();
      apply();
      e.preventDefault();
    } else if (mode === "pan" && e.touches.length === 1) {
      const dx = e.touches[0].clientX - startTouchX;
      const dy = e.touches[0].clientY - startTouchY;
      originX = startOriginX + dx;
      originY = startOriginY + dy;
      clampOrigin();
      apply();
      e.preventDefault();
    }
  }, { passive: false });

  function endGesture() {
    if (scale <= 1.02) {
      reset();
    }
    mode = null;
  }

  frameEl.addEventListener("touchend", endGesture);
  frameEl.addEventListener("touchcancel", endGesture);

  return { reset };
}
