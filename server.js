import "babel-polyfill";
import Koa from 'koa'
import koaRouter from 'koa-router'
import request from 'request'
import _ from 'lodash'
import { CronJob } from 'cron'
import cors from 'kcors'
import bodyParser from 'koa-bodyparser'
var jobs = []
const server = new Koa();
const router = koaRouter();
const onerror = err => {
  console.error(err.stack)
}

server
  .use(bodyParser())
  .use(async(ctx, next) => {
    console.log(ctx.url)
    await next()
  })

const SWRequest = options => new Promise((resolve, reject) => (async f => {
  const dRO = { // defaultRequestOptions
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2605.0 Safari/537.36',
      'Accept': 'text/html',
      'Accept-Encoding': 'deflate',
      'Accept-Language': 'en-US,en;q=0.8'
    }
  }
  const parseSetCookie = input => {
    if (!input) return ''
    let output = []
    input.forEach((e, i) => {
      output[i] = e.split(';')[0]
    })
    return output.join('; ')
  }
  let [postRes, postBody] = await new Promise((resolve, reject) => {
    request.post(_.assign(dRO, options), (err, res, body) => {
      if (err) reject(err)
      else resolve([res, body])
    })
  })
  let postCookie = parseSetCookie(postRes.headers['set-cookie'])
  if (postRes.statusCode === 302) {
    let redirect = await new Promise((resolve, reject) => {
      let [url, setCookie] = [postRes.headers.location, postRes.headers['set-cookie']]
      request.get(_.assign(dRO, {
        url: url,
        headers: {
          Cookie: postCookie
        }
      }), (err, res, body) => {
        if (err) reject(err)
        else resolve([res, body])
      })
    })
    let [redirectRes, redirectBody] = redirect
    let redirectCookie = parseSetCookie(redirectRes.headers['set-cookie'])
    resolve({
      response: redirectRes,
      body: redirectBody,
      cookie: redirectCookie
    })
  } else reject({ err: 'Did not receive a status code 302', response: postRes, body: postBody, cookie: postCookie })
})())

const checkInFull = async(inputOptions) => {
  const submitFormOptions = {
    url: 'https://www.southwest.com/flight/retrieveCheckinDoc.html',
    form: inputOptions
  }
  let submitForm = await(async function recursiveRetry(retryCount = 0) {
    try {
      let response = await SWRequest(submitFormOptions)
      return response
    } catch (err) {
      const body = err.body
      if (_.isArray(body.match(/This form has the following errors/g))) {
        const errors = body.match(/<ul id="errors"[^]+<\/ul>/)[0].split('<li>')
        console.log(`Status Code: ${err.response.statusCode}`)
        if (++retryCount >= 10) {
          console.log('Too many redirects for ' + JSON.stringify(submitFormOptions))
          err.err = true
          return err
        } else {
          console.log('Retrying')
          return recursiveRetry(retryCount)
        }
      } else {
        err.err = true
        return err
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
    const sendToEMailOptions = await SWRequest({
      url: 'https://www.southwest.com/flight/selectCheckinDocDelivery.html',
      form: {
        selectedOption: 'optionEmail',
        emailAddress: 'its@phamap.net',
        book_now: ''
      },
      headers: {
        Cookie: submitForm.cookie
      }
    })
    let response = checkIn.body
    return response
    await next()
  } catch (err) {
    return err
    console.log(err)
  }
}
router
  .get('/', async(ctx, next) => {
    ctx.body = await checkInFull(inputOptions2)
  })
  .get('/listAll', ctx => {
    let body = {}
    for (let index in jobs) {
      body[index] = jobs[index].params || jobs[index]
    }
    ctx.body = body
  })
  .post('/flight', async(ctx, next) => {
    await next()
    ctx.body = ctx.request
  })
  .put('/add', async ctx => {
    try {
      var count = 0
      let body = ctx.request.body
      const time = body.time + ' *'
      delete body.time
      // Seconds: 0-59
      // Minutes: 0-59
      // Hours: 0-23
      // Day of Month: 1-31
      // Months: 0-11
      // Day of Week: 0-6
      // if (_.isArray(time.match(/\*/g))) throw ('Cannot use * in time key. Check in should only be once.')
      const params = {
        time: time,
        params: body,
        id: jobs.length
      }
      jobs.push({
        params,
        CronJob: new CronJob({
          cronTime: time,
          onTick: async f => {
            console.log('Trying to check in!')
            let response = await checkInFull(body)
            console.log(time)
            console.log(body)
            console.log('Looks like check in script was ran')
          },
          start: true,
          timeZone: 'America/Los_Angeles',
          onComplete: f => {
            console.log('stopped')
          }
        })
      })
      ctx.body = _.assign({}, params, { info: 'Successful!' })
    } catch (err) {
      ctx.body = err
    }
  })
  .delete('/remove', ctx => {
    const body = ctx.request.body
    const index = body.index
    const job = jobs[index]
    if ('CronJob' in job) job.CronJob.stop()
    jobs[index] = 'Removed'
    ctx.body = `checkin #${index} removed`
  })

server
  .use(router.routes())

module.exports = server