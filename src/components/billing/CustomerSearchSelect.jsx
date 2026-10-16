import { useEffect, useMemo, useRef, useState } from "react"

function CustomerSearchSelect({ disabled, onChange, options, value }) {
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const selectedOption = options.find((option) => option.value === value) ?? options[0]
  const visibleOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return options
    return options.filter((option) => option.label.toLocaleLowerCase().includes(normalizedQuery))
  }, [options, query])

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
        setQuery("")
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick)
    return () => document.removeEventListener("mousedown", closeOnOutsideClick)
  }, [])

  function selectOption(option) {
    onChange(option.value)
    setOpen(false)
    setQuery("")
    inputRef.current?.blur()
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      setOpen(false)
      setQuery("")
      return
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      const direction = event.key === "ArrowDown" ? 1 : -1
      setActiveIndex((current) => Math.max(0, Math.min(visibleOptions.length - 1, current + direction)))
      return
    }

    if (event.key === "Enter" && open && visibleOptions[activeIndex]) {
      event.preventDefault()
      selectOption(visibleOptions[activeIndex])
    }
  }

  return (
    <div className="customer-search-select" ref={rootRef}>
      <input
        aria-activedescendant={open && visibleOptions[activeIndex] ? `customer-option-${visibleOptions[activeIndex].value}` : undefined}
        aria-autocomplete="list"
        aria-controls="customer-search-options"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Search and select customer"
        autoComplete="off"
        className="customer-search-select-input"
        disabled={disabled}
        onChange={(event) => {
          setQuery(event.target.value)
          setActiveIndex(0)
          setOpen(true)
        }}
        onFocus={() => {
          setQuery("")
          setActiveIndex(0)
          setOpen(true)
        }}
        onKeyDown={handleKeyDown}
        placeholder="Select or search customer"
        ref={inputRef}
        role="combobox"
        value={open ? query : selectedOption?.label ?? ""}
      />
      {open && (
        <div className="customer-search-options" id="customer-search-options" role="listbox">
          {visibleOptions.length ? visibleOptions.map((option, index) => (
            <button
              aria-selected={option.value === value}
              className={[
                "customer-search-option",
                option.value === value ? "selected" : "",
                index === activeIndex ? "active" : "",
              ].filter(Boolean).join(" ")}
              id={`customer-option-${option.value}`}
              key={option.value}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectOption(option)}
              role="option"
              type="button"
            >
              {option.label}
            </button>
          )) : (
            <p className="customer-search-empty">No matching customers</p>
          )}
        </div>
      )}
    </div>
  )
}

export default CustomerSearchSelect
