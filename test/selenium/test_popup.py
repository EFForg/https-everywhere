import unittest
from util import ExtensionTestCase


class TestPopup(ExtensionTestCase):
    def test_rule_shown(self):
        url = 'http://freerangekitten.com'
        with self.load_popup_for(url):
            #Open Rule Management section
            see_more_prompt = self.query_selector('#RuleManagement__see_more--prompt')
            see_more_prompt.click()

            #Check to see if stable rule is checked
            checkbox_el = self.driver.find_element_by_id('stable_ruleset_1')
            self.assertTrue(checkbox_el.is_selected())


    def test_disable_enable(self):
        selector = '#onoffswitch__label'
        checkbox = 'onoffswitch'
        var_name = 'background.state.isExtensionEnabled'

        # disable https everywhere
        with self.load_popup_for():
            el = self.query_selector(selector)
            # Using query_selector does not work here if element isn't "plainly" visible on page, fails on Chrome
            checkbox_el = self.driver.find_element_by_id(checkbox)
            self.assertTrue(checkbox_el.is_selected())
            el.click() # disable

        with self.load_popup_for():
            el = self.query_selector(selector)
            checkbox_el = self.driver.find_element_by_id(checkbox)
            self.assertFalse(checkbox_el.is_selected())
            el.click()

        with self.load_popup_for():
            el = self.query_selector(selector)
            checkbox_el = self.driver.find_element_by_id(checkbox)
            self.assertTrue(checkbox_el.is_selected())

    def test_http_nowhere(self):
        selector = '#http-nowhere-checkbox_label'
        checkbox = 'http-nowhere-checkbox'
        var_name = 'background.state.httpNowhereOn'

        # check default state and enable
        with self.load_popup_for():
            el = self.query_selector(selector)
            # Using query_selector does not work here if element isn't "plainly" visible on page, fails on Chrome
            checkbox_el = self.driver.find_element_by_id(checkbox)
            self.assertFalse(checkbox_el.is_selected())
            el.click()

        # check it is enabled, and disable
        with self.load_popup_for():
            el = self.query_selector(selector)
            checkbox_el = self.driver.find_element_by_id(checkbox)
            self.assertTrue(checkbox_el.is_selected())
            el.click() # disable

        # check disabled
        with self.load_popup_for():
            checkbox_el = self.driver.find_element_by_id(checkbox)
            self.assertFalse(checkbox_el.is_selected()) # default state
