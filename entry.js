require('babel-register')
process.stdout.write('\033c');
var app = require('./server')

app.listen(8000, () => console.log('listening to port 8000'))