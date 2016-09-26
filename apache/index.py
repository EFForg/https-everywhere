#!/usr/bin/env python2.7

from mod_python import apache
from mod_python import util
from time import sleep

def index(req):
  return page(req)

def page(req):
  req.content_type = 'text/html'
  sleep(0.5)
  return "<font size=80>page</font>\n"

def submit_cert(req):
  sleep(100)
  return "ok cert submitted\n"
