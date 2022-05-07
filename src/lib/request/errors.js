class HTTPErrors extends Error {
    constructor(msg, url, statusCode) {
        super(msg);
        this.name = this.constructor.name;
        this.url = url;
        this.statusCode = statusCode;
    }
}

class HTTPResponceError extends HTTPErrors {
    constructor(url, error) {
        super(`request error, last url: ${url}, error ${error.message}`, url);
        this.cause = error;
    }
}

class HTTPBadStatus extends HTTPErrors {
    constructor(url, statusCode) {
        super(`request fail, last url: ${url}, status code ${statusCode}`, url, statusCode);
    }
}

class HTTPMaxRedirects extends HTTPErrors {
    constructor(url, statusCode) {
        super(`maximum depth of redirects, last url: ${url}, status code ${statusCode}`, url, statusCode);
    }
}

class HTTPMaxAttempts extends HTTPErrors {
    constructor(url, statusCode, error) {
        super(`maximum attempts, last url: ${url}, status code ${statusCode}`, url, statusCode);
        this.cause = error;
    }
}

module.exports = {
    HTTPResponceError,
    HTTPMaxAttempts,
    HTTPMaxRedirects,
    HTTPBadStatus
}