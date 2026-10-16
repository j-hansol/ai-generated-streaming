import type { LiveInfo } from '@streaming/shared';

export function LiveBadge({ live }: { live: LiveInfo }) {
  return live.status === 'live' ? (
    <span className="badge badge-live">LIVE · 시청 {live.viewers}명</span>
  ) : (
    <span className="badge">대기 중</span>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}
