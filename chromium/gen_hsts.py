"""
This parses the HTTPS Everywhere rulesets and, where it can, generates JSON objects to add to
Chromium's TransportSecurity to require they be secured.
"""
import glob, time, base64, hashlib, json, os
import xmltramp # http://www.aaronsw.com/2002/xmltramp/xmltramp.py

def domain2dns(s):
    out = []
    s = s.lower().split('.')
    for part in s:
        out.append(chr(len(part)) + part)
    return ''.join(out)

def parse_rules():
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
        return out

def update_tsobj(domains, tsobj):
    for (host, include_subdomains) in domains:
        t = base64.encodestring(hashlib.sha256(domain2dns(host) + '\0').digest()).strip()
        if t not in tsobj:
            tsobj[t] = {
                'created': time.time(),
                'expiry': time.time()+86400000,
                'include_subdomains': include_subdomains,
                'mode': 'strict'
            }
    return tsobj

TS_FN = os.path.expanduser('~') + '/Library/Application Support/Google/Chrome/Default/TransportSecurity'
def replace_ts():
    tsobj = json.load(file(TS_FN))
    update_tsobj(parse_rules(), tsobj)
    file(TS_FN+'.bak', 'w').write(file(TS_FN).read())
    json.dump(tsobj, file(TS_FN + '.tmp', 'w'), indent=4)

if __name__ == "__main__":
    replace_ts()
    print "Please quit Google Chrome/Chromium before running this program."
    raw_input("Hit return once you've quit: ")
    os.rename(TS_FN + '.tmp', TS_FN)