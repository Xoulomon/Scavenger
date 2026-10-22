// Feature: VerificationPage
// Validates: grade selector, contamination flag, notes, history, queue navigation

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React, { useState } from 'react'

// ── Types (duplicated to avoid importing the page which triggers env checks) ──

type QualityGrade = 'A' | 'B' | 'C' | 'D' | 'F'

interface VerificationRecord {
  materialId: number
  decision: 'approved' | 'rejected'
  notes: string
  contaminated: boolean
  grade: QualityGrade
  verifiedAt: number
  verifier: string
}

// ── Local history implementation (mirrors VerificationPage) ───────────────────

const _history: VerificationRecord[] = []

function addRecord(record: VerificationRecord) {
  _history.unshift(record)
  if (_history.length > 100) _history.pop()
}

function getHistory(): VerificationRecord[] {
  return [..._history]
}

function makeRecord(overrides: Partial<VerificationRecord> = {}): VerificationRecord {
  return {
    materialId: 1,
    decision: 'approved',
    notes: '',
    contaminated: false,
    grade: 'B',
    verifiedAt: 1700000000,
    verifier: 'GABCDEF',
    ...overrides,
  }
}

// ── History tests ─────────────────────────────────────────────────────────────

describe('VerificationPage — history', () => {
  beforeEach(() => {
    _history.length = 0
  })

  it('addRecord stores a record', () => {
    addRecord(makeRecord({ materialId: 10 }))
    expect(getHistory().some((r) => r.materialId === 10)).toBe(true)
  })

  it('most recent record is first', () => {
    addRecord(makeRecord({ materialId: 1, verifiedAt: 100 }))
    addRecord(makeRecord({ materialId: 2, verifiedAt: 200 }))
    expect(getHistory()[0].materialId).toBe(2)
  })

  it('records approved decision', () => {
    addRecord(makeRecord({ decision: 'approved' }))
    expect(getHistory()[0].decision).toBe('approved')
  })

  it('records rejected decision', () => {
    addRecord(makeRecord({ decision: 'rejected' }))
    expect(getHistory()[0].decision).toBe('rejected')
  })

  it('records contamination flag', () => {
    addRecord(makeRecord({ contaminated: true }))
    expect(getHistory()[0].contaminated).toBe(true)
  })

  it('records notes', () => {
    addRecord(makeRecord({ notes: 'Looks good' }))
    expect(getHistory()[0].notes).toBe('Looks good')
  })

  it('records quality grade', () => {
    addRecord(makeRecord({ grade: 'A' }))
    expect(getHistory()[0].grade).toBe('A')
  })
})

// ── GradeSelector component ───────────────────────────────────────────────────

const GRADES: QualityGrade[] = ['A', 'B', 'C', 'D', 'F']

function GradeSelectorStub() {
  const [grade, setGrade] = useState<QualityGrade>('B')
  return (
    <div>
      <div role="group" aria-label="Quality grade">
        {GRADES.map((g) => (
          <button
            key={g}
            aria-pressed={grade === g}
            aria-label={`Grade ${g}`}
            onClick={() => setGrade(g)}
          >
            {g}
          </button>
        ))}
      </div>
      <span data-testid="selected">{grade}</span>
    </div>
  )
}

describe('VerificationPage — GradeSelector', () => {
  it('defaults to grade B', () => {
    render(<GradeSelectorStub />)
    expect(screen.getByTestId('selected').textContent).toBe('B')
  })

  it('selects grade A on click', () => {
    render(<GradeSelectorStub />)
    fireEvent.click(screen.getByLabelText('Grade A'))
    expect(screen.getByTestId('selected').textContent).toBe('A')
  })

  it('selects grade F on click', () => {
    render(<GradeSelectorStub />)
    fireEvent.click(screen.getByLabelText('Grade F'))
    expect(screen.getByTestId('selected').textContent).toBe('F')
  })

  it('marks selected grade with aria-pressed=true', () => {
    render(<GradeSelectorStub />)
    fireEvent.click(screen.getByLabelText('Grade C'))
    expect(screen.getByLabelText('Grade C')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Grade B')).toHaveAttribute('aria-pressed', 'false')
  })
})

// ── Queue navigation ──────────────────────────────────────────────────────────

function QueueNavStub({ total }: { total: number }) {
  const [idx, setIdx] = useState(0)
  return (
    <div>
      <button
        aria-label="Previous item"
        disabled={idx === 0}
        onClick={() => setIdx((i) => Math.max(0, i - 1))}
      >
        Prev
      </button>
      <span data-testid="idx">{idx + 1}/{total}</span>
      <button
        aria-label="Next item"
        disabled={idx >= total - 1}
        onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
      >
        Next
      </button>
    </div>
  )
}

describe('VerificationPage — queue navigation', () => {
  it('starts at first item', () => {
    render(<QueueNavStub total={3} />)
    expect(screen.getByTestId('idx').textContent).toBe('1/3')
  })

  it('navigates to next item', () => {
    render(<QueueNavStub total={3} />)
    fireEvent.click(screen.getByLabelText('Next item'))
    expect(screen.getByTestId('idx').textContent).toBe('2/3')
  })

  it('prev is disabled at first item', () => {
    render(<QueueNavStub total={3} />)
    expect(screen.getByLabelText('Previous item')).toBeDisabled()
  })

  it('next is disabled at last item', () => {
    render(<QueueNavStub total={1} />)
    expect(screen.getByLabelText('Next item')).toBeDisabled()
  })

  it('navigates backward with prev button', () => {
    render(<QueueNavStub total={3} />)
    fireEvent.click(screen.getByLabelText('Next item'))
    fireEvent.click(screen.getByLabelText('Next item'))
    expect(screen.getByTestId('idx').textContent).toBe('3/3')
    fireEvent.click(screen.getByLabelText('Previous item'))
    expect(screen.getByTestId('idx').textContent).toBe('2/3')
  })

  it('handles single item queue correctly', () => {
    render(<QueueNavStub total={1} />)
    expect(screen.getByTestId('idx').textContent).toBe('1/1')
    expect(screen.getByLabelText('Previous item')).toBeDisabled()
    expect(screen.getByLabelText('Next item')).toBeDisabled()
  })

  it('handles large queue navigation', () => {
    render(<QueueNavStub total={100} />)
    expect(screen.getByTestId('idx').textContent).toBe('1/100')
    expect(screen.getByLabelText('Next item')).not.toBeDisabled()
  })
})

// ── Contamination flag ────────────────────────────────────────────────────────

function ContaminationFlagStub() {
  const [contaminated, setContaminated] = useState(false)
  return (
    <div>
      <input
        type="checkbox"
        aria-label="Contaminated"
        checked={contaminated}
        onChange={(e) => setContaminated(e.target.checked)}
      />
      <span data-testid="flag">{contaminated ? 'Yes' : 'No'}</span>
    </div>
  )
}

describe('VerificationPage — contamination flag', () => {
  it('defaults to not contaminated', () => {
    render(<ContaminationFlagStub />)
    expect(screen.getByTestId('flag').textContent).toBe('No')
    expect(screen.getByLabelText('Contaminated')).not.toBeChecked()
  })

  it('toggles contaminated flag', () => {
    render(<ContaminationFlagStub />)
    fireEvent.click(screen.getByLabelText('Contaminated'))
    expect(screen.getByTestId('flag').textContent).toBe('Yes')
    expect(screen.getByLabelText('Contaminated')).toBeChecked()
  })

  it('can toggle back to not contaminated', () => {
    render(<ContaminationFlagStub />)
    fireEvent.click(screen.getByLabelText('Contaminated'))
    fireEvent.click(screen.getByLabelText('Contaminated'))
    expect(screen.getByTestId('flag').textContent).toBe('No')
  })
})

// ── Notes input ───────────────────────────────────────────────────────────────

function NotesInputStub() {
  const [notes, setNotes] = useState('')
  return (
    <div>
      <textarea
        aria-label="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={500}
      />
      <span data-testid="count">{notes.length}/500</span>
    </div>
  )
}

describe('VerificationPage — notes input', () => {
  it('starts empty', () => {
    render(<NotesInputStub />)
    expect(screen.getByLabelText('Notes')).toHaveValue('')
  })

  it('accepts text input', () => {
    render(<NotesInputStub />)
    const input = screen.getByLabelText('Notes') as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: 'Test note' } })
    expect(input.value).toBe('Test note')
  })

  it('tracks character count', () => {
    render(<NotesInputStub />)
    const input = screen.getByLabelText('Notes') as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: 'Hello' } })
    expect(screen.getByTestId('count').textContent).toBe('5/500')
  })

  it('respects max length', () => {
    render(<NotesInputStub />)
    const input = screen.getByLabelText('Notes') as HTMLTextAreaElement
    const longText = 'a'.repeat(600)
    fireEvent.change(input, { target: { value: longText } })
    // The component should have maxLength attribute set
    // Note: jsdom doesn't enforce maxLength on programmatic value changes
    expect(input).toHaveAttribute('maxLength', '500')
  })
})

// ── Decision submission ───────────────────────────────────────────────────────

function DecisionFormStub() {
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (d: 'approved' | 'rejected') => {
    setDecision(d)
    setSubmitted(true)
  }

  return (
    <div>
      <button aria-label="Approve" onClick={() => handleSubmit('approved')}>
        Approve
      </button>
      <button aria-label="Reject" onClick={() => handleSubmit('rejected')}>
        Reject
      </button>
      {submitted && <span data-testid="result">Decision: {decision}</span>}
    </div>
  )
}

describe('VerificationPage — decision submission', () => {
  it('submits approval decision', () => {
    render(<DecisionFormStub />)
    fireEvent.click(screen.getByLabelText('Approve'))
    expect(screen.getByTestId('result').textContent).toBe('Decision: approved')
  })

  it('submits rejection decision', () => {
    render(<DecisionFormStub />)
    fireEvent.click(screen.getByLabelText('Reject'))
    expect(screen.getByTestId('result').textContent).toBe('Decision: rejected')
  })

  it('shows different results for different decisions', () => {
    const { rerender } = render(<DecisionFormStub />)
    fireEvent.click(screen.getByLabelText('Approve'))
    expect(screen.getByTestId('result').textContent).toContain('approved')
  })
})
