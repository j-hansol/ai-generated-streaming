import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export const config = {
  port: Number(process.env.API_PORT ?? 3000),
  host: process.env.API_HOST ?? '127.0.0.1',
  dbFile: process.env.DB_FILE ?? path.join(rootDir, 'data', 'app.db'),
  mediamtx: {
    /** Node 서버가 내부적으로 호출하는 MediaMTX 제어 API */
    apiUrl: process.env.MEDIAMTX_API_URL ?? 'http://127.0.0.1:9997',
    /** 브라우저가 접속하는 주소 */
    webrtcUrl: process.env.MEDIAMTX_WEBRTC_URL ?? 'http://localhost:8889',
    hlsUrl: process.env.MEDIAMTX_HLS_URL ?? 'http://localhost:8888',
    rtmpUrl: process.env.MEDIAMTX_RTMP_URL ?? 'rtmp://localhost:1935',
  },
};
