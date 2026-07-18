export interface WikiResult {
  title: string;
  thumbnailUrl: string | null;
}

export function buildSearchUrl(query: string): string {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrlimit: '6',
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: '128',
    format: 'json',
    origin: '*',
  });
  return `https://fortnite.fandom.com/api.php?${params.toString().replace(/\+/g, '%20')}`;
}

interface RawPage {
  index?: number;
  title?: string;
  thumbnail?: { source?: string };
}

export function parseSearchResponse(json: unknown): WikiResult[] {
  const pages = (json as { query?: { pages?: Record<string, RawPage> } } | null)?.query?.pages;
  if (!pages) return [];
  return Object.values(pages)
    .filter((p): p is RawPage & { title: string } => typeof p?.title === 'string')
    .sort((a, b) => (a.index ?? 99) - (b.index ?? 99))
    .map((p) => ({ title: p.title, thumbnailUrl: p.thumbnail?.source ?? null }));
}

export async function searchWikiIcons(query: string): Promise<WikiResult[]> {
  let res: Response;
  try {
    res = await fetch(buildSearchUrl(query));
  } catch {
    throw new Error('Wiki unreachable');
  }
  if (!res.ok) throw new Error('Wiki unreachable');
  return parseSearchResponse(await res.json());
}

export async function toDataUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

export async function findIconUrl(name: string): Promise<string | null> {
  try {
    const results = await searchWikiIcons(`${name} schematic`);
    const hit = results.find((r) => r.thumbnailUrl);
    if (!hit?.thumbnailUrl) return null;
    return await toDataUrl(hit.thumbnailUrl);
  } catch {
    return null;
  }
}
