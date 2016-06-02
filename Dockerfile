FROM electronicfrontierfoundation/https-everywhere-docker-base 
MAINTAINER William Budington "bill@eff.org"

WORKDIR /opt
ADD test/rules/requirements.txt test/rules/requirements.txt
ADD test/chromium/requirements.txt test/chromium/requirements.txt
RUN pip install -r test/rules/requirements.txt
RUN pip install -r test/chromium/requirements.txt
RUN apt-get update
RUN apt-get install -y tor iptables sudo
RUN echo VirtualAddrNetworkIPv4 10.192.0.0/10 >> /etc/tor/torrc
RUN echo AutomapHostsOnResolve 1 >> /etc/tor/torrc
RUN echo TransPort 9040 >> /etc/tor/torrc
RUN echo DNSPort 53 >> /etc/tor/torrc
RUN adduser --disabled-password --gecos "" test

ENV FIREFOX /firefox-latest/firefox/firefox

WORKDIR /opt
