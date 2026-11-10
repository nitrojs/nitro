// Bundled CommonJS requiring a dependency Vite keeps external in the SSR build (#4171)
exports.dep = require("@fixture/require-external-dep");
