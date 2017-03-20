const Koa = require('koa')
const koaRouter = require('koa-router')
const request = require('request')
const _ = require('lodash')
const { CronJob } = require('cron')
const cors = require('kcors')
const bodyParser = require('koa-bodyparser')
const southwestCheckIn = require('./modules/southwest-driver')
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

router
  .get('/', async(ctx, next) => {
    ctx.body = {
      exampleJson: {
        "firstName": "Michelle",
        "lastName": "Lam",
        "confirmationNumber": "BX6BEB",
        "time": "35 21 16 12",
        "timeComment": "/*Minute*/ /*Hour in 24 hour format*/ /*Flight Day*/ /*Flight Month*/"
      }
    }
  })
  .get('/listAll', ctx => {
    let body = {}
    for (let index in jobs) {
      body[index] = jobs[index].params || jobs[index]
    }
    body.exampleJson = {
      "firstName": "Michelle",
      "lastName": "Lam",
      "confirmationNumber": "BX6BEB",
      "time": "35 21 16 12",
      "timeComment": "/*Minute*/ /*Hour in 24 hour format*/ /*Flight Day*/ /*Flight Month*/"
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
      let time = `50 ${body.time} *`
      delete body.time
      // Seconds: 0-59
      // Minutes: 0-59
      // Hours: 0-23
      // Day of Month: 1-31
      // Months: 0-11
      // Day of Week: 0-6
      // if (_.isArray(time.match(/\*/g))) throw ('Cannot use * in time key. Check in should only be once.')
      let arrayTime = time.split(' ')
      console.log(arrayTime)
      arrayTime[1] = +arrayTime[1] - 1 // bring back by 1 minute
      arrayTime[3] = +arrayTime[3] - 1 // bring back by 1 dat
      arrayTime[4] = +arrayTime[4] - 1 // change the month = require(0-11 to 1-12
      // Seconds: 0-59
      // Minutes: 0-59
      // Hours: 0-23
      // Day of Month: 1-31
      // Months: 1-12
      time = arrayTime.join(' ')
      console.log(time)
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
            let response = await southwestCheckIn(body)
            console.log(time)
            console.log(body)
            console.log('Looks like check in script was ran')
          },
          start: true,
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
  .listen(8000, () => console.log('listening to port 8000'))
