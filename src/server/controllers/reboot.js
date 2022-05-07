const { reboot } = require('./modem')

module.exports = async function (req, res) {
  let searchParams = getSearchParams(req.url)
  const { error, ip } = await reboot(searchParams)

  if (error) {
    res.statusCode = 400;
    res.end(error.message); 
    console.log(
      `remoteAddress ${req.client.remoteAddress} key: ${searchParams.key} error: ${error.message}`
    );
    return
  }
  res.end(ip)
}

function getSearchParams(url) {
  const { searchParams } = new URL(url, `http://localhost`)
  return Object.fromEntries(searchParams)
}