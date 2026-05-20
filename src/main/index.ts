import { registerCrashHandlers } from './diagnostics/crashHandlers';
import { registerAppLifecycle } from './app/lifecycle';
import { startDevApiServer } from './app/devApiServer';
import { registerIpc } from './ipc/registerIpc';
import { registerCoverProtocolScheme } from './protocol/coverProtocol';
import { initializeProtectedUserDataPath } from './app/dataProtection';
import { isLibraryRecoveryMode } from './app/libraryRecoveryMode';

initializeProtectedUserDataPath();
registerCrashHandlers();
registerCoverProtocolScheme();
registerIpc();
if (!isLibraryRecoveryMode()) {
  startDevApiServer();
}
registerAppLifecycle();
