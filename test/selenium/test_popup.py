from util import ExtensionTestCase


class TestPopup(ExtensionTestCase):
    def test_rule_shown(self):
        url = 'http://freerangekitten.com'
        with self.load_popup_for(url):
            el = self.query_selector('#StableRules > div > label > span')
            self.assertTrue(el.text.lower() in url)

    def test_disable_enable(self):
        selector = '#onoffswitch'
        var_name = 'background.state.isExtensionEnabled'

        # disable https everywhere
        with self.load_popup_for():
            el = self.query_selector(selector)
            self.assertTrue(el.is_selected())
            el.click() # disable

        with self.load_popup_for():
            el = self.query_selector(selector)
            self.assertFalse(el.is_selected())
            el.click()

        with self.load_popup_for():
            el = self.query_selector(selector)
            self.assertTrue(el.is_selected())

    def test_http_nowhere(self):
        selector = '#http-nowhere-checkbox'
        var_name = 'background.state.httpNowhereOn'

        # check default state and enable
        with self.load_popup_for():
            el = self.query_selector(selector)
            self.assertFalse(el.is_selected())
            el.click()

        # check it is enabled, and disable
        with self.load_popup_for():
            el = self.query_selector(selector)
            self.assertTrue(el.is_selected())
            el.click() # disable

        # check disabled
        with self.load_popup_for():
            el = self.query_selector(selector)
            self.assertFalse(el.is_selected()) # default state
