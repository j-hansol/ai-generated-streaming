// WHIP / WHEP 공통 로직
//
// WHIP(송출)과 WHEP(시청)은 둘 다 "HTTP 한 번으로 SDP를 교환하는" 단순한 규격이다.
//   1. 브라우저가 SDP offer를 만들어 POST (Content-Type: application/sdp)
//   2. 서버가 201 Created + SDP answer를 돌려주고, Location 헤더로 세션 주소를 알려준다
//   3. 끝낼 때는 그 세션 주소로 DELETE
// 규격: WHIP = RFC 9725, WHEP = draft-ietf-wish-whep

export type ConnectionState = RTCPeerConnectionState;

/** ICE 후보 수집이 끝날 때까지 기다린다. (로컬 환경이라 trickle ICE 없이 한 번에 보낸다) */
function waitIceGathering(pc: RTCPeerConnection, timeoutMs = 2000): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener('icegatheringstatechange', onChange);
      clearTimeout(timer);
      resolve();
    };
    const onChange = () => pc.iceGatheringState === 'complete' && done();
    const timer = setTimeout(done, timeoutMs);
    pc.addEventListener('icegatheringstatechange', onChange);
  });
}

/** offer를 만들어 서버에 보내고 answer를 적용한다. 세션 주소(삭제용)를 돌려준다. */
export async function negotiate(pc: RTCPeerConnection, endpoint: string): Promise<string | null> {
  await pc.setLocalDescription(await pc.createOffer());
  await waitIceGathering(pc);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/sdp' },
    body: pc.localDescription!.sdp,
  });

  if (res.status !== 201) {
    const detail = await res.text().catch(() => '');
    throw new Error(describeError(res.status, detail));
  }

  const location = res.headers.get('Location');
  const sessionUrl = location ? new URL(location, endpoint).toString() : null;

  // 서버 응답을 기다리는 사이에 연결이 취소됐다면, 서버에 생긴 세션도 지운다
  if (pc.signalingState === 'closed') {
    await closeSession(null, sessionUrl);
    throw new Error('연결이 취소되었습니다.');
  }

  const answer = await res.text();
  await pc.setRemoteDescription({ type: 'answer', sdp: answer });

  // SDP 교환(HTTP)이 성공해도 실제 영상 경로(ICE/UDP)가 막혀 있으면 'connecting'에서 멈춘다.
  // 끝없이 기다리지 않도록 제한 시간 안에 연결되지 않으면 실패로 처리한다.
  try {
    await waitConnected(pc);
  } catch (err) {
    await closeSession(pc, sessionUrl);
    throw err;
  }
  return sessionUrl;
}

const CONNECT_TIMEOUT_MS = 10_000;

function waitConnected(pc: RTCPeerConnection, timeoutMs = CONNECT_TIMEOUT_MS): Promise<void> {
  if (pc.connectionState === 'connected') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = (err?: Error) => {
      pc.removeEventListener('connectionstatechange', onChange);
      clearTimeout(timer);
      if (err) reject(err);
      else resolve();
    };
    const onChange = () => {
      if (pc.connectionState === 'connected') finish();
      else if (pc.connectionState === 'failed') finish(new Error(ICE_FAILED));
      else if (pc.connectionState === 'closed') finish(new Error('연결이 취소되었습니다.'));
    };
    const timer = setTimeout(() => finish(new Error(ICE_FAILED)), timeoutMs);
    pc.addEventListener('connectionstatechange', onChange);
  });
}

const ICE_FAILED =
  '미디어 서버와 영상 연결(ICE)을 맺지 못했습니다. 신호 교환은 됐지만 영상이 오갈 UDP 경로가 막혀 있습니다. (media/mediamtx.yml의 webrtc 주소 설정과 방화벽을 확인하세요)';

export async function closeSession(pc: RTCPeerConnection | null, sessionUrl: string | null) {
  pc?.close();
  if (sessionUrl) await fetch(sessionUrl, { method: 'DELETE' }).catch(() => undefined);
}

function describeError(status: number, detail: string): string {
  let message = detail;
  try {
    message = (JSON.parse(detail) as { error?: string }).error ?? detail;
  } catch {
    /* 본문이 JSON이 아니면 그대로 쓴다 */
  }
  switch (status) {
    case 400:
      return `잘못된 요청입니다. (${message})`;
    case 401:
    case 403:
      return '권한이 없습니다.';
    case 404:
      return '방송이 아직 시작되지 않았습니다.';
    default:
      return `미디어 서버 오류 (HTTP ${status}) ${message}`;
  }
}

/** 코덱 우선순위 지정: 맨 앞에 둔 코덱을 우선 협상한다. */
export function preferCodec(transceiver: RTCRtpTransceiver, kind: 'video' | 'audio', mimeType: string) {
  const codecs = RTCRtpReceiver.getCapabilities(kind)?.codecs;
  if (!codecs || !('setCodecPreferences' in transceiver)) return;
  const target = mimeType.toLowerCase();
  const sorted = [
    ...codecs.filter((c) => c.mimeType.toLowerCase() === target),
    ...codecs.filter((c) => c.mimeType.toLowerCase() !== target),
  ];
  transceiver.setCodecPreferences(sorted);
}
