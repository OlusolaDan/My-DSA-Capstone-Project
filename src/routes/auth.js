import { requireUser } from '../http/guards.js';

export function registerAuthRoutes(router, { authService, tokenSecret }) {
  router.post('/api/auth/signup', async ({ response, body }) => {
    const result = await authService.signup(body);
    response.statusCode = 201;
    return result;
  });

  router.post('/api/auth/login', ({ body }) => authService.login(body));

  router.get('/api/auth/me', async ({ request }) => {
    const user = requireUser(request, tokenSecret);
    return { user: await authService.getCurrentUser(user.sub) };
  });
}
