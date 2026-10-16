// MediaMTX를 media/ 폴더 기준으로 실행한다. (Windows: mediamtx.exe, 그 외: mediamtx)
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const mediaDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'media');
const bin = path.join(mediaDir, process.platform === 'win32' ? 'mediamtx.exe' : 'mediamtx');

if (!existsSync(bin)) {
  console.error(`MediaMTX 실행 파일이 없습니다: ${bin}`);
  console.error('https://github.com/bluenviron/mediamtx/releases 에서 내려받아 media/ 폴더에 넣어주세요.');
  process.exit(1);
}

const child = spawn(bin, ['mediamtx.yml'], { cwd: mediaDir, stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill());
