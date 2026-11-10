<script>
  import Icon from './Icon.svelte'

  let {
    language = $bindable('html'),
    activePanel,
    previewOpen,
    onlanguagechange,
    onpanelchange,
    onpreviewtoggle
  } = $props()

  const languages = [
    { value: 'html', label: 'HTML' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'json', label: 'JSON' },
    { value: 'xml', label: 'XML / SVG' },
    { value: 'css', label: 'CSS' },
    { value: 'plain', label: 'Plain text' }
  ]

  function changeLanguage(event) {
    language = event.currentTarget.value
    onlanguagechange?.(language)
  }
</script>

<div class="editor-bar">
  <div class="editor-actions">
    <label class="language-select">
      <span class="sr-only">Language</span>
      <Icon name="code" size={17} />
      <select class="syntax-select" value={language} onchange={changeLanguage}>
        <button type="button">
          <selectedcontent></selectedcontent>
        </button>
        <div class="syntax-options-header" aria-hidden="true">LANGUAGE</div>
        {#each languages as item (item.value)}
          <option class="language-option" value={item.value}>
            <span class="language-label">{item.label}</span>
          </option>
        {/each}
      </select>
    </label>
    <button
      class="tool-button text-button"
      class:active={activePanel === 'csrf'}
      type="button"
      onclick={() => onpanelchange?.('csrf')}
      title="Generate a CSRF proof of concept"
      aria-pressed={activePanel === 'csrf'}
    >
      <Icon name="wand" size={15} />
      <span>CSRF PoC</span>
    </button>
    <button
      class="tool-button text-button"
      class:active={activePanel === 'gist'}
      type="button"
      onclick={() => onpanelchange?.('gist')}
      title="Use a GitHub gist as the response body"
      aria-pressed={activePanel === 'gist'}
    >
      <Icon name="github" size={15} />
      <span>Gist</span>
    </button>
    <button
      class="tool-button preview-button"
      class:active={previewOpen}
      type="button"
      onclick={onpreviewtoggle}
      title="Toggle live preview (Ctrl+P)"
      aria-label="Toggle live preview"
      aria-keyshortcuts="Control+P Meta+P"
      aria-pressed={previewOpen}
    >
      <Icon name={previewOpen ? 'eye' : 'eye-off'} size={17} />
    </button>
  </div>
</div>

<style>
  .editor-bar {
    display: flex;
    align-items: stretch;
    justify-content: flex-start;
    gap: 0;
    height: 3.25rem;
    min-height: 3.25rem;
    padding: 0;
    border-top: 1px solid var(--border);
  }

  .editor-actions,
  .language-select,
  .tool-button {
    display: flex;
    align-items: center;
  }

  .editor-actions {
    align-items: stretch;
    width: 100%;
    height: 100%;
  }

  .language-select {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.55rem;
    min-width: 10.5rem;
    height: 100%;
    padding-left: 1rem;
    border-right: 1px solid var(--border);
    color: var(--text-muted);
    transition:
      border-color 140ms ease,
      background 140ms ease,
      box-shadow 140ms ease;
  }

  .language-select::after {
    position: absolute;
    top: 50%;
    right: 0.9rem;
    width: 0.45rem;
    height: 0.45rem;
    border-right: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    content: '';
    pointer-events: none;
    transform: translateY(-70%) rotate(45deg);
  }

  .language-select:hover {
    color: var(--text);
    background: var(--surface-raised);
  }

  .language-select:focus-within {
    color: var(--accent);
    background: var(--surface-raised);
    box-shadow: inset 0 -2px var(--accent);
  }

  select {
    min-width: 8rem;
    width: 100%;
    height: 100%;
    padding: 0 2.5rem 0 0;
    border: 0;
    appearance: none;
    color: var(--text);
    background: transparent;
    box-shadow: none;
    font-size: 0.84rem;
    font-weight: 560;
    letter-spacing: -0.01em;
    outline: 0;
  }

  select:focus {
    box-shadow: none;
  }

  option {
    color: var(--text);
    background: #181818;
  }

  @supports (appearance: base-select) {
    .language-select::after {
      display: none;
    }

    .syntax-select,
    .syntax-select::picker(select) {
      appearance: base-select;
    }

    .syntax-select {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      padding-right: 0.85rem;
    }

    .syntax-select > button {
      display: flex;
      flex: 1;
      align-items: center;
      align-self: stretch;
      width: auto;
      min-width: 0;
      padding: 0;
      border: 0;
      color: inherit;
      background: transparent;
    }

    .syntax-select selectedcontent,
    .language-option {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }

    .syntax-select selectedcontent .language-label {
      color: var(--accent);
    }

    .syntax-select::picker-icon {
      flex: none;
      align-self: center;
      color: var(--text-subtle);
      transition:
        color 140ms ease,
        rotate 180ms ease;
    }

    .syntax-select:hover::picker-icon,
    .syntax-select:focus::picker-icon {
      color: var(--accent);
    }

    .syntax-select:open::picker-icon {
      rotate: 180deg;
    }

    .syntax-select::picker(select) {
      min-width: 13.5rem;
      max-height: min(22rem, 60vh);
      max-height: min(22rem, 60dvh);
      margin-block: 0.4rem;
      padding: 0.35rem;
      border: 1px solid var(--border-strong);
      border-radius: 6px;
      color: var(--text);
      background: #181818;
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.42);
      opacity: 0;
      transform: translateY(-0.25rem);
      transition:
        opacity 140ms ease,
        transform 140ms ease,
        display 140ms allow-discrete,
        overlay 140ms allow-discrete;
    }

    .syntax-select:open::picker(select) {
      opacity: 1;
      transform: translateY(0);
    }

    .syntax-options-header {
      margin: 0 0.4rem 0.25rem;
      padding: 0.35rem 0.35rem 0.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      color: var(--text-subtle);
      font-size: 0.62rem;
      font-weight: 750;
      letter-spacing: 0.12em;
      line-height: 1;
      pointer-events: none;
    }

    @starting-style {
      .syntax-select:open::picker(select) {
        opacity: 0;
        transform: translateY(-0.25rem);
      }
    }

    .language-option {
      min-height: 2.6rem;
      padding: 0.65rem 0.75rem;
      border: 0;
      border-radius: 3px;
      color: var(--text-muted);
      background: transparent;
      font-size: 0.82rem;
      font-weight: 560;
      cursor: pointer;
    }

    .language-option:hover,
    .language-option:focus {
      color: var(--text);
      background: rgba(255, 255, 255, 0.055);
    }

    .language-option:checked {
      color: #07140c;
      background: var(--accent);
    }

    .language-option::checkmark {
      order: 1;
      margin-left: auto;
      color: #07140c;
      content: '✓';
      font-size: 0.8rem;
      font-weight: 800;
    }
  }

  .tool-button {
    justify-content: center;
    width: 3.25rem;
    height: 100%;
    border: 0;
    border-right: 1px solid var(--border);
    border-radius: 0;
    color: var(--text-muted);
    background: transparent;
  }

  .tool-button.text-button {
    gap: 0.4rem;
    width: auto;
    padding: 0 0.85rem;
    font-size: 0.82rem;
    font-weight: 600;
  }

  .preview-button {
    margin-left: auto;
    border-right: 0;
    border-left: 1px solid var(--border);
  }

  .tool-button:hover,
  .tool-button.active {
    color: var(--text);
    background: var(--surface-raised);
  }

  .tool-button.active {
    color: var(--accent);
    background: rgba(94, 232, 139, 0.07);
    box-shadow: inset 0 -2px var(--accent);
  }

  @media (max-width: 620px) {
    .language-select {
      min-width: 9rem;
    }

    select {
      min-width: 6rem;
    }

    .tool-button.text-button {
      padding: 0 0.7rem;
    }
  }

  @media (max-width: 440px) {
    .tool-button.text-button {
      width: 2.75rem;
      padding: 0;
    }

    .tool-button.text-button span {
      display: none;
    }
  }
</style>
