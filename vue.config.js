const { defineConfig } = require("@vue/cli-service");

module.exports = defineConfig({
  transpileDependencies: true,
  // 配置 HTTPS 开发服务器，允许访问摄像头
  devServer: {
    https: true,
    host: "0.0.0.0",
    port: 8080,
    allowedHosts: "all",
  },
});
