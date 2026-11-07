export interface ZipEntry {
  name: string
  /** Text is stored as UTF-8. */
  content: string | Uint8Array
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

export function crc32(input: Uint8Array): number {
  let crc = -1
  for (const byte of input) crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff]
  return (crc ^ -1) >>> 0
}

/** A ZIP archive with uncompressed (stored) entries. */
export function buildZip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder()
  const local: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const data =
      typeof entry.content === 'string'
        ? encoder.encode(entry.content)
        : entry.content
    const crc = crc32(data)

    const header = new Uint8Array(30 + name.length)
    const h = new DataView(header.buffer)
    h.setUint32(0, 0x04034b50, true)
    h.setUint16(4, 20, true)
    h.setUint32(14, crc, true)
    h.setUint32(18, data.length, true)
    h.setUint32(22, data.length, true)
    h.setUint16(26, name.length, true)
    header.set(name, 30)

    const record = new Uint8Array(46 + name.length)
    const r = new DataView(record.buffer)
    r.setUint32(0, 0x02014b50, true)
    r.setUint16(4, 20, true)
    r.setUint16(6, 20, true)
    r.setUint32(16, crc, true)
    r.setUint32(20, data.length, true)
    r.setUint32(24, data.length, true)
    r.setUint16(28, name.length, true)
    r.setUint32(42, offset, true)
    record.set(name, 46)

    local.push(header, data)
    central.push(record)
    offset += header.length + data.length
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0)
  const end = new Uint8Array(22)
  const e = new DataView(end.buffer)
  e.setUint32(0, 0x06054b50, true)
  e.setUint16(8, entries.length, true)
  e.setUint16(10, entries.length, true)
  e.setUint32(12, centralSize, true)
  e.setUint32(16, offset, true)

  const parts = [...local, ...central, end].map(
    (part) =>
      part.buffer.slice(
        part.byteOffset,
        part.byteOffset + part.byteLength
      ) as ArrayBuffer
  )
  return new Blob(parts, { type: 'application/zip' })
}
