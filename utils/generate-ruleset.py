#!/usr/bin/env python3
"""
    Generate rulesets for HTTPSEverywhere.

    '--help' for details
"""
import argparse
import codecs
import collections
import concurrent.futures
from datetime import timedelta
import dns.resolver
import dns.zone
import enum
import itertools
import io
import os
import re
import requests
import sys
import textwrap
import xml.etree.ElementTree


class Err(enum.Enum):
    """
        Enumeration of errors that represent the different categories added at the top of
        a ruleset as comment

        Example:
             <!--
                 Http redirect:
                     - nano.example.com
                 Self-signed certificate:
                     - www.example.com
             -->
   """
    http_redirect = 'http redirect'
    http_status_code = 'unexpected http status code'
    certificate_mismatch = 'certificate mismatch'
    connection_refused = 'connection refused'
    self_signed_certificate = 'self-signed certificate'
    timeout_on_https = 'timeout on https'


class Host():
    """
        Representation of a host

        ``error`` is what is added as comment the ruleset
        ``messages`` are printed in the summary
    """
    def __init__(self, name):
        self.name = name
        self.messages = []
        self.error = None
        self.skipped = False

    def add_message(self, level, message):
        self.messages.append([level, message])

    def skip(self, level, message):
        self.skipped = True
        self.add_message(level, message)

    def set_error(self, error, message):
        assert isinstance(error, Err)
        self.error_message = message
        self.error = error

    def status(self):
        lines = ['host {}:'.format(self)]
        if self.error:
            lines.append('    • ERROR : {!r}: {}'.format(self.error.value, self.error_message))
        for level, message in self.messages:
            lines.append('    • {:5} : {}'.format(level.upper(), message))

        if not self.error and not self.messages:
            lines.append('    OK')

        return '\n'.join(lines)

    def __str__(self):
        return self.name


class OpenFileOrStream:
    """Open and close given file if necessary"""
    def __init__(self, file, mode='r'):
        if isinstance(file, str):
            self.close = True
            self.fp = open(file, mode)
        else:
            self.close = False
            self.fp = file

    def __enter__(self):
        return self.fp

    def __exit__(self, a, b, c):
        if self.close and hasattr(self, 'fp'):
            self.fp.close()


class Parser:
    """Base class for all parsers"""
    def __init__(self, fp):
        self.fp = fp

    def __iter__(self):
        raise NotImplementedError()


class LineParser(Parser):
    """
        Read host names from file.

        Each name must be on a separate line. Empty lines are ignored, '#' starts a comment.
    """

    def __iter__(self):
        for line in self.fp:
            line = line.split('#', 1)[0].strip()
            if line != '':
                yield line


class RuleSetParser(Parser):
    """
        Read a existing ruleset file and extract host names from it.

        Extracted are:
            • host names in <target>s
            • host names in the first comment before <ruleset> if they are in one of these two forms:
                '    - www.example.com'
                '    www.example.com'
              In essence any line starting a 'word' (possibly preceded by a hyphen) is considered
              a host name if it contains a dot.
    """
    def _extract_targets(self, content):
        tree = xml.etree.ElementTree.parse(io.StringIO(content))
        return (i.get('host') for i in tree.iterfind('target'))

    def _extract_comments(self, content):
        match = re.search('<!--((\n|.)*?)-->(\n|.)*<\s*ruleset\s', content)
        if match:
            for line in match.group(1).split('\n'):
                host_match = re.match('\s*(?:-\s+)?([^\s]+\.[^\s]+)', line)
                if host_match:
                    yield host_match.group(1)

    def __iter__(self):
        content = self.fp.read()
        yield from self._extract_targets(content)
        yield from self._extract_comments(content)


class ZoneFileParser(Parser):
    """Parse a DNS zone file"""
    def __iter__(self):
        data = dns.zone.from_file(self.fp)
        for entry in (i.concatenate(data.origin) for i in data.keys() if not i.is_wild()):
            yield '.'.join(self.punycode_decode(l) for l in entry.labels if l != b'')

    def punycode_decode(self, label):
        """Support for internationalized domain names"""
        if label.startswith(b'xn--'):
            return codecs.decode(label[4:], 'punycode')
        return label.decode()

class Writer:
    """Base class for all writers"""
    def __init__(self, args, threads=25):
        self.args = args
        self.threads = threads

    def sort_key(self, host):
        """
            Sort host names

            Sort alphabetically, label by label, from right to left. As special exception 'www.xyz'
            is placed directly after 'xyz'.
        """
        parts = host.split('.')[::-1]
        if parts[-1] == 'www':
            return parts[:-1], 1
        return parts, 0

    def execute(self, output, host_iter):
        raise NotImplementedError()


class LineWriter(Writer):
    """Write hosts line by line"""
    def execute(self, output, host_iter):
        hosts = sorted(set(host_iter), key=self.sort_key)
        for host in hosts:
            print(host, file=output)


class RuleWriter(Writer):
    def __init__(self, args, *a, **ka):
        super().__init__(self, *a, **ka)

        self.allowed_status_codes = [int(i) for i in args.http_status_codes.split(',')]

    def _process_hosts(self, hosts):
        """
            Process all hosts

            @return yields a ``Host`` object for every valid host
        """
        with concurrent.futures.ThreadPoolExecutor(self.threads) as pool:
            yield from pool.map(self._verify_entry, hosts)

    def _has_dns_entry(self, host):
        """Check if there is a A or AAAA record for ``host``. CNAMEs are followed."""

        try:
            # IPv4
            dns.resolver.query(host)
            return True

            # IPv6
            dns.resolver.query(host, dns.rdatatype.AAAA)
            return True
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer) as e:
            pass

        return False

    def _verify_hsts_header(self, result, hsts):
        if hsts is None:
            return  # header absent

        max_age_match = re.search('max-age\s*=\s*(\d+)', hsts)
        max_age = timedelta(seconds=int(max_age_match.group(1))) if max_age_match else 'unknown'

        if re.search('(^|\s|;)preload($|\s|;)', hsts):
            result.add_message('warn', 'HSTS indicates a preloaded domain: {!r}'.format(hsts))

        result.add_message('info', 'found HSTS header with a max-age of {}: {!r}'.format(max_age, hsts))


    def _verify_entry(self, host):
        """Verify validity of ``host`` as a <target>"""
        result = Host(host)
        if not self._has_dns_entry(host):
           result.skip('warn', 'skipping host, failed to fetch A/AAAA DNS entry'.format(host))
           return result

        url = 'https://' + host
        url_http = 'http://' + host
        try:
            resp = requests.get(url, timeout=30)
            resp_http = requests.get(url, timeout=30)

            redirects = [i.url for i in resp.history + [resp]]
            redirects_http = [i.url for i in resp_http.history + [resp_http]]

            self._verify_hsts_header(result, resp.headers.get('Strict-Transport-Security'))

            if len(redirects) > 1 and any(i.startswith(url_http + '/') for i in redirects[1]):
                # Verify none of the redirects for https:// redirects to the http:// version of the page
                result.set_error(Err.http_redirect, '{!r} redirects to http://'.format(url))
            elif resp.status_code not in self.allowed_status_codes:
                # verify http status code is allowed for https:// request
                result.set_error(Err.http_status_code,
                    'unexpected status code {} for {!r}'.format(resp.status_code, url))
            elif resp_http.status_code not in self.allowed_status_codes:
                # verify http status code is allowed for http:// request
                result.set_error(Err.http_status_code,
                    'unexpected status code {} for {!r}'.format(resp_http.status_codeurl))

            if any(i.startswith('http://') for i in redirects):
                result.add_message('warn', 'https:// url redirects to http://: {}'.format(' → '.join(redirects)))
        except requests.exceptions.SSLError as e:
            if 'CERTIFICATE_VERIFY_FAILED' in str(e):
                result.set_error(Err.self_signed_certificate,
                    'Self-signed certificate encountered for host {!r}: {}'.format(host, e))
            else:
                result.set_error(Err.certificate_mismatch, 'SSL connection failed for {!r}: {}'.format(host, e))
        except (requests.exceptions.ConnectTimeout, requests.exceptions.ReadTimeout) as e:
            if e.request.url.startswith('https://'):
                result.set_error(Err.timeout_on_https, 'Connection timed-out for {!r}: {}'.format(host, e))
            else:
                result.skip('warn', 'skipping host, it is not reachable via http://:', e)
        except requests.exceptions.ConnectionError as e:
            if e.request.url.startswith('https://'):
                result.set_error(Err.connection_refused, 'Failed to get {!r}: {}'.format(url, e))
            else:
                result.skip('warn', 'skipping host, it is not reachable via http://:', e)
        return result

    def _write_xml_head(self, file):
        name = re.sub('\.xml$', '', os.path.basename(file.name))
        print('<ruleset name="{}">'.format(name), file=file)

    def _write_xml_comment(self, file, hosts):
        if hosts:
            print(textwrap.dedent("""\
                <!--
                \tNon-functional hosts:"""), file=file)

            for title, hosts in self._group_by_error(hosts):
                print('\t\t' + title.capitalize() + ':', file=file)
                for host in hosts:
                    print('\t\t\t-', host.name, file=file)

            print('-->', file=file)

    def _group_by_error(self, hosts):
        """
            group hosts by ``Err``

            @return items consisting of (``Err``, [host1, host2, …])
        """
        grouped = {}
        for host in hosts:
            group = grouped.setdefault(host.error.value, [])
            group.append(host)
        return sorted(grouped.items())

    def _write_xml_target(self, file, host):
        print('\t<target host="{}" />'.format(host), file=file)

    def _write_xml_footer(self, file):
        print(textwrap.dedent("""
            \t<securecookie host=".+" name=".+" />

            \t<rule from="^http:" to="https:" />
            </ruleset>"""), file=file)

    def execute(self, output, hostnames):
        hostnames = sorted(set(hostnames), key=self.sort_key)

        hosts = []
        for host in self._process_hosts(hostnames):
            if host.error or host.messages:
                print(host.status(), file=sys.stderr)
            hosts.append(host)

        self._write_xml_comment(output, list(filter(lambda h: h.error is not None and not h.skipped, hosts)))
        self._write_xml_head(output)
        for host in filter(lambda h: h.error is None and not h.skipped, hosts):
            self._write_xml_target(output, host)
        self._write_xml_footer(output)



def parse_args():
    prologue = textwrap.dedent("""\
        Generate and update rulesets for use with HTTPSEverywhere.

        The ruleset written is formatted like this:
            <!--
                Non-functional hosts:
                    Certificate mismatch:
                            - wrongcert.example.com
                    Connection refused:
                            - host.example.com
                            - host2.example.com
            -->
            <ruleset "Example.com">
                <target host="example.com" />
                <target host="www.example.com" />
                <target host="a.example.com" />
                <target host="b.example.com" />

                <securecookie host=".+" name=".+" />

                <rule from="^http:" to="https:" />
            </ruleset>

        This script attempt to detect errors and move host to the right
        section in the header.

        The following errors are currently detected:
        {}

    """).format('\n'.join(sorted('• ' + i.value for i in Err)))

    epilogue = textwrap.dedent("""\
        examples:
            use host names provided by sublist3er [1]:
                $ sublist3r -d example.com -o hostlist.txt
                $ {0} -i hostlist.txt -o rules/Example.com.xml

                [1]: https://github.com/aboul3la/Sublist3r

            update existing ruleset, add hosts in hostlist.txt:
                $ {0} -i hostlist -u -o rules/Example.com.xml

            print hosts found in ruleset on stdout:
                $ {0} -i rules.Example.com.xml --ruleset-parser --line-writer
    """).format(sys.argv[0])
    argparser = argparse.ArgumentParser(description=prologue,
        formatter_class=argparse.RawDescriptionHelpFormatter, epilog=epilogue)

    parser_group = argparser.add_argument_group(title='input and output')
    parser_group.add_argument('-i', '--input', default=sys.stdin,
        help='File to write rules to. If omitted, output is written to stdout.')
    parser_group.add_argument('-o', '--output', default=sys.stdout,
        help='File to read host names from. If omitted, input is read from stdin.')
    parser_group.add_argument('-u', '--update', action='store_true',
        help='Scan OUTPUT file for host names before overwriting it. Host names are added to the host'
        ' names found in INPUT or on stdin. Only supported with ruleset writer.')

    parser_group = argparser.add_argument_group(title='available parsers')
    parser_group_mutex = parser_group.add_mutually_exclusive_group()
    parser_group_mutex.add_argument('--line-parser', dest='parser', action='store_const',
        default=LineParser, const=LineParser, help='Input contains one host name per line. Empty lines are ignored,'
            ' comments start with # and whitespace is stripped. This is the default parser.')
    parser_group_mutex.add_argument('--zone-file-parser', dest='parser', action='store_const', const=ZoneFileParser,
        help='Input is a DNS zone file.')
    parser_group_mutex.add_argument('--ruleset-parser', dest='parser', action='store_const', const=RuleSetParser,
        help='Input is a HTTPSEverywhere ruleset file. Extracts all host names in <target>s and attempts to extract'
            ' host names found in initial comment.')

    parser_group = argparser.add_argument_group(title='available writers')
    parser_group_mutex = parser_group.add_mutually_exclusive_group()
    parser_group_mutex.add_argument('--rule-writer', dest='writer', action='store_const', default=RuleWriter,
        const=RuleWriter, help='Write a rule file. (default)')
    parser_group_mutex.add_argument('--line-writer', dest='writer', action='store_const', const=LineWriter,
        help='Write host names line by line')

    parser_group = argparser.add_argument_group(title='misc.')
    parser_group.add_argument('--threads', type=int, default=25, help='Number of threads to use. Defaults to 25.')
    parser_group.add_argument('--http-status-codes', default='200,401',
        help='Comma separated list of http status codes that need to be returned for http:// and https:// requests.'
            ' Request that return any other codes are moved to the {!r} section. Defaults to \'200,401\''\
            .format(Err.http_status_code.value)
    )

    return argparser.parse_args()

def main():
    args = parse_args()
    with OpenFileOrStream(args.input) as input:
        host_iters = [args.parser(input)]

        if args.update:
            if args.output == sys.stdout:
                print('--update requires -o/--output')
                exit(1)
            with open(args.output) as f:
                host_iters.append(set(RuleSetParser(f)))

        with OpenFileOrStream(args.output, 'w') as output:
            args.writer(args=args, threads=args.threads).execute(output, itertools.chain(*host_iters))


if __name__ == '__main__':
    main()
