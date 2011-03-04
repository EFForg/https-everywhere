"""
This parses the HTTPS Everywhere rulesets and, where it can, generates JSON objects to add to
Chromium's TransportSecurity to require they be secured.
"""
import glob, time, base64, hashlib
import xmltramp # http://www.aaronsw.com/2002/xmltramp/xmltramp.py

def domain2dns(s):
    out = []
    s = s.lower().split('.')
    for part in s:
        out.append(chr(len(part)) + part)
    return ''.join(out)

rules = glob.glob('../src/chrome/content/rules/*.xml')
out = []
for rule in rules:
    ruleset = xmltramp.seed(file(rule))
    #print ruleset('name')
    hosts = []
    for k in ruleset['target':]:
        hosts.append(k('host'))

    for k in ruleset['rule':]:
        for host in hosts:
            escaped_host = host.replace('.', '\\.')
            if (
              k('from') == "^http://(www\.)?%s/" % escaped_host
            ) and (
              k('to') == "https://www.%s/" % host or 
              k('to') == "https://%s/" % host
            ):
                out.extend([(host, False), ('www.' + host, False)])
                break
            elif k('from') == "^http://([^/:@]*)\.%s/" % escaped_host and \
              k('to') == "https://$1.%s/" % host:
                out.extend([(host, True)])
            elif k('from') == '^http://%s/' % escaped_host and \
              k('to') == "https://%s/" % host:
                out.append((host, False))
        else:
            pass #print '  ', host, k('from').encode('utf8'), k('to').encode('utf8')
    #print '  ', out

for (host, include_subdomains) in out:
    t = base64.encodestring(hashlib.sha256(domain2dns(host) + '\0').digest()).strip()
    
    print '    "%s": {' % t
    print '        "created": %s,' % time.time()
    print '        "expiry": %s,' % (time.time()+86400000)
    print '        "include_subdomains": %s,' % repr(include_subdomains).lower()
    print '        "mode": "strict"'
    print '    },'
