const request = require('../../../lib/request');
const Agent = require('proxy-agent');
const {Errors} = require('./constants')

request.deafultOptions.throw = true;
request.deafultOptions.follow = false;
request.deafultOptions.retry.attempts = 0;
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
// request.deafultOptions.agent = new Agent('http://127.0.0.1:8888')

module.exports = async function (...arg) {
  let index = 0
  let error
  while (true) {
    if (index++ > 1) {
      throw error
    }

    const res = await request(...arg)

    let code = res.body.match(/<code>(\d+)<\/code>/)
    if (code && code[1]) {
      code = code[1]
      error = Errors[code] || 'unknown modem error';
  
      if (code == 125001 || code == 125002 || code == 125003) {
        await this.login()
        continue
      }

      if (code == 108001 || code == 108002) {
        throw error
      }
    }
  
    if ('set-cookie' in res.headers) {
      this.headers.cookie = res.headers['set-cookie'] && res.headers['set-cookie'][0];
    }
    
  
    if ('__requestverificationtoken' in res.headers) {
      this.headers.__RequestVerificationToken = res.headers['__requestverificationtoken'].split('#')[0];
    }
  
    return res
  }

}
