import type { ClassroomWithLive, CreateClassroomRequest, MediaUrls } from '@streaming/shared';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `요청 실패 (HTTP ${res.status})`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  health: () => request<{ server: string; mediamtx: 'ok' | 'down' }>('/api/health'),
  listClassrooms: () => request<ClassroomWithLive[]>('/api/classrooms'),
  getClassroom: (id: string) => request<ClassroomWithLive>(`/api/classrooms/${id}`),
  getMediaUrls: (id: string) => request<MediaUrls>(`/api/classrooms/${id}/media`),
  createClassroom: (body: CreateClassroomRequest) =>
    request<ClassroomWithLive>('/api/classrooms', { method: 'POST', body: JSON.stringify(body) }),
  deleteClassroom: (id: string) => request<void>(`/api/classrooms/${id}`, { method: 'DELETE' }),
};
