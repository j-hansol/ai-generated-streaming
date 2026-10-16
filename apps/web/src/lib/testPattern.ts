// 카메라가 없어도 송출을 시험할 수 있는 테스트 화면.
// 밀리초 단위 시계를 그리므로, 시청 화면의 "현재 시각"과 비교하면 지연 시간을 눈으로 잴 수 있다.

export interface TestPattern {
  stream: MediaStream;
  stop: () => void;
}

export function createTestPattern(title: string, width = 1280, height = 720, fps = 30): TestPattern {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const startedAt = performance.now();

  const draw = () => {
    const now = new Date();
    const t = (performance.now() - startedAt) / 1000;

    ctx.fillStyle = '#10213f';
    ctx.fillRect(0, 0, width, height);

    // 움직이는 막대: 영상이 멈췄는지 바로 알 수 있다
    const barX = ((t * 240) % (width + 200)) - 200;
    ctx.fillStyle = '#2f6fed';
    ctx.fillRect(barX, height - 60, 200, 24);

    ctx.fillStyle = '#9fb3d9';
    ctx.font = '600 36px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, 140);

    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 140px ui-monospace, Consolas, monospace';
    ctx.fillText(`${hh}:${mm}:${ss}.${ms}`, width / 2, height / 2 + 50);

    ctx.fillStyle = '#9fb3d9';
    ctx.font = '400 28px system-ui, sans-serif';
    ctx.fillText('테스트 화면 · 시청 화면의 현재 시각과 비교해 지연 시간을 확인하세요', width / 2, height / 2 + 130);
  };

  draw();
  const ticker = createBackgroundTicker(1000 / fps, draw);
  const stream = canvas.captureStream(fps);

  return {
    stream,
    stop: () => {
      ticker.stop();
      stream.getTracks().forE
      ch((t) => t.stop());
    },
  };
}

/**
 * 탭이 가려져도 일정한 간격으로 callback을 부른다.
 *
 * 브라우저는 안 보이는 탭의 requestAnimationFrame을 멈추고, setInterval도 1초에 한 번
 * (Chrome은 5분 뒤 1분에 한 번)으로 늦춘다. 그러면 강사가 다른 탭을 보는 동안 송출 영상이 멈춘다.
 * Web Worker 안의 타이머는 이 제한을 받지 않으므로, Worker가 박자를 보내고 화면에서는 그림만 그린다.
 */
function createBackgroundTicker(intervalMs: number, callback: () => void) {
  const source = `setInterval(() => postMessage(0), ${intervalMs});`;
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  const worker = new Worker(url);
  worker.onmessage = callback;

  return {
    stop: () => {
      worker.terminate();
      URL.revokeObjectURL(url);
    },
  };
}
