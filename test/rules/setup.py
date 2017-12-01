#!/usr/bin/env python

from setuptools import setup, find_packages

readme = open('README.rst').read()
history = open('HISTORY.rst').read().replace('.. :changelog:', '')

setup(
    name='https-everywhere-checker',
    version='0.1.0',
    description='Rule checker for HTTPS Everywhere',
    long_description=readme + '\n\n' + history,
    author='Ondrej Mikle',
    author_email='ondrej.mikle@nic.cz',
    url='https://github.com/hiviah/https-everywhere-checker',
    packages=find_packages('src', exclude=('tests',)),
    package_dir={'': 'src'},
    include_package_data=True,
    install_requires=[
        "pycurl>=7.19.0",
        "lxml>=2.2.3",
        "bsdiff4>=1.1.4",
        "python-levenshtein>=0.10.2",
        "regex>=0.1.20120613",
    ],
    license="GPL3",
    keywords='https https-everywhere http security',
    entry_points={
        'console_scripts': [
            'check-https-rules = https_everywhere_checker.check_rules:cli'
        ],
    }
)
