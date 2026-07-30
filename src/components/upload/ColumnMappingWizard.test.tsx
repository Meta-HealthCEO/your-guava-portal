import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('calls onConfirm with mapping when all required fields set', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
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
    await user.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ date: 'When', items: 'Description', total: 'Amount' }),
      'packed'
    )
  })

  it('rejects reusing one source column for multiple canonical fields', () => {
    render(
      <ColumnMappingWizard
        open
        headers={headers}
        preview={preview}
        initialMapping={{ date: 'When', items: 'When', total: 'Amount' }}
        initialItemsMode="packed"
        onConfirm={vi.fn()}
        onCancel={() => {}}
      />
    )

    expect(screen.getByText(/each field needs its own source column/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
  })

  it('requires receipt ID for line-per-row imports', () => {
    const onConfirm = vi.fn()
    render(
      <ColumnMappingWizard
        open
        headers={headers}
        preview={preview}
        initialMapping={baseMapping}
        initialItemsMode="line-per-row"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    )

    expect(screen.getByText(/receipt id is required/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
  })

  it('allows line-per-row imports after receipt ID is mapped', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(
      <ColumnMappingWizard
        open
        headers={headers}
        preview={preview}
        initialMapping={baseMapping}
        initialItemsMode="line-per-row"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    )

    const receiptSelect = screen.getAllByRole('combobox')[4]
    await user.selectOptions(receiptSelect, 'Txn')
    await user.click(screen.getByRole('button', { name: /confirm/i }))

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ date: 'When', items: 'Description', total: 'Amount', receiptId: 'Txn' }),
      'line-per-row'
    )
  })
})
