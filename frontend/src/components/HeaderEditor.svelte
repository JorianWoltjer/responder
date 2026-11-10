<script>
  import { tick } from 'svelte'
  import {
    CORS_HEADERS,
    HTTP_HEADERS,
    getHttpHeaderDocsUrl,
    getHttpHeaderExample,
    getHttpHeaderValues,
    hasCORS
  } from '@/utils'
  import Icon from './Icon.svelte'
  import StatusField from './StatusField.svelte'

  let { headers = $bindable(), status = $bindable(), bodyLength = 0 } = $props()

  let corsEnabled = $derived(hasCORS(headers))
  let nextRowId = 1
  let rows = $state([...Array.from(headers, (values) => createRow(values)), createRow()])

  $effect(() => syncExternalHeaders(headers))

  function createRow(values = ['', ''], id = nextRowId++, inputs = []) {
    return { id, values: [...values], inputs }
  }

  function isContentLength(name) {
    return name.trim().toLowerCase() === 'content-length'
  }

  function getValueSuggestions(name) {
    return isContentLength(name) ? [String(bodyLength)] : getHttpHeaderValues(name)
  }

  function headersFromRows(sourceRows) {
    return sourceRows.filter((row) => row.values[0].trim()).map((row) => [...row.values])
  }

  function headersEqual(left, right) {
    return (
      left.length === right.length &&
      left.every(([name, value], index) => name === right[index][0] && value === right[index][1])
    )
  }

  function syncExternalHeaders(nextHeaders) {
    if (headersEqual(nextHeaders, headersFromRows(rows))) return

    const draft = rows.at(-1) ?? createRow()
    const nextRows = Array.from(nextHeaders, (values, index) =>
      createRow(
        values,
        index < rows.length - 1 ? rows[index].id : undefined,
        index < rows.length - 1 ? rows[index].inputs : undefined
      )
    )
    rows = [...nextRows, draft.values[0].trim() ? createRow() : draft]
  }

  function publish(nextRows) {
    rows = nextRows
    headers = headersFromRows(nextRows)
  }

  function updateRow(index, field, value) {
    const next = rows.map((row) => ({ ...row, values: [...row.values] }))
    next[index].values[field] = value
    if (index === next.length - 1 && next[index].values[0].trim()) next.push(createRow())
    publish(next)
  }

  function cleanRows() {
    const draft = rows.at(-1) ?? createRow()
    publish([...rows.slice(0, -1).filter((row) => row.values[0].trim()), draft])
  }

  function removeRow(index) {
    publish(rows.filter((_, rowIndex) => rowIndex !== index))
  }

  function firstDisplayedDatalistValue(input) {
    const query = input.value.toLowerCase()
    const options = Array.from(input.list?.options ?? [])
    const option = options.find(
      ({ disabled, label, value }) =>
        !disabled && (value.toLowerCase().includes(query) || label.toLowerCase().includes(query))
    )
    return option?.value
  }

  async function acceptDatalistAndAdvance(event, index, field) {
    if (event.key !== 'Enter' || event.isComposing) return

    const value = firstDisplayedDatalistValue(event.currentTarget)
    if (value === undefined) return

    event.preventDefault()
    if (event.repeat) return

    updateRow(index, field, value)
    await tick()

    const nextInput = field === 0 ? rows[index]?.inputs[1] : rows[index + 1]?.inputs[0]
    nextInput?.focus()
  }

  function toggleCors() {
    let next = Array.from(headers, (values, index) =>
      createRow(values, rows[index]?.id, rows[index]?.inputs)
    )
    if (corsEnabled) {
      next = next.filter((row) => !Object.hasOwn(CORS_HEADERS, row.values[0]))
    } else {
      next = [
        ...Object.entries(CORS_HEADERS).map((values) => createRow(values)),
        ...next
      ]
    }
    const draft = rows.at(-1) ?? createRow()
    publish([...next, draft])
  }
</script>

<section class="headers-section" aria-labelledby="headers-title">
  <div class="section-heading">
    <h2 id="headers-title">Headers</h2>
  </div>

  <div class="header-status">
    <StatusField bind:status />
    <button
      class:active={corsEnabled}
      class="cors-button"
      type="button"
      aria-pressed={corsEnabled}
      onclick={toggleCors}
    >
      {#if corsEnabled}<Icon name="check" size={14} />{/if}
      CORS
    </button>
  </div>

  <div class="header-table">
    <div class="table-head" aria-hidden="true">
      <span>Name</span><span>Value</span><span></span>
    </div>
    <div class="table-body">
      {#each rows as row, index (row.id)}
        {@const valueExample = getHttpHeaderExample(row.values[0])}
        {@const valueSuggestions = getValueSuggestions(row.values[0])}
        {@const isInputRow = index === rows.length - 1}
        <div class="header-row">
          <input
            bind:this={row.inputs[0]}
            class="header-name-input"
            class:last-row={isInputRow}
            style:grid-row={index + 1}
            aria-label={`Header ${index + 1} name`}
            list="header-names"
            placeholder={isInputRow ? 'Add header…' : 'Header name'}
            value={row.values[0]}
            oninput={(event) => updateRow(index, 0, event.currentTarget.value)}
            onkeydown={(event) => acceptDatalistAndAdvance(event, index, 0)}
            onblur={cleanRows}
          />
          <input
            bind:this={row.inputs[1]}
            class="header-value-input"
            class:last-row={isInputRow}
            style:grid-row={index + 1}
            aria-label={`Header ${index + 1} value`}
            list={valueSuggestions.length ? `header-values-${index}` : undefined}
            placeholder={valueExample || 'Value'}
            value={row.values[1]}
            oninput={(event) => updateRow(index, 1, event.currentTarget.value)}
            onkeydown={(event) => acceptDatalistAndAdvance(event, index, 1)}
            onblur={cleanRows}
          />
          {#if valueSuggestions.length}
            <datalist id={`header-values-${index}`}>
              {#each valueSuggestions as value (value)}
                <option {value}></option>
              {/each}
            </datalist>
          {/if}
        </div>
      {/each}
      {#each rows as row, index (row.id)}
        {@const docsUrl = getHttpHeaderDocsUrl(row.values[0])}
        {@const isInputRow = index === rows.length - 1}
        <div
          class="row-actions"
          class:last-row={isInputRow}
          style:grid-row={index + 1}
          style:grid-column="3"
        >
          {#if docsUrl}
            <a
              class="docs-link"
              href={docsUrl}
              target="_blank"
              rel="noreferrer"
              title="Read documentation on MDN"
              aria-label={`Read ${row.values[0]} documentation on MDN`}
            >
              <Icon name="book" size={16} />
            </a>
          {/if}
          {#if !isInputRow}
            <button
              class="remove-button"
              type="button"
              title="Remove header"
              aria-label={`Remove ${row.values[0] || 'header'}`}
              onclick={() => removeRow(index)}
            >
              <Icon name="trash" size={15} />
            </button>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <datalist id="header-names">
    {#each HTTP_HEADERS as header (header)}
      <option value={header}></option>
    {/each}
  </datalist>
</section>

<style>
  .headers-section {
    display: flex;
    flex: 1;
    min-height: 0;
    flex-direction: column;
  }

  .section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .header-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 650;
    letter-spacing: -0.01em;
  }

  .cors-button {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    min-width: 5rem;
    justify-content: center;
    min-height: 2.5rem;
    padding: 0.5rem 0.85rem;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    background: var(--surface-raised);
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .cors-button.active {
    color: #07140c;
    border-color: var(--accent);
    background: var(--accent);
  }

  .cors-button:hover:not(.active) {
    border-color: var(--accent-muted);
    color: var(--text);
  }

  .cors-button.active:hover {
    border-color: var(--accent-hover);
    background: var(--accent-hover);
  }

  .header-table {
    overflow-y: auto;
    flex: 0 1 auto;
    min-height: 0;
    border: 1px solid var(--border);
    border-radius: 0;
    background: var(--surface-inset);
  }

  .table-head,
  .table-body {
    display: grid;
    grid-template-columns: minmax(8rem, 0.9fr) minmax(8rem, 1.1fr) 4.5rem;
  }

  .header-row {
    display: contents;
  }

  .table-head {
    position: sticky;
    z-index: 1;
    top: 0;
    padding: 0 0.05rem;
    border-bottom: 1px solid var(--border);
    color: var(--text-subtle);
    background:
      linear-gradient(rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0.018)),
      var(--surface-inset);
    font-size: 0.78rem;
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .table-head span {
    padding: 0.7rem 0.85rem;
  }

  .header-name-input {
    grid-column: 1;
  }

  .header-value-input {
    grid-column: 2;
  }

  .header-row input {
    min-width: 0;
    min-height: 3.15rem;
    padding: 0.75rem 0.85rem;
    border: 0;
    border-right: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    border-radius: 0;
    color: var(--text);
    background: transparent;
    font-family: var(--font-mono);
    font-size: 0.9rem;
    outline: 0;
  }

  .header-row input:focus {
    background: rgba(94, 232, 139, 0.045);
    box-shadow: inset 0 0 0 1px var(--accent-muted);
  }

  .header-row input:hover:not(:focus) {
    border-right-color: var(--border);
    border-bottom-color: var(--border);
    background: var(--interactive-hover);
  }

  .row-actions {
    display: flex;
    justify-content: flex-end;
    min-width: 0;
    min-height: 3.15rem;
    border-bottom: 1px solid var(--border);
  }

  .header-row input.last-row,
  .row-actions.last-row {
    border-bottom: 0;
  }

  .docs-link,
  .remove-button {
    display: grid;
    width: 2.25rem;
    height: 100%;
    place-items: center;
    color: var(--text-subtle);
    background: transparent;
  }

  .docs-link {
    text-decoration: none;
  }

  .docs-link:hover {
    color: #8cb4ff;
    background: rgba(140, 180, 255, 0.08);
  }

  .remove-button {
    border: 0;
  }

  .remove-button:hover {
    color: var(--danger);
    background: rgba(255, 111, 111, 0.07);
  }

  @media (max-width: 480px) {
    .table-head,
    .table-body {
      grid-template-columns: minmax(7rem, 0.9fr) minmax(7rem, 1.1fr) 4.5rem;
    }
  }

  @media (max-width: 980px) {
    .headers-section {
      flex: none;
    }

    .header-table {
      overflow-y: hidden;
    }
  }
</style>
