const javascript = require('./languages/javascript');
const coffee = require('./languages/coffee');
const c = require('./languages/c');
const java = require('./languages/java');
const python = require('./languages/python');
const html = require('./languages/html');

module.exports = {
  'javascript': javascript,
  'coffee': coffee,
  'coffeescript': coffee,
  'c': c,
  'c_cpp': c,
  'java': java,
  'python': python,
  'html': html
};
