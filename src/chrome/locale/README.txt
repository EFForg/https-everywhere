We handle translations through Transifex, using the Tor Project's
account. If you'd like to improve a translation, please visit
https://www.transifex.com/otf/torproject/translate and sign up as a
translator. The results will be automatically pushed to the https_everywhere
branch of https://git.torproject.org/translation.git, which is included as
a submodule here.

If you'd like to update the translations in your locally checked-out repo, run:

cd translations/
git pull origin https_everywhere

If you'd like to add a new string for translation, add it to the `en` locale.
Once your change has been merged to master, it will show up in Transifex as
available for translation.
