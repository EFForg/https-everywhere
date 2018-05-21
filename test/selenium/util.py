# -*- coding: UTF-8 -*-
from contextlib import contextmanager
import os
import unittest
import subprocess
import time

from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from selenium.common.exceptions import NoSuchWindowException

import shim

SEL_DEFAULT_WAIT_TIMEOUT = 20

parse_stdout = lambda res: res.strip().decode('utf-8')

run_shell_command = lambda command: parse_stdout(subprocess.check_output(command))

get_git_root = lambda: run_shell_command(['git', 'rev-parse', '--show-toplevel'])


class ExtensionTestCase(unittest.TestCase):

    shim = shim.Shim(shim.chrome_info, shim.firefox_info)

    @classmethod
    def setUpClass(cls):
        cls.manager = cls.shim.manager
        cls.base_url = cls.shim.bg_url
        cls.wants_xvfb = cls.shim.wants_xvfb
        if cls.wants_xvfb:
            from xvfbwrapper import Xvfb
            cls.vdisplay = Xvfb(width=1280, height=720)
            cls.vdisplay.start()

        # setting DBUS_SESSION_BUS_ADDRESS to nonsense prevents frequent
        # hangs of chromedriver (possibly due to crbug.com/309093).
        os.environ["DBUS_SESSION_BUS_ADDRESS"] = "/dev/null"
        cls.proj_root = get_git_root()

    @classmethod
    def tearDownClass(cls):
        if cls.wants_xvfb:
            cls.vdisplay.stop()

    def init(self, driver):
        self.driver = driver
        self.bg_url = self.base_url + "_generated_background_page.html"

    def run(self, result=None):
        with self.manager() as driver:
            self.init(driver)
            super(ExtensionTestCase, self).run(result)

    def query_selector(self, css_selector, timeout=SEL_DEFAULT_WAIT_TIMEOUT):
        return WebDriverWait(self.driver, timeout).until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, css_selector)))

    def wait(self, func, timeout=SEL_DEFAULT_WAIT_TIMEOUT):
        return WebDriverWait(self.driver, timeout).until(func)

    def switch_to_url(self, target, open_url=False):
        for wh in self.driver.window_handles:
            self.driver.switch_to.window(wh)
            # use `in` bc we don't care about queries or fragments
            if target in self.driver.current_url:
                return self.driver.refresh()
        if open_url:
            return self.driver.get(target)
        raise ValueError('Target ({}) not found in current urls'.format(target))

    def get_variable(self, name):
        return self.driver.execute_script('return {};'.format(name))

    @contextmanager
    def load_popup_for(self, url='about:blank'):
        create_url_and_popup_js_str = '''
        (function(done) {{
          chrome.tabs.create({{url: '{}'}}, function(tab) {{
            setTimeout(
              () => chrome.tabs.create({{url: '{}' + '?tabId=' + String(tab.id)}}, done),
              500
            );
          }});
        }})(arguments[0]);
        '''
        script = create_url_and_popup_js_str.format(url, self.shim.popup_url)

        self.driver.get(self.shim.bg_url)
        time.sleep(0.5)

        bg = self.driver.current_window_handle

        before_windows = set(self.driver.window_handles)
        self.driver.execute_async_script(script)
        new_windows = set(self.driver.window_handles) ^ before_windows

        self.switch_to_url(self.shim.popup_url)

        yield

        time.sleep(0.1)
        for wh in new_windows:
            if len(self.driver.window_handles) > 1:
                try:
                    self.driver.switch_to.window(wh)
                    self.driver.close()
                except NoSuchWindowException:
                    pass

        self.driver.switch_to.window(bg)

    def toggle_disabled(self):
        selector = '#onoffswitch'
        with self.load_popup_for():
            el = self.query_selector(selector)
            el.click()
            time.sleep(0.25)

    def toggle_http_nowhere(self):
        selector = '#http-nowhere-checkbox'
        with self.load_popup_for():
            el = self.query_selector(selector)
            el.click()
            time.sleep(0.25)
