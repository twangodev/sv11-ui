---
title: Usage
description: How to use svagent-ui components in your SvelteKit application.
---

Once a svagent-ui component is installed, you can import it and use it in your application like any other Svelte component. The components are copied into your codebase (not hidden in a library), so you can freely edit them to suit your specific needs.

---

## Example

After installing svagent-ui components, you can use them in your application like any other Svelte component. For example:

```svelte
<script lang="ts">
	import { Orb } from "$lib/registry/ui/orb";
	import { Card } from "$lib/registry/ui/card";
</script>

<Card class="flex items-center justify-center p-8">
	<Orb />
</Card>
```
