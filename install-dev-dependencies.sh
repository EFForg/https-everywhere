#!/bin/bash
# Install packages that are necessary and/or useful to build and debug
# HTTPS Everywhere
set -o errexit

if [ "$1" != "--no-prompt" ]; then
  echo
  echo "Warning: Installing the development dependencies for HTTPS Everywhere"
  echo "may alter your system, installing requirements both within the package"
  echo "management system and also external binaries."
  echo
  echo -n "Are you sure you want to continue? [y/N]: "
  read CONTINUE
  CONTINUE=`echo $CONTINUE | xargs | head -c 1 | awk '{print tolower($0)}'`
  if [ "$CONTINUE" != "y" ]; then
    exit
  fi
  echo
fi

if [ $UID != 0 ]; then
  SUDO_SHIM=sudo
fi

if type apt-get >/dev/null ; then
  $SUDO_SHIM apt-get update
  $SUDO_SHIM apt-get install -y lsb-release
  BROWSERS="firefox chromium-browser"
  CHROMEDRIVER="chromium-chromedriver"
  if [[ "$(lsb_release -is)" == "Debian" ]]; then
    # Iceweasel is the rebranded Firefox that Debian ships, and Chromium
    # takes the name of 'chromium' instead of 'chromium-browser' in
    # Debian 7 (wheezy) and later.
    BROWSERS="iceweasel chromium"
    CHROMEDRIVER="chromedriver"
  fi
  $SUDO_SHIM apt-get install -y libxml2-dev libxml2-utils libxslt1-dev \
    python3.6-dev $BROWSERS zip sqlite3 python3-pip libcurl4-openssl-dev xvfb \
    libssl-dev git curl $CHROMEDRIVER
  if ! type geckodriver >/dev/null; then
    curl -LO "https://github.com/mozilla/geckodriver/releases/download/v0.17.0/geckodriver-v0.17.0-linux64.tar.gz"
    tar -zxvf "geckodriver-v0.17.0-linux64.tar.gz"
    rm -f "geckodriver-v0.17.0-linux64.tar.gz"
    $SUDO_SHIM mv geckodriver /usr/bin/geckodriver
    $SUDO_SHIM chown root /usr/bin/geckodriver
    $SUDO_SHIM chmod 755 /usr/bin/geckodriver
  fi
  if [ ! -f /usr/lib/chromium/chromedriver ] && [ -f `which chromedriver` ]; then
    ln -s `which chromedriver` /usr/lib/chromium/chromedriver
  fi
elif type brew >/dev/null ; then
  brew list python &>/dev/null || brew install python
  brew install libxml2 gnu-sed chromedriver
  if ! echo $PATH | grep -ql /usr/local/bin ; then
    echo '/usr/local/bin not found in $PATH, please add it.'
  fi
elif type dnf >/dev/null ; then
  $SUDO_SHIM dnf install -y firefox gcc git libcurl-devel libxml2-devel \
    libxslt-devel python-devel redhat-rpm-config xorg-x11-server-Xvfb which \
    findutils procps openssl openssl-devel chromium GConf2
  if ! type chromedriver >/dev/null; then
    if [ "`uname -m`" == "x86_64" ]; then
      ARCH=64
    else
      ARCH=32
    fi
    curl -O "https://chromedriver.storage.googleapis.com/2.23/chromedriver_linux$ARCH.zip"
    unzip "chromedriver_linux$ARCH.zip"
    rm -f "chromedriver_linux$ARCH.zip"
    $SUDO_SHIM mv chromedriver /usr/bin/chromedriver
    $SUDO_SHIM chown root /usr/bin/chromedriver
    $SUDO_SHIM chmod 755 /usr/bin/chromedriver
  fi
  if ! type geckodriver >/dev/null; then
    curl -LO "https://github.com/mozilla/geckodriver/releases/download/v0.17.0/geckodriver-v0.17.0-macos.tar.gz"
    tar -zxvf "geckodriver-v0.17.0-macos.tar.gz"
    rm -f "geckodriver-v0.17.0-macos.tar.gz"
    $SUDO_SHIM mv geckodriver /usr/bin/geckodriver
    $SUDO_SHIM chown root /usr/bin/geckodriver
    $SUDO_SHIM chmod 755 /usr/bin/geckodriver
  fi
  # This is needed for Firefox on some systems. See here for more information:
  # https://github.com/EFForg/https-everywhere/pull/5584#issuecomment-238655443
  if [ ! -f /var/lib/dbus/machine-id ]; then
    $SUDO_SHIM sh -c 'dbus-uuidgen > /var/lib/dbus/machine-id'
  fi
  export PYCURL_SSL_LIBRARY=openssl
fi

# Get the addon SDK submodule and rule checker
git submodule init
git submodule update

# Install Python packages
pip3 install --user --no-allow-insecure --no-allow-external -r requirements.txt
cd test/rules
pip3 install --user -r requirements.txt
cd -
cd test/chromium
pip3 install --user -r requirements.txt
cd -

# Install git hook to run tests before pushing.
ln -sf ../../test.sh .git/hooks/pre-push
