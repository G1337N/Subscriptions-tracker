export default function RenewSubscriptionModal(props) {
  const { onCancel, onChange, onSubmit, renewError, renewForm, visible } = props
  if (!visible) return null

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto overscroll-contain bg-slate-950/40 px-4 py-6">
      <form
        onSubmit={onSubmit}
        className="pointer-events-auto mx-auto my-2 w-full max-w-md rounded-2xl bg-white p-5 shadow-soft dark:bg-slate-900 dark:ring-1 dark:ring-slate-800 sm:my-8"
      >
        <h3 className="text-lg font-semibold">Renew subscription</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Log the renewal payment and set the new expiry date.</p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Amount paid</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              value={renewForm.amountPaid}
              onChange={(event) => onChange('amountPaid', event.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Renewal payment date</label>
            <div className="mt-1">
              <props.DatePickerComponent
                name="paymentDate"
                value={renewForm.paymentDate}
                onChange={(event) => onChange('paymentDate', event.target.value)}
                placeholder="Select date"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">New expiry date</label>
            <div className="mt-1">
              <props.DatePickerComponent
                name="newExpiryDate"
                value={renewForm.newExpiryDate}
                onChange={(event) => onChange('newExpiryDate', event.target.value)}
                placeholder="Select date"
              />
            </div>
          </div>
        </div>

        {renewError && <p className="mt-3 text-sm text-rose-600 dark:text-rose-300">{renewError}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button type="submit" className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
            Save renewal
          </button>
        </div>
      </form>
    </div>
  )
}
