export default function SettingsModal({
  exportStatus,
  isDesktopRuntime,
  onCancel,
  onChange,
  onExportBackup,
  onSave,
  onSyncOpenClaw,
  settingsError,
  settingsForm,
  visible,
}) {
  if (!visible) return null

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto overscroll-contain bg-slate-950/40 px-4 py-6">
      <div className="pointer-events-auto mx-auto my-2 w-full max-w-lg rounded-2xl bg-white p-5 shadow-soft dark:bg-slate-900 dark:ring-1 dark:ring-slate-800 sm:my-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Settings</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage app defaults, backups, and OpenClaw reminder sync.</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
            onClick={onCancel}
          >
            Close
          </button>
        </div>

        <div className="mt-4 grid gap-4">
          <div>
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Theme</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              value={settingsForm.themePreference}
              onChange={(event) => onChange('themePreference', event.target.value)}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Analytics range</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                value={settingsForm.analyticsDefaultRangeMonths}
                onChange={(event) => onChange('analyticsDefaultRangeMonths', Number(event.target.value))}
              >
                <option value={6}>6 months</option>
                <option value={12}>12 months</option>
                <option value={24}>24 months</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Reminder lead time</label>
              <input
                type="number"
                min="1"
                max="30"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                value={settingsForm.defaultReminderDays}
                onChange={(event) => onChange('defaultReminderDays', Number(event.target.value))}
              />
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700">
            <input
              type="checkbox"
              checked={settingsForm.backupsEnabled}
              onChange={(event) => onChange('backupsEnabled', event.target.checked)}
            />
            <span>Enable backups for this device</span>
          </label>

          <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700">
            <input
              type="checkbox"
              checked={settingsForm.openclawSyncEnabled}
              onChange={(event) => onChange('openclawSyncEnabled', event.target.checked)}
            />
            <span>Sync active renewals into OpenClaw reminders</span>
          </label>

          {settingsError && <p className="text-sm text-rose-600 dark:text-rose-300">{settingsError}</p>}
          {exportStatus && <p className="text-sm text-emerald-600 dark:text-emerald-300">{exportStatus}</p>}

          <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                onClick={onExportBackup}
                disabled={!isDesktopRuntime}
              >
                Export full backup
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                onClick={onSyncOpenClaw}
                disabled={!isDesktopRuntime}
              >
                Sync OpenClaw now
              </button>
            </div>
            <button
              type="button"
              className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
              onClick={onSave}
            >
              Save settings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
