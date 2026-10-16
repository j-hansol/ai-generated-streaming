// pnpm dev 실행 전에 필요한 포트가 비어 있는지 확인한다.
// 이미 다른 프로그램(예: 이전에 실행한 pnpm dev)이 쓰고 있으면 알아보기 쉬운 메시지를 출력하고 멈춘다.
import net from 'node:net';
import { execFileSync } from 'node:child_process';

const PORTS = [
  { port: 5173, name: '웹 (Vite)' },
  { port: Number(process.env.API_PORT ?? 3000), name: 'API 서버' },
  { port: 8888, name: 'MediaMTX LL-HLS' },
  { port: 8889, name: 'MediaMTX WebRTC' },
  { port: 9997, name: 'MediaMTX 제어 API' },
  { port: 1935, name: 'MediaMTX RTMP' },
];

/** 127.0.0.1과 ::1 둘 중 하나라도 사용 중이면 true */
const isInUse = (port) =>
  Promise.all(
    ['127.0.0.1', '::1'].map(
      (host) =>
        new Promise((resolve) => {
          const server = net.createServer();
          server.once('error', (err) => resolve(err.code === 'EADDRINUSE'));
          server.once('listening', () => server.close(() => resolve(false)));
          server.listen(port, host);
        }),
    ),
  ).then((results) => results.some(Boolean));

/** 포트를 쓰는 프로세스 이름과 PID (Windows 전용, 실패하면 빈 문자열) */
function ownerOf(port) {
  if (process.platform !== 'win32') return '';
  try {
    const script =
      `Get-NetTCPConnection -State Listen -LocalPort ${port} | Select-Object -First 1 | ` +
      `ForEach-Object { $p = Get-Process -Id $_.OwningProcess; '{0} (PID {1})' -f $p.ProcessName, $p.Id }`;
    return execFileSync('powershell', ['-NoProfile', '-Command', script], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

const busy = [];
for (const p of PORTS) if (await isInUse(p.port)) busy.push({ ...p, owner: ownerOf(p.port) });

if (busy.length > 0) {
  console.error('\n[포트 확인] 다음 포트를 이미 다른 프로그램이 사용 중입니다:\n');
  for (const b of busy) console.error(`  - ${b.port} (${b.name})${b.owner ? ` ← ${b.owner}` : ''}`);
  console.error('\n이전에 실행한 pnpm dev가 아직 켜져 있을 가능성이 큽니다. 그 터미널에서 Ctrl+C로 끄거나,');
  console.error('위 PID를 작업 관리자에서 종료한 뒤 다시 실행하세요.\n');
  process.exit(1);
}
