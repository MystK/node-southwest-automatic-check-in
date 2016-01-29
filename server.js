import "babel-polyfill";
import Koa from 'koa'
import koaRouter from 'koa-router'
import request from 'request'
import _ from 'lodash'
import cron from 'cron'
// CronJob
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
})

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
  let postCookie = parseSetCookie(postRes.headers['set-cookie'])
  if (postRes.statusCode === 302) {
    let redirect = await new Promise((resolve, reject) => {
      let [url, setCookie] = [postRes.headers.location, postRes.headers['set-cookie']]
      request.get(Object.assign(defaultRequestOptions, {
        url: url,
        headers: { Cookie: postCookie }
      }), (err, res, body) => { if (err) reject(err); else resolve([res, body]) })
    })
    let [redirectRes, redirectBody] = redirect
    let redirectCookie = parseSetCookie(redirectRes.headers['set-cookie'])
    resolve({ response: redirectRes, body: redirectBody, cookie: redirectCookie })
  } else {
    reject({ err: 'Did not receive a status code 302', response: postRes, body: postBody, cookie: postCookie })
  }
})())

const inputOptions = {
  confirmationNumber: 'H8WQPC',
  firstName: 'KRISTIE',
  lastName: 'DANG'
}
const inputOptions2 = {
  confirmationNumber: 'RSA2TA',
  firstName: 'ANTOINE',
  lastName: 'PHAM'
}

const checkInFull = async(inputOptions) => {
  const submitFormOptions = {
    url: 'https://www.southwest.com/flight/retrieveCheckinDoc.html',
    form: inputOptions
  }
  let submitForm = await (async function recursiveRetry(retryCount = 0) {
    try {
      let response = await SWRequest(submitFormOptions)
      return response
    } catch (err) {
      console.log(`Status Code: ${err.response.statusCode}`)
      if (++retryCount >= 10) {
        console.log('Too many redirects for ' + JSON.stringify(submitFormOptions))
        console.log(_.isArray(err.body.match(/This form has the following errors/g)))
        err.err = true
        return err
      } else {
        console.log('Retrying')
        return recursiveRetry(retryCount)
      }
    }
  })()
  if (submitForm.err) {
    submitFormOptions.err = 'Something happened with submit form!'
    return submitForm.body
  }
  try {
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
    // const sendToPhoneOptions = SWRequest({
    //   url: 'https://www.southwest.com/flight/selectCheckinDocDelivery.html',
    //   form: {
    //     selectedOption: 'optionText',
    //     phoneArea: '408',
    //     phonePrefix: '391',
    //     phoneNumber: '3799',
    //     book_now: ''
    //   },
    //   headers: {
    //     Cookie: checkIn.cookie
    //   }
    // })
    // const sendToEMailOptions = SWRequest({
    //   url: 'https://www.southwest.com/flight/selectCheckinDocDelivery.html',
    //   form: {
    //     selectedOption: 'optionEmail',
    //     emailAddress: 'its@phamap.net',
    //     book_now: ''
    //   },
    //   headers: {
    //     Cookie: submitForm.cookie
    //   }
    // })
    // const [sendToPhone, sendToEMail] = await Promise.all([
    //   SWRequest(sendToPhoneOptions),
    //   SWRequest(sendToEMailOptions)
    // ])
    let response = checkIn.body
    return response
    console.log('here!!')
    await next()
  } catch (err) {
    return err
    console.log(err)
  }
}
  router.get('/', async(ctx, next) => {
    ctx.body = await checkInFull(inputOptions2)
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

server
  .use(router.routes())

module.exports = server