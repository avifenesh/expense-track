/**
 * Backend Server Manager
 * Spawns Next.js backend for E2E tests, handles health checks and cleanup
 */

import { spawn, ChildProcess, execSync } from 'child_process';
import path from 'path';

const DEFAULT_PORT = 4300;
const HEALTH_CHECK_INTERVAL = 1000;
const STARTUP_TIMEOUT = 60000;

export class BackendManager {
  private process: ChildProcess | null = null;
  private port: number;
  private baseUrl: string;
  private projectRoot: string;

  constructor(port: number = DEFAULT_PORT) {
    this.port = port;
    this.baseUrl = `http://localhost:${port}`;
    // mobile/e2e/server -> project root
    this.projectRoot = path.resolve(__dirname, '..', '..', '..');
  }

  async start(): Promise<void> {
    if (this.process) {
      console.log('[BackendManager] Server already running');
      return;
    }

    console.log(`[BackendManager] Starting backend at ${this.baseUrl}...`);
    console.log(`[BackendManager] Project root: ${this.projectRoot}`);

    return new Promise((resolve, reject) => {
      const isWindows = process.platform === 'win32';
      const command = isWindows ? 'npm.cmd' : 'npm';
      const args = ['run', 'dev'];

      this.process = spawn(command, args, {
        cwd: this.projectRoot,
        env: {
          ...process.env,
          PORT: String(this.port),
          HOSTNAME: '127.0.0.1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        // On Windows, we need shell to handle npm properly
        shell: isWindows,
        // Create a new process group for cleanup
        detached: !isWindows,
      });

      let startupLog = '';

      this.process.stdout?.on('data', (data) => {
        const output = data.toString();
        startupLog += output;
        if (process.env.DEBUG_BACKEND) {
          console.log('[Backend]', output.trim());
        }
      });

      this.process.stderr?.on('data', (data) => {
        const output = data.toString();
        startupLog += output;
        if (process.env.DEBUG_BACKEND) {
          console.error('[Backend Error]', output.trim());
        }
      });

      this.process.on('error', (error) => {
        console.error('[BackendManager] Failed to start:', error);
        reject(error);
      });

      this.process.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          console.error('[BackendManager] Process exited with code:', code);
          console.error('[BackendManager] Startup log:', startupLog);
        }
        this.process = null;
      });

      // Wait for health check
      this.waitForHealthy()
        .then(resolve)
        .catch((error) => {
          this.stop();
          reject(error);
        });
    });
  }

  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    console.log('[BackendManager] Stopping backend...');

    return new Promise((resolve) => {
      const isWindows = process.platform === 'win32';

      if (this.process) {
        this.process.on('exit', () => {
          this.process = null;
          console.log('[BackendManager] Backend stopped');
          resolve();
        });

        if (isWindows) {
          // On Windows, use taskkill to kill the process tree
          try {
            if (this.process.pid) {
              execSync(`taskkill /pid ${this.process.pid} /T /F`, {
                stdio: 'ignore',
              });
            }
          } catch {
            // Process may have already exited
          }
        } else {
          // On Unix, kill the process group
          try {
            if (this.process.pid) {
              process.kill(-this.process.pid, 'SIGTERM');
            }
          } catch {
            // Process may have already exited
          }
        }

        // Force resolve after timeout
        setTimeout(() => {
          this.process = null;
          resolve();
        }, 5000);
      } else {
        resolve();
      }
    });
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getPort(): number {
    return this.port;
  }

  isRunning(): boolean {
    return this.process !== null;
  }

  private async waitForHealthy(): Promise<void> {
    const startTime = Date.now();
    // Use /api/v1/users/me which returns 401 when not authenticated
    // This confirms the API is working
    const healthUrl = `${this.baseUrl}/api/v1/users/me`;

    console.log(`[BackendManager] Waiting for health check at ${healthUrl}...`);

    while (Date.now() - startTime < STARTUP_TIMEOUT) {
      try {
        const response = await fetch(healthUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        // users/me returns 401 when not authenticated, which means server is up
        // Any response (200, 401, 403) indicates the server is healthy
        if (response.status === 200 || response.status === 401 || response.status === 403) {
          console.log(
            `[BackendManager] Server healthy (status: ${response.status}, ${Date.now() - startTime}ms)`
          );
          return;
        }
      } catch {
        // Server not ready yet
      }

      await this.sleep(HEALTH_CHECK_INTERVAL);
    }

    throw new Error(
      `Backend failed to start within ${STARTUP_TIMEOUT}ms. Check server logs.`
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance for global setup/teardown
let instance: BackendManager | null = null;

export function getBackendManager(): BackendManager {
  if (!instance) {
    instance = new BackendManager();
  }
  return instance;
}

export function resetBackendManager(): void {
  instance = null;
}
