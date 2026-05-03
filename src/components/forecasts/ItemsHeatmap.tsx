import type { Forecast } from '@/types'

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function shortDay(dateStr: string): string {
  return SHORT_DAYS[new Date(dateStr).getDay()]
}

interface Props {
  forecasts: Forecast[]
}

export function ItemsHeatmap({ forecasts }: Props) {
  if (forecasts.length === 0) return null

  // Union of all items sorted by total qty, top 12
  const totals: Record<string, number> = {}
  for (const f of forecasts) {
    for (const item of f.items) {
      totals[item.itemName] = (totals[item.itemName] || 0) + item.predictedQty
    }
  }
  const topItems = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name]) => name)

  // Build matrix: rows = items, cols = days
  const dayLabels = forecasts.map((f) => shortDay(f.date))
  const matrix: number[][] = topItems.map((itemName) =>
    forecasts.map((f) => {
      const found = f.items.find((i) => i.itemName === itemName)
      return found ? found.predictedQty : 0
    })
  )

  const maxVal = Math.max(1, ...matrix.flat())

  function cellBg(value: number): string {
    if (value === 0) return 'transparent'
    const opacity = Math.max(0.08, value / maxVal)
    // Return inline style; we'll apply as style prop
    return `rgba(212, 61, 61, ${opacity})`
  }

  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2A2A2A]">
        <p className="text-[#F0F0F0] text-sm font-semibold">Items × days heatmap</p>
        <p className="text-[#555555] text-xs mt-0.5">Top 12 items by weekly predicted quantity</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              {/* Sticky first header cell */}
              <th className="sticky left-0 bg-[#1A1A1A] text-left px-4 py-2.5 text-[#555555] font-medium w-36 min-w-[9rem] border-b border-[#2A2A2A] border-r border-[#2A2A2A]">
                Item
              </th>
              {dayLabels.map((day, i) => (
                <th
                  key={i}
                  className="text-center px-3 py-2.5 text-[#555555] font-medium min-w-[3.5rem] border-b border-[#2A2A2A]"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topItems.map((itemName, rowIdx) => (
              <tr key={itemName} className="border-b border-[#1F1F1F] last:border-0">
                <td className="sticky left-0 bg-[#1A1A1A] px-4 py-2 text-[#888888] truncate max-w-[9rem] border-r border-[#2A2A2A]">
                  {itemName}
                </td>
                {matrix[rowIdx].map((val, colIdx) => (
                  <td
                    key={colIdx}
                    className="text-center px-3 py-2"
                    style={{ backgroundColor: cellBg(val) }}
                  >
                    <span className={val === 0 ? 'text-[#333333]' : 'text-[#F0F0F0]'}>
                      {val === 0 ? '—' : val}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
