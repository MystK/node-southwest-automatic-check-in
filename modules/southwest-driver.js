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

const southwestCheckIn = async(inputOptions) => {
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
        if (++retryCount >= 20) {
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
	const passengerCount = submitForm.body.match(/id="checkinPassengers/g).length
	const form = {
      printDocuments: 'Check In'
    }
	for (let i = 0; i < passengerCount; ++i) {
	  form[`checkinPassengers[${i}].selected`] = 'true'
	}
	console.log(form)
    const checkIn = await SWRequest({
      url: 'https://www.southwest.com/flight/selectPrintDocument.html',
      form,
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

module.exports = southwestCheckIn
