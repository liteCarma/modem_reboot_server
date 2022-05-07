
const { getIp, reboot } = require('./controllers')

module.exports = function router(req, res) {
  
  switch (req.url.split('?')[0]) {
    case('/reboot'): {
      reboot(req, res);
      break;
    }
    case('/ip'): {
      getIp(req, res)
      break
    }
    default: {
      res.statusCode = 400;
      res.end('Bad request');
    }
  }
}
