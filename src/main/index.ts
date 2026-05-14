import { registerCrashHandlers } from './diagnostics/crashHandlers';
import { registerAppLifecycle } from './app/lifecycle';
import { startDevApiServer } from './app/devApiServer';
import { registerIpc } from './ipc/registerIpc';
import { registerCoverProtocolScheme } from './protocol/coverProtocol';

registerCrashHandlers();
registerCoverProtocolScheme();
registerIpc();
startDevApiServer();
registerAppLifecycle();
