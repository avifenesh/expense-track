#!/usr/bin/env node

const { spawn } = require('node:child_process');
const net = require('node:net');
const process = require('node:process');

const DEFAULT_PORT = Number.parseInt(process.env.PORT ?? '3000', 10);
const MAX_INCREMENT = 50;

async function isPortAvailable(port) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => {
      server.close(() => resolve(false));
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '0.0.0.0');
  });
}

async function findOpenPort(startPort) {
  if (await isPortAvailable(startPort)) {
    return startPort;
  }

  console.warn(`Port ${startPort} is busy; searching for the next available port.`);

  for (let offset = 1; offset <= MAX_INCREMENT; offset += 1) {
    const candidate = startPort + offset;
    if (await isPortAvailable(candidate)) {
      return candidate;
    }
  }

  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '0.0.0.0', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function start() {
  try {
    const port = await findOpenPort(DEFAULT_PORT);
    const env = { ...process.env, PORT: String(port) };
    const nextBin = require.resolve('next/dist/bin/next');

    console.log(`Starting Next.js on port ${port}`);

    const child = spawn(process.execPath, [nextBin, 'start', '-p', String(port)], {
      stdio: 'inherit',
      env
    });

    const forwardSignal = signal => {
      if (child.exitCode === null) {
        child.kill(signal);
      }
    };

    process.on('SIGINT', forwardSignal);
    process.on('SIGTERM', forwardSignal);

    child.on('exit', code => {
      process.exit(code ?? 0);
    });

    child.on('error', err => {
      console.error('Failed to launch Next.js:', err);
      process.exit(1);
    });
  } catch (error) {
    console.error('Unable to determine an open port:', error);
    process.exit(1);
  }
}

start();
