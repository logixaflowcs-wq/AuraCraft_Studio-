// FIX(audit-3-H): keep third-party image prompts within the documented input limit.
export function limitPollinationsPrompt(value: string): string {
  return value.slice(0, 1000);
}
