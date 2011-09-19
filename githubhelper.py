import json, urllib, sys, os, subprocess

from tokenkeys import oauth_token

VERSION = sys.argv[1]
fn = 'pkg/https-everywhere-%s.crx' % VERSION

results = json.load(urllib.urlopen('https://api.github.com/repos/aaronsw/https-everywhere/downloads?access_token=%s' % oauth_token, json.dumps(dict(
  name=fn,
  size=os.stat(fn).st_size,
  description='Release of version %s' % VERSION,
  content_type='application/x-chrome-extension'
))))

subprocess.Popen(['curl', 
  '-F', 'key=%s' % results['path'],
  '-F', "acl=%s" % results['acl'],
  '-F', "success_action_status=201",
  '-F', "Filename=%s" % results['name'],
  '-F', "AWSAccessKeyId=%s" % results['accesskeyid'],
  '-F', "Policy=%s" % results['policy'],
  '-F', "Signature=%s" % results['signature'],
  '-F', "Content-Type=%s" % results['mime_type'],
  '-F', "file=@%s" % fn,
'https://github.s3.amazonaws.com/']).wait()

print '\nUploaded.'