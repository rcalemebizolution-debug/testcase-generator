export const testCaseCsvHeaders = ['Test Cases #', 'Priority', 'Module', 'Sub-Module', 'Test Scenario', 'Description', 'Pre-Condition', 'Steps / Test Data', 'Expected Result', 'Actual Result', 'Status', 'Bug Link/ID', 'Tester', 'Date Tested', 'Remarks']

const escapeCsv = value => `"${String(value ?? '').replace(/"/g, '""')}"`

export function buildTestCaseCsv(cases = []) {
  const rows = cases.map(item => [
    item.id,
    item.priority,
    item.module,
    item.subModule,
    item.title,
    item.description,
    item.precondition,
    (item.steps || []).map((step, index) => `${index + 1}. ${step}`).join('\n'),
    item.expected,
    '', '', '', '', '', '',
  ])
  return [testCaseCsvHeaders, ...rows].map(row => row.map(escapeCsv).join(',')).join('\r\n')
}

export function downloadTestCaseCsv(cases, filename = 'test-case-suite.csv') {
  const blob = new Blob(['\uFEFF', buildTestCaseCsv(cases)], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
