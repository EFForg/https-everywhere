FROM electronicfrontierfoundation/https-everywhere-docker-base
MAINTAINER William Budington "bill@eff.org"
WORKDIR /opt

COPY test/rules/requirements.txt /tmp/
RUN pip install -r /tmp/requirements.txt && rm /tmp/requirements.txt
