// WHEP 시청 클라이언트: MediaMTX에서 WebRTC로 영상을 받는다. (지연 1초 미만)
import { closeSession, negotiate, type ConnectionState } from './webrtc.ts';

export interface PlayOptions {
  onStateChange?: (state: ConnectionState) => void;
}

export class WhepPlayer {
  private pc: RTCPeerConnection | null = null;
  private sessionUrl: string | null = null;

  /** 연결하고, 받은 트랙이 담길 MediaStream을 돌려준다. */
  async start(endpoint: string, options: PlayOptions = {}): Promise<MediaStream> {
    const pc = new RTCPeerConnection();
    this.pc = pc;
    const stream = new MediaStream();

    pc.addEventListener('connectionstatechange', () => options.onStateChange?.(pc.connectionState));
    pc.addEventListener('track', (e) => stream.addTrack(e.track));

    // 받기만 하는(recvonly) 영상/음성 채널을 하나씩 연다
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });

    try {
      this.sessionUrl = await negotiate(pc, endpoint);
    } catch (err) {
      await this.stop();
      throw err;
    }
    return stream;
  }

  async stop() {
    const { pc, sessionUrl } = this;
    this.pc = null;
    this.sessionUrl = null;
    await closeSession(pc, sessionUrl);
  }

  async getStats(): Promise<RTCStatsReport | null> {
    return this.pc ? this.pc.getStats() : null;
  }
}
