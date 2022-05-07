const http = require('http');
const https = require('https');
const {
  HTTPResponceError,
  HTTPMaxAttempts,
  HTTPMaxRedirects,
  HTTPBadStatus
} = require('./errors.js');

module.exports = request;

async function request(url, options = {}) {
  if (typeof url == 'object') {
    options = url;
    url = undefined;
  }

  setOptions(url, options);
  options = Object.assign({}, request.deafultOptions, options);
  let attemptsCount = 0;
  let followCount = 0;

  while (true) {
    let error = null,
      res = '';
    try {
      res = await tickReq(options);
    } catch (e) {
      console.warn(e.message)
      error = e;
    }

    if (res !== '') {
      if (res.statusCode === 200) {
        return res;
      } else if ('location' in res.headers) { //переадресация
        if (options.follow) {
          if (followCount++ >= options.followDepth) {
            throw new HTTPMaxRedirects(url, res.statusCode);
          }
          options.path = res.headers['location'];
          continue;
        } else {
          return res;
        }
      } else if (!options.retry && !options.throw) {  //нет опции повтора и отличены ошибки
        return res;
      } else {
        error = new HTTPBadStatus(options.path, res.statusCode);
        if (!options.retry.statusCode.includes(res.statusCode)) { //статус не выбран для повтора
          throw error;
        }
      };
    }

    if (error !== null) {
      error = new HTTPResponceError(options.path, error);
    }

    if (options.retry) {
      if (attemptsCount++ >= options.retry.attempts - 1) {
        throw new HTTPMaxAttempts(url, res.statusCode || -1, error);
      }
      await pause(options.retry.delay);
    } else {
      throw error;
    }

  }
}

function tickReq(options) {
  let httpAny = options.protocol === 'http:' ? http : https;
  return new Promise(function (resolve, reject) {
    const req = httpAny.request(options, res => {
      let raw = '';
      res.on('data', chunk => {
        raw += chunk;
      });

      res.on('end', () => {
        res.body = raw;
        resolve(res);
      })
    });

    req.on('socket', socket => {
      socket.on('timeout', function (err) {
        req.abort();
      });
    })

    req.on('error', function (err) {
      reject(err);
    });

    if (!isNaN(options.timeout)) {
      req.setTimeout(options.timeout);
    }
    req.end(options.body);
  })
};

request.deafultOptions = {
  timeout: undefined,
  keepAlive: true,
  retry: {
    attempts: 2,
    delay: 5000,
    statusCode: [408, 413, 429, 500, 502, 503, 504, 521, 522, 524]
  },
  throw: true,
  follow: true,
  followDepth: 10
}

function setOptions(url, options) {
  url = new URL(options.path ? options.path : '', url);
  const {
    host,
    pathname,
    protocol
  } = url;
  options.host = host;
  options.path = pathname;
  options.protocol = protocol;

  if (options.body && !options.method) {
    options.method = 'POST'
  }

  if (protocol != 'http:' && !protocol == 'https:') {
    throw Error(`unknown protocol ${protocol}`);
  }

  options.defaultPort = protocol === 'http:' ? 80 : 443;
  setAgent(options, protocol == 'https:');
}

function setAgent(options, https) {
  if (!options.agent) return;
  if (options.agent.https && https) {
    options.agent = options.agent.https;
  } else if (options.agent.http && !https) {
    options.agent = options.agent.http;
  } else {
    options.agent = options.agent;
  }
}

function pause(msc) {
  return new Promise(function (resolve) {
    setTimeout(resolve, msc);
  });
}