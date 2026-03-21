export default function SubscriptionForm(props) {
  const {
    billingOptions,
    categoryOptions,
    editingId,
    errorMessage,
    formState,
    handleChange,
    handleDateChange,
    handleSubmit,
    resetForm,
    statusOptions,
  } = props
  return (
    <div className="rounded-2xl bg-white p-6 shadow-soft dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
      <h2 className="text-xl font-semibold">{editingId ? 'Edit subscription' : 'Add subscription'}</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">Capture the next renewal in seconds.</p>

      <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmit}>
        <div>
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Name</label>
          <input
            name="name"
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
            value={formState.name}
            onChange={handleChange}
            placeholder="e.g. Netflix"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Cost</label>
            <input
              name="amount"
              type="number"
              min="0"
              step="0.01"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
              value={formState.amount}
              onChange={handleChange}
              placeholder="15.99"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Billing cycle</label>
            <select
              name="billingCycle"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
              value={formState.billingCycle}
              onChange={handleChange}
            >
              {billingOptions.map((cycle) => (
                <option key={cycle} value={cycle}>
                  {cycle}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Category</label>
            <select
              name="category"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
              value={formState.category}
              onChange={handleChange}
            >
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Status</label>
            <select
              name="status"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
              value={formState.status}
              onChange={handleChange}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>
        {formState.category === 'Other' && (
          <div>
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Custom category label</label>
            <input
              name="categoryDetail"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
              value={formState.categoryDetail}
              onChange={handleChange}
              placeholder="e.g. Cloud storage"
            />
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Current payment</label>
            <div className="mt-1">
              <props.DatePickerComponent
                name="currentPayment"
                value={formState.currentPayment}
                onChange={handleDateChange}
                placeholder="Select date"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Next payment</label>
            <div className="mt-1">
              <props.DatePickerComponent
                name="nextPayment"
                value={formState.nextPayment}
                onChange={handleDateChange}
                placeholder="Select date"
              />
            </div>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Subscription link</label>
          <input
            name="link"
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
            value={formState.link}
            onChange={handleChange}
            placeholder="https://example.com/manage"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Notes</label>
          <textarea
            name="notes"
            className="mt-1 min-h-[90px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
            value={formState.notes}
            onChange={handleChange}
            placeholder="Plan details, renewal notes, etc."
          />
        </div>

        {errorMessage && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMessage}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600"
          >
            {editingId ? 'Save changes' : 'Add subscription'}
          </button>
          {editingId && (
            <button
              type="button"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
              onClick={resetForm}
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
