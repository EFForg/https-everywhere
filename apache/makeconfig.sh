#!/bin/bash -ex
#
# Generate a local Apache config that will listen with SSL on ports 3001-3100.
# The default behavior is to respond relatively promptly on /, while sleeping
# for 100 seconds before responding on /submit_cert.

cd $(dirname $0)
START=3001
END=3100

cat <<EOF >apache2.conf
  ServerName https_everywhere_test
  ServerRoot "."
  DocumentRoot "."
  PidFile ./apache2.pid
  ErrorLog ./error.log
  LoadModule python_module /usr/lib/apache2/modules/mod_python.so
  LoadModule rewrite_module /usr/lib/apache2/modules/mod_rewrite.so
  LoadModule mime_module /usr/lib/apache2/modules/mod_mime.so
  LoadModule mpm_prefork_module /usr/lib/apache2/modules/mod_mpm_prefork.so
  LoadModule ssl_module /usr/lib/apache2/modules/mod_ssl.so
  LoadModule authz_core_module /usr/lib/apache2/modules/mod_authz_core.so
  LoadModule cgi_module /usr/lib/apache2/modules/mod_cgi.so
  LoadModule alias_module /usr/lib/apache2/modules/mod_alias.so
  LoadModule dir_module /usr/lib/apache2/modules/mod_dir.so

  SSLVerifyDepth  1
  SSLOptions +StdEnvVars
  SSLCipherSuite HIGH:MEDIUM:!aNULL:!eNULL:@STRENGTH:-DHE-RSA-AES128-SHA:-EDH-RSA-DES-CBC3-SHA:-DHE-RSA-AES256-SHA:-DHE-RSA-AES256-SHA

  <Directory />
    SetHandler mod_python
    PythonHandler mod_python.publisher
    PythonDebug On
    Options +ExecCGI
    DirectoryIndex index.py
  </Directory>
EOF

for n in `seq $START $END` ; do cat >> apache2.conf <<EOF
  Listen 127.0.0.1:$n
  <VirtualHost *:$n>
    SSLEngine on
    SSLCertificateFile certificates/$n.crt
    SSLCertificateKeyFile certificates/$n.key
  </VirtualHost>
EOF
done

mkdir -p certificates
cd certificates

onecert() {
  openssl genrsa -out $1.key 2048
  openssl req -new -key $1.key -out $1.csr -subj /CN=localhost
  openssl x509 -req -days 1826 -in $1.csr -CA ca.crt -CAkey ca.key -set_serial $RANDOM -out $1.crt
  rm $1.csr
}

openssl genrsa -out ca.key 2048
openssl req -new -x509 -days 1826 -key ca.key -out ca.crt -subj /CN=https-everywhere-test-ca
for n in `seq $START $END` ; do
  onecert $n
done
