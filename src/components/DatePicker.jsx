import { useEffect, useRef, useState } from 'react'
import { formatDateLocal } from '../subscriptionLogic'

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const weekDayLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const startOfDay = (value) => {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

const DatePicker = ({ name, value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const selectedDate = value ? startOfDay(`${value}T00:00:00`) : null
  const [viewDate, setViewDate] = useState(selectedDate || startOfDay(new Date()))

  useEffect(() => {
    if (!isOpen) return

    const handleOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])


  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const dayCells = Array.from({ length: 42 }, (_, index) => {
    const dayNumber = index - firstDayIndex + 1
    if (dayNumber < 1 || dayNumber > daysInMonth) return null
    return dayNumber
  })

  const selectDate = (dayNumber) => {
    const date = new Date(year, month, dayNumber)
    const nextValue = formatDateLocal(date)
    onChange({ target: { name, value: nextValue } })
    setViewDate(date)
    setIsOpen(false)
  }

  const togglePicker = () => {
    if (!isOpen) {
      setViewDate(selectedDate || startOfDay(new Date()))
    }
    setIsOpen((open) => !open)
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
        onClick={togglePicker}
      >
        {value || placeholder}
      </button>

      {isOpen && (
        <div className="absolute left-0 z-[70] mt-2 w-[18rem] rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between gap-1 text-xs font-semibold">
            <button type="button" className="rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setViewDate(new Date(year, month - 1, 1))}>
              ←
            </button>
            <span className="text-sm">{monthLabels[month]} {year}</span>
            <button type="button" className="rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setViewDate(new Date(year, month + 1, 1))}>
              →
            </button>
          </div>

          <div className="mb-2 flex items-center justify-center gap-2 text-xs">
            <button type="button" className="rounded border border-slate-200 px-2 py-1 hover:border-brand-300 dark:border-slate-700" onClick={() => setViewDate(new Date(year - 5, month, 1))}>-5Y</button>
            <button type="button" className="rounded border border-slate-200 px-2 py-1 hover:border-brand-300 dark:border-slate-700" onClick={() => setViewDate(new Date(year + 5, month, 1))}>+5Y</button>
          </div>

          <div className="mb-3 grid grid-cols-4 gap-1 text-xs">
            {monthLabels.map((label, monthIndex) => (
              <button
                key={label}
                type="button"
                className={`rounded px-1 py-1.5 ${monthIndex === month ? 'bg-brand-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                onClick={() => setViewDate(new Date(year, monthIndex, 1))}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 dark:text-slate-400">
            {weekDayLabels.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1 text-sm">
            {dayCells.map((dayNumber, index) => {
              if (!dayNumber) return <span key={`empty-${index}`} className="h-8" />

              const isSelected =
                selectedDate &&
                selectedDate.getFullYear() === year &&
                selectedDate.getMonth() === month &&
                selectedDate.getDate() === dayNumber

              return (
                <button
                  key={`${year}-${month}-${dayNumber}`}
                  type="button"
                  className={`h-8 rounded ${isSelected ? 'bg-brand-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  onClick={() => selectDate(dayNumber)}
                >
                  {dayNumber}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default DatePicker
