/**
 * Vercel entrypoint for the complete 2piClock Node/Express server.
 *
 * The real API and Angular SSR server remain in src/server.ts so local
 * development and production execute the same backend code.
 */
import { reqHandler } from '../src/server';

export default reqHandler;
