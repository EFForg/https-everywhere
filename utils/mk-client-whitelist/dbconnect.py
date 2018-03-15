#!/usr/bin/env python3.6
import MySQLdb

try:    from db_private import DB_USER
except: DB_USER = "root"  # customise for your install

try:    from db_private import DB_PASS
except: DB_PASS = "root"  # customise

try:    from db_private import DB_NAME
except: DB_NAME = "observatory_api"

TEST_DB_NAME = "tmp_TESTDB1"

def dbconnect():
  db = MySQLdb.connect(user=DB_USER, passwd=DB_PASS, db=DB_NAME)
  dbc = db.cursor()
  return db,dbc

def dbconnecttest():
  db = MySQLdb.connect(user=DB_USER, passwd=DB_PASS, db=TEST_DB_NAME)
  dbc = db.cursor()
  return db,dbc

