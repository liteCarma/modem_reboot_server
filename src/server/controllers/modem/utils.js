const {Network} = require('./constants')
const RSAKey = require('./RSA.js');

function retryAsync(...arg) {
	const func = arg.pop();
	const stopIfError = arg[0];
	const attempts = arg[1] || 10;
	const timeout = arg[2] || 1000;
	
	let counter = 0;
	let result = null;
	let error;
	const done = function(data) {
		result = data;
	}

	return new Promise(function(resolve, reject) {
			setTimeout(async function retry() {
					counter++;
					try {
							await func(done);
							if (result) {
									resolve(result)
									return;
							};
					} catch (e) {
							if (stopIfError) {
									reject(e);
							} else {
									error = e;
									//console.warn(e.message);
							}
					}

					if (counter == attempts) {
							if (error) {
									reject(error);
							} else {
									resolve(result);
							}
					} else {
							setTimeout(retry, timeout)
					};
			}, 0);
	})
}

function wait(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms)
	})
}

function keyGenerator() {
	const crypto = require('crypto');
	const secret = '#d3losf093kmdk=)332dwd23@d332ghkjlHgfdg';
	const hmac = crypto.createHmac('sha256', secret);
	const key = hmac.update(Math.random().toString()).digest('hex');
	console.log(key);
}

function base64encode(str) {
    return Buffer.from(str, 'utf8').toString('base64');
};

function parseNetwork(networkStr = 'lte:umts') {
  const data = networkStr.trim().split(':')
  return {
    main:   Network[data[0].toLowerCase()],
    second: Network[data[1].toLowerCase()]
  }
}
//RSA
function doRSAEncrypt(encstring, N, E) {
    let rsa = new RSAKey();
    rsa.setPublic(N, E);
    encstring = base64encode(encstring);
    let num = encstring.length / 245;
    let restotal = '';
    for (let i = 0; i < num; i++) {
        let encdata = encstring.substr(i * 245, 245);
        let res = rsa.encrypt(encdata);
        restotal += res;
    }
    if (restotal.length % 256 != 0) {
        restotal = doRSAEncrypt(encstring, N, E);
    }
    return restotal;
}

//XML
function object2xml(name, obj) {
    var xmlstr = '<?xml version="1.0" encoding="UTF-8"?>';
    xmlstr += _recursiveObject2Xml(name, obj);
    return xmlstr;
}

function _recursiveObject2Xml(name, obj) {
    let xmlstr = '';
    if (typeof(obj) == 'string' || typeof(obj) == 'number') {
        xmlstr = _createNodeStr(name, obj);
    } else if (typeof(obj) == 'object') {
        xmlstr += '<' + name + '>';
        for (let key in obj) {
            xmlstr += _recursiveObject2Xml(key, obj[key]);
        }
        xmlstr += '</' + name + '>';
    }

    return xmlstr;
}

function _createNodeStr(nodeName, nodeValue) {
    return '<' + nodeName + '>' + nodeValue + '</' + nodeName + '>';
}

module.exports = {
  retryAsync,
  wait,
  keyGenerator,
  base64encode,
  parseNetwork,
  doRSAEncrypt,
  object2xml
}