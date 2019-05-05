const { toASCII, toUnicode } = (() => {
  /**
   * This code is derived from punycode.js (https://github.com/bestiejs/punycode.js).
   *
   * Copyright Mathias Bynens <https://mathiasbynens.be/>
   *
   * Permission is hereby granted, free of charge, to any person obtaining
   * a copy of this software and associated documentation files (the
   * "Software"), to deal in the Software without restriction, including
   * without limitation the rights to use, copy, modify, merge, publish,
   * distribute, sublicense, and/or sell copies of the Software, and to
   * permit persons to whom the Software is furnished to do so, subject to
   * the following conditions:
   *
   * The above copyright notice and this permission notice shall be
   * included in all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
   * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
   * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
   * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
   * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
   * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
   * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
   */

  const maxInt = 2147483647

  const base = 36
  const tMin = 1
  const tMax = 26
  const skew = 38
  const damp = 700
  const initialBias = 72
  const initialN = 128
  const delimiter = '-'

  const regexPunycode = /^xn--/
  const regexNonASCII = /[^\0-\x7E]/
  const regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g

  const baseMinusTMin = base - tMin

  const mapDomain = (string, fn) => {
    const parts = string.split('@')
    let result = ''
    if (parts.length > 1) {
      result = parts[0] + '@'
      string = parts[1]
    }

    string = string.replace(regexSeparators, '.')
    const labels = string.split('.')
    const encoded = labels.map(fn).join('.')
    return result + encoded
  }

  const ucs2decode = string => {
    const output = []
    let counter = 0
    const length = string.length
    while (counter < length) {
      const value = string.charCodeAt(counter++)
      if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
        const extra = string.charCodeAt(counter++)
        if ((extra & 0xFC00) === 0xDC00) {
          output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000)
        } else {
          output.push(value)
          counter--
        }
      } else {
        output.push(value)
      }
    }
    return output
  }

  const basicToDigit = codePoint => {
    if (codePoint - 0x30 < 0x0A) {
      return codePoint - 0x16
    }
    if (codePoint - 0x41 < 0x1A) {
      return codePoint - 0x41
    }
    if (codePoint - 0x61 < 0x1A) {
      return codePoint - 0x61
    }
    return base
  }

  const digitToBasic = (digit, flag) => digit + 22 + 75 * (digit < 26) - ((flag !== 0) << 5)

  const adapt = (delta, numPoints, firstTime) => {
    let k = 0
    delta = firstTime ? Math.floor(delta / damp) : delta >> 1
    delta += Math.floor(delta / numPoints)
    for (; delta > baseMinusTMin * tMax >> 1; k += base) {
      delta = Math.floor(delta / baseMinusTMin)
    }
    return Math.floor(k + (baseMinusTMin + 1) * delta / (delta + skew))
  }

  const decode = input => {
    const output = []
    const inputLength = input.length
    let i = 0
    let n = initialN
    let bias = initialBias

    let basic = input.lastIndexOf(delimiter)
    if (basic < 0) {
      basic = 0
    }

    for (let j = 0; j < basic; ++j) {
      if (input.charCodeAt(j) >= 0x80) {
        throw new Error('Illegal input >= 0x80 (not a basic code point)')
      }
      output.push(input.charCodeAt(j))
    }

    for (let index = basic > 0 ? basic + 1 : 0; index < inputLength;) {
      const oldi = i
      for (let w = 1, k = base; ; k += base) {
        if (index >= inputLength) {
          throw new Error('Invalid input')
        }

        const digit = basicToDigit(input.charCodeAt(index++))

        if (digit >= base || digit > Math.floor((maxInt - i) / w)) {
          throw new Error('Overflow: input needs wider integers to process')
        }

        i += digit * w
        const t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias)

        if (digit < t) {
          break
        }

        const baseMinusT = base - t
        if (w > Math.floor(maxInt / baseMinusT)) {
          throw new Error('Overflow: input needs wider integers to process')
        }

        w *= baseMinusT
      }

      const out = output.length + 1
      bias = adapt(i - oldi, out, oldi === 0)

      if (Math.floor(i / out) > maxInt - n) {
        throw new Error('Overflow: input needs wider integers to process')
      }

      n += Math.floor(i / out)
      i %= out

      output.splice(i++, 0, n)
    }

    return String.fromCodePoint(...output)
  }

  const encode = input => {
    const output = []

    input = ucs2decode(input)

    const inputLength = input.length

    let n = initialN
    let delta = 0
    let bias = initialBias

    for (const currentValue of input) {
      if (currentValue < 0x80) {
        output.push(String.fromCharCode(currentValue))
      }
    }

    const basicLength = output.length
    let handledCPCount = basicLength

    if (basicLength) {
      output.push(delimiter)
    }

    while (handledCPCount < inputLength) {
      let m = maxInt
      for (const currentValue of input) {
        if (currentValue >= n && currentValue < m) {
          m = currentValue
        }
      }

      const handledCPCountPlusOne = handledCPCount + 1
      if (m - n > Math.floor((maxInt - delta) / handledCPCountPlusOne)) {
        throw new Error('Overflow: input needs wider integers to process')
      }

      delta += (m - n) * handledCPCountPlusOne
      n = m

      for (const currentValue of input) {
        if (currentValue < n && ++delta > maxInt) {
          throw new Error('Overflow: input needs wider integers to process')
        }

        if (currentValue === n) {
          let q = delta
          for (let k = base; ; k += base) {
            const t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias)

            if (q < t) {
              break
            }

            const qMinusT = q - t
            const baseMinusT = base - t
            output.push(
              String.fromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
            )
            q = Math.floor(qMinusT / baseMinusT)
          }

          output.push(String.fromCharCode(digitToBasic(q, 0)))
          bias = adapt(delta, handledCPCountPlusOne, handledCPCount === basicLength)
          delta = 0
          ++handledCPCount
        }
      }

      ++delta
      ++n
    }
    return output.join('')
  }

  const toUnicode = input => mapDomain(input, string => regexPunycode.test(string) ? decode(string.slice(4).toLowerCase()) : string)

  const toASCII = input => mapDomain(input, string => regexNonASCII.test(string) ? 'xn--' + encode(string) : string)

  return { toASCII, toUnicode }
})()
