import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { MediaUrls } from '@streaming/shared';
import { api } from '../api.ts';
import { formatClock, usePolling } from '../hooks.ts';
import { LiveBadge, Stat } from '../components.tsx';
import { WhipPublisher } from '../lib/whip.ts';
import { createTestPattern } from '../lib/testPattern.ts';
import { createVideoStatsMeter, formatBitrate, type VideoStats } from '../lib/stats.ts';

type Source = 'screen' | 'camera' | 'test';
type Phase = 'idle' | 'starting' | 'live';

const SOURCE_LABEL: Record<Source, string> = {
  screen: '화면 공유',
  camera: '웹캠',
  test: '테스트 화면 (카메라 없이 시험)',
};

/** 선택한 입력 장치로 MediaStream을 만든다. cleanup은 장치를 끄는 함수. */
async function openSource(source: Source, withMic: boolean, title: string) {
  const cleanups: (() => void)[] = [];
  let stream: MediaStream;

  if (source === 'screen') {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
    // 글씨가 많은 화면은 프레임보다 선명도를 우선한다
    stream.getVideoTracks().forEach((t) => (t.contentHint = 'detail'));
  } else if (source === 'camera') {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
  } else {
    const pattern = createTestPattern(title);
    stream = pattern.stream;
    cleanups.push(pattern.stop);
  }

  if (withMic) {
    const mic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    mic.getAudioTracks().forEach((t) => stream.addTrack(t));
  }

  cleanups.push(() => stream.getTracks().forEach((t) => t.stop()));
  return { stream, cleanup: () => cleanups.forEach((fn) => fn()) };
}

/** 영상 트랙이 끊겼을 때(ended 이벤트) 입력별 안내 문구 */
const ENDED_REASON: Record<Source, string> = {
  screen:
    '화면 공유가 중지되어 강의가 종료되었습니다. (브라우저의 "공유 중지"를 눌렀거나, 공유하던 탭·창이 닫히거나 새로고침되었습니다)',
  camera: '카메라 연결이 끊어져 강의가 종료되었습니다. (카메라 분리 또는 다른 프로그램이 카메라를 가져감)',
  test: '테스트 화면이 중지되어 강의가 종료되었습니다.',
};

/** sessionStorage는 사생활 보호 모드 등에서 실패할 수 있으므로 감싼다 */
const storage = {
  get: (key: string) => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string) => {
    try {
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      /* 무시 */
    }
  },
  remove: (key: string) => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* 무시 */
    }
  },
};

function describeMediaError(err: unknown): string {
  const e = err as DOMException;
  if (e.name === 'NotAllowedError') return '화면/카메라/마이크 사용 권한이 거부되었습니다.';
  if (e.name === 'NotFoundError') return '사용할 수 있는 카메라나 마이크가 없습니다.';
  if (e.name === 'NotReadableError') return '다른 프로그램이 장치를 사용 중입니다.';
  return e.message ?? String(err);
}

export function TeachPage() {
  const { id = '' } = useParams();
  const classroom = usePolling(() => api.getClassroom(id), 3000);
  const [urls, setUrls] = useState<MediaUrls | null>(null);

  const [source, setSource] = useState<Source>('screen');
  const [withMic, setWithMic] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [connState, setConnState] = useState<RTCPeerConnectionState>('new');
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<VideoStats | null>(null);
  /** 강의가 왜 끝났는지 (사용자가 직접 끈 경우는 표시하지 않음) */
  const [notice, setNotice] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const publisherRef = useRef<WhipPublisher | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    api.getMediaUrls(id).then(setUrls, (err: Error) => setError(err.message));
  }, [id]);

  const liveKey = `teach-live:${id}`;

  /** 송출을 끝낸다. reason을 주면 왜 끝났는지 화면에 남긴다. */
  const stop = async (reason?: string) => {
    await publisherRef.current?.stop();
    publisherRef.current = null;
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    storage.remove(liveKey);
    if (reason) {
      setNotice(`${formatClock(new Date())} · ${reason}`);
      console.info('[강의 종료]', reason);
    }
    setPhase('idle');
    setConnState('closed');
    setStats(null);
    void classroom.reload();
  };

  // 송출 중에 페이지가 새로고침되거나 닫히면 stop()이 불리지 않아 표시가 남는다. 이걸로 원인을 알려준다.
  useEffect(() => {
    if (storage.get(liveKey)) {
      storage.remove(liveKey);
      setNotice('이전 강의는 강의 페이지가 새로고침되거나 닫혀서 종료되었습니다.');
    }
  }, [liveKey]);

  const start = async () => {
    if (!urls) return;
    setError(null);
    setNotice(null);
    setPhase('starting');
    try {
      const { stream, cleanup } = await openSource(source, withMic, classroom.data?.title ?? '강의');
      cleanupRef.current = cleanup;
      if (videoRef.current) videoRef.current.srcObject = stream;

      // 브라우저의 "공유 중지" 버튼, 공유하던 탭/창 닫기, 카메라 분리 등으로 영상이 끊기면 방송도 끝낸다
      stream.getVideoTracks()[0]?.addEventListener('ended', () => void stop(ENDED_REASON[source]));

      const publisher = new WhipPublisher();
      publisherRef.current = publisher;
      await publisher.start(urls.whip, stream, {
        maxVideoBitrate: 2_500_000,
        onStateChange: (state) => {
          setConnState(state);
          if (state === 'failed') void stop('미디어 서버와의 연결이 끊어져 강의가 종료되었습니다. 다시 시작해주세요.');
        },
      });
      storage.set(liveKey);
      setPhase('live');
      void classroom.reload();
    } catch (err) {
      setError(err instanceof DOMException ? describeMediaError(err) : (err as Error).message);
      await stop();
    }
  };

  // 송출 통계: 1초마다 측정
  useEffect(() => {
    if (phase !== 'live') return;
    const measure = createVideoStatsMeter('outbound');
    const timer = setInterval(async () => {
      const report = await publisherRef.current?.getStats();
      if (report) setStats(measure(report));
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // 페이지를 떠나면 송출을 끝낸다
  useEffect(() => () => void stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (classroom.error && !classroom.data) return <p className="error-text">{classroom.error}</p>;
  const room = classroom.data;

  return (
    <>
      <div className="page-head">
        <div>
          <Link to="/" className="muted">
            ← 강의실 목록
          </Link>
          <h1>{room?.title ?? '…'}</h1>
        </div>
        {room && <LiveBadge live={room.live} />}
      </div>
      {classroom.error && <div className="alert alert-error">{classroom.error}</div>}

      <div className="layout">
        <section className="video-box">
          <video ref={videoRef} autoPlay muted playsInline />
          {phase === 'idle' && <div className="video-overlay">송출 전입니다. 입력을 고르고 강의를 시작하세요.</div>}
        </section>

        <aside className="card side">
          <h2>송출 설정</h2>
          <fieldset className="choices" disabled={phase !== 'idle'}>
            {(Object.keys(SOURCE_LABEL) as Source[]).map((s) => (
              <label key={s}>
                <input type="radio" name="source" checked={source === s} onChange={() => setSource(s)} />
                {SOURCE_LABEL[s]}
              </label>
            ))}
            <label className="check">
              <input type="checkbox" checked={withMic} onChange={(e) => setWithMic(e.target.checked)} />
              마이크 켜기
            </label>
          </fieldset>

          {phase === 'live' ? (
            <button className="btn btn-danger btn-block" onClick={() => void stop()}>
              강의 종료
            </button>
          ) : (
            <button className="btn btn-primary btn-block" onClick={() => void start()} disabled={!urls || phase === 'starting'}>
              {phase === 'starting' ? '연결 중…' : '강의 시작'}
            </button>
          )}
          {error && <p className="error-text">{error}</p>}
          {notice && phase === 'idle' && <p className="notice-text">{notice}</p>}

          {phase === 'live' && (
            <div className="stats">
              <Stat label="연결 상태" value={connState} />
              <Stat label="코덱" value={stats?.codec || '-'} />
              <Stat label="해상도" value={stats ? `${stats.width}×${stats.height}` : '-'} />
              <Stat label="프레임" value={stats ? `${Math.round(stats.fps)} fps` : '-'} />
              <Stat label="비트레이트" value={stats ? formatBitrate(stats.bitrate) : '-'} />
            </div>
          )}

          <p className="muted small">
            수강생 화면: <Link to={`/classrooms/${id}/watch`} target="_blank">새 탭에서 열기 ↗</Link>
          </p>

          {urls && (
            <details className="small">
              <summary>OBS로 송출하기</summary>
              <p>
                서버: <code>{urls.rtmp.slice(0, urls.rtmp.lastIndexOf('/'))}</code>
                <br />
                스트림 키: <code>{id}</code>
              </p>
              <p className="muted">
                OBS는 음성을 AAC로 보내는데 WebRTC는 AAC를 재생하지 못합니다. OBS로 송출할 때는 시청 화면에서 LL-HLS를
                선택하세요.
              </p>
            </details>
          )}
        </aside>
      </div>
    </>
  );
}
