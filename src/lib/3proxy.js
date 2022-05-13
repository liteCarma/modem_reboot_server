const fs = require('fs');
const os = require('os');
const path = require('path')
const { exec } = require('child_process');
const { check: tcpPortUsed } = require('tcp-port-used');
const config = require('../../config.json');

const proxyConfigPath = `${os.tmpdir()}/3proxy.cfg`
module.exports = async function() {
    let template = templateGlob;
    const clients = config.clients;
    for (let apiKey in clients) {
        const clientModems = config.clients[apiKey].filter(modem => {
          return modem.options.on
        })

        for (const modem of clientModems) {
          let portUsed = await tcpPortUsed(modem.proxy.port);
          if (portUsed) {
              console.warn(`порт ${modem.proxy.port} занят`);
          }
  
          if (!portUsed) {
              template += templateUser(modem);
          }
        }
    }
    fs.writeFileSync(proxyConfigPath, template);
    return runProxyProcess();
}

//общая часть конфигурации
const templateGlob =
    `#monitor 3proxy.cfg
#logformat "L%C - %U [%d/%o/%Y:%H:%M:%S %z] ""%T"" %E %I %O %N/%R:%r"
#log "c:/3proxy/3proxy.log" D
#rotate 180
#archiver rar “”"c:/Program Files/WinRAR/rar.exe””" a -df -inul %A %F
internal  ${config.main.serverIp}
timeouts 1 5 30 60 180 1800 15 60
`;

//кофигурация для конкретного модема
function templateUser(modem) {
  const protocol = modem.proxy.protocol == 'http' ? 'proxy' : 'socks';
  let config = `
nserver ${modem.options.ip_web}
nscache 65536`

  if (modem.proxy.login) {
    config += `
auth strong
users ${modem.proxy.login}:CL:${modem.proxy.password}
allow ${modem.proxy.login}`
  }

  config += `
${protocol} -t -n -a -e${modem.options.ip} -p${modem.proxy.port}
flush
`
  return config
}

function runProxyProcess() {
    let proxy = exec(`3proxy ${proxyConfigPath}`);
    proxy.on('exit', function(code) {
        console.error(`3proxy close, code: ${code}`);
        process.exit(1)
    })

    return proxy;
}