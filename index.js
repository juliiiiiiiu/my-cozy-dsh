import { starTheme } from './github-star.js';

export function apply(ctx) {
  ctx.inject(['connection'], scope => {
    scope.effect(() => scope.connection.fetch.register({
      path: '/api/my-cozy-dsh/star',
      methods: ['POST'],
      requestBody: 'buffered',
      async fetch(request) {
        const headers = { 'cache-control': 'no-store' };
        if (request.headers.get('x-my-cozy-dsh-action') !== 'star' ||
            new URL(request.url).search || (await request.arrayBuffer()).byteLength) {
          return Response.json({ result: 'retry' }, { status: 400, headers });
        }
        const result = await starTheme(undefined, undefined, request.signal).catch(() => 'retry');
        return Response.json({ result }, { headers });
      },
    }));
  });
}
