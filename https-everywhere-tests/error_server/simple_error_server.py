#!/usr/bin/env python3

from bottle import Bottle, run, request, get, post

import json
try:
    # Python 3
    from urllib.parse import unquote_plus, urlsplit
except ImportError:
    #Python 2
    from urllib import unquote_plus
    from urlparse import urlsplit

import logging
import sys


class ErrorServer(Bottle):
    def __init__(self):
        Bottle.__init__(self)
        self.route("/https_everywhere_error_reports", method=["POST"], callback = self.error_reports)

    def error_reports(self):
        """
        :return:
        """

        try:
            error_reports = request.forms.get("error_reports")
            browser = request.forms.get("browser")
            version = request.forms.get("version")
            der = unquote_plus(error_reports)
            der = json.loads(der)
        except:
            pass
        print ("Browser: %s Version: %s Report: %s" % (browser, version, str(der)))

        return ""



if __name__ == "__main__":
    es = ErrorServer()
    run(es, host='127.0.0.1', port=5000, debug=True)
