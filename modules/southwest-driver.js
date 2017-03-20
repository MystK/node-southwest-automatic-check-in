const _ = require('lodash')
const request = require('request')

const SWRequest = options => new Promise((resolve, reject) => (async () => {
  const dRO = { // defaultRequestOptions
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2605.0 Safari/537.36',
      Accept: 'text/html',
      'Accept-Encoding': 'deflate',
      'Accept-Language': 'en-US,en;q=0.8',
    },
  }
  const parseSetCookie = (input) => {
    if (!input) return ''
    const output = []
    input.forEach((e, i) => {
      output[i] = e.split(';')[0]
    })
    return output.join('; ')
  }
  const [postRes, postBody] = await new Promise((resolve2, reject2) => {
    request.post(_.assign(dRO, options), (err, res, body) => {
      if (err) reject2(err)
      else resolve2([res, body])
    })
  })
  const postCookie = parseSetCookie(postRes.headers['set-cookie'])
  if (postRes.statusCode === 302) {
    const redirect = await new Promise((resolve2, reject2) => {
      const [url] = postRes.headers.location
      request.get(_.assign(dRO, {
        url,
        headers: {
          Cookie: postCookie,
        },
      }), (err, res, body) => {
        if (err) reject2(err)
        else resolve2([res, body])
      })
    })
    const [redirectRes, redirectBody] = redirect
    const redirectCookie = parseSetCookie(redirectRes.headers['set-cookie'])
    resolve({
      response: redirectRes,
      body: redirectBody,
      cookie: redirectCookie,
    })
  } else reject({ err: 'Did not receive a status code 302', response: postRes, body: postBody, cookie: postCookie })
})())

const southwestCheckIn = async (inputOptions) => {
  const submitFormOptions = {
    url: 'https://www.southwest.com/flight/retrieveCheckinDoc.html',
    form: inputOptions,
  }
  const submitForm = await (async function recursiveRetry(retryCount = 0) {
    try {
      const response = await SWRequest(submitFormOptions)
      return response
    } catch (err) {
      const body = err.body
      if (_.isArray(body.match(/This form has the following errors/g))) {
        // const errors = body.match(/<ul id="errors"[^]+<\/ul>/)[0].split('<li>')
        console.log(`Status Code: ${err.response.statusCode}`)
        if (++retryCount >= 20) {
          console.log(`Too many redirects for ${JSON.stringify(submitFormOptions)}`)
          err.err = true
          return err
        }
        console.log('Retrying')
        return recursiveRetry(retryCount)
      }
      err.err = true
      return err
    }
  }())
  if (submitForm.err) {
    submitFormOptions.err = 'Something happened with submit form!'
    return submitForm.body
  }
  try {
    const passengerCount = submitForm.body.match(/id="checkinPassengers/g).length
    const form = {
      printDocuments: 'Check In',
    }
    for (let i = 0; i < passengerCount; ++i) {
      form[`checkinPassengers[${i}].selected`] = 'true'
    }
    console.log(form)
    const checkIn = await SWRequest({
      url: 'https://www.southwest.com/flight/selectPrintDocument.html',
      form,
      headers: {
        Cookie: submitForm.cookie,
      },
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
    // send email
    await SWRequest({
      url: 'https://www.southwest.com/flight/selectCheckinDocDelivery.html',
      form: {
        selectedOption: 'optionEmail',
        emailAddress: 'its@phamap.net',
        book_now: '',
      },
      headers: {
        Cookie: submitForm.cookie,
      },
    })
    const response = checkIn.body
    return response
  } catch (err) {
    console.log(err)
    return err
  }
}

module.exports = southwestCheckIn
