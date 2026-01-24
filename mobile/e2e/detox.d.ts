declare module 'detox/runners/jest/globalSetup' {
  const globalSetup: () => Promise<void>
  export default globalSetup
}

declare module 'detox/runners/jest/globalTeardown' {
  const globalTeardown: () => Promise<void>
  export default globalTeardown
}
