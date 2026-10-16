import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api } from '../api.ts';
import { usePolling } from '../hooks.ts';
import { LiveBadge } from '../components.tsx';

export function ClassroomListPage() {
  const classrooms = usePolling(api.listClassrooms, 5000);
  const health = usePolling(api.health, 5000);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  /** 삭제 확인 중인 강의실 ID */
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    try {
      await api.createClassroom({ title, description });
      setTitle('');
      setDescription('');
      await classrooms.reload();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  // 삭제: "삭제" 클릭 → 해당 줄에 확인 문구와 [삭제]/[취소]가 나타남 → [삭제]로 실행
  const onConfirmDelete = async (id: string, roomTitle: string) => {
    setDeleting(true);
    try {
      await api.deleteClassroom(id);
      setListError(null);
    } catch (err) {
      setListError(`"${roomTitle}" 삭제 실패: ${(err as Error).message}`);
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
    await classrooms.reload();
  };

  return (
    <>
      {health.error && <div className="alert alert-error">API 서버에 연결할 수 없습니다. `pnpm dev`가 실행 중인지 확인하세요.</div>}
      {health.data?.mediamtx === 'down' && (
        <div className="alert alert-error">미디어 서버(MediaMTX)가 꺼져 있습니다. 송출과 시청이 되지 않습니다.</div>
      )}

      <section className="card">
        <h2>강의실 만들기</h2>
        <form className="form" onSubmit={onCreate}>
          <input
            placeholder="강의 제목 (예: 자료구조 3주차)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            required
          />
          <input
            placeholder="설명 (선택)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
          />
          <button className="btn btn-primary" disabled={creating || !title.trim()}>
            {creating ? '만드는 중…' : '만들기'}
          </button>
        </form>
        {formError && <p className="error-text">{formError}</p>}
      </section>

      <section>
        <h2>강의실 목록</h2>
        {listError && <p className="error-text">{listError}</p>}
        {classrooms.data?.length === 0 && <p className="muted">아직 강의실이 없습니다. 위에서 하나 만들어보세요.</p>}
        <ul className="room-list">
          {classrooms.data?.map((room) => (
            <li key={room.id} className="card room">
              <div className="room-info">
                <div className="room-title">
                  <strong>{room.title}</strong>
                  <LiveBadge live={room.live} />
                </div>
                {room.description && <p className="muted">{room.description}</p>}
              </div>
              {pendingDelete === room.id ? (
                <div className="room-actions confirm" role="alert">
                  <span className="confirm-text">
                    이 강의실을 삭제할까요?
                    {room.live.status === 'live' && <b> 방송 중인 강의는 송출이 끊깁니다.</b>}
                  </span>
                  <button
                    className="btn btn-danger"
                    onClick={() => onConfirmDelete(room.id, room.title)}
                    disabled={deleting}
                    autoFocus
                  >
                    {deleting ? '삭제 중…' : '삭제'}
                  </button>
                  <button className="btn" onClick={() => setPendingDelete(null)} disabled={deleting}>
                    취소
                  </button> 
                </div>
              ) : (
                <div className="room-actions">
                  <Link className="btn btn-primary" to={`/classrooms/${room.id}/teach`}>
                    강의하기
                  </Link>
                  <Link className="btn" to={`/classrooms/${room.id}/watch`}>
                    시청하기
                  </Link>
                  <button className="btn btn-ghost" onClick={() => setPendingDelete(room.id)} disabled={deleting}>
                    삭제
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
