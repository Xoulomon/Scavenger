/**
 * Modal — shared accessible modal wrapper (issue #875, #1674)
 *
 * Built on top of the existing Radix-backed Dialog primitives so all
 * instances get:
 *   - Automatic focus trap (Radix handles this)
 *   - Esc key closes the modal
 *   - Focus restored to the trigger element on close
 *   - role="dialog" + aria-modal="true" (Radix adds these)
 *   - Visible close button with aria-label
 *
 * This is the single shared modal primitive for the app (issue #1674);
 * per-page modal duplicates should be replaced with this component.
 *
 * @example Basic usage
 * ```tsx
 * const [open, setOpen] = React.useState(false)
 *
 * <Modal
 *   open={open}
 *   onClose={() => setOpen(false)}
 *   title="Delete project"
 *   description="This action cannot be undone."
 * >
 *   <Button variant="destructive" onClick={confirmDelete}>
 *     Delete
 *   </Button>
 * </Modal>
 * ```
 *
 * @example Imperative open with focus restoration
 * ```tsx
 * const triggerRef = React.useRef<HTMLButtonElement>(null)
 *
 * <button ref={triggerRef} onClick={() => setOpen(true)}>
 *   Open settings
 * </button>
 * <Modal
 *   open={open}
 *   onClose={() => setOpen(false)}
 *   title="Settings"
 *   triggerRef={triggerRef}
 * >
 *   <SettingsForm />
 * </Modal>
 * ```
 *
 * Accessibility:
 *   - `title` is required and becomes the dialog's accessible name.
 *   - `description` (optional) is wired to `aria-describedby` by Radix.
 *   - Focus is trapped while open and restored to `triggerRef` on close.
 *   - Pressing Escape calls `onClose`.
 *
 * Backwards compatibility (issue #1674): the public props are unchanged —
 * `open`, `onClose`, `title`, `description`, `children`, `className`,
 * `triggerRef` — so existing callers continue to work without modification.
 */
import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/Dialog'

/**
 * Unit tests for the shared Modal primitive live in
 * `frontend/src/components/ui/__tests__/Modal.test.tsx` and cover:
 *   - focus trap while open
 *   - Escape key calls `onClose`
 *   - focus restoration to `triggerRef` on close
 *   - accessible name from `title` and description wiring
 */

export interface ModalProps {
  open: boolean
  onClose: () => void
  /** Visible heading — also used as the accessible name for the dialog */
  title: React.ReactNode
  /** Optional description shown below the title */
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
  /**
   * Ref of the element that triggered the modal.
   * When provided, focus is returned to this element on close.
   * Radix handles this automatically when DialogTrigger is used;
   * this prop is for imperative open patterns.
   */
  triggerRef?: React.RefObject<HTMLElement>
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  triggerRef
}: ModalProps) {
  // When the dialog closes, return focus to the trigger element if supplied.
  // Radix already does this when DialogTrigger is used; this handles the
  // imperative open pattern (e.g. onClick → setState).
  const handleOpenChange = React.useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        onClose()
        // Defer so Radix finishes unmounting before we move focus
        if (triggerRef?.current) {
          setTimeout(() => triggerRef.current?.focus(), 0)
        }
      }
    },
    [onClose, triggerRef]
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

export default Modal
