import {
  parseExtractedTables,
  slug,
  stripTableHtml,
  tableToCsv,
  tableToMarkdown,
  tableToTsv,
  tablesToZipEntries
} from './table-formats'
import { buildZip, crc32 } from './zip'

const table = {
  title: 'Sales Q1',
  headers: ['Name', 'Total'],
  rows: [['A "b"', '1']]
}

describe('table formats', () => {
  it('writes CSV, TSV and Markdown', () => {
    expect(tableToCsv(table)).toBe('"Name","Total"\n"A ""b""","1"')
    expect(tableToTsv(table)).toBe('Name\tTotal\nA "b"\t1')
    expect(tableToMarkdown(table)).toContain('| Name | Total |\n| --- | --- |')
  })

  it('names zip entries by number and title', () => {
    expect(tablesToZipEntries([table], 'excel')[0].name).toBe('01-sales-q1.xls')
    expect(
      tablesToZipEntries([{ ...table, title: '!!' }], 'json')[0].name
    ).toBe('01-table-1.json')
    expect(slug('Hello, World!')).toBe('hello-world')
  })

  it('parses model answers', () => {
    expect(
      parseExtractedTables(
        '[{"headers":["a"],"rows":[["1",2]]},{"title":"x"},"bad"]'
      )
    ).toEqual([{ title: 'Table', headers: ['a'], rows: [['1', '2']] }])
  })

  it('strips attributes from table HTML', () => {
    const element = document.createElement('table')
    element.innerHTML = '<tr class="a"><td style="color:red">1</td></tr>'
    element.id = 'main'
    expect(stripTableHtml(element)).toBe(
      '<table><tbody><tr><td>1</td></tr></tbody></table>'
    )
  })
})

describe('zip', () => {
  it('computes CRC32', () => {
    expect(crc32(new TextEncoder().encode('hello'))).toBe(0x3610a686)
  })

  it('builds a stored zip archive', async () => {
    const blob = buildZip([{ name: 'a.txt', content: 'hi' }])
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const view = new DataView(bytes.buffer)
    expect(blob.type).toBe('application/zip')
    expect(view.getUint32(0, true)).toBe(0x04034b50)
    expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50)
    expect(view.getUint16(bytes.length - 22 + 10, true)).toBe(1)
  })
})
