(() => {
  "use strict";

  const photoInput = document.getElementById("photoInput");
  const pasteBtn = document.getElementById("pasteBtn");
  const resetHatBtn = document.getElementById("resetHatBtn");
  const flipHatBtn = document.getElementById("flipHatBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const placeholder = document.getElementById("placeholder");
  const canvasStack = document.getElementById("canvasStack");
  const baseCanvas = document.getElementById("baseCanvas");
  const overlayCanvas = document.getElementById("overlayCanvas");
  const baseCtx = baseCanvas.getContext("2d");
  const overlayCtx = overlayCanvas.getContext("2d");

  const HANDLE_RADIUS = 14;
  const ROTATE_HANDLE_OFFSET = 40;
  const MIN_SIZE = 24;

  const hatImage = new Image();
  hatImage.src = "santahat.png";

  let photoImage = null;
  let hat = null; // { cx, cy, w, h, angle, flip }
  let defaultHat = null;

  const CORNER_MULT = {
    tl: { x: -1, y: -1 },
    tr: { x: 1, y: -1 },
    br: { x: 1, y: 1 },
    bl: { x: -1, y: 1 },
  };
  const OPPOSITE = { tl: "br", tr: "bl", br: "tl", bl: "tr" };
  const CORNER_SIGN = {
    br: { x: 1, y: 1 },
    tl: { x: -1, y: -1 },
    tr: { x: 1, y: -1 },
    bl: { x: -1, y: 1 },
  };

  function rotatePoint(x, y, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return { x: x * cos - y * sin, y: x * sin + y * cos };
  }

  function inverseRotatePoint(x, y, angle) {
    return rotatePoint(x, y, -angle);
  }

  function getCorner(h, name) {
    const mult = CORNER_MULT[name];
    const local = { x: (mult.x * h.w) / 2, y: (mult.y * h.h) / 2 };
    const rotated = rotatePoint(local.x, local.y, h.angle);
    return { x: h.cx + rotated.x, y: h.cy + rotated.y };
  }

  function getRotateHandlePos(h) {
    const local = { x: 0, y: -h.h / 2 - ROTATE_HANDLE_OFFSET };
    const rotated = rotatePoint(local.x, local.y, h.angle);
    return { x: h.cx + rotated.x, y: h.cy + rotated.y };
  }

  function getAllCorners(h) {
    return {
      tl: getCorner(h, "tl"),
      tr: getCorner(h, "tr"),
      br: getCorner(h, "br"),
      bl: getCorner(h, "bl"),
    };
  }

  function pointInHat(px, py, h) {
    const dx = px - h.cx;
    const dy = py - h.cy;
    const local = inverseRotatePoint(dx, dy, h.angle);
    return Math.abs(local.x) <= h.w / 2 && Math.abs(local.y) <= h.h / 2;
  }

  function drawBase() {
    baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
    if (photoImage) {
      baseCtx.drawImage(photoImage, 0, 0, baseCanvas.width, baseCanvas.height);
    }
    if (hat && hatImage.complete) {
      baseCtx.save();
      baseCtx.translate(hat.cx, hat.cy);
      baseCtx.rotate(hat.angle);
      baseCtx.scale(hat.flip ? -1 : 1, 1);
      baseCtx.drawImage(hatImage, -hat.w / 2, -hat.h / 2, hat.w, hat.h);
      baseCtx.restore();
    }
  }

  function drawOverlay() {
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    if (!hat) return;

    const corners = getAllCorners(hat);
    const rotateHandle = getRotateHandlePos(hat);

    // scale visual sizes relative to canvas internal resolution so they
    // stay a sensible on-screen size regardless of photo resolution
    const displayScale = overlayCanvas.width / overlayCanvas.getBoundingClientRect().width || 1;
    const lineWidth = 2 * displayScale;
    const handleR = HANDLE_RADIUS * displayScale;

    overlayCtx.save();
    overlayCtx.strokeStyle = "#ff5252";
    overlayCtx.lineWidth = lineWidth;
    overlayCtx.setLineDash([6 * displayScale, 4 * displayScale]);
    overlayCtx.beginPath();
    overlayCtx.moveTo(corners.tl.x, corners.tl.y);
    overlayCtx.lineTo(corners.tr.x, corners.tr.y);
    overlayCtx.lineTo(corners.br.x, corners.br.y);
    overlayCtx.lineTo(corners.bl.x, corners.bl.y);
    overlayCtx.closePath();
    overlayCtx.stroke();
    overlayCtx.setLineDash([]);

    // line to rotate handle
    overlayCtx.beginPath();
    const topMid = {
      x: (corners.tl.x + corners.tr.x) / 2,
      y: (corners.tl.y + corners.tr.y) / 2,
    };
    overlayCtx.moveTo(topMid.x, topMid.y);
    overlayCtx.lineTo(rotateHandle.x, rotateHandle.y);
    overlayCtx.stroke();

    // corner handles
    overlayCtx.fillStyle = "#ffffff";
    for (const name of ["tl", "tr", "br", "bl"]) {
      const c = corners[name];
      overlayCtx.beginPath();
      overlayCtx.arc(c.x, c.y, handleR, 0, Math.PI * 2);
      overlayCtx.fill();
      overlayCtx.stroke();
    }

    // rotate handle
    overlayCtx.beginPath();
    overlayCtx.fillStyle = "#4caf50";
    overlayCtx.arc(rotateHandle.x, rotateHandle.y, handleR, 0, Math.PI * 2);
    overlayCtx.fill();
    overlayCtx.stroke();

    overlayCtx.restore();
  }

  function render() {
    drawBase();
    drawOverlay();
  }

  function setupCanvasSize(width, height) {
    baseCanvas.width = width;
    baseCanvas.height = height;
    overlayCanvas.width = width;
    overlayCanvas.height = height;
  }

  function makeDefaultHat(photoW, photoH) {
    const hatAspect = hatImage.naturalWidth / hatImage.naturalHeight || 1;
    const w = photoW * 0.42;
    const h = w / hatAspect;
    return {
      cx: photoW * 0.42,
      cy: h * 0.55,
      w,
      h,
      angle: -0.18,
      flip: false,
    };
  }

  function loadPhoto(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        photoImage = img;
        setupCanvasSize(img.naturalWidth, img.naturalHeight);

        const start = () => {
          hat = makeDefaultHat(img.naturalWidth, img.naturalHeight);
          defaultHat = { ...hat };
          placeholder.hidden = true;
          canvasStack.hidden = false;
          resetHatBtn.disabled = false;
          flipHatBtn.disabled = false;
          downloadBtn.disabled = false;
          render();
        };

        if (hatImage.complete && hatImage.naturalWidth) {
          start();
        } else {
          hatImage.onload = start;
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  photoInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) loadPhoto(file);
  });

  pasteBtn.addEventListener("click", async () => {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      alert("Your browser doesn't support reading images from the clipboard. Try pasting with Ctrl+V / Cmd+V instead, or use Upload Photo.");
      return;
    }
    try {
      const clipboardItems = await navigator.clipboard.read();
      let imageBlob = null;
      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (imageType) {
          imageBlob = await item.getType(imageType);
          break;
        }
      }
      if (!imageBlob) {
        alert("No image found on the clipboard. Copy an image first, then try again.");
        return;
      }
      loadPhoto(imageBlob);
    } catch (err) {
      alert("Couldn't read the clipboard. Your browser may need permission — check for a prompt, or try Ctrl+V / Cmd+V instead.");
    }
  });

  window.addEventListener("paste", (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          loadPhoto(file);
        }
        break;
      }
    }
  });

  resetHatBtn.addEventListener("click", () => {
    if (!defaultHat || !photoImage) return;
    hat = { ...defaultHat };
    render();
  });

  flipHatBtn.addEventListener("click", () => {
    if (!hat) return;
    hat.flip = !hat.flip;
    render();
  });

  downloadBtn.addEventListener("click", () => {
    if (!photoImage) return;
    const link = document.createElement("a");
    link.download = "santa-hat-pfp.png";
    link.href = baseCanvas.toDataURL("image/png");
    link.click();
  });

  // ---- Pointer interaction ----

  let dragMode = null; // "move" | "resize" | "rotate"
  let dragHandle = null;
  let dragStart = null; // { x, y } canvas coords at gesture start
  let hatStart = null; // snapshot of hat at gesture start
  let resizeAnchor = null; // { x, y } fixed canvas point during resize
  let resizeOppositeName = null;

  function canvasCoordsFromEvent(evt) {
    const rect = overlayCanvas.getBoundingClientRect();
    const point = evt.touches && evt.touches.length ? evt.touches[0] : evt;
    const scaleX = overlayCanvas.width / rect.width;
    const scaleY = overlayCanvas.height / rect.height;
    return {
      x: (point.clientX - rect.left) * scaleX,
      y: (point.clientY - rect.top) * scaleY,
    };
  }

  function hitTestHandle(px, py) {
    if (!hat) return null;
    const rect = overlayCanvas.getBoundingClientRect();
    const scale = overlayCanvas.width / rect.width || 1;
    const hitR = (HANDLE_RADIUS + 10) * scale;

    const rotateHandle = getRotateHandlePos(hat);
    if (Math.hypot(px - rotateHandle.x, py - rotateHandle.y) <= hitR) {
      return { type: "rotate" };
    }

    const corners = getAllCorners(hat);
    for (const name of ["tl", "tr", "br", "bl"]) {
      const c = corners[name];
      if (Math.hypot(px - c.x, py - c.y) <= hitR) {
        return { type: "resize", corner: name };
      }
    }
    return null;
  }

  function pointerDown(evt) {
    if (!hat) return;
    evt.preventDefault();
    const { x, y } = canvasCoordsFromEvent(evt);

    const handleHit = hitTestHandle(x, y);
    dragStart = { x, y };
    hatStart = { ...hat };

    if (handleHit && handleHit.type === "rotate") {
      dragMode = "rotate";
    } else if (handleHit && handleHit.type === "resize") {
      dragMode = "resize";
      dragHandle = handleHit.corner;
      resizeOppositeName = OPPOSITE[handleHit.corner];
      resizeAnchor = getCorner(hat, resizeOppositeName);
    } else if (pointInHat(x, y, hat)) {
      dragMode = "move";
    } else {
      dragMode = null;
    }

    if (dragMode) {
      window.addEventListener("mousemove", pointerMove);
      window.addEventListener("mouseup", pointerUp);
      window.addEventListener("touchmove", pointerMove, { passive: false });
      window.addEventListener("touchend", pointerUp);
    }
  }

  function pointerMove(evt) {
    if (!dragMode || !hat) return;
    evt.preventDefault();
    const { x, y } = canvasCoordsFromEvent(evt);

    if (dragMode === "move") {
      hat.cx = hatStart.cx + (x - dragStart.x);
      hat.cy = hatStart.cy + (y - dragStart.y);
    } else if (dragMode === "rotate") {
      hat.angle = Math.atan2(y - hat.cy, x - hat.cx) + Math.PI / 2;
    } else if (dragMode === "resize") {
      const dx = x - resizeAnchor.x;
      const dy = y - resizeAnchor.y;
      const local = inverseRotatePoint(dx, dy, hatStart.angle);
      const sign = CORNER_SIGN[dragHandle];
      const rawW = local.x * sign.x;
      const rawH = local.y * sign.y;

      const scale = (rawW / hatStart.w + rawH / hatStart.h) / 2;
      let newW = Math.max(MIN_SIZE, hatStart.w * scale);
      let newH = Math.max(MIN_SIZE, hatStart.h * scale);

      const oppositeMult = CORNER_MULT[resizeOppositeName];
      const localOpp = { x: (oppositeMult.x * newW) / 2, y: (oppositeMult.y * newH) / 2 };
      const rotatedOpp = rotatePoint(localOpp.x, localOpp.y, hatStart.angle);

      hat.w = newW;
      hat.h = newH;
      hat.cx = resizeAnchor.x - rotatedOpp.x;
      hat.cy = resizeAnchor.y - rotatedOpp.y;
    }

    render();
  }

  function pointerUp() {
    dragMode = null;
    dragHandle = null;
    window.removeEventListener("mousemove", pointerMove);
    window.removeEventListener("mouseup", pointerUp);
    window.removeEventListener("touchmove", pointerMove);
    window.removeEventListener("touchend", pointerUp);
  }

  overlayCanvas.addEventListener("mousedown", pointerDown);
  overlayCanvas.addEventListener("touchstart", pointerDown, { passive: false });

  window.addEventListener("resize", () => {
    if (hat) render();
  });
})();
