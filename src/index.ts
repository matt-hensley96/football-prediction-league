import { handleLogin, handleSignup } from './api/auth';
import { handleMockAdvance, handleMockReset, handleMockState, isMockEnabled } from './api/dev-mock';
import { getHistory } from './api/history';
import { handleForgotPin, handleResetPin } from './api/pin-reset';
import { getCurrentGameweek, submitPredictions } from './api/predictions';
import { getLeagueTable } from './api/table';
import { syncGameweek } from './cron/handler';
import { checkAndSendReminders } from './cron/reminders';
import { cleanupUsers } from './cron/cleanup-users';
import type { Env } from './types';

const REMINDERS_CRON = '0 8 * * *';
const USER_CLEANUP_CRON = '0 9 * * 1';

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

      if (pathname.startsWith('/api/dev/mock/') && isMockEnabled(env)) {
        if (pathname === '/api/dev/mock/reset' && request.method === 'POST') {
          return await handleMockReset(env);
        }

        if (pathname === '/api/dev/mock/advance' && request.method === 'POST') {
          return await handleMockAdvance(env);
        }

        if (pathname === '/api/dev/mock/state' && request.method === 'GET') {
          return await handleMockState(env);
        }
      }

      return new Response('Not found', { status: 404 });
    } catch (err) {
      console.error(err);

      return new Response('Internal error', { status: 500 });
    }
  },

  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    switch (controller.cron) {
      case REMINDERS_CRON:
        await checkAndSendReminders(env);
        break;
      case USER_CLEANUP_CRON:
        await cleanupUsers(env);
        break;
      default:
        await syncGameweek(env);
    }
  },
} satisfies ExportedHandler<Env>;
