import { useMemo, useState } from 'react'
import { buildReports, reportToCsv, reportToText, type ReportTable, type Script } from '@spec/core'

interface Props {
  script: Script
  /** App-supplied tables (writing stats) shown after the script reports. */
  extraTables?: ReportTable[]
  /** Suggested file base name, usually the script title. */
  baseName: string
}

/**
 * Production reports, computed live from the script. Each report exports as
 * plain text (aligned columns) or CSV for a spreadsheet.
 */
export function ReportsView({ script, extraTables, baseName }: Props): React.JSX.Element {
  const reports = useMemo(
    () => [...buildReports(script), ...(extraTables ?? [])],
    [script, extraTables]
  )
  const [active, setActive] = useState(reports[0]?.id ?? 'scenes')
  const table = reports.find((r) => r.id === active) ?? reports[0]

  const exportAs = async (format: 'txt' | 'csv'): Promise<void> => {
    if (!table) return
    const content = format === 'csv' ? reportToCsv(table) : reportToText(table)
    const name = `${baseName} - ${table.title}.${format}`
    const path = await window.spec.saveFileAs(
      name,
      format === 'csv' ? 'CSV' : 'Text',
      [format]
    )
    if (!path) return
    await window.spec.writeBinaryFile(path, new TextEncoder().encode(content))
  }

  return (
    <div className="reports">
      <div className="reports-tabs" role="tablist">
        {reports.map((r) => (
          <button
            key={r.id}
            role="tab"
            aria-selected={active === r.id}
            className={active === r.id ? 'active' : ''}
            onClick={() => setActive(r.id)}
          >
            {r.title}
          </button>
        ))}
        <span className="reports-export">
          <button onClick={() => void exportAs('txt')}>Export .txt</button>
          <button onClick={() => void exportAs('csv')}>Export .csv</button>
        </span>
      </div>
      {table && (
        <div className="reports-table-wrap">
          <table className="reports-table">
            <thead>
              <tr>
                {table.columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {table.rows.length === 0 && <p className="empty board-empty">Nothing to report yet.</p>}
        </div>
      )}
    </div>
  )
}
