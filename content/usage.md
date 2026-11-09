---
title: Usage
description: How to use sv11-ui components in your SvelteKit application.
---

Once a sv11-ui component is installed, you can import it and use it in your application like any other Svelte component. The components are copied into your codebase (not hidden in a library), so you can freely edit them to suit your specific needs.

---

## Example

After installing sv11-ui components, you can use them in your application like any other Svelte component. For example:

```svelte
<script lang="ts">
	import { Orb } from "$lib/components/ui/orb";
	import { Card } from "$lib/components/ui/card";
</script>

<Card class="flex h-64 items-center justify-center p-8">
	<Orb />
</Card>
```
