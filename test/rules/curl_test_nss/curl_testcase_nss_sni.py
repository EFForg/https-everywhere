#!/usr/bin/env python2.7
import pycurl
import cStringIO

""" Test case showing the CURL+NSS bug with SNI and FQDNs sharing IP address """

def curlRequest(url):
    buf = cStringIO.StringIO()
    headers = cStringIO.StringIO()

    c = pycurl.Curl()
    c.setopt(c.URL, url)
    c.setopt(c.VERBOSE, 1)
    c.setopt(c.WRITEFUNCTION, buf.write)
    c.setopt(c.HEADERFUNCTION, headers.write)
    c.setopt(c.CONNECTTIMEOUT, 5)
    c.setopt(c.TIMEOUT, 8)
    c.setopt(c.CAPATH, "cacert/")
    # Even though the bug is caused by SSL session IDs and session resume, the
    # following option doesn't help, it's somehow "ignored"
    #c.setopt(c.SSL_SESSIONID_CACHE, 0)
    # Turning off certchain validation turns off SSL session IDs and the HTTP
    # 400 thus vanishes:
    #c.setopt(c.SSL_VERIFYPEER, 0)
    #c.setopt(c.SSL_VERIFYHOST, 0)
    # Also using SSLv3 instead of TLSv1 is a "workaround" for the HTTP 400:
    #c.setopt(c.SSLVERSION, c.SSLVERSION_SSLv3)
    c.perform()

    bufData = buf.getvalue()
    headerData = headers.getvalue()
    buf.close()
    headers.close()
    c.close()

    return (bufData, headerData)

(data, headers) = curlRequest("https://wiki.vorratsdatenspeicherung.de")
print "=== Data length: ", len(data)
# This will return HTTP 400 if CURL was linked with NSS
(data, headers) = curlRequest("https://www.vorratsdatenspeicherung.de")
print "=== Data length: ", len(data)

