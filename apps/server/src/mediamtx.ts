// MediaMTX 제어 API 클라이언트
// 문서: https://bluenviron.github.io/mediamtx/
import type { LiveInfo } from '@streaming/shared';
import { config } from './config.ts';

interface MtxPath {
  name: string;
  ready: boolean;
  readyTime: string | null;
  tracks: string[];
  source: { type: string; id: string } | null;
  readers: { type: string; id: string }[];
}

interface MtxPathList {
  itemCount: number;
  items: MtxPath[];
}

export const OFFLINE: LiveInfo = { status: 'idle', viewers: 0, tracks: [], liveSince: null };

const toLiveInfo = (p: MtxPath | undefined): LiveInfo =>
  p?.ready
    ? {
        status: 'live',
        // WebRTC 시청자는 webRTCSession, HLS 시청자는 hlsSession으로 집계된다
        viewers: p.readers.length,
        tracks: p.tracks,
        liveSince: p.readyTime,
      }
    : OFFLINE;

const api = (pathname: string, init?: RequestInit) =>
  fetch(`${config.mediamtx.apiUrl}${pathname}`, { signal: AbortSignal.timeout(1500), ...init });

/** 송출 연결 종류별 강제 종료 API */
const KICK_ENDPOINT: Record<string, string> = {
  webRTCSession: 'webrtcsessions',
  rtmpConn: 'rtmpconns',
};

export const mediamtx = {
  async isUp(): Promise<boolean> {
    return api('/v3/paths/list')
      .then((r) => r.ok)
      .catch(() => false);
  },

  /** 모든 경로의 방송 상태. MediaMTX가 꺼져 있으면 빈 Map을 돌려준다. */
  async liveInfoByPath(): Promise<Map<string, LiveInfo>> {
    try {
      const res = await api('/v3/paths/list?itemsPerPage=1000');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as MtxPathList;
      return new Map(body.items.map((p) => [p.name, toLiveInfo(p)]));
    } catch {
      return new Map();
    }
  },

  async liveInfo(path: string): Promise<LiveInfo> {
    return (await this.liveInfoByPath()).get(path) ?? OFFLINE;
  },

  /** 송출 중인 연결을 끊는다 (강의실 삭제 시 사용) */
  async kickPublisher(path: string): Promise<void> {
    const res = await api(`/v3/paths/get/${path}`).catch(() => null);
    if (!res?.ok) return;
    const { source } = (await res.json()) as MtxPath;
    const endpoint = source && KICK_ENDPOINT[source.type];
    if (endpoint) await api(`/v3/${endpoint}/kick/${source.id}`, { method: 'POST' }).catch(() => null);
  },
};
