'use strict'

document.addEventListener('DOMContentLoaded', () => {
  let jsonData
  const importButton = document.getElementById('import')

  function importJson (e) {
    const file = event.target.files[0]
    const reader = new FileReader()
    reader.addEventListener('error', evt => {
      reject(new Error('FileReader error: ' + evt.target.error.name))
    }

    reader.addEventListener('load', evt => {
      resolve(evt.target.result)
    })

    reader.readAsText(file)
    
    const settings = JSON.parse(jsonData)
    sendMessage('import_settings', settings, function () {})
  }

  document.getElementById('import-settings').addEventListener('change', event => {
    importButton.disabled = (event.target.files.length === 0)
  })

  importButton.addEventListener('click', importJson)
})
