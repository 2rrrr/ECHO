import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(scriptPath), '..');
const sourceDir = join(projectRoot, 'native', 'audio-host');
const buildDir = join(projectRoot, 'out', 'native', 'audio-host');
const targetDir = join(projectRoot, 'electron-app', 'build');
const targetExe = join(targetDir, process.platform === 'win32' ? 'echo-audio-host.exe' : 'echo-audio-host');
const config = process.env.ECHO_AUDIO_HOST_CONFIG || 'Release';

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
};

const findBuiltHost = () => {
  const exe = process.platform === 'win32' ? 'echo-audio-host.exe' : 'echo-audio-host';
  const candidates = [
    join(buildDir, 'echo-audio-host_artefacts', config, exe),
    join(buildDir, config, exe),
    join(buildDir, exe),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
};

try {
  run('cmake', [
    '-S',
    sourceDir,
    '-B',
    buildDir,
    '-G',
    'Visual Studio 17 2022',
    '-A',
    'x64',
  ]);
  run('cmake', ['--build', buildDir, '--config', config, '--parallel']);

  const builtHost = findBuiltHost();

  if (!builtHost) {
    throw new Error(`Built host binary was not found under ${buildDir}`);
  }

  mkdirSync(targetDir, { recursive: true });
  copyFileSync(builtHost, targetExe);
  console.log(`[build:audio-host] Copied ${builtHost}`);
  console.log(`[build:audio-host]      -> ${targetExe}`);
} catch (error) {
  console.error('[build:audio-host] Failed to build JUCE audio host.');
  console.error('[build:audio-host] Requirements: CMake, Visual Studio 2022 Build Tools, Windows SDK, and network access for JUCE 8.0.12.');
  console.error(`[build:audio-host] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
