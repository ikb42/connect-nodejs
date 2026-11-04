'use strict'

var qs = require('qs')
var undici = require('undici')

function dispatcherFor (options) {
  var connect = options.agentOptions
  var hasConnect = connect && typeof connect === 'object' && Object.keys(connect).length > 0
  var proxy = options.proxy
  if (proxy && typeof proxy !== 'string') proxy = proxy.href || proxy.url || null

  if (proxy) {
    var proxyOptions = { uri: proxy }
    if (hasConnect) proxyOptions.requestTls = connect
    return new undici.ProxyAgent(proxyOptions)
  }

  if (hasConnect) {
    return new undici.Agent({ connect: connect })
  }
}

function request (options) {
  options = options || {}
  var headers = Object.assign({}, options.headers || {})
  var method = options.method || 'GET'
  var body

  if (options.auth && options.auth.user && !headers.Authorization && !headers.authorization) {
    var credentials = Buffer.from(options.auth.user + ':' + (options.auth.pass || '')).toString('base64')
    headers.Authorization = 'Basic ' + credentials
  }

  if (options.form) {
    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
    }
    body = qs.stringify(options.form)
  } else if (options.json && typeof options.json === 'object') {
    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json'
    }
    body = JSON.stringify(options.json)
  }

  var fetchOptions = {
    method: method,
    headers: headers
  }

  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    fetchOptions.body = body
  }

  var dispatcher = dispatcherFor(options)
  if (dispatcher) fetchOptions.dispatcher = dispatcher

  return fetch(options.url, fetchOptions)
    .then(function (response) {
      return response.text().then(function (text) {
        var parsed = text
        if (!text) {
          parsed = null
        } else if (options.json) {
          try {
            parsed = JSON.parse(text)
          } catch (err) {
            parsed = text
          }
        }

        if (!response.ok) {
          var detail = typeof parsed === 'string' ? parsed : JSON.stringify(parsed)
          var error = new Error(response.status + ' - ' + detail)
          error.statusCode = response.status
          error.error = parsed
          error.response = { statusCode: response.status, body: parsed }
          throw error
        }

        return parsed
      })
    })
    .finally(function () {
      if (dispatcher) return dispatcher.close()
    })
}

module.exports = request
