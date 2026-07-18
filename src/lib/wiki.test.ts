import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSearchUrl, parseSearchResponse, searchWikiIcons, toDataUrl, findIconUrl } from './wiki';

afterEach(() => vi.unstubAllGlobals());

describe('buildSearchUrl', () => {
  it('encodes query and requests CORS + pageimages', () => {
    const url = buildSearchUrl('Nocturno sword');
    expect(url).toContain('https://fortnite.fandom.com/api.php');
    expect(url).toContain('origin=*');
    expect(url).toContain('generator=search');
    expect(url).toContain('gsrsearch=Nocturno%20sword');
    expect(url).toContain('prop=pageimages');
  });
});

describe('parseSearchResponse', () => {
  it('maps pages to results sorted by search index', () => {
    const json = {
      query: {
        pages: {
          '1': { index: 2, title: 'Siegebreaker', thumbnail: { source: 'https://img/s.png' } },
          '2': { index: 1, title: 'Nocturno', thumbnail: { source: 'https://img/n.png' } },
          '3': { index: 3, title: 'No Image Page' },
        },
      },
    };
    expect(parseSearchResponse(json)).toEqual([
      { title: 'Nocturno', thumbnailUrl: 'https://img/n.png' },
      { title: 'Siegebreaker', thumbnailUrl: 'https://img/s.png' },
      { title: 'No Image Page', thumbnailUrl: null },
    ]);
  });
  it('returns empty array for empty/odd responses', () => {
    expect(parseSearchResponse({})).toEqual([]);
    expect(parseSearchResponse(null)).toEqual([]);
  });
});

describe('searchWikiIcons', () => {
  it('throws readable error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fail')));
    await expect(searchWikiIcons('x')).rejects.toThrow('Wiki unreachable');
  });

  it('resolves parsed results on a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          query: { pages: { '1': { index: 1, title: 'Nocturno', thumbnail: { source: 'https://img/n.png' } } } },
        }),
      }),
    );
    await expect(searchWikiIcons('Nocturno')).resolves.toEqual([
      { title: 'Nocturno', thumbnailUrl: 'https://img/n.png' },
    ]);
  });

  it('throws readable error when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(searchWikiIcons('x')).rejects.toThrow('Wiki unreachable');
  });
});

describe('toDataUrl', () => {
  it('falls back to original url on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('cors')));
    await expect(toDataUrl('https://img/n.png')).resolves.toBe('https://img/n.png');
  });

  it('falls back to original url when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(toDataUrl('https://img/n.png')).resolves.toBe('https://img/n.png');
  });
});

describe('findIconUrl', () => {
  it('returns the first thumbnail (hotlink fallback when conversion fails)', async () => {
    const searchResponse = {
      query: { pages: { '1': { index: 1, title: 'Swan', thumbnail: { source: 'https://img/s.png' } } } },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => searchResponse }).mockRejectedValueOnce(new TypeError('cors')),
    );
    await expect(findIconUrl('Swan')).resolves.toBe('https://img/s.png');
  });

  it('returns null on wiki failure or empty results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('down')));
    await expect(findIconUrl('Swan')).resolves.toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    await expect(findIconUrl('Swan')).resolves.toBeNull();
  });
});
