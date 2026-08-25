export default function QueueList({ queue, onRemove }) {
  return (
    <div className="panel no-print">
      <h2>Print Queue ({queue.length})</h2>
      {queue.length === 0 ? (
        <p className="queue-empty">No cards queued yet.</p>
      ) : (
        <ul className="queue-list">
          {queue.map((item, i) => (
            <li key={i}>
              <span className="qname">
                {item.name}
                {item.card?.continued ? ' (2 cards)' : ''}
              </span>
              <span className="qmeta">Lv {item.level}</span>
              <span className="queue-actions">
                <button type="button" className="btn btn-small" onClick={() => onRemove(i)}>
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="btn-row">
        <button type="button" className="btn btn-primary" disabled={!queue.length} onClick={() => window.print()}>
          Print
        </button>
      </div>
    </div>
  )
}
