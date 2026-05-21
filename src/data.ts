const archiveBase = `${import.meta.env.BASE_URL}archive/`;

export async function fetchArchiveJson<T>(path: string): Promise<T> {
  const response = await fetch(`${archiveBase}${path}`);
  if (!response.ok) {
    throw new Error(`Unable to load archive/${path}: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function formatNumber(value: number | undefined, digits = 0): string {
  if (value === undefined || Number.isNaN(value)) {
    return "-";
  }
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function formatDate(value: number | undefined): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function teamDisplay(
  teamKey: string | undefined,
  teamNames: Map<string, string>,
): string {
  if (!teamKey) {
    return "Unknown";
  }
  return teamNames.get(teamKey) ?? teamKey;
}
