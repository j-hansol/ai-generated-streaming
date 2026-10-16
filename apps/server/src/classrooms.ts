import { randomBytes } from 'node:crypto';
import type { Classroom } from '@streaming/shared';
import { db } from './db.ts';

interface ClassroomRow {
  id: string;
  title: string;
  description: string;
  created_at: string;
}

export const mediaPathOf = (id: string) => `classroom/${id}`;

const toClassroom = (row: ClassroomRow): Classroom => ({
  id: row.id,
  title: row.title,
  description: row.description,
  createdAt: row.created_at,
  mediaPath: mediaPathOf(row.id),
});

/** MediaMTX 경로 규칙(^classroom/[a-z0-9]+$)에 맞는 10자리 ID */
const newId = () => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(randomBytes(10), (b) => alphabet[b % alphabet.length]).join('');
};

export const classroomRepo = {
  list(): Classroom[] {
    const rows = db.prepare('SELECT * FROM classrooms ORDER BY created_at DESC').all() as unknown as ClassroomRow[];
    return rows.map(toClassroom);
  },

  get(id: string): Classroom | undefined {
    const row = db.prepare('SELECT * FROM classrooms WHERE id = ?').get(id) as unknown as ClassroomRow | undefined;
    return row && toClassroom(row);
  },

  create(input: { title: string; description: string }): Classroom {
    const row = db
      .prepare('INSERT INTO classrooms (id, title, description) VALUES (?, ?, ?) RETURNING *')
      .get(newId(), input.title, input.description) as unknown as ClassroomRow;
    return toClassroom(row);
  },

  remove(id: string): boolean {
    return db.prepare('DELETE FROM classrooms WHERE id = ?').run(id).changes > 0;
  },
};
