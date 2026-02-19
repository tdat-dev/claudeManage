export function shortenPathForCli(path: string, maxLength = 48): string {
  if (!path || path.length <= maxLength) {
    return path;
  }

  const segments = path.split(/[\\/]/).filter(Boolean);
  if (segments.length === 0) {
    return path;
  }

  const tail = segments.slice(-2).join("/");
  const driveMatch = path.match(/^[A-Za-z]:[\\/]/);
  const prefix = driveMatch ? `${driveMatch[0].replace("\\", "/")}.../` : ".../";
  const compact = `${prefix}${tail}`;

  if (compact.length <= maxLength) {
    return compact;
  }

  const keep = Math.max(8, Math.floor((maxLength - 3) / 2));
  return `${path.slice(0, keep)}...${path.slice(-keep)}`;
}
