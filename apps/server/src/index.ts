import Fastify from 'fastify';
import { config } from './config.ts';
import { routes } from './routes.ts';

const app = Fastify({
  // 화면이 몇 초마다 상태를 조회하므로 요청마다 로그를 남기지 않는다
  disableRequestLogging: true,
  logger: {
    transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
  },
});

await app.register(routes);

try {
  await app.listen({ port: config.port, host: config.host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
