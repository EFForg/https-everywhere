#!/bin/bash
set -x
toplevel="$(git rev-parse --show-toplevel)"
testdir="${toplevel}/test/selenium"
srcdir="${toplevel}/chromium"
linter="${toplevel}/utils/eslint/node_modules/.bin/eslint --ignore-path ${srcdir}/.eslintignore"


function run_lint {
  $linter $srcdir
  if [ $? != 0 ]; then
    echo "Linting errors"
    exit 1
  fi
}

function run_unittests {
  pushd ${srcdir}
    npm run cover # run with coverage
    if [ $? != 0 ]; then
        echo "unittest errors"
        exit 1
    fi
    npm run report
  popd
}

function run_selenium {
  ENABLE_XVFB=1 py.test -v --capture=no ${testdir} # autodiscover and run the tests
}

if [ "$INFO" == "lint" ]; then
    echo "running lint tests"
    run_lint
elif [ "$INFO" == "unittests" ]; then
    echo "Running unittests"
    run_unittests
elif [ "$INFO" == "rules" ] || [ "$INFO" == "fetch" ] || [ "$INFO" == "preloaded" ]; then
    export TEST=${INFO}
    ${toplevel}/test/travis.sh # run old travis tests
else
    case $BROWSER in
      *chrome*)
        echo "running tests on chrome"
        run_selenium
        ;;
      *firefox*)
        echo "running tests on firefox"
        run_selenium
        ;;
      *)
        echo "bad INFO variable, got $INFO"
        exit 1
        ;;
    esac
fi
