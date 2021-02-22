import unittest
from time import sleep
from util import ExtensionTestCase

class OptionsTest(ExtensionTestCase):
    def load_options(self):
        self.driver.get(self.shim.options_url)

    def test_options(self):
        self.load_options()
        self.assertEqual(self.driver.current_url, self.shim.options_url)
