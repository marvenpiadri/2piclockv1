import { reqHandler } from '../../src/server';

/**
 * Vercel serverless entrypoint for the 2piClock API.
 *
 * The API implementation remains in the existing Express/SSR server so local
 * development and production use the same handlers. Vercel exposes that
 * handler as a function for every /api/v1/* request.
 */
export default reqHandler;
