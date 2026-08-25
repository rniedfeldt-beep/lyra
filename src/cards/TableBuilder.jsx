// Optional tabular content for a card's description — e.g. the size/speed
// table on Aspect of the Wolf. Shape matches card.table in the reference:
// { head: [...], rows: [[...], ...] }.
export default function TableBuilder({ table, onChange }) {
  if (!table) {
    return (
      <button type="button" className="btn btn-small" onClick={() => onChange({ head: [''], rows: [['']] })}>
        + Add table
      </button>
    )
  }

  const cols = table.head.length

  function setHead(i, v) {
    const head = [...table.head]
    head[i] = v
    onChange({ ...table, head })
  }
  function setCell(ri, ci, v) {
    const rows = table.rows.map((r) => [...r])
    rows[ri][ci] = v
    onChange({ ...table, rows })
  }
  function addCol() {
    const head = [...table.head, '']
    const rows = table.rows.length ? table.rows.map((r) => [...r, '']) : [Array(head.length).fill('')]
    onChange({ head, rows })
  }
  function removeCol(i) {
    const head = table.head.filter((_, idx) => idx !== i)
    if (!head.length) return onChange(null)
    const rows = table.rows.map((r) => r.filter((_, idx) => idx !== i))
    onChange({ head, rows })
  }
  function addRow() {
    onChange({ ...table, rows: [...table.rows, Array(cols).fill('')] })
  }
  function removeRow(ri) {
    onChange({ ...table, rows: table.rows.filter((_, idx) => idx !== ri) })
  }

  return (
    <div className="table-builder">
      <table>
        <thead>
          <tr>
            {table.head.map((h, i) => (
              <th key={i}>
                <input value={h} onChange={(e) => setHead(i, e.target.value)} placeholder={`Col ${i + 1}`} />
                <button type="button" className="btn btn-small" title="Remove column" onClick={() => removeCol(i)}>
                  ×
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci}>
                  <input value={cell} onChange={(e) => setCell(ri, ci, e.target.value)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="table-builder-buttons">
        <button type="button" className="btn btn-small" onClick={addCol}>
          + column
        </button>
        <button type="button" className="btn btn-small" onClick={addRow}>
          + row
        </button>
        {table.rows.length > 0 && (
          <button type="button" className="btn btn-small" onClick={() => removeRow(table.rows.length - 1)}>
            − last row
          </button>
        )}
        <button type="button" className="btn btn-small" onClick={() => onChange(null)}>
          Remove table
        </button>
      </div>
    </div>
  )
}
