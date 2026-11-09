<script>
  export let name
  export let size = 18
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if name === 'eye'}
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
    <circle cx="12" cy="12" r="2.5" />
  {:else if name === 'eye-off'}
    <path
      d="m3 3 18 18M10.6 6.2A10.7 10.7 0 0 1 12 6c6.5 0 10 6 10 6a14 14 0 0 1-2.1 2.8M6.6 6.6C3.6 8.3 2 12 2 12s3.5 6 10 6c1.7 0 3.2-.4 4.5-1"
    />
  {:else if name === 'external'}
    <path d="M15 3h6v6M10 14 21 3M18 13v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h7" />
  {:else if name === 'copy'}
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
  {:else if name === 'check'}
    <path d="m4 12 5 5L20 6" />
  {:else if name === 'trash'}
    <path d="M4 7h16M9 3h6l1 4H8l1-4ZM6 7l1 14h10l1-14M10 11v6M14 11v6" />
  {:else if name === 'plus'}
    <path d="M12 5v14M5 12h14" />
  {:else if name === 'clock'}
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  {:else if name === 'code'}
    <path d="m8 9-3 3 3 3M16 9l3 3-3 3M14 5l-4 14" />
  {:else if name === 'info'}
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  {:else if name === 'book'}
    <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2V4Z" />
    <path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7V4Z" />
  {:else if name === 'github'}
    <path
      d="M15 22v-3.9c0-1 .1-1.4-.5-2 2.8-.3 5.7-1.4 5.7-6.2 0-1.4-.5-2.5-1.3-3.4.1-.3.6-1.6-.1-3.4 0 0-1.1-.3-3.6 1.3a12.4 12.4 0 0 0-6.5 0C6.2 2.7 5.1 3 5.1 3c-.7 1.8-.2 3.1-.1 3.4a4.9 4.9 0 0 0-1.3 3.4c0 4.8 2.9 5.9 5.7 6.2-.4.4-.6.8-.7 1.4-.6.3-2.6.8-3.7-1.1 0 0-.7-1.3-2-1.4 0 0-1.3 0-.1.8 0 0 .9.4 1.5 1.8 0 0 .8 2.1 2.7 4.2 1.5V22"
    />
  {:else if name === 'close'}
    <path d="m6 6 12 12M18 6 6 18" />
  {:else if name === 'wand'}
    <path d="m15 4 5 5L8 21H3v-5L15 4ZM13 6l5 5M6 4V2M5 3H3M20 18v4M18 20h4" />
  {/if}
</svg>
