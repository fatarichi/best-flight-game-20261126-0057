// Coral Coast Run — keyboard and mouse input, read once per frame
// into one control object the flight model consumes.

export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, active: false, down: false };
  const pressed = new Set(); // keys hit since the last read, edge-triggered

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width - 0.5;
    mouse.y = (e.clientY - r.top) / r.height - 0.5;
    mouse.active = true;
  });
  canvas.addEventListener('mousedown', (e) => {
    mouse.down = true;
    mouse.active = true;
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width - 0.5;
    mouse.y = (e.clientY - r.top) / r.height - 0.5;
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });

  function read() {
    // Pitch: W / Up is nose up; S / Down is nose down. Mouse up is nose up.
    let pitch = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) pitch += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) pitch -= 1;
    // Roll: D / Right banks right; A / Left banks left. Mouse steers too.
    let roll = 0;
    if (keys.has('KeyD') || keys.has('ArrowRight')) roll += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) roll -= 1;
    if (roll === 0 && pitch === 0 && mouse.active && mouse.down) {
      roll = clamp(mouse.x * 2.4, -1, 1);
      pitch = clamp(-mouse.y * 2.2, -1, 1);
    }
    // Throttle: R raises it, F lowers it; Shift / Control do the same.
    let throttle = 0;
    if (keys.has('KeyR') || keys.has('ShiftLeft') || keys.has('ShiftRight')) throttle += 1;
    if (keys.has('KeyF') || keys.has('ControlLeft') || keys.has('ControlRight')) throttle -= 1;

    return {
      pitch,
      roll,
      throttle,
      brake: keys.has('Space'),
      gear: takePressed('KeyG'),
      pause: takePressed('KeyP'),
      mute: takePressed('KeyM'),
      confirm: takePressed('Enter') || takePressed('NumpadEnter'),
      escape: takePressed('Escape'),
      digit: takePressed('Digit1') ? 0 : takePressed('Digit2') ? 1 : takePressed('Digit3') ? 2 : -1,
      clicked: takeClicked(),
    };
  }

  let clicked = false;
  canvas.addEventListener('mousedown', () => {
    clicked = true;
  });

  function takePressed(code) {
    if (pressed.has(code)) {
      pressed.delete(code);
      return true;
    }
    return false;
  }
  function takeClicked() {
    const c = clicked;
    clicked = false;
    return c;
  }

  return { read, keys, mouse };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
