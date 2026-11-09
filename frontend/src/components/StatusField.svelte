<script>
  import { getReasonPhrase } from 'http-status-codes'

  let { status = $bindable(200) } = $props()

  let reason = $derived.by(() => {
    try {
      return getReasonPhrase(status)
    } catch {
      return 'Unknown status'
    }
  })

  function update(event) {
    const value = event.currentTarget.valueAsNumber
    if (!Number.isNaN(value)) status = value
  }

  function normalize() {
    status = Math.min(699, Math.max(100, status || 200))
  }
</script>

<label class="status-field">
  <span class="label">Status</span>
  <span class="status-control">
    <input type="number" min="100" max="699" value={status} oninput={update} onblur={normalize} />
    <span class="reason">{reason}</span>
  </span>
</label>

<style>
  .status-field {
    display: grid;
    grid-template-columns: 6rem 1fr;
    align-items: center;
    gap: 0.8rem;
  }

  .label {
    color: var(--text-muted);
    font-size: 0.95rem;
    font-weight: 600;
  }

  .status-control {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    min-width: 0;
  }

  input {
    width: 6rem;
    min-height: 2.75rem;
    padding: 0.6rem 0.75rem;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 1rem;
    font-variant-numeric: tabular-nums;
  }

  .reason {
    overflow: hidden;
    color: var(--text);
    font-size: 0.95rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
