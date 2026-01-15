#!/usr/bin/env node

const { spawn } = require('node:child_process')
const process = require('node:process')

const HOSTNAME = process.env.PLAYWRIGHT_HOSTNAME ?? '127.0.0.1'
const PORT = process.env.PLAYWRIGHT_PORT ?? '4300'
const command = 'npm run dev'

const env = { ...process.env, HOSTNAME, PORT }

const child = spawn(command, {
  stdio: 'inherit',
  env,
  shell: true,
})

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal)
  }
}

process.on('SIGINT', forwardSignal)
process.on('SIGTERM', forwardSignal)

child.on('exit', (code) => {
  process.exit(code ?? 0)
})

child.on('error', (error) => {
  console.error('Failed to launch dev server:', error)
  process.exit(1)
})
