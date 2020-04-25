import unittest
from time import sleep

from util import ExtensionTestCase

kittens_url = 'http://freerangekitten.com/'

http_url = 'http://http.badssl.com/'

class TestNavigation(ExtensionTestCase):
    def test_redirect(self):
        sleep(3)
        self.driver.get(kittens_url)
        self.assertTrue(self.driver.current_url.startswith('https'))

    def test_no_redirect_when_disabled(self):
        self.toggle_disabled()
        self.driver.get(kittens_url)
        self.assertEqual(self.driver.current_url, kittens_url)  # not https

    def test_httpnowhere_blocks(self):
        #if self.shim.browser_type == 'firefox':
        #    raise unittest.SkipTest('broken on firefox')
        href_script = 'return window.location.href;'
        self.toggle_http_nowhere()
        self.driver.get(http_url)
        expected_href_location = self.driver.execute_script(href_script)
        self.assertFalse(True, msg='Expect window.location.href equals {1}, but got {0}'.format(http_url, expected_href_location))

    def test_http_site_not_blocked(self):
        self.driver.get(http_url)
        self.assertTrue(self.driver.current_url == http_url)
