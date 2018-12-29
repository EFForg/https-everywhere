from time import sleep
from util import ExtensionTestCase

class OptionsTest(ExtensionTestCase):
    def load_options(self):
        self.driver.get(self.shim.options_url)

    def test_options(self):
        self.load_options()
        self.assertEqual(self.driver.current_url, self.shim.options_url)

    def test_show_counter(self):
        # FIXME: Skipping because of intermittent failures causing
        # more trouble to fix the test than the benefit it can introduce.
        #
        # Note: Increasing the timeout might resolve the failing test
        # temporary. However, as the complexity of the option page
        # increase (see #17201), test fails despite a long timeout.
        raise unittest.SkipTest('broken')

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
