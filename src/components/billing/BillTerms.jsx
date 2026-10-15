function BillTerms({ terms }) {
  const items = Array.isArray(terms)
    ? terms.map((term) => term.trim()).filter(Boolean)
    : typeof terms === "string"
      ? terms.split(/\r?\n/).map((term) => term.trim()).filter(Boolean)
      : []

  if (!items.length) return null

  return (
    <section aria-label="Terms and conditions" className="bill-terms">
      <strong>Terms &amp; Conditions</strong>
      <ol>
        {items.map((term, index) => <li key={`${index}-${term}`}>{term}</li>)}
      </ol>
    </section>
  )
}

export default BillTerms
