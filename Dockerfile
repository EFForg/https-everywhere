FROM ubuntu:16.04

# general build deps
RUN apt-get update && apt-get install -y \
  sudo \
  git \
  wget \
  build-essential \
  zip \
  python-dev \
  python-pip

RUN pip install \
  awscli \
  requests \
  pycrypto \
  argparse

RUN wget https://www.openssl.org/source/old/0.9.x/openssl-0.9.8zg.tar.gz && \
  tar zxf openssl-0.9.8zg.tar.gz && \
  cd ./openssl-0.9.8zg && \
  ./config && \
  make

# https everywhere deps
# some of them overlap with general deps but it does not matter
# for simplicity this list is a copy of one in ./install-dev-dependencies.sh
RUN apt-get install -y \
  libxml2-dev \
  libxml2-utils \
  libxslt1-dev \
  python-dev \
  firefox \
  chromium-browser \
  zip \
  sqlite3 \
  python-pip \
  libcurl4-openssl-dev \
  xvfb \
  libssl-dev \
  git \
  chromium-chromedriver

RUN pip install \
  lxml>=3.3.3 \
  pycurl \
  regex \
  bsdiff4 \
  python-Levenshtein \
  selenium
