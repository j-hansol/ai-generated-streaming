// 서버와 웹이 함께 쓰는 타입

export type ClassroomStatus = 'idle' | 'live';

export interface Classroom {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  /** MediaMTX 상의 경로 (예: classroom/abc123) */
  mediaPath: string;
}

/** 실시간 방송 상태 (MediaMTX API에서 조회) */
export interface LiveInfo {
  status: ClassroomStatus;
  /** 현재 시청자 수 (WebRTC + HLS 합계) */
  viewers: number;
  /** 송출 중인 트랙 코덱 목록 (예: ["H264", "Opus"]) */
  tracks: string[];
  liveSince: string | null;
}

export interface ClassroomWithLive extends Classroom {
  live: LiveInfo;
}

export interface CreateClassroomRequest {
  title: string;
  description?: string;
}

/** 브라우저가 미디어 서버에 접속할 주소 */
export interface MediaUrls {
  /** WebRTC 송출 (WHIP) */
  whip: string;
  /** WebRTC 시청 (WHEP) */
  whep: string;
  /** LL-HLS 시청 */
  hls: string;
  /** OBS 송출용 RTMP 주소 */
  rtmp: string;
}
