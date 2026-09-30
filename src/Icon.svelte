<script lang="ts">
  let { name, size = 20 }: { name: string; size?: number } = $props();
  const paths: Record<string, string> = {
    monitor: 'M3 4h18v13H3z M8 21h8 M12 17v4',
    plus: 'M12 5v14 M5 12h14',
    search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    refresh: 'M20 7v5h-5 M4 17v-5h5 M5 8a8 8 0 0 1 13-3l2 3 M19 16a8 8 0 0 1-13 3l-2-3',
    lock: 'M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0v4 M12 14v3',
    unlock: 'M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0 M12 14v3',
    check: 'M5 12l4 4L19 6',
    grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    layers: 'M12 3 2 8l10 5 10-5-10-5 M2 12l10 5 10-5 M2 16l10 5 10-5',
    play: 'm8 4 12 8-12 8V4Z',
    edit: 'm15 5 4 4 M4 20l5-1L21 7l-4-4L5 15l-1 5',
    trash: 'M3 6h18 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7',
    upload: 'M12 16V3 M7 8l5-5 5 5 M4 15v6h16v-6',
    close: 'm6 6 12 12 M18 6 6 18',
    logout: 'M9 3H3v18h6 M9 12h12 M16 7l5 5-5 5',
    info: 'M12 16v-4 M12 8h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    arrow: 'M4 12h16 M15 7l5 5-5 5',
    more: 'M5 12h.01 M12 12h.01 M19 12h.01',
  };
</script>
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.monitor} /></svg>
