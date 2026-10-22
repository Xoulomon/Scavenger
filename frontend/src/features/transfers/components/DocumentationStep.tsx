import type { TransferFormData } from '../types'
import { PhotoUploadSection } from './PhotoUploadSection'

export function DocumentationStep({
  form,
  onChange,
}: {
  form: TransferFormData
  onChange: (updates: Partial<TransferFormData>) => void
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Add notes and documentation for the transfer.
      </p>

      <div className="space-y-2">
        <label htmlFor="transfer-notes" className="text-sm font-medium">
          Transfer Notes
        </label>
        <textarea
          id="transfer-notes"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          rows={3}
          placeholder="General notes about this transfer..."
          value={form.transferNotes}
          onChange={(e) => onChange({ transferNotes: e.target.value })}
          aria-label="Transfer notes"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="condition-notes" className="text-sm font-medium">
          Condition Notes
        </label>
        <textarea
          id="condition-notes"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          rows={2}
          placeholder="Describe the current condition of the material..."
          value={form.conditionNotes}
          onChange={(e) => onChange({ conditionNotes: e.target.value })}
          aria-label="Condition notes"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="handling-instructions" className="text-sm font-medium">
          Handling Instructions
        </label>
        <textarea
          id="handling-instructions"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          rows={2}
          placeholder="Special handling requirements or instructions..."
          value={form.handlingInstructions}
          onChange={(e) => onChange({ handlingInstructions: e.target.value })}
          aria-label="Handling instructions"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PhotoUploadSection
          label="Before Photos"
          photos={form.beforePhotos}
          onPhotosChange={(files) => onChange({ beforePhotos: files })}
          inputId="before-photos"
        />
        <PhotoUploadSection
          label="After Photos"
          photos={form.afterPhotos}
          onPhotosChange={(files) => onChange({ afterPhotos: files })}
          inputId="after-photos"
        />
      </div>
    </div>
  )
}
