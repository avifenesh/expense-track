// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config')

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

// Windows-specific fix for chunked transfer encoding issue with Android emulator
// Error: java.net.ProtocolException: Expected leading [0-9a-fA-F] character but was 0xd
if (process.platform === 'win32') {
  const originalEnhanceMiddleware = config.server?.enhanceMiddleware

  config.server = {
    ...config.server,
    enhanceMiddleware: (middleware, server) => {
      // Apply original enhancement if exists
      const enhanced = originalEnhanceMiddleware
        ? originalEnhanceMiddleware(middleware, server)
        : middleware

      return (req, res, next) => {
        // Force non-chunked responses by setting Connection: close
        // This tells the server to send a complete response with Content-Length
        // instead of streaming with Transfer-Encoding: chunked
        res.setHeader('Connection', 'close')

        return enhanced(req, res, next)
      }
    },
  }
}

module.exports = config
