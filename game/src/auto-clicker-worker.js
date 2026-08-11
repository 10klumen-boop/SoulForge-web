// ===== Автоудар: worker-метроном (меньше троттлинга Chrome в фоне/под перекрытием) =====
// Ping-pong: тик → main → ack → следующий тик. Без очереди сообщений после часа AFK.

let timerId = null;
let intervalMs = 50;
let running = false;

function clearTimer() {
  if (timerId != null) {
    clearTimeout(timerId);
    timerId = null;
  }
}

function armNext() {
  clearTimer();
  if (!running) return;
  const wait = Math.max(16, intervalMs | 0);
  timerId = setTimeout(() => {
    timerId = null;
    postMessage({ type: "tick", t: Date.now() });
  }, wait);
}

self.onmessage = (e) => {
  const data = e && e.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "start") {
    const next = Number(data.intervalMs);
    if (Number.isFinite(next) && next > 0) intervalMs = next;
    running = true;
    armNext();
    return;
  }
  if (data.type === "ack") {
    const next = Number(data.intervalMs);
    if (Number.isFinite(next) && next > 0) intervalMs = next;
    if (running) armNext();
    return;
  }
  if (data.type === "stop") {
    running = false;
    clearTimer();
  }
};
