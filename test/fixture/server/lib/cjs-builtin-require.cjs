const { EventEmitter } = require("events");

class Client extends EventEmitter {}

module.exports = {
  Client,
  EventEmitter,
};
