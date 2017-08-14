'use strict'

function readFile (file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.addEventListener('error', event => {
      reject(new Error('FileReader error: ' + event.target.error.name))
    })

    reader.addEventListener('load', event => {
      resolve(event.target.result)
    })

    reader.readAsText(file)
  })
}

document.addEventListener('DOMContentLoaded', () => {
  const importButton = document.getElementById('import')

  importButton.addEventListener('click', async event => {
    const file = event.target.files[0]

    const fileContents = await readFile(file)

    const settings = JSON.parse(fileContents)

    sendMessage('import_settings', settings, function () {})
  })

  document.getElementById('import-settings').addEventListener('change', event => {
    importButton.disabled = (event.target.files.length === 0)
  })
})
