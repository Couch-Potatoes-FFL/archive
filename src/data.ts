const archiveBase = `${import.meta.env.BASE_URL}archive/`;
const absoluteUrlPattern = /^(?:[a-z][a-z\d+.-]*:)?\/\//i;

export async function fetchArchiveJson<T>(path: string): Promise<T> {
  const response = await fetch(`${archiveBase}${path}`);
  if (!response.ok) {
    throw new Error(`Unable to load archive/${path}: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function archivePublicUrl(pathOrUrl: string | undefined): string | undefined {
  if (!pathOrUrl) {
    return undefined;
  }
  if (absoluteUrlPattern.test(pathOrUrl) || pathOrUrl.startsWith("data:")) {
    return pathOrUrl;
  }
  return `${import.meta.env.BASE_URL}${pathOrUrl.replace(/^\/+/, "")}`;
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

export function formatTimestamp(value: string | number | undefined): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${month}/${day}/${year} ${hours}:${minutes}`;
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
