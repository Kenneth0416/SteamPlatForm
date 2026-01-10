jest.mock(
  'next/dynamic',
  () => {
    const dynamicMock = jest.fn((importer: any, options: any) => {
      const React = require('react')
      const DynamicComponent = (props: any) => {
        const [Inner, setInner] = React.useState<any>(null)
        React.useEffect(() => {
          importer().then((mod: any) => {
            const { act } = require('@testing-library/react')
            act(() => setInner(() => mod.default || mod))
          })
        }, [importer])
        return Inner ? React.createElement(Inner, props) : null
      }
      ;(DynamicComponent as any).__options = options
      return DynamicComponent
    })

    return {
      __esModule: true,
      default: dynamicMock,
    }
  },
  { virtual: true },
)

jest.mock(
  'vditor',
  () => {
    const mockSetValue = jest.fn()
    const mockDestroy = jest.fn()
    const mockGetValue = jest.fn()
    let lastOptions: any = null
    let lastElement: any = null
    let currentValue = ''

    const VditorMock = jest.fn().mockImplementation((element: any, options: any) => {
      lastOptions = options
      lastElement = element
      currentValue = options?.value ?? ''
      mockGetValue.mockReturnValue(currentValue)
      mockSetValue.mockImplementation((val: string) => {
        currentValue = val
        mockGetValue.mockReturnValue(val)
        options?.input?.(val)
        options?.blur?.(val)
      })

      return {
        setValue: mockSetValue,
        getValue: mockGetValue,
        destroy: mockDestroy,
      }
    })

    return {
      __esModule: true,
      default: VditorMock,
      __mock: {
        mockSetValue,
        mockDestroy,
        mockGetValue,
        getLastOptions: () => lastOptions,
        getLastElement: () => lastElement,
      },
    }
  },
  { virtual: true },
)

import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import Vditor from 'vditor'
import { VditorEditorInner } from '@/components/vditor-editor'

const vditorMock = (jest.requireMock('vditor') as any).__mock

describe('VditorEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('initializes Vditor in wysiwyg mode with the simplified toolbar and theme hooks', async () => {
    render(<VditorEditorInner value="Seed content" onChange={jest.fn()} placeholder="Start writing" className="custom" />)

    await waitFor(() => expect(Vditor as unknown as jest.Mock).toHaveBeenCalled())
    const options = vditorMock.getLastOptions()

    expect(options.mode).toBe('wysiwyg')
    expect(options.cache).toEqual({ enable: false })
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
    expect(options.toolbarConfig).toEqual(expect.objectContaining({ pin: true }))
    expect(options.placeholder).toBe('Start writing')
    expect(options.value).toBe('Seed content')

    const container = screen.getByTestId('vditor-editor')
    expect(container).toHaveClass('custom')
    expect(container).toHaveStyle({
      backgroundColor: 'var(--vditor-surface)',
      color: 'var(--foreground)',
    })
    expect(vditorMock.getLastElement()).toMatch(/^vditor-/)
  })

  it('debounces live input and flushes pending changes on blur', async () => {
    const onChange = jest.fn()
    render(<VditorEditorInner value="Hello" onChange={onChange} />)

    await waitFor(() => expect(Vditor as unknown as jest.Mock).toHaveBeenCalled())
    const options = vditorMock.getLastOptions()

    jest.useFakeTimers()
    try {
      act(() => {
        options.input?.('first change')
        options.input?.('second change')
        jest.advanceTimersByTime(250)
      })
      expect(onChange).not.toHaveBeenCalled()

      act(() => {
        jest.advanceTimersByTime(50)
      })
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenLastCalledWith('second change')

      act(() => {
        options.input?.('final change')
        jest.advanceTimersByTime(100)
        options.blur?.('final change')
      })
      expect(onChange).toHaveBeenCalledTimes(2)
      expect(onChange).toHaveBeenLastCalledWith('final change')
    } finally {
      jest.useRealTimers()
    }
  })

  it('pushes external value updates to the editor without re-sending the same content', async () => {
    const onChange = jest.fn()
    const { rerender } = render(<VditorEditorInner value="Initial" onChange={onChange} />)

    await waitFor(() => expect(Vditor as unknown as jest.Mock).toHaveBeenCalled())
    expect(vditorMock.mockSetValue).not.toHaveBeenCalled()

    rerender(<VditorEditorInner value="Updated value" onChange={onChange} />)
    await waitFor(() => expect(vditorMock.mockSetValue).toHaveBeenCalledWith('Updated value'))

    rerender(<VditorEditorInner value="Updated value" onChange={onChange} />)
    expect(vditorMock.mockSetValue).toHaveBeenCalledTimes(1)
  })

  it('skips setValue when the incoming value already matches the editor content', async () => {
    const onChange = jest.fn()
    const { rerender } = render(<VditorEditorInner value="Alpha" onChange={onChange} />)

    await waitFor(() => expect(Vditor as unknown as jest.Mock).toHaveBeenCalled())
    vditorMock.mockGetValue.mockReturnValue('Beta')

    rerender(<VditorEditorInner value="Beta" onChange={onChange} />)

    await waitFor(() => expect(vditorMock.mockGetValue).toHaveBeenCalled())
    expect(vditorMock.mockSetValue).not.toHaveBeenCalled()
  })

  it('clears pending timers and destroys the instance on unmount', async () => {
    const onChange = jest.fn()
    const { unmount } = render(<VditorEditorInner value="Transient" onChange={onChange} />)

    await waitFor(() => expect(Vditor as unknown as jest.Mock).toHaveBeenCalled())
    const options = vditorMock.getLastOptions()

    jest.useFakeTimers()
    try {
      act(() => {
        options.input?.('draft content')
      })
      unmount()
      act(() => {
        jest.runOnlyPendingTimers()
      })

      expect(onChange).not.toHaveBeenCalled()
      expect(vditorMock.mockDestroy).toHaveBeenCalled()
    } finally {
      jest.useRealTimers()
    }
  })

  it('exports a default wrapper with SSR disabled', () => {
    const mod = require('@/components/vditor-editor')
    const Wrapped = mod.default as any

    expect(Wrapped.__options).toMatchObject({ ssr: false })
    render(<Wrapped value="" onChange={jest.fn()} />)
  })
})
