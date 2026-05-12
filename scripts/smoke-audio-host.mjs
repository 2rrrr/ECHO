import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { spawnSync, spawn } from 'node:child_process';

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(scriptPath), '..');
const hostPath = join(projectRoot, 'electron-app', 'build', process.platform === 'win32' ? 'echo-audio-host.exe' : 'echo-audio-host');

const fail = (message) => {
  console.error(`[smoke:audio-host] ${message}`);
  process.exit(1);
};

if (!existsSync(hostPath)) {
  fail(`Missing host binary: ${hostPath}. Run "npm run build:audio-host" first.`);
}

const listResult = spawnSync(hostPath, ['-list'], {
  cwd: projectRoot,
  encoding: 'utf8',
});

if (listResult.status !== 0) {
  fail(`-list failed: ${listResult.stderr || listResult.stdout}`);
}

const devices = listResult.stdout
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

if (devices.length === 0) {
  fail('-list returned no output devices');
}

console.log(`[smoke:audio-host] listed ${devices.length} output devices`);

const child = spawn(hostPath, ['-sr', '48000', '-ch', '2'], {
  cwd: projectRoot,
  stdio: ['pipe', 'pipe', 'pipe'],
});

let stdout = '';
let stderr = '';
let ready = false;
let position = false;
let ended = false;
let stdinError = '';

child.stdout.setEncoding('utf8');
child.stdout.on('data', (chunk) => {
  stdout += chunk;
  for (const line of chunk.split(/\r?\n/).filter(Boolean)) {
    try {
      const event = JSON.parse(line);
      ready ||= event.ready === true;
      position ||= typeof event.pos === 'number';
      ended ||= event.event === 'ended';
    } catch {
      // Ignore non-JSON stdout noise.
    }
  }
});

child.stderr.setEncoding('utf8');
child.stderr.on('data', (chunk) => {
  stderr += chunk;
});

child.stdin.on('error', (error) => {
  stdinError = error instanceof Error ? error.message : String(error);
});

const seconds = 0.25;
const sampleRate = 48000;
const channels = 2;
const frames = Math.floor(seconds * sampleRate);
const pcm = Buffer.alloc(frames * channels * Float32Array.BYTES_PER_ELEMENT);

child.stdin.write(pcm, (error) => {
  if (error) {
    stdinError = error.message;
  }
});
child.stdin.end();

const exitCode = await new Promise((resolve) => {
  const timer = setTimeout(() => {
    child.kill('SIGKILL');
    resolve(-1);
  }, 10000);

  child.on('exit', (code) => {
    clearTimeout(timer);
    resolve(code ?? 0);
  });
});

if (exitCode !== 0) {
  fail(`host exited with ${exitCode}; stdin=${stdinError || 'ok'}; stderr=${stderr}; stdout=${stdout}`);
}

if (!ready || !position || !ended) {
  fail(`missing expected events ready=${ready} position=${position} ended=${ended}; stderr=${stderr}; stdout=${stdout}`);
}

console.log('[smoke:audio-host] ready/position/ended OK');
