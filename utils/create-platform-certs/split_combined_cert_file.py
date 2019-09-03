#!/usr/bin/env python3.6
import argparse
import codecs
import os
import pathlib
import re

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument(
        'cert_file',
        help='combined crt/pem file to split',
    )
    parser.add_argument(
        'output_dir',
        help='output directory for split files',
    )
    args = parser.parse_args()
    with codecs.open(args.cert_file, 'r', encoding='utf-8') as cert_file:
        bundle = cert_file.read()
        certs = re.compile('\n{2,}').split(bundle)

        # First element of certs is a comment
        certs = certs[1:]
        cert_filename_num_width = len(str(len(certs)))
        pathlib.Path(args.output_dir).mkdir(parents=True, exist_ok=True)
        for index, cert in enumerate(certs):
            cert_name, cert_content = re.compile("\n=+\n").split(cert)
            cert_filename = os.path.join(
                args.output_dir,
                "cert{}.pem".format(str(index+1).zfill(cert_filename_num_width))
            )
            with codecs.open(
                    cert_filename, 'w', encoding='utf-8') as cert_file:
                cert_file.write("%s\n" % cert_name)
                cert_file.write(cert_content)
                cert_file.write('\n')
