const http = require('http');
const url = require('url');
const { reboot: modemReboot, modemTimeoutReboot } = require('./src/server/controllers/modem');
const proxy = require('./src/lib/3proxy');
const {
  main: { serverIp, serverPort },
} = require('./config.json');
const router = require('./src/server/router')

async function main() {
  await proxy()
  await modemTimeoutReboot()

  http.createServer(router)
  .listen(serverPort, serverIp, function () {
    console.log(`server start on port: ${serverIp}:${serverPort}`);
  });
}

main();

