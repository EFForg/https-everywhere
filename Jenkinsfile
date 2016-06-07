node {

  stage 'checkout'

  checkout([$class: 'GitSCM', branches: [[name: '*/cliqz-ci']], doGenerateSubmoduleConfigurations: false, extensions: [[$class: 'RelativeTargetDirectory', relativeTargetDir: '../workspace@script/xpi-sign']], submoduleCfg: [], userRemoteConfigs: [[credentialsId: XPI_SIGN_CREDENTIALS, url: 'git@github.com:cliqz/xpi-sign']]])

  stage 'build'

  def imgName = "cliqz-oss/https-everywhere:${env.BUILD_TAG}"

  dir("../workspace@script") {
    sh 'rm -fr secure'
    sh 'cp -R /cliqz secure'

    docker.build(imgName, ".")

    docker.image(imgName).inside("-u 0:0") {
      sh './install-dev-dependencies.sh'
      sh '/bin/bash ./cliqz/build_sign_and_publish.sh '+CLIQZ_CHANNEL
    }

    sh 'rm -rf secure'
  }
}
