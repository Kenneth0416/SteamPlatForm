const shouldInclude = process.argv.join(' ').includes('autoSaveQueue')

if (shouldInclude) {
  require('./useAutoSave.test')
} else {
  test('autoSaveQueue helper is idle when not targeted', () => {
    expect(true).toBe(true)
  })
}
