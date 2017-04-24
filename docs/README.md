# HTTPS Everywhere Documentation

The markdown files contained in this path provide documentation for contributing to HTTPS Everywhere.  These files are also templates that can be used to generate the markup for HTTPS Everywhere pages under `https://www.eff.org/https-everywhere`.  To do so, install the program `pandoc` and run

    pandoc faq.md

Copy the output, excluding the header on the first line, to the source of the relevant page within the CMS.  Note that some of the pages are dynamically generated and are not generated from templates contained here.

# Translation of the FAQ

#### Do you want to translate the FAQ to your language?

Fork this repository and, if it doesn't exist yet, create a folder with the name of your language code (*it*, *fr*, ...) in the same level of the *en_US* and *default* folders. Then copy the faq.md file from the *en_US* folder into your language folder and translate it **without touching at the Markdown syntax**. When you're done, create a pull request to merge your changes.

Initially the translation was happening in [this repository](https://github.com/EFForg/www-l10n) so if you're lucky you may find the FAQ already translated in your language there. In this case you can use the old translation as a starting point for yours, but please, take some time to review it.

#### Did you find some error in the translation of the FAQ?

You can just follow the procedure above and fix the error or, if you prefer, you can open an issue describing exactly the error and the suggested correction that should be made and someone will fix it as soon as possible.
