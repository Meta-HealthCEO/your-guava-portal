import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import MenuItems from './MenuItems'
import type { SalesItem } from '@/types'

// Mock assets
vi.mock('@/assets/logo.png', () => ({ default: 'logo.png' }))
vi.mock('@/assets/guava-icon.png', () => ({ default: 'icon.png' }))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { role: 'owner' }, isLoading: false, isOwner: true }),
}))

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPut = vi.fn()

// Partial mock: AuthProvider reads API_CONFIG_ERROR and isSessionRejection from
// this module during render, and a factory that omits them makes vitest throw
// the moment one is touched.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    refreshAccessToken: () => Promise.resolve('test-access-token'),
    default: {
      get: (...args: unknown[]) => mockGet(...args),
      post: (...args: unknown[]) => mockPost(...args),
      put: (...args: unknown[]) => mockPut(...args),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      defaults: { baseURL: 'http://localhost:5000/api' },
    },
  }
})

function buildItem(overrides: Partial<SalesItem> & { _id: string; name: string }): SalesItem {
  return {
    cafeId: 'cafe1',
    category: 'coffee',
    isActive: true,
    reviewStatus: 'matched',
    ...overrides,
  } as SalesItem
}

const FLAT_WHITE = buildItem({
  _id: 'item1',
  name: 'Flat White (Blend)',
  expectedPrice: 32,
  priceTolerancePct: 10,
  avgPrice: 32,
  aliases: ['FLATWHITE'],
})

const CROISSANT = buildItem({
  _id: 'item2',
  name: 'Almond Croissant',
  category: 'food',
  expectedPrice: 45,
  priceTolerancePct: 10,
  avgPrice: 45,
})

const NEEDS_REVIEW = buildItem({
  _id: 'review1',
  name: 'Cappucino Lrg',
  reviewStatus: 'needs_review',
  avgPrice: 38,
  lastObservedPrice: 38,
  candidates: [{ item: FLAT_WHITE, score: 0.7 }],
} as Partial<SalesItem> & { _id: string; name: string })

function mockItems(menu: SalesItem[], review: SalesItem[]) {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/items/reconciliation')) {
      return Promise.resolve({ data: { items: review } })
    }
    if (url.includes('/items')) {
      return Promise.resolve({ data: { items: menu } })
    }
    if (url.includes('/cafe/me')) {
      return Promise.resolve({ data: { cafe: { name: 'Test' } } })
    }
    return Promise.resolve({ data: {} })
  })
}

// Serves a different menu list on every /items?active=true call so a refetch can
// be made to disagree with what the user is currently editing.
function mockItemsSequence(menuByCall: SalesItem[][], review: SalesItem[]) {
  let call = 0
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/items/reconciliation')) {
      return Promise.resolve({ data: { items: review } })
    }
    if (url.includes('/items')) {
      const menu = menuByCall[Math.min(call, menuByCall.length - 1)]
      call += 1
      return Promise.resolve({ data: { items: menu } })
    }
    return Promise.resolve({ data: {} })
  })
}

async function openMenuPricesTab() {
  await waitFor(() => expect(screen.getByText('Menu Prices')).toBeInTheDocument())
  await userEvent.click(screen.getByText('Menu Prices'))
}

const priceFor = (name: string | RegExp) =>
  screen.getByRole('spinbutton', { name: new RegExp(`Menu price for ${name}`, 'i') })

describe('MenuItems accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('names every menu-table category select after its own row', async () => {
    mockItems([FLAT_WHITE, CROISSANT], [])

    render(<MenuItems />)

    await waitFor(() => expect(screen.getByText('Menu Prices')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Menu Prices'))

    expect(
      screen.getByRole('combobox', { name: /Category for Flat White \(Blend\)/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: /Category for Almond Croissant/i })
    ).toBeInTheDocument()
  })

  it('names every menu-table price, threshold and alias input after its own row', async () => {
    mockItems([FLAT_WHITE, CROISSANT], [])

    render(<MenuItems />)

    await waitFor(() => expect(screen.getByText('Menu Prices')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Menu Prices'))

    expect(screen.getByRole('spinbutton', { name: /Menu price for Flat White \(Blend\)/i })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: /Price alert threshold for Flat White \(Blend\)/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /POS aliases for Flat White \(Blend\)/i })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: /Menu price for Almond Croissant/i })).toBeInTheDocument()
  })

  it('names each row Save button after the item it saves', async () => {
    mockItems([FLAT_WHITE, CROISSANT], [])

    render(<MenuItems />)

    await waitFor(() => expect(screen.getByText('Menu Prices')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Menu Prices'))

    expect(screen.getByRole('button', { name: /Save Flat White \(Blend\)/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save Almond Croissant/i })).toBeInTheDocument()
  })

  it('labels the new-item category select and the search box', async () => {
    mockItems([FLAT_WHITE], [])

    render(<MenuItems />)

    await waitFor(() => expect(screen.getByText('Menu Prices')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Menu Prices'))

    expect(screen.getByRole('combobox', { name: /^Category$/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Search menu items/i })).toBeInTheDocument()
  })

  it('names the review-card category select, price input and link select after the POS item', async () => {
    mockItems([FLAT_WHITE], [NEEDS_REVIEW])

    render(<MenuItems />)

    await waitFor(() => expect(screen.getByText('Cappucino Lrg')).toBeInTheDocument())

    expect(screen.getByRole('combobox', { name: /Category for Cappucino Lrg/i })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: /Menu price for Cappucino Lrg/i })).toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: /Link Cappucino Lrg to an existing menu item/i })
    ).toBeInTheDocument()
  })

  it('leaves no select on the page without an accessible name', async () => {
    mockItems([FLAT_WHITE, CROISSANT], [NEEDS_REVIEW])

    render(<MenuItems />)

    await waitFor(() => expect(screen.getByText('Cappucino Lrg')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Menu Prices'))

    const selects = Array.from(document.querySelectorAll('select'))
    expect(selects.length).toBeGreaterThan(0)
    for (const select of selects) {
      const labelled =
        select.getAttribute('aria-label') ||
        (select.id && document.querySelector(`label[for="${select.id}"]`)?.textContent) ||
        select.closest('label')?.textContent
      expect(labelled?.trim()).toBeTruthy()
    }
  })

  it('gives every repeated review action a row-specific accessible name', async () => {
    mockItems([FLAT_WHITE], [NEEDS_REVIEW])

    render(<MenuItems />)

    await waitFor(() => expect(screen.getByText('Cappucino Lrg')).toBeInTheDocument())

    expect(screen.getByRole('button', { name: /Keep Cappucino Lrg as a new menu item/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ignore the POS item Cappucino Lrg/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Run AI review for Cappucino Lrg/i })).toBeInTheDocument()
  })
})

describe('MenuItems unsaved work', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockPut.mockResolvedValue({ data: {} })
    mockPost.mockResolvedValue({ data: {} })
  })

  it('keeps edits typed into other rows when one row is saved', async () => {
    mockItems([FLAT_WHITE, CROISSANT], [])
    render(<MenuItems />)
    await openMenuPricesTab()

    await userEvent.clear(priceFor('Almond Croissant'))
    await userEvent.type(priceFor('Almond Croissant'), '48')

    await userEvent.click(screen.getByRole('button', { name: /Save Flat White/i }))
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1))

    // The refetch must not discard the in-progress edit on the sibling row.
    await waitFor(() => expect(priceFor('Almond Croissant')).toHaveValue(48))
  })

  it('never blanks the table into a spinner while refetching after a save', async () => {
    mockItems([FLAT_WHITE, CROISSANT], [])
    render(<MenuItems />)
    await openMenuPricesTab()

    await userEvent.click(screen.getByRole('button', { name: /Save Flat White/i }))

    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Loading menu items...')).not.toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: /Menu price for Almond Croissant/i })).toBeInTheDocument()
  })

  it('warns instead of silently discarding when the server value moved under an edit', async () => {
    const movedCroissant = { ...CROISSANT, expectedPrice: 52 }
    mockItemsSequence([[FLAT_WHITE, CROISSANT], [FLAT_WHITE, movedCroissant]], [])
    render(<MenuItems />)
    await openMenuPricesTab()

    await userEvent.clear(priceFor('Almond Croissant'))
    await userEvent.type(priceFor('Almond Croissant'), '48')
    await userEvent.click(screen.getByRole('button', { name: /Save Flat White/i }))

    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1))
    // The user's number survives...
    await waitFor(() => expect(priceFor('Almond Croissant')).toHaveValue(48))
    // ...and they are told the stored value changed rather than being left to
    // overwrite it blind.
    expect(await screen.findByText(/changed on the server/i)).toBeInTheDocument()
  })

  it('counts unsaved rows and saves them all in one action', async () => {
    mockItems([FLAT_WHITE, CROISSANT], [])
    render(<MenuItems />)
    await openMenuPricesTab()

    await userEvent.clear(priceFor('Almond Croissant'))
    await userEvent.type(priceFor('Almond Croissant'), '48')
    await userEvent.clear(priceFor('Flat White'))
    await userEvent.type(priceFor('Flat White'), '35')

    expect(await screen.findByText(/2 unsaved changes/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /save all changes/i }))
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(2))
    expect(mockPut).toHaveBeenCalledWith('/items/item2', expect.objectContaining({ expectedPrice: 48 }))
    expect(mockPut).toHaveBeenCalledWith('/items/item1', expect.objectContaining({ expectedPrice: 35 }))
  })

  it('discards unsaved edits only when the user asks for it', async () => {
    mockItems([FLAT_WHITE, CROISSANT], [])
    render(<MenuItems />)
    await openMenuPricesTab()

    await userEvent.clear(priceFor('Almond Croissant'))
    await userEvent.type(priceFor('Almond Croissant'), '48')
    await screen.findByText(/1 unsaved change/i)

    await userEvent.click(screen.getByRole('button', { name: /discard changes/i }))

    await waitFor(() => expect(priceFor('Almond Croissant')).toHaveValue(45))
    expect(screen.queryByText(/unsaved change/i)).not.toBeInTheDocument()
  })

  it('warns before the tab is closed with unsaved edits', async () => {
    mockItems([FLAT_WHITE, CROISSANT], [])
    render(<MenuItems />)
    await openMenuPricesTab()

    await userEvent.clear(priceFor('Almond Croissant'))
    await userEvent.type(priceFor('Almond Croissant'), '48')
    await screen.findByText(/1 unsaved change/i)

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })
})

describe('MenuItems import fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockPut.mockResolvedValue({ data: {} })
    mockPost.mockResolvedValue({ data: {} })
  })

  it('refuses to link when the pre-selected suggestion has been cleared', async () => {
    mockItems([FLAT_WHITE], [NEEDS_REVIEW])
    render(<MenuItems />)
    await waitFor(() => expect(screen.getByText('Cappucino Lrg')).toBeInTheDocument())

    const linkSelect = screen.getByRole('combobox', { name: /Link Cappucino Lrg to an existing menu item/i })
    await userEvent.selectOptions(linkSelect, '')
    await userEvent.click(screen.getByRole('button', { name: /^Link Cappucino Lrg/i }))

    expect(await screen.findByText(/choose a menu item to map to/i)).toBeInTheDocument()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('still links to the suggested candidate when the user leaves it selected', async () => {
    mockItems([FLAT_WHITE], [NEEDS_REVIEW])
    render(<MenuItems />)
    await waitFor(() => expect(screen.getByText('Cappucino Lrg')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /^Link Cappucino Lrg/i }))

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith(
      '/items/review1/resolve',
      expect.objectContaining({ action: 'map_to', targetItemId: 'item1' })
    ))
  })
})

describe('MenuItems create form', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockPut.mockResolvedValue({ data: {} })
  })

  it('cannot be submitted twice while the first request is in flight', async () => {
    mockItems([FLAT_WHITE], [])
    let resolveCreate: (value: unknown) => void = () => {}
    mockPost.mockImplementation(() => new Promise((resolve) => { resolveCreate = resolve }))

    render(<MenuItems />)
    await openMenuPricesTab()

    await userEvent.type(screen.getByLabelText(/item name/i), 'Cortado')
    const add = screen.getByRole('button', { name: /^add(ing)?/i })
    await userEvent.click(add)
    await waitFor(() => expect(add).toBeDisabled())
    await userEvent.click(add)

    expect(mockPost).toHaveBeenCalledTimes(1)
    resolveCreate({ data: {} })
  })

  it('is disabled until a name is typed', async () => {
    mockItems([FLAT_WHITE], [])
    render(<MenuItems />)
    await openMenuPricesTab()

    expect(screen.getByRole('button', { name: /^add$/i })).toBeDisabled()
  })
})

describe('MenuItems AI review honesty', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('does not promise an untouched balance when the review never came back', async () => {
    mockItems([FLAT_WHITE], [NEEDS_REVIEW])
    mockPost.mockRejectedValue(Object.assign(new Error('timeout of 90000ms exceeded'), { code: 'ECONNABORTED' }))

    render(<MenuItems />)
    await waitFor(() => expect(screen.getByText('Cappucino Lrg')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /Run AI review for Cappucino Lrg/i }))

    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent(/lost contact/i)
    expect(notice).not.toHaveTextContent(/no credits were charged/i)
  })

  it('keeps the "no credits charged" promise for a definite pre-charge rejection', async () => {
    mockItems([FLAT_WHITE], [NEEDS_REVIEW])
    mockPost.mockRejectedValue({ response: { status: 402, data: {} } })

    render(<MenuItems />)
    await waitFor(() => expect(screen.getByText('Cappucino Lrg')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /Run AI review for Cappucino Lrg/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/no credits were charged/i)
  })

  it('presents the free smart-check fallback as a result, not a failure', async () => {
    mockItems([FLAT_WHITE], [NEEDS_REVIEW])
    mockPost.mockResolvedValue({ data: { items: [NEEDS_REVIEW], meta: { paidAiUsed: false } } })

    render(<MenuItems />)
    await waitFor(() => expect(screen.getByText('Cappucino Lrg')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /Run AI review for Cappucino Lrg/i }))

    const notice = await screen.findByRole('status')
    expect(notice).toHaveTextContent(/free smart check/i)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('MenuItems at scale', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('pages a long menu instead of rendering every row at once', async () => {
    const many = Array.from({ length: 120 }, (_, index) =>
      buildItem({ _id: `bulk${index}`, name: `Item ${String(index).padStart(3, '0')}`, expectedPrice: 10 })
    )
    mockItems(many, [])

    render(<MenuItems />)
    await openMenuPricesTab()

    expect(await screen.findByText(/Showing 1-50 of 120 menu items/i)).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: /Menu price for Item 000/i })).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: /Menu price for Item 050/i })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /next menu page/i }))
    expect(await screen.findByText(/Showing 51-100 of 120 menu items/i)).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: /Menu price for Item 050/i })).toBeInTheDocument()
  })
})
