require('babel-register')
var app = require('./server')

app.listen(8000, () => console.log('listening to port 8000'))