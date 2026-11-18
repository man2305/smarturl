/** Poll until `condition` is true (for fire-and-forget side effects). */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeoutMs = 3000,
  label = 'condition'
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${label}`);
}
