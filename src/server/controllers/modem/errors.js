class ModemError extends Error {
  constructor(msg) {
    super(msg);
    this.name = this.constructor.name;
  }
}

class ApiKeyNotFound extends ModemError {
  constructor() {
    super('API keys not found');
  }
}

class ModemOff extends ModemError {
  constructor(id) {
    super(`Modem: ${id} - disabled`);
  }
}

class ModemNotFound extends ModemError {
  constructor(id) {
    super(`Modem: ${id} - not found`);
  }
}

class IpNotChanged extends ModemError {
  constructor() {
    super(`ip not changed`);
  }
}

class TooFrequentAttempts extends ModemError {
  constructor(ms) {
    super(`Too frequent attempts, remained: ${Math.ceil(ms / 1000)} sec`);
  }
}


module.exports = {
  ApiKeyNotFound,
  ModemNotFound,
  IpNotChanged,
  TooFrequentAttempts
};
