module.exports = {
  webpack: {
    configure: {
      ignoreWarnings: [
        function ignoreSourceMapsLoaderWarnings(warning) {
          return (
            warning.module &&
            warning.module.resource.includes('node_modules') &&
            warning.details &&
            warning.details.includes('source-map-loader')
          );
        },
      ],
    },
  },
  devServer: {
    allowedHosts: "all",
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
        pathRewrite: { "^/api": "" }, // Important pour FastAPI
        headers: {
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*" // Header supplémentaire
        }
      }
    }
  }
};