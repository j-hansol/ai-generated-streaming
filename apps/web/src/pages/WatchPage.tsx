import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import Hls from 'hls.js';
import type { MediaUrls } from '@streaming/shared';
import { api } from '../api.ts';
import { formatClock, useClock, usePolling } from '../hooks.ts';
import { LiveBadge, Stat } from '../components.tsx';
import { WhepPlayer } from '../lib/whep.ts';
import { createVideoStatsMeter, formatBitrate } from '../lib/stats.ts';

type Mode = 'webrtc' | 'hls';

const MODE_INFO: Record<Mode, { label: string; hint: string }> = {
  webrtc: { label: 'WebRTC', hint: '지연 1초 미만 · 서버 부담 큼' },
  hls: { label: 'LL-HLS', hint: '지연 2~4초 · 시청자가 많아도 안정적' },
};

interface PlaybackStats {
  latency: string;
  resolution: string;
  bitrate: string;
  codec: string;
}

const RETRY_MS = 3000;

export function WatchPage() {
  const { id = '' } = useParams();
  const classroom = usePolling(() => api.getClassroom(id), 3000);
  const [urls, setUrls] = useState<MediaUrls | null>(null);
  const [mode, setMode] = useState<Mode>('webrtc');
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PlaybackStats | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const now = useClock();

  const isLive = classroom.data?.live.status === 'live';

  useEffect(() => {
    api.getMediaUrls(id).then(setUrls, (err: Error) => setError(err.message));
  }, [id]);

  // 방송 중이면 선택한 방식으로 재생한다. 방식이 바뀌거나 방송이 끝나면 정리 후 다시 실행된다.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !urls || !isLive) return;

    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let statsTimer: ReturnType<typeof setInterval> | undefined;
    let teardown: () => void = () => undefined;

    const scheduleRetry = (message: string) => {
      if (disposed || retryTimer) return;
      setError(`${message} 잠시 후 다시 연결합니다…`);
      setPlaying(false);
      retryTimer = setTimeout(() => setRetryKey((k) => k + 1), RETRY_MS);
    };

    setError(null);

    if (mode === 'webrtc') {
      const player = new WhepPlayer();
      teardown = () => void player.stop();
      player
        .start(urls.whep, {
          onStateChange: (state) => {
            if (state === 'connected') setPlaying(true);
            if (state === 'failed' || state === 'disconnected') scheduleRetry('연결이 끊어졌습니다.');
          },
        })
        .then((stream) => {
          if (disposed) return;
          video.srcObject = stream;
          const measure = createVideoStatsMeter('inbound');
          statsTimer = setInterval(async () => {
            const report = await player.getStats();
            const s = report && measure(report);
            if (s)
              setStats({
                latency: `지터 버퍼 ${Math.round(s.jitterBufferMs)} ms`,
                resolution: `${s.width}×${s.height} · ${Math.round(s.fps)} fps`,
                bitrate: formatBitrate(s.bitrate),
                codec: s.codec || '-',
              });
          }, 1000);
        })
        .catch((err: Error) => scheduleRetry(err.message));
    } else if (Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: true, backBufferLength: 10 });
      teardown = () => hls.destroy();
      hls.on(Hls.Events.MANIFEST_PARSED, () => setPlaying(true));
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        hls.destroy();
        scheduleRetry(`HLS 오류 (${data.details}).`);
      });
      hls.loadSource(urls.hls);
      hls.attachMedia(video);
      statsTimer = setInterval(() => {
        const level = hls.levels[hls.currentLevel];
        setStats({
          latency: Number.isFinite(hls.latency) ? `${hls.latency.toFixed(2)} 초 (목표 ${hls.targetLatency?.toFixed(1) ?? '-'}초)` : '-',
          resolution: video.videoWidth ? `${video.videoWidth}×${video.videoHeight}` : '-',
          bitrate: level ? formatBitrate(level.bitrate) : '-',
          codec: level?.videoCodec ?? '-',
        });
      }, 1000);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari는 HLS를 기본 지원한다
      video.src = urls.hls;
      setPlaying(true);
      teardown = () => video.removeAttribute('src');
    } else {
      setError('이 브라우저는 HLS를 재생할 수 없습니다.');
    }

    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      clearInterval(statsTimer);
      teardown();
      video.srcObject = null;
      video.removeAttribute('src');
      video.load();
      setPlaying(false);
      setStats(null);
    };
  }, [mode, urls, isLive, retryKey]);

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
          {room?.description && <p className="muted">{room.description}</p>}
        </div>
        {room && <LiveBadge live={room.live} />}
      </div>
      {classroom.error && <div className="alert alert-error">{classroom.error}</div>}

      <div className="layout">
        <section>
          <div className="video-box">
            <video ref={videoRef} autoPlay muted={muted} playsInline controls={playing} />
            {room && !isLive && <div className="video-overlay">강의가 시작되기를 기다리는 중입니다…</div>}
            {isLive && !playing && !error && <div className="video-overlay">연결 중…</div>}
          </div>
          <div className="below-video">
            <button className="btn" onClick={() => setMuted((m) => !m)} disabled={!playing}>
              {muted ? '🔇 소리 켜기' : '🔊 소리 끄기'}
            </button>
            <span className="clock">현재 시각 {formatClock(now)}</span>
          </div>
          {error && <p className="error-text">{error}</p>}
        </section>

        <aside className="card side">
          <h2>시청 방식</h2>
          <div className="segmented">
            {(Object.keys(MODE_INFO) as Mode[]).map((m) => (
              <button key={m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>
                {MODE_INFO[m].label}
              </button>
            ))}
          </div>
          <p className="muted small">{MODE_INFO[mode].hint}</p>

          <div className="stats">
            <Stat label="지연" value={stats?.latency ?? '-'} />
            <Stat label="화질" value={stats?.resolution ?? '-'} />
            <Stat label="비트레이트" value={stats?.bitrate ?? '-'} />
            <Stat label="코덱" value={stats?.codec ?? '-'} />
          </div>

          <p className="muted small">
            강사가 <b>테스트 화면</b>으로 송출하면 영상 속 시계와 위의 <b>현재 시각</b>의 차이가 실제 지연 시간입니다.
          </p>
        </aside>
      </div>
    </>
  );
}
