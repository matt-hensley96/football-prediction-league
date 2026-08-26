import { handleLogin, handleSignup } from './api/auth';
import { getHistory } from './api/history';
import { handleForgotPin, handleResetPin } from './api/pin-reset';
import { getCurrentGameweek, submitPredictions } from './api/predictions';
import { getLeagueTable } from './api/table';
import { runDaily } from './cron/handler';
import type { Env } from './types';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    try {
      if (pathname === '/api/login' && request.method === 'POST') {
        return await handleLogin(request, env);
      }

      if (pathname === '/api/signup' && request.method === 'POST') {
        return await handleSignup(request, env);
      }

      if (pathname === '/api/gameweek' && request.method === 'GET') {
        return await getCurrentGameweek(request, env);
      }

      if (pathname === '/api/predictions' && request.method === 'POST') {
        return await submitPredictions(request, env);
      }

      if (pathname === '/api/forgot-pin' && request.method === 'POST') {
        return await handleForgotPin(request, env);
      }

      if (pathname === '/api/reset-pin' && request.method === 'POST') {
        return await handleResetPin(request, env);
      }

      if (pathname === '/api/table' && request.method === 'GET') {
        return await getLeagueTable(env);
      }

      if (pathname === '/api/history' && request.method === 'GET') {
        return await getHistory(env);
      }

      return new Response('Not found', { status: 404 });
    } catch (err) {
      console.error(err);

      return new Response('Internal error', { status: 500 });
    }
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await runDaily(env);
  },
} satisfies ExportedHandler<Env>;
