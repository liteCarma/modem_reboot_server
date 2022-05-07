const chalk = require('chalk');
const modemRequest = require('./modemRequest');
const EventEmitter = require('events');
const request = require('../../../lib/request');
const Agent = require('proxy-agent');
const config = require('../../../../config.json');
const ModemErrors = require('./errors');
const {
  retryAsync,
  keyGenerator,
  base64encode,
  parseNetwork,
  doRSAEncrypt,
  object2xml,
} = require('./utils');
const SHA256 = require('./SHA256.js');

request.deafultOptions.throw = true;
request.deafultOptions.follow = false;
request.deafultOptions.retry.attempts = 0;
const sessions = {};

const log = console.log;

class Session extends EventEmitter{
  constructor(modem) {
    super()
    this.isAuth = false;
    this.lock = false
    this.timeOutId = null;
    this.options = modem.options;
    this.lastMode = '';
    this.lastIp = '';
    this.lastChangeIp = 0
    this.headers = {
      encrypt_transmit: 'encrypt_transmit',
      'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
      cookie: '',
      __RequestVerificationToken: '',
    };
    this.__RequestVerificationToken = '';
    this.network = parseNetwork(modem.options.network);
    this.proxyURL = Session.proxyParse(modem.proxy);
    this.request = modemRequest;

    this.on('lock', () => {
      this.lock = true
      this.timeOutId = setTimeout(() => {
        this.lock = false
        this.emit('unlock')
      }, 120000)
    })

    this.on('unlock', () => {
      this.lock = false
      clearInterval(this.timeOutId)
      this.timeOutId = null
    })
  }

  async login() {
    const { user, password, ip_web } = this.options;
    const headers = this.headers;

    let res = await this.request(`http://${ip_web}/html/home.html`, {
      headers,
    });

    res = await this.request(`http://${ip_web}/api/user/state-login`, {
      headers,
    });

    const g_password_type = res.body.match(/<password_type>(\d+)</)[1];
    res = await this.request(`http://${ip_web}/api/webserver/SesTokInfo`, {
      headers,
    });

    headers.__RequestVerificationToken = res.body.match(/<TokInfo>(\S+?)</)[1];
    if (g_password_type == '0') {
      return true;
    }

    let g_encPublickeyE;
    let g_encPublickeyN;
    if (g_password_type == '4') {
      res = await this.request(`http://${ip_web}/api/webserver/publickey`, {
        headers,
      });
      g_encPublickeyN = res.body.match(/<encpubkeyn>(\S+?)</)[1];
      g_encPublickeyE = res.body.match(/<encpubkeye>(\S+?)</)[1];
      password = SHA256(
        user +
          base64encode(SHA256(password)) +
          headers.__RequestVerificationToken
      );
    }

    let xmlDate = {
      Username: user,
      Password: base64encode(password),
      password_type: g_password_type,
    };

    xmlDate = object2xml('request', xmlDate);
    xmlDate = doRSAEncrypt(xmlDate, g_encPublickeyN, g_encPublickeyE);
    res = await this.request(`http://${ip_web}/api/user/login`, {
      headers,
      body: xmlDate,
    });
    this.isAuth = res.body.includes('OK');
  }

  static proxyParse(proxy) {
    let proxyURL = proxy.protocol + '://';
    if (proxy.login) {
      proxyURL += proxy.login + ':' + proxy.password + '@';
    }
    return proxyURL + config.main.serverIp + ':' + proxy.port;
  }

  static rebootTimeout = 120000
}

async function reboot(query) {
  const result = {
    error: null,
    ip: null
  }

  const { error, modem } = findModem(query)
  if (error) {
    result.error = error
    return result
  }

  const login = modem.options.login;
  let userSession = sessions[login];
  if (!userSession) {
    userSession = sessions[login] = new Session(modem);
  }

  const remainingTime = (userSession.lastChangeIp + 20000) - Date.now()
  if (remainingTime > 0) {
    result.error = new ModemErrors.TooFrequentAttempts(remainingTime)
    return result
  }

  if (userSession.lock) {
    await new Promise((resolve) => {
      userSession.on('unlock', resolve)
    })
    result.ip = userSession.lastIp
    return result
  }

  userSession.emit('lock')
  await userSession.login();

  let ip;
  for(let i = 1; i <= 3; i++) {
    try {
      await resetIp(userSession);
      ip = await checkIp(userSession.proxyURL);
    } catch (e) {
      console.warn(e.message);
      continue;
    }

    const time = new Date().toString().match(/\d{2,2}:\d{2,2}:\d{2,2}/)[0];
    log(
      chalk.gray(time) +
      chalk.green(` - modem: ${modem.options.id}; attepmt ${i}, ip: ${ip}`)
    );

    if (ip !== null && ip != userSession.lastIp) {
      userSession.lastIp = ip;
      userSession.lastChangeIp = Date.now();
      break;
    }
  }

  if (!ip){
    result.error = new ModemErrors.IpNotChanged()
  } else {
    result.ip = ip
  }

  userSession.emit('unlock')
  return result;
}

function modemTimeoutReboot() {
  for (const apiKey in config.clients) {
    const clientModems = config.clients[apiKey].filter((modem) => {
      return modem.options.on && modem.options.timeout > 0;
    });

    clientModems.forEach((modem) => {
      const timeout = modem.options.timeout;
      retryAsync(false, Infinity, timeout * 1000, async (done) => {
        while (true) {
          try {
            await reboot({
              key: apiKey,
              id: modem.options.id
            });
            break;
          } catch (e) {
            console.error(client, e.message);
          }
        }
      });
    });
  }
}

async function resetIp(userSession) {
  const host = userSession.options.ip_web;
  await changeMode(userSession, host, userSession.network.second);
  await changeMode(userSession, host, userSession.network.main);
  return retryAsync(false, async (done) => {
    const { body } = await userSession.request(
      `http://${host}/api/monitoring/status`,
      {
        headers: userSession.headers,
      }
    );
    if (/<ConnectionStatus>901</.test(body)) {
      done(body);
    }
  });
}

function checkIp(proxy) {
  return retryAsync(false, 3, 1000, async (done) => {
    const { body } = await request('http://ip.bablosoft.com/', {
      agent: new Agent(proxy),
    });

    if (body != '<html></html>') {
      done(body);
    }
  });
}

function findModem(query) {
  const apiKey = query['key'];
  const modemId = query['id'];
  const userData = config.clients[apiKey];
  const result = {
    error: null,
    modem: null
  }

  if (!userData) {
    result.error = new ModemErrors.ApiKeyNotFound();
    return result
  }

  const modem = userData.find((modem) => modem.options.id === modemId);

  if (!modem) {
    result.error = new ModemErrors.ModemNotFound(modemId);
    return result
  }

  if (!modem.options.on) {
    result.error = ModemErrors.ModemOff(modemId);
    return result
  }

  result.modem = modem
  return result
}

if (module.parent) {
  module.exports = {
    reboot,
    modemTimeoutReboot,
  };
} else {
  keyGenerator();
}

async function changeMode(userSession, host, mode) {
  let body = `<?xml version="1.0" encoding="UTF-8"?><request><NetworkMode>${mode}</NetworkMode><NetworkBand>3FFFFFFF</NetworkBand><LTEBand>7FFFFFFFFFFFFFFF</LTEBand></request>`;
  const res = await userSession.request(`http://${host}/api/net/net-mode`, {
    body,
    headers: userSession.headers,
  });
}
