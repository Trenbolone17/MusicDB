const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const SUMMARY_API = 'https://en.wikipedia.org/api/rest_v1/page/summary/';

// Wraps a client from seed/http.js. MusicBrainz links artists to Wikidata, and Wikidata
// links to the English Wikipedia article, whose summary has a short bio and a lead image.
function createWikipedia(client) {
  async function englishTitle(wikidataId) {
    const params = new URLSearchParams({
      action: 'wbgetentities',
      ids: wikidataId,
      props: 'sitelinks',
      sitefilter: 'enwiki',
      format: 'json',
    });
    const data = await client.getJson(`${WIKIDATA_API}?${params}`);
    return data?.entities?.[wikidataId]?.sitelinks?.enwiki?.title ?? null;
  }

  // Returns { bio, imageUrl, wikipediaUrl }, or null when there's no usable article.
  async function summaryFor(wikidataId) {
    const title = await englishTitle(wikidataId);
    if (!title) return null;

    // Titles like "AC/DC" contain slashes, which must be percent-encoded for this API.
    const page = await client.getJson(SUMMARY_API + encodeURIComponent(title.replaceAll(' ', '_')));
    if (!page || page.type !== 'standard' || !page.extract) return null;

    return {
      bio: page.extract,
      imageUrl: page.thumbnail?.source ?? null,
      wikipediaUrl: page.content_urls?.desktop?.page ?? null,
    };
  }

  return { summaryFor };
}

module.exports = { createWikipedia };
