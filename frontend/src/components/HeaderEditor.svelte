<script>
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

  export let headers
  export let status

  $: corsEnabled = hasCORS(headers)
  let rows = [...Array.from(headers), ['', '']]
  let lastHeaders = headers

  $: syncExternalHeaders(headers)

  function syncExternalHeaders(nextHeaders) {
    if (nextHeaders === lastHeaders) return
    const draft = rows.at(-1) ?? ['', '']
    rows = [...Array.from(nextHeaders), draft[0].trim() ? ['', ''] : draft]
    lastHeaders = nextHeaders
  }

  function publish(nextRows) {
    rows = nextRows
    const nextHeaders = new Map(nextRows.filter(([name]) => name.trim()))
    lastHeaders = nextHeaders
    headers = nextHeaders
  }

  function updateRow(index, field, value) {
    const next = rows.map((row) => [...row])
    next[index][field] = value
    if (index === next.length - 1 && next[index][0].trim()) next.push(['', ''])
    publish(next)
  }

  function cleanRows() {
    const draft = rows.at(-1) ?? ['', '']
    publish([...rows.slice(0, -1).filter(([name]) => name.trim()), draft])
  }

  function removeRow(index) {
    publish(rows.filter((_, rowIndex) => rowIndex !== index))
  }

  function openDatalist(event) {
    const input = event.currentTarget
    if (!input.list || typeof input.showPicker !== 'function') return

    try {
      input.showPicker()
    } catch {
      // Some browsers require a user activation or do not support datalist pickers.
    }
  }

  function toggleCors() {
    const next = new Map(headers)
    if (corsEnabled) {
      Object.keys(CORS_HEADERS).forEach((name) => next.delete(name))
    } else {
      Object.entries(CORS_HEADERS).forEach(([name, value]) => next.set(name, value))
    }
    const draft = rows.at(-1) ?? ['', '']
    publish([...Array.from(next), draft])
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
      on:click={toggleCors}
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
      {#each rows as row, index (index)}
        {@const valueExample = getHttpHeaderExample(row[0])}
        {@const valueSuggestions = getHttpHeaderValues(row[0])}
        {@const isInputRow = index === rows.length - 1}
        <div class="header-row">
          <input
            class="header-name-input"
            class:last-row={isInputRow}
            style:grid-row={index + 1}
            aria-label={`Header ${index + 1} name`}
            list="header-names"
            placeholder={isInputRow ? 'Add header…' : 'Header name'}
            value={row[0]}
            on:input={(event) => updateRow(index, 0, event.currentTarget.value)}
            on:focus={openDatalist}
            on:blur={cleanRows}
          />
          <input
            class="header-value-input"
            class:last-row={isInputRow}
            style:grid-row={index + 1}
            aria-label={`Header ${index + 1} value`}
            list={valueSuggestions.length ? `header-values-${index}` : undefined}
            placeholder={valueExample || 'Value'}
            value={row[1]}
            on:input={(event) => updateRow(index, 1, event.currentTarget.value)}
            on:focus={openDatalist}
            on:blur={cleanRows}
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
      {#each rows as row, index (index)}
        {@const docsUrl = getHttpHeaderDocsUrl(row[0])}
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
              aria-label={`Read ${row[0]} documentation on MDN`}
            >
              <Icon name="book" size={16} />
            </a>
          {/if}
          {#if !isInputRow}
            <button
              class="remove-button"
              type="button"
              title="Remove header"
              aria-label={`Remove ${row[0] || 'header'}`}
              on:click={() => removeRow(index)}
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
    min-height: 0;
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

  .header-table {
    overflow: hidden;
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
    padding: 0 0.05rem;
    border-bottom: 1px solid var(--border);
    color: var(--text-subtle);
    background: rgba(255, 255, 255, 0.018);
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
</style>
