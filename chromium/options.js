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
  const showAppliedCountCheckbox = document.getElementById('show-applied-count')

  sendMessage('get_option', { showAppliedCount: true }).then(item => {
    showAppliedCountCheckbox.checked = item.showAppliedCount
    showAppliedCountCheckbox.addEventListener('change', event => {
      sendMessage('set_option', { showAppliedCount: showAppliedCountCheckbox.checked })
    })
  })

  const importButton = document.getElementById('import')

  importButton.addEventListener('click', event => {
    const file = event.target.files[0]

    readFile(file).then(data => {
      const settings = JSON.parse(fileContents)
      sendMessage('import_settings', settings)
    })
  })

  document.getElementById('import-settings').addEventListener('change', event => {
    importButton.disabled = (event.target.files.length === 0)
  })
})
