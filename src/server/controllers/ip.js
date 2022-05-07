module.exports = function getIp(req, res) {
  res.end(req.client.remoteAddress);
}
