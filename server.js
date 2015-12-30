import "babel-polyfill";
import Koa from 'koa'
import koaRouter from 'koa-router'
import request from 'request'
// import './auth'
const server = new Koa();
const router = koaRouter();
const onerror = err => {
  console.error(err.stack)
}

import cors from 'kcors'
import bodyParser from 'koa-bodyparser'
server.use(bodyParser())

server.use(async(ctx, next) => {
  console.log(ctx.url)
  await next()
  // if (this.method!='OPTIONS') console.log(this.session, this.request.body)
})

// const db = JSON.parse(readFileSync('data/db.json').toString())

const parseSetCookie = input => {
  if (!input) return ''
  let output = []
  input.forEach((e, i) => {
    output[i] = e.split(';')[0]
  })
  return output.join('; ')
}
const defaultRequestOptions = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2605.0 Safari/537.36',
    'Accept': 'text/html',
    'Accept-Encoding': 'deflate',
    'Accept-Language': 'en-US,en;q=0.8'
  }
}
const SWRequest = (options, redirectCount = 0) => new Promise((resolve, reject) => (async f => {
  let post = await new Promise((resolve, reject) => {
    request.post(Object.assign(defaultRequestOptions, options), (err, res, body) => { if (err) reject(err); else resolve([res, body]) })
  })
  let [postRes, postBody] = post
  if (postRes.statusCode === 302) {
    let redirect = await new Promise((resolve, reject) => {
      let [url, setCookie] = [postRes.headers.location, postRes.headers['set-cookie']]
      request.get(Object.assign(defaultRequestOptions, {
        url: url,
        headers: { Cookie: parseSetCookie(setCookie) }
      }), (err, res, body) => { if (err) reject(err); else resolve([res, body]) })
    })
    let [redirectRes, redirectBody] = redirect
    let redirectCookie = parseSetCookie(redirectRes.headers['set-cookie'])
    resolve({ response: redirectRes, body: redirectBody, cookie: redirectCookie })
  } else {
    console.log(postRes.statusCode)
    if (++redirectCount >= 2) {
      return reject('Too many redirects for ' + JSON.stringify(options))
    } else {
      try {
        return await SWRequest(options, redirectCount)
      } catch (err) {
        reject(err)
      }
    }
  }
})())

  router
  .get('/', async(ctx, next) => {
  try {
    const submitForm = await SWRequest({
      url: 'https://www.southwest.com/flight/retrieveCheckinDoc.html',
      form: {
        confirmationNumber: 'HSHQ3O',
        firstName: 'ANTOINE',
        lastName: 'PHAM'
      }
    })
    const checkIn = await SWRequest({
      url: 'https://www.southwest.com/flight/selectPrintDocument.html',
      form: {
        'checkinPassengers[0].selected': 'true',
        printDocuments: 'Check In'
      },
      headers: {
        Cookie: submitForm.cookie
      }
    })
    const sendToPhoneOptions = SWRequest({
      url: 'https://www.southwest.com/flight/selectCheckinDocDelivery.html',
      form: {
        selectedOption: 'optionText',
        phoneArea: '408',
        phonePrefix: '391',
        phoneNumber: '3799',
        book_now: ''
      },
      headers: {
        Cookie: checkIn.cookie
      }
    })
    const sendToEMailOptions = SWRequest({
      url: 'https://www.southwest.com/flight/selectCheckinDocDelivery.html',
      form: {
        selectedOption: 'optionEmail',
        emailAddress: 'its@phamap.net',
        book_now: ''
      },
      headers: {
        Cookie: checkIn.cookie
      }
    })
    const [sendToPhone, sendToEMail] = await Promise.all([
      SWRequest(sendToPhoneOptions),
      SWRequest(sendToEMailOptions)
    ])
    let response = checkIn.body
    ctx.body = response
    await next()
  } catch (err) {
    ctx.body = err
    console.log(err)
  }
})
  .get('/listAll', ctx => {
    ctx.body = 'This call should list all stuff'
  })
  .post('/flight', async(ctx, next) => {
    await next()
    ctx.body = ctx.request
  })
  .put('/add', ctx => {

  })
  .delete('/remove', ctx => {

  })

/*router.get('/', async function(ctx) {
  this.body = 'Hello Wo rld'
})

router.post('/login', async function(ctx) {
  let body = this.request.body
  if (body.username == 'tillster' && body.password == 'test') {
    this.body = { name: 'Antoine Pham', result: true }
    this.session.username = 'tillster'
    this.session.name = 'Antoine Pham'
    this.session.type = 'updateAdmin'
    this.session.expire = Date.now() + 86400000
  }
  else this.body = { result: false }
})

router.post('/api/1/updates/check', async function(ctx) {
  let release = this.request.body['version'];
  let response
  if (release in db) response = db[release]
  else response = db['NA']
  this.body = {
    request: this.request.body,
    response: response
  }
  this.request.body.url = this.url
  console.log(this.request.body)
});

router.post('/api/1/updates/log', async function(ctx) {
  this.body = {
    request: this.request.body,
    response: {
      result: true
    }
  }
  this.request.body.url = this.url
  console.log(this.request.body)
});

router.get('/api/1/updates/sessiontest', async function(ctx) {
  this.session.test = this.session.test + 1 || 1
  this.body = {
    response: this.session.test
  }
});*/

server
// .use(cors())
  .use(router.routes())

module.exports = server