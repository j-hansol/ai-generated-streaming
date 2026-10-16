// RTCPeerConnection.getStats() 결과를 사람이 읽기 쉬운 값으로 바꾼다.

export interface VideoStats {
  /** 초당 비트 (직전 측정 대비) */
  bitrate: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  /** 수신 측 지터 버퍼 지연 (ms). 송출 측에서는 0 */
  jitterBufferMs: number;
}

interface Sample {
  bytes: number;
  timestamp: number;
}

/** 호출할 때마다 직전 호출과 비교해 비트레이트를 계산하는 측정기 */
export function createVideoStatsMeter(direction: 'outbound' | 'inbound') {
  let prev: Sample | null = null;

  return (report: RTCStatsReport): VideoStats | null => {
    let rtp: Record<string, any> | null = null;
    report.forEach((s) => {
      if (s.type === `${direction}-rtp` && s.kind === 'video') rtp = s;
    });
    if (!rtp) return null;
    const r: Record<string, any> = rtp;

    const bytes: number = direction === 'outbound' ? r.bytesSent : r.bytesReceived;
    const bitrate = prev && r.timestamp > prev.timestamp ? ((bytes - prev.bytes) * 8 * 1000) / (r.timestamp - prev.timestamp) : 0;
    prev = { bytes, timestamp: r.timestamp };

    const codec = r.codecId ? (report.get(r.codecId)?.mimeType as string | undefined)?.split('/')[1] ?? '' : '';
    const jitterBufferMs =
      direction === 'inbound' && r.jitterBufferEmittedCount ? (r.jitterBufferDelay / r.jitterBufferEmittedCount) * 1000 : 0;

    return {
      bitrate,
      width: r.frameWidth ?? 0,
      height: r.frameHeight ?? 0,
      fps: r.framesPerSecond ?? 0,
      codec,
      jitterBufferMs,
    };
  };
}

export const formatBitrate = (bps: number) =>
  bps >= 1_000_000 ? `${(bps / 1_000_000).toFixed(2)} Mbps` : `${Math.round(bps / 1000)} kbps`;
