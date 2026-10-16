import type { FastifyInstance } from 'fastify';
import type { ClassroomWithLive, CreateClassroomRequest, MediaUrls } from '@streaming/shared';
import { classroomRepo } from './classrooms.ts';
import { mediamtx, OFFLINE } from './mediamtx.ts';
import { config } from './config.ts';

const mediaUrlsOf = (mediaPath: string): MediaUrls => ({
  whip: `${config.mediamtx.webrtcUrl}/${mediaPath}/whip`,
  whep: `${config.mediamtx.webrtcUrl}/${mediaPath}/whep`,
  hls: `${config.mediamtx.hlsUrl}/${mediaPath}/index.m3u8`,
  rtmp: `${config.mediamtx.rtmpUrl}/${mediaPath}`,
});

const NOT_FOUND = { message: '강의실을 찾을 수 없습니다.' };

export async function routes(app: FastifyInstance) {
  app.get('/api/health', async () => ({
    server: 'ok',
    mediamtx: (await mediamtx.isUp()) ? 'ok' : 'down',
  }));

  app.get('/api/classrooms', async (): Promise<ClassroomWithLive[]> => {
    const liveByPath = await mediamtx.liveInfoByPath();
    return classroomRepo.list().map((c) => ({ ...c, live: liveByPath.get(c.mediaPath) ?? OFFLINE }));
  });

  app.post<{ Body: CreateClassroomRequest }>(
    '/api/classrooms',
    {
      schema: {
        body: {
          type: 'object',
          required: ['title'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 100 },
            description: { type: 'string', maxLength: 1000 },
          },
        },
      },
    },
    async (req, reply) => {
      const title = req.body.title.trim();
      if (!title) return reply.code(400).send({ message: '강의 제목을 입력해주세요.' });
      const classroom = classroomRepo.create({ title, description: req.body.description?.trim() ?? '' });
      return reply.code(201).send({ ...classroom, live: OFFLINE } satisfies ClassroomWithLive);
    },
  );

  app.get<{ Params: { id: string } }>('/api/classrooms/:id', async (req, reply) => {
    const classroom = classroomRepo.get(req.params.id);
    if (!classroom) return reply.code(404).send(NOT_FOUND);
    return { ...classroom, live: await mediamtx.liveInfo(classroom.mediaPath) } satisfies ClassroomWithLive;
  });

  app.get<{ Params: { id: string } }>('/api/classrooms/:id/media', async (req, reply) => {
    const classroom = classroomRepo.get(req.params.id);
    if (!classroom) return reply.code(404).send(NOT_FOUND);
    return mediaUrlsOf(classroom.mediaPath);
  });

  app.delete<{ Params: { id: string } }>('/api/classrooms/:id', async (req, reply) => {
    const classroom = classroomRepo.get(req.params.id);
    if (!classroom) return reply.code(404).send(NOT_FOUND);
    await mediamtx.kickPublisher(classroom.mediaPath);
    classroomRepo.remove(classroom.id);
    return reply.code(204).send();
  });
}
