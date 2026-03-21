export default function DeleteSubscriptionModal({ deletingSubscription, onCancel, onConfirm }) {
  if (!deletingSubscription) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 px-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-soft dark:bg-slate-900 dark:ring-1 dark:ring-slate-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-subscription-title"
        aria-describedby="delete-subscription-description"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="delete-subscription-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Delete subscription?
        </h3>
        <p id="delete-subscription-description" className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          This will permanently remove <span className="font-semibold text-slate-700 dark:text-slate-200">{deletingSubscription.name}</span> from your tracker.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
