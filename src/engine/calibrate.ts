// Calibration screen: a line sweeps across a mini bar and crosses the center mark on every beat
// (with a click). The player taps along; the average lateness becomes the calibration offset.
import { computeCalibration, tapOffsets } from '../core/calibration';
import { phaseToPos } from '../core/combat';
import type { App } from './app';

const INTERVAL = 600; // ms per beat (100 BPM)
const COUNT_IN = 4;
const RECORD = 12;

export function runCalibration(app: App, onDone: () => void): void {
  const root = document.getElementById('calib')!;
  app.calibrating = true;
  app.syncClock(performance.now());
  root.hidden = false;
  root.innerHTML = `
    <div class="cal-box">
      <div class="cal-title">CALIBRATE</div>
      <p class="cal-help">Tap anywhere on this screen each time the line crosses the center mark.
      ${COUNT_IN} count-in beats, then ${RECORD} beats. Watch the line; the click is a guide.</p>
      <div class="cal-bar"><div class="cal-mark"></div><div class="cal-cursor"></div></div>
      <div class="cal-status">Press Start, then tap along.</div>
      <div class="cal-buttons">
        <button class="dbg-btn" data-act="start">Start</button>
        <button class="dbg-btn" data-act="save" hidden>Save</button>
        <button class="dbg-btn" data-act="cancel">Close</button>
      </div>
    </div>`;
  const cursor = root.querySelector<HTMLElement>('.cal-cursor')!;
  const mark = root.querySelector<HTMLElement>('.cal-mark')!;
  const bar = root.querySelector<HTMLElement>('.cal-bar')!;
  const status = root.querySelector<HTMLElement>('.cal-status')!;
  const btnStart = root.querySelector<HTMLButtonElement>('[data-act=start]')!;
  const btnSave = root.querySelector<HTMLButtonElement>('[data-act=save]')!;
  const btnCancel = root.querySelector<HTMLButtonElement>('[data-act=cancel]')!;

  let beats: number[] = [];
  let taps: number[] = [];
  let beat0 = 0;
  let running = false;
  let raf = 0;
  let result = 0;

  const frame = () => {
    const now = performance.now();
    const ref = beat0 || now;
    const pos = phaseToPos((now - ref) / INTERVAL + 0.5);
    cursor.style.left = `${pos * 100}%`;
    if (running) {
      const i = Math.round((now - beat0) / INTERVAL);
      const near = Math.abs(now - (beat0 + i * INTERVAL)) < 70 && i >= 0 && i < beats.length;
      mark.classList.toggle('flash', near);
      if (i < COUNT_IN) status.textContent = i < 0 ? 'Get ready…' : `${COUNT_IN - i}…`;
      else if (i < beats.length) status.textContent = `Tap along!  ${taps.length} taps`;
      if (now > beats[beats.length - 1] + INTERVAL * 0.8) finish();
    }
    raf = requestAnimationFrame(frame);
  };

  const start = () => {
    app.audio.unlock();
    taps = [];
    beat0 = performance.now() + 900;
    beats = Array.from({ length: COUNT_IN + RECORD }, (_, i) => beat0 + i * INTERVAL);
    running = true;
    btnStart.hidden = true;
    btnSave.hidden = true;
    const ctx = app.audio.ctx;
    if (ctx) {
      const lat = app.audio.latency;
      const nowPerf = performance.now();
      beats.forEach((b, i) => app.audio.clickAt(ctx.currentTime + Math.max(0, (b - nowPerf) / 1000 - lat), i < COUNT_IN || (i - COUNT_IN) % 4 === 0));
    }
  };

  const finish = () => {
    running = false;
    const recBeats = beats.slice(COUNT_IN);
    const offsets = tapOffsets(taps, recBeats, INTERVAL * 0.4);
    const r = computeCalibration(offsets, 8);
    btnStart.hidden = false;
    btnStart.textContent = 'Retry';
    if (r.ok) {
      result = r.offsetMs;
      const dir = r.offsetMs >= 0 ? 'late' : 'early';
      status.textContent = `You tap ${Math.abs(r.offsetMs)} ms ${dir} (spread ${r.spreadMs} ms, ${r.count} taps). Save to apply.`;
      btnSave.hidden = false;
    } else status.textContent = `Only ${offsets.length} taps counted. Need 8+. Retry?`;
  };

  const close = () => {
    cancelAnimationFrame(raf);
    root.hidden = true;
    root.innerHTML = '';
    root.removeEventListener('pointerdown', onTap);
    app.calibrating = false;
    app.syncClock(performance.now());
    onDone();
  };

  const onTap = (e: PointerEvent) => {
    if ((e.target as Element).closest('button')) return;
    e.preventDefault();
    if (!running) return;
    const first = beats[COUNT_IN] - INTERVAL / 2;
    if (e.timeStamp >= first) taps.push(e.timeStamp);
    bar.classList.add('tap');
    window.setTimeout(() => bar.classList.remove('tap'), 60);
  };

  root.addEventListener('pointerdown', onTap, { passive: false });
  btnStart.onclick = start;
  btnSave.onclick = () => {
    app.settings.calibrationMs = result;
    app.save();
    status.textContent = `Saved: ${result} ms.`;
    btnSave.hidden = true;
  };
  btnCancel.onclick = close;
  raf = requestAnimationFrame(frame);
}
