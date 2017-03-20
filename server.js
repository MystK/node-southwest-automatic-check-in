const Koa = require('koa')
const koaRouter = require('koa-router')
const _ = require('lodash')
const CronJob = require('cron').CronJob
const bodyParser = require('koa-bodyparser')
const fsp = require('fs-promise')
const southwestCheckIn = require('./modules/southwest-driver')

const jobs = []
const jobsCron = []
const server = new Koa()
const router = koaRouter()

// restart every hour so the time is in sync with the system, which should be correct
setInterval(() => {
  let restart = true
  jobs.forEach((job) => {
    const arrayTime = job.time.split(' ')
    const jobDate = +arrayTime[3]
    const todayDate = (new Date()).getDate()

    // don't restart the server if a check in is on the same day
    if (jobDate === todayDate) restart = false
  })
  if (restart) process.exit(1) // exit code 1 to make it look like a crash
}, 1000 * 60 * 60)

const addJob = (params) => {
  jobs.push(Object.assign({ status: 'Waiting until time' }, params))
  jobsCron.push({
    params,
    CronJob: new CronJob({
      cronTime: params.time,
      onTick: async () => {
        jobsCron[params.id].CronJob.stop()
        jobs[params.id].status = 'Done'
        await fsp.writeJson('./state.json', jobs)
        console.log('Trying to check in!')
        await southwestCheckIn(params.params)
        console.log(`Check in script was ran for ${JSON.stringify(params.params)}`)
      },
      start: true,
    }),
  })
  return params.id
}

// load the state
(async () => {
  try {
    const state = await fsp.readJson('./state.json')
    state.forEach(job => addJob(job))
  } catch (err) {
    // this is an expected error
  }
})()

server
  .use(bodyParser())
  .use(async (ctx, next) => {
    console.log(ctx.url)
    await next()
  })

router
  .get('/', async (ctx) => {
    ctx.body = {
      exampleJson: {
        firstName: 'Michelle',
        lastName: 'Lam',
        confirmationNumber: 'BX6BEB',
        time: '35 21 16 12',
        timeComment: '/*Minute*/ /*Hour in 24 hour format*/ /*Flight Day*/ /*Flight Month*/',
      },
    }
  })
  .get('/listAll', (ctx) => {
    const body = {}
    jobs.forEach((job, index) => {
      body[index] = job.params
      body[index].time = job.time
      body[index].status = job.status
    })
    body.exampleJson = {
      firstName: 'Michelle',
      lastName: 'Lam',
      confirmationNumber: 'BX6BEB',
      time: '35 21 16 12',
      timeComment: '/*Minute*/ /*Hour in 24 hour format*/ /*Flight Day*/ /*Flight Month*/',
      phoneNumber: '4086739283',
      phoneNumberComment: 'Phone number is optional and has to be exactly like above!',
      emailAddress: 'yourEmail@example.com',
      emailAddressComment: 'Email address is optional',
    }
    body.currentTime = Date()
    ctx.body = body
  })
  .post('/flight', async (ctx, next) => {
    await next()
    ctx.body = ctx.request
  })
  .put('/add', async (ctx, next) => {
    try {
      const body = ctx.request.body
      let time = `50 ${body.time} *`
      delete body.time
      // Seconds: 0-59
      // Minutes: 0-59
      // Hours: 0-23
      // Day of Month: 1-31
      // Months: 0-11
      // Day of Week: 0-6
      // if (_.isArray(time.match(/\*/g))) {
      //   throw ('Cannot use * in time key. Check in should only be once.')
      // }
      const arrayTime = time.split(' ')
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
        time,
        params: body,
        id: jobs.length,
      }
      addJob(params)
      await fsp.writeJson('./state.json', jobs)
      ctx.body = _.assign({}, params, { info: 'Successful!' })
      await next()
    } catch (err) {
      ctx.body = err
    }
  })
  .delete('/remove', (ctx) => {
    const body = ctx.request.body
    const index = body.index
    const job = jobs[index]
    if ('CronJob' in job) jobsCron.CronJob.stop()
    jobs[index] = 'Removed'
    ctx.body = `checkin #${index} removed`
  })

server
  .use(router.routes())
  .listen(8000, () => console.log('listening to port 8000'))
