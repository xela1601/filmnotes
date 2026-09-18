/**
 * The scan import needs an authenticated server session: unlike the rest of the app it
 * cannot work offline, because the files live on the server. The implementation is
 * shared with the sync engine.
 */
export { openServerSession, type ServerSession } from '../../sync/session';
