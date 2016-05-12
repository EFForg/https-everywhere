#!/usr/bin/env python
import json
import requests
import logging
import sys
from Crypto.Hash import SHA512

log = logging.getLogger('log')
log.addHandler(logging.StreamHandler(stream=sys.stdout))
log.setLevel(logging.INFO)

class Submitter(object):
    headers = {
        'Accept-Encoding': 'application/json',
        'Accept': 'application/json'
    }

    def __init__(self, release_name, auth, api_root,
                 addon_id, addon_version, addon_url):
        self.release_name = release_name
        self.auth = auth
        self.addon_id = addon_id
        self.addon_version = addon_version
        self.addon_url = addon_url

        self.CSRF_URL = api_root+"/csrf_token"
        self.RELEASE_URL = api_root+"/releases"
        self.RELEASE_UPDATE_URL = api_root+"/releases/"+release_name

    def __get_csrf_token(self):
        res = self.session.request(
            method='HEAD',
            url=self.CSRF_URL,
            auth=self.auth
        )
        return res.headers['X-CSRF-Token']

    def __get_blob_and_version(self):
        try:
            res = self.session.request(
                method='GET',
                url=self.RELEASE_UPDATE_URL,
                auth=self.auth
            )
            return (
                json.loads(res.content),
                res.headers['X-Data-Version']
            )
        except:
            return (
                {
                    "vendors": {},
                    "hashFunction": "sha512",
                    "name": self.release_name,
                    "schema_version": 1000
                },
                None
            )

    def __get_xpi_meta(self):
        res = requests.get(self.addon_url)
        filesize = len(res.content)
        sha = SHA512.new(res.content)
        hashValue = sha.hexdigest()
        return {
            "fileUrl": self.addon_url,
            "hashValue": hashValue,
            "filesize": str(filesize)
        }

    def submit(self):
        # All requests to balrog shall be done with same session
        # otherwise you shall not pass
        self.session = requests.session()

        blob, version = self.__get_blob_and_version()
        token = self.__get_csrf_token()
        xpi_meta = self.__get_xpi_meta()

        blob["vendors"][self.addon_id] = {
            "platforms": {
                "default": xpi_meta
            },
            "version": self.addon_version
        }

        data = {
            'blob': json.dumps(blob),
            'csrf_token': token,
            'name': self.release_name,
            'product': 'SystemAddons',
            'version': '1' if not version else str(int(version) + 1)
        }

        log.info("Request data: %s", data)

        try:
            if version:
                method="PUT"
                url=self.RELEASE_UPDATE_URL
                data['data_version'] = version
            else:
                method="POST"
                url=self.RELEASE_URL

            res = self.session.request(
                method=method,
                url=url,
                headers=self.headers,
                auth=self.auth,
                data=data
            )

            log.info("SUCCESS: %s", res.content)
        except requests.exceptions.HTTPError, e:
            log.exception("ERROR HTTP: %s", e.response.content)
        except requests.exceptions.ConnectionError:
            log.exception("ERROR CONNECTION")

if __name__ == '__main__':
    from optparse import OptionParser

    parser = OptionParser()
    parser.add_option("-a", "--api-root", dest="api_root")
    parser.add_option("-c", "--credentials-file", dest="credentials_file")
    parser.add_option("-u", "--username", dest="username", default="balrogadmin")
    parser.add_option("-r", "--release-channel", dest="release_channel", default="browser_beta")
    parser.add_option("--addon-id", dest="addon_id")
    parser.add_option("--addon-version", dest="addon_version")
    parser.add_option("--addon-url", dest="addon_url")

    options, args = parser.parse_args()

    credentials = {}
    execfile(options.credentials_file, credentials)
    auth = (
        options.username,
        credentials['balrog_credentials'][options.username]
    )

    submitter = Submitter(
        release_name="SystemAddons-"+options.release_channel,
        auth=auth,
        api_root=options.api_root,
        addon_id=options.addon_id,
        addon_version=options.addon_version,
        addon_url=options.addon_url
    )
    submitter.submit()
