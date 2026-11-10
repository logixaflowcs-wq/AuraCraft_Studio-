// FIX(audit-3-F): encode all selected OBS source settings in a stable URL contract.
export function buildObsSourceUrl(origin: string, background: string, resolution: string): string {
  const params = new URLSearchParams({ obs: 'true', bg: background, resolution });
  return origin + '/?' + params.toString();
}
