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
  const showAppliedCount = document.getElementById('show-applied-count')

  sendMessage('get_show_applied_count').then(value => {
    showAppliedCount.checked = on
    showAppliedCount.addEventListener('change', event => {
      sendMessage('set_show_applied_count', showAppliedCount.checked)
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
