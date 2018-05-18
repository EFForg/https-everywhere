import time
import unittest

from util import ExtensionTestCase

kittens_url = 'http://freerangekitten.com/'

http_url = 'http://http.badssl.com/'


class TestNavigation(ExtensionTestCase):
    def test_redirect(self):
        num_retries = 5

        for i in range(0, num_retries):
            self.driver.get(kittens_url)

            # retry if assertions fail until num_retries reached
            if not self.driver.current_url.startswith('https:') and i > num_retries - 1:
                self.assertTrue(self.driver.current_url.startswith('https:'))
	
            time.sleep(3)

        self.assertTrue(self.driver.current_url.startswith('https'))

    def test_no_redirect_when_disabled(self):
        self.toggle_disabled()
        self.driver.get(kittens_url)
        self.assertEqual(self.driver.current_url, kittens_url)  # not https

    def test_httpnowhere_blocks(self):
        if self.shim.browser_type == 'firefox':
            raise unittest.SkipTest('broken on firefox')
        href_script = 'return window.location.href;'
        self.toggle_http_nowhere()
        self.driver.get(http_url)
        self.assertFalse(http_url == self.driver.execute_script(href_script))

    def test_http_site_not_blocked(self):
        self.driver.get(http_url)
        self.assertTrue(self.driver.current_url == http_url)
