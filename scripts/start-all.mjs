import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const workspaceRoot = resolve(process.cwd());
const backendDir = resolve(workspaceRoot, 'backend');
const frontendDir = resolve(workspaceRoot, 'frontend');

function startProcess(label, cwd, args, extraEnv = {}) {
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
  const commandArgs =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', `npm ${args.join(' ')}`]
      : args;

  const child = spawn(command, commandArgs, {
    cwd,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...extraEnv,
    },
  });

  child.on('exit', (code, signal) => {
    if (code && code !== 0) {
      console.error(`[${label}] exited with code ${code}`);
    } else if (signal) {
      console.error(`[${label}] exited with signal ${signal}`);
    }
    process.exitCode = code ?? 0;
  });

  child.on('error', (error) => {
    console.error(`[${label}] failed to start`, error);
    process.exitCode = 1;
  });

  return child;
}

const backend = startProcess('backend', backendDir, ['run', 'start:dev']);
const frontend = startProcess('frontend', frontendDir, ['run', 'dev', '--', '--port', '3001'], {
  PORT: '3001',
  NEXT_PUBLIC_API_BASE_URL: 'http://localhost:3000',
});

function shutdown() {
  backend.kill('SIGINT');
  frontend.kill('SIGINT');
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
