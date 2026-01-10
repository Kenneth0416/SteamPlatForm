import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { WysiwygEditor } from '@/components/wysiwyg-editor'
import { VditorEditorInner } from '@/components/vditor-editor'

const mockVditorWrapper = jest.fn()
const vditorInstances: Array<{ id: string; options: any }> = []
const valueMap = new Map<string, string>()
const mockSetValue = jest.fn()
const mockGetValue = jest.fn()
const mockDestroy = jest.fn()

jest.mock('@/components/vditor-editor', () => {
  const actual = jest.requireActual('@/components/vditor-editor')
  return {
    __esModule: true,
    ...actual,
    default: (props: any) => {
      mockVditorWrapper(props)
      return (
        <div data-testid="vditor-proxy" data-placeholder={props.placeholder} data-classname={props.className}>
          <button onClick={() => props.onChange(props.value)}>emit-current</button>
        </div>
      )
    },
  }
})

jest.mock(
  'vditor',
  () => ({
    __esModule: true,
    default: class MockVditor {
      id: string

      constructor(id: string, options: any) {
        this.id = id
        valueMap.set(id, options.value ?? '')
        vditorInstances.push({ id, options })
      }

      setValue(value: string) {
        mockSetValue(value)
        valueMap.set(this.id, value)
      }

      getValue() {
        mockGetValue()
        return valueMap.get(this.id) ?? ''
      }

      destroy() {
        mockDestroy()
      }
    },
  }),
  { virtual: true },
)

describe('WysiwygEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockVditorWrapper.mockClear()
  })

  it('renders the Vditor wrapper with styling and lang metadata', () => {
    render(
      <WysiwygEditor
        value="# Hello World"
        onChange={jest.fn()}
        placeholder="Start writing"
        className="custom-class"
        lang="zh"
      />,
    )

    expect(screen.getByTestId('wysiwyg-editor')).toHaveClass('custom-class')
    expect(screen.getByTestId('wysiwyg-editor')).toHaveAttribute('data-lang', 'zh')

    expect(screen.getByTestId('vditor-proxy')).toHaveAttribute('data-placeholder', 'Start writing')
    expect(screen.getByTestId('vditor-proxy')).toHaveAttribute('data-classname', expect.stringContaining('min-h-[400px]'))

    expect(mockVditorWrapper).toHaveBeenCalledWith(
      expect.objectContaining({
        value: '# Hello World',
        placeholder: 'Start writing',
      }),
    )
  })

  it('forwards changes from Vditor to the parent handler', () => {
    const onChange = jest.fn()
    render(<WysiwygEditor value="Draft" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button'))

    expect(onChange).toHaveBeenCalledWith('Draft')
  })

  it('preserves mermaid code fences without modification', () => {
    const onChange = jest.fn()
    render(<WysiwygEditor value="```mermaid\nflowchart LR\nA-->B\n```" onChange={onChange} />)

    const props = mockVditorWrapper.mock.calls[0][0]
    props.onChange('```mermaid\nflowchart LR\nA-->B\n```')

    expect(onChange).toHaveBeenCalledWith('```mermaid\nflowchart LR\nA-->B\n```')
  })
})

describe('VditorEditorInner', () => {
  beforeEach(() => {
    vditorInstances.length = 0
    valueMap.clear()
    mockSetValue.mockClear()
    mockGetValue.mockClear()
    mockDestroy.mockClear()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('initializes Vditor in wysiwyg mode with the curated toolbar', async () => {
    render(<VditorEditorInner value="# Start" onChange={jest.fn()} placeholder="Begin typing" />)

    await waitFor(() => expect(vditorInstances).toHaveLength(1))

    const { id, options } = vditorInstances[0]
    expect(id).toMatch(/^vditor-/)
    expect(options.mode).toBe('wysiwyg')
    expect(options.toolbar).toEqual([
      'bold',
      'italic',
      'strike',
      '|',
      'headings',
      'link',
      '|',
      'list',
      'ordered-list',
      'quote',
      'code',
      'table',
      '|',
      'undo',
      'redo',
    ])
    expect(options.toolbarConfig).toEqual({ pin: true })
    expect(options.placeholder).toBe('Begin typing')
    expect(options.value).toBe('# Start')
  })

  it('debounces input callbacks and flushes on blur', async () => {
    jest.useFakeTimers()
    const onChange = jest.fn()
    render(<VditorEditorInner value="Draft" onChange={onChange} />)

    await waitFor(() => expect(vditorInstances).toHaveLength(1))
    const { options } = vditorInstances[0]

    act(() => {
      options.input?.('First pass')
    })

    expect(onChange).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(300)
    })
    expect(onChange).toHaveBeenCalledWith('First pass')

    onChange.mockClear()
    act(() => {
      options.input?.('Needs flush')
      options.blur?.('Needs flush')
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('Needs flush')

    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(onChange).toHaveBeenCalledTimes(1)
    jest.useRealTimers()
  })

  it('updates the underlying editor value when props change', async () => {
    const onChange = jest.fn()
    const { rerender } = render(<VditorEditorInner value="Initial" onChange={onChange} />)

    await waitFor(() => expect(vditorInstances).toHaveLength(1))
    mockSetValue.mockClear()

    rerender(<VditorEditorInner value="Updated value" onChange={onChange} />)
    expect(mockSetValue).toHaveBeenCalledWith('Updated value')

    rerender(<VditorEditorInner value="Updated value" onChange={onChange} />)
    expect(mockSetValue).toHaveBeenCalledTimes(1)
  })

  it('destroys the editor and clears pending debounced updates on unmount', async () => {
    jest.useFakeTimers()
    const onChange = jest.fn()
    const { unmount } = render(<VditorEditorInner value="Start" onChange={onChange} />)

    await waitFor(() => expect(vditorInstances).toHaveLength(1))
    const { options } = vditorInstances[0]

    act(() => {
      options.input?.('will cancel')
    })

    unmount()

    act(() => {
      jest.runOnlyPendingTimers()
    })

    expect(onChange).not.toHaveBeenCalled()
    expect(mockDestroy).toHaveBeenCalled()
  })
})
