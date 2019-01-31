from time import sleep
from util import ExtensionTestCase

class OptionsTest(ExtensionTestCase):
    def load_options(self):
        self.driver.get(self.shim.options_url)

    def test_options(self):
        self.load_options()
        self.assertEqual(self.driver.current_url, self.shim.options_url)

    def test_show_counter(self):
        selector = '#showCounter'
        self.load_options()
        sleep(3)

        el = self.query_selector(selector)
        self.assertTrue(el.is_selected())
        el.click()

        self.driver.refresh()
        sleep(3)
        el = self.query_selector(selector)
        self.assertFalse(el.is_selected())
        el.click()

        self.driver.refresh()
        sleep(3)
        el = self.query_selector(selector)
        self.assertTrue(el.is_selected())
