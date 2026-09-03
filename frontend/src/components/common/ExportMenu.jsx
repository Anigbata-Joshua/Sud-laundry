import { useState } from 'react'
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react'
import Button from './Button'

function downloadBlob(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export default function ExportMenu({ title, filename, columns, rows }) {
  const [open, setOpen] = useState(false)

  async function exportPdf() {
    const { jsPDF } = await import('jspdf')
    const document = new jsPDF()
    document.setFontSize(18)
    document.text(title, 14, 18)
    document.setFontSize(9)
    document.text(`Generated ${new Date().toLocaleString('en-NG')}`, 14, 25)
    document.setFontSize(11)

    let y = 36
    rows.forEach((row) => {
      const line = columns
        .map((column) => `${column.label}: ${row[column.key] ?? ''}`)
        .join('  |  ')
      const wrapped = document.splitTextToSize(line, 180)
      if (y + wrapped.length * 6 > 280) {
        document.addPage()
        y = 20
      }
      document.text(wrapped, 14, y)
      y += wrapped.length * 6 + 3
    })

    document.save(`${filename}.pdf`)
    setOpen(false)
  }

  function exportExcel() {
    const header = columns
      .map((column) => `<Cell><Data ss:Type="String">${escapeXml(column.label)}</Data></Cell>`)
      .join('')
    const body = rows
      .map(
        (row) =>
          `<Row>${columns.map((column) => `<Cell><Data ss:Type="String">${escapeXml(row[column.key] ?? '')}</Data></Cell>`).join('')}</Row>`,
      )
      .join('')
    const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Overview"><Table><Row>${header}</Row>${body}</Table></Worksheet></Workbook>`
    downloadBlob(workbook, 'application/vnd.ms-excel', `${filename}.xls`)
    setOpen(false)
  }

  return (
    <div className="relative">
      <Button onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <Download className="size-4" /> Export <ChevronDown className="size-3.5" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-40 rounded-xl border border-line bg-white p-1.5 shadow-xl">
          <button
            type="button"
            onClick={exportPdf}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs hover:bg-gray-50"
          >
            <FileText className="size-4 text-red-500" /> Export PDF
          </button>
          <button
            type="button"
            onClick={exportExcel}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs hover:bg-gray-50"
          >
            <FileSpreadsheet className="size-4 text-emerald-600" /> Export Excel
          </button>
        </div>
      )}
    </div>
  )
}
