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

function saveFile (blob, fileName) {
  const blobUrl = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = blobUrl
  anchor.download = fileName
  anchor.click()
}

document.addEventListener('DOMContentLoaded', () => {
  const showAppliedCountCheckbox = document.getElementById('show-applied-count')

  sendMessage('get_option', { showAppliedCount: true }).then(item => {
    showAppliedCountCheckbox.checked = item.showAppliedCount
    showAppliedCountCheckbox.addEventListener('change', event => {
      sendMessage('set_option', { showAppliedCount: showAppliedCountCheckbox.checked })
    })
  })

  const importButton = document.getElementById('import')
  const importSettings = document.getElementById('import-settings')

  importButton.addEventListener('click', event => {
    const file = importSettings.files[0]

    readFile(file).then(data => {
      const settings = JSON.parse(fileContents)
      sendMessage('import_settings', settings)
    })
  })

  document.getElementById('import-settings').addEventListener('change', event => {
    importButton.disabled = (event.target.files.length === 0)
  })

  document.getElementById('rulesetSettingsExport').addEventListener('click', () => {
    const json = JSON.stringify(localStorage)
    const blob = new Blob([json], { type: 'application/json' })
    saveFile(blob, 'settings.json')
  })

  document.getElementById('rulesetSettingsImport').addEventListener('click', () => {

  })
})
