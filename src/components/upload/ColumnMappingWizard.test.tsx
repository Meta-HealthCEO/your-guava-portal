import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ColumnMappingWizard } from './ColumnMappingWizard'
import type { ColumnMapping } from '@/types/upload'

const headers = ['Txn', 'When', 'Description', 'Amount']
const preview = [
  { Txn: 'A1', When: '2026-04-01 08:30', Description: '1 x Flat White', Amount: '32.00' },
]

const baseMapping: ColumnMapping = { date: 'When', items: 'Description', total: 'Amount' }

describe('ColumnMappingWizard', () => {
  it('disables confirm when required fields are unmapped', () => {
    const onConfirm = vi.fn()
    render(
      <ColumnMappingWizard
        open
        headers={headers}
        preview={preview}
        initialMapping={{ date: 'When' }}
        initialItemsMode="packed"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    )
    const confirm = screen.getByRole('button', { name: /confirm/i })
    expect(confirm).toBeDisabled()
  })

  it('calls onConfirm with mapping when all required fields set', () => {
    const onConfirm = vi.fn()
    render(
      <ColumnMappingWizard
        open
        headers={headers}
        preview={preview}
        initialMapping={baseMapping}
        initialItemsMode="packed"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ date: 'When', items: 'Description', total: 'Amount' }),
      'packed'
    )
  })
})
