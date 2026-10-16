// WHIP 송출 클라이언트: 브라우저의 MediaStream을 MediaMTX로 보낸다.
import { closeSession, negotiate, preferCodec, type ConnectionState } from './webrtc.ts';

export interface PublishOptions {
  /** 영상 최대 비트레이트 (bps) */
  maxVideoBitrate?: number;
  onStateChange?: (state: ConnectionState) => void;
}

export class WhipPublisher {
  private pc: RTCPeerConnection | null = null;
  private sessionUrl: string | null = null;

  async start(endpoint: string, stream: MediaStream, options: PublishOptions = {}) {
    const pc = new RTCPeerConnection();
    this.pc = pc;
    pc.addEventListener('connectionstatechange', () => options.onStateChange?.(pc.connectionState));

    for (const track of stream.getTracks()) {
      const transceiver = pc.addTransceiver(track, { direction: 'sendonly', streams: [stream] });

      if (track.kind === 'video') {
        // LL-HLS로도 볼 수 있도록 H264를 우선한다 (HLS는 VP8을 지원하지 않는다)
        preferCodec(transceiver, 'video', 'video/H264');

        if (options.maxVideoBitrate) {
          const params = transceiver.sender.getParameters();
          params.encodings = [{ ...(params.encodings?.[0] ?? {}), maxBitrate: options.maxVideoBitrate }];
          await transceiver.sender.setParameters(params).catch(() => undefined);
        }
      }
    }

    try {
      this.sessionUrl = await negotiate(pc, endpoint);
    } catch (err) {
      await this.stop();
      throw err;
    }
  }

  async stop() {
    const { pc, sessionUrl } = this;
    this.pc = null;
    this.sessionUrl = null;
    await closeSession(pc, sessionUrl);
  }

  /** 송출 통계 (비트레이트 계산용) */
  async getStats(): Promise<RTCStatsReport | null> {
    return this.pc ? this.pc.getStats() : null;
  }
}
