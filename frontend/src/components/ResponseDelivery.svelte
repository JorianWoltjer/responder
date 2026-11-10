<script>
  import { onDestroy } from 'svelte'
  import Icon from './Icon.svelte'

  let {
    filename,
    delay = $bindable(0),
    url,
    onfilename,
    onopen,
    onpasteurl,
    onusegist,
    ontoast
  } = $props()

  let copied = $state(false)
  let copiedTimer

  function updateFilename(event) {
    onfilename?.(event.currentTarget.value)
  }

  function selectUrl(event) {
    event.currentTarget.select()
  }

  function pasteUrl(event) {
    const pastedUrl = event.clipboardData?.getData('text/plain').trim()
    if (!pastedUrl) return

    event.preventDefault()
    onpasteurl?.(pastedUrl)
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(`${location.origin}${url}`)
      copied = true
      clearTimeout(copiedTimer)
      copiedTimer = setTimeout(() => {
        copied = false
        copiedTimer = undefined
      }, 1600)
    } catch {
      ontoast?.('Could not copy URL', 'Select the URL and copy it manually.', 'warning', 5000)
    }
  }

  onDestroy(() => clearTimeout(copiedTimer))
</script>

<section class="delivery" aria-labelledby="delivery-title">
  <h2 id="delivery-title">Response URL</h2>
  <div class="delivery-options">
    <label class="compact-field path-field">
      <span>Path</span>
      <span class="input-prefix-wrap">
        <span class="input-prefix">/</span>
        <input
          value={filename}
          placeholder="poc.html"
          aria-label="Response path"
          oninput={updateFilename}
        />
      </span>
    </label>
    <label class="compact-field delay-field">
      <span>Delay</span>
      <span class="delay-wrap">
        <Icon name="clock" size={17} />
        <input
          bind:value={delay}
          type="number"
          min="0"
          max="300000"
          aria-label="Response delay in milliseconds"
        />
        <span>ms</span>
      </span>
    </label>
  </div>
  <div class="url-box">
    <input
      value={url}
      readonly
      aria-label="Generated response URL"
      title="Paste a response URL to load it"
      onfocus={selectUrl}
      onpaste={pasteUrl}
    />
    <button type="button" onclick={copyUrl} title="Copy full URL" aria-label="Copy full URL">
      <Icon name={copied ? 'check' : 'copy'} size={17} />
    </button>
    <button class="open-response-button" type="button" onclick={onopen}>
      Open response
      <Icon name="external" size={15} />
    </button>
  </div>
  {#if url.length > 8192}
    <p class="url-warning">
      This URL is longer than 8,192 characters and may not load.
      <button type="button" onclick={onusegist}>Use a gist instead</button>.
    </p>
  {/if}
</section>

<style>
  .delivery {
    margin-top: auto;
    padding: 1.5rem 0 0;
    border-top: 1px solid var(--border);
  }

  h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 650;
  }

  .delivery-options {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 1rem;
    margin: 1rem 0;
  }

  .compact-field {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.65rem;
    color: var(--text-muted);
    font-size: 0.85rem;
    font-weight: 600;
  }

  .compact-field input {
    font-weight: 400;
  }

  .path-field {
    min-width: 0;
  }

  .input-prefix-wrap,
  .delay-wrap {
    display: flex;
    align-items: center;
  }

  .input-prefix-wrap {
    position: relative;
    min-width: 0;
  }

  .input-prefix {
    position: absolute;
    z-index: 1;
    left: 0.7rem;
    color: var(--text-subtle);
    font-family: var(--font-mono);
    font-size: 0.95rem;
    pointer-events: none;
  }

  .input-prefix-wrap input {
    min-width: 0;
    width: 100%;
    min-height: 2.75rem;
    padding: 0.52rem 0.65rem 0.52rem 1.25rem;
    font-family: var(--font-mono);
    font-size: 0.95rem;
  }

  .delay-field {
    gap: 0.4rem;
  }

  .delay-wrap {
    gap: 0.5rem;
    color: var(--text-subtle);
  }

  .delay-wrap input {
    width: 6.5rem;
    min-height: 2.75rem;
    padding: 0.5rem 0.6rem;
    text-align: right;
    font-family: var(--font-mono);
    font-size: 0.95rem;
  }

  .delay-wrap span {
    font-family: var(--font-mono);
    font-size: 0.85rem;
  }

  .url-box {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 3rem auto;
    margin: 1rem 0;
    border: 1px solid var(--border-strong);
    background: var(--surface-inset);
    transition:
      border-color 140ms ease,
      box-shadow 140ms ease;
  }

  .url-box:hover {
    border-color: rgba(231, 255, 239, 0.25);
  }

  .url-box:focus-within {
    border-color: var(--accent-muted);
    box-shadow: 0 0 0 3px rgba(94, 232, 139, 0.07);
  }

  .url-box input {
    min-width: 0;
    min-height: 3rem;
    padding: 0.75rem 0.9rem;
    border: 0;
    border-radius: 0;
    color: #b8c4bc;
    background: transparent;
    box-shadow: none;
    font-family: var(--font-mono);
    font-size: 0.85rem;
  }

  .url-box button {
    display: grid;
    place-items: center;
    border: 0;
    border-left: 1px solid var(--border);
    color: var(--text-muted);
    background: transparent;
  }

  .url-box button:hover {
    color: var(--accent);
    background: rgba(94, 232, 139, 0.05);
  }

  .url-box .open-response-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    min-height: 3rem;
    padding: 0 1rem;
    border-left-color: rgba(0, 0, 0, 0.25);
    color: #06120a;
    background: var(--accent);
    font-size: 0.9rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .url-box .open-response-button:hover {
    color: #06120a;
    background: var(--accent-hover);
  }

  .url-warning {
    margin: 0.5rem 0 0;
    color: var(--warning);
    font-size: 0.75rem;
    line-height: 1.4;
  }

  .url-warning button {
    padding: 0;
    border: 0;
    color: inherit;
    background: transparent;
    font-size: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .url-warning button:hover {
    color: var(--text);
  }

  @media (max-width: 620px) {
    .delivery {
      padding-right: 0;
      padding-left: 0;
    }
  }
</style>
