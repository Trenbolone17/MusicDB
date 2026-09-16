// Turns catalog API items into the rows RankedList renders. Shared by the charts, search,
// featured, home, and admin pages, so every list shows an item the same way.
export const ROW_BUILDERS = {
  tracks: (item) => ({
    href: `/tracks/${item.id}`,
    image: item.album.coverUrl,
    imageAlt: `${item.album.title} cover`,
    title: item.title,
    // Film songs are catalogued under the composer; show the singers when they're credited.
    subtitle: `${item.credit ?? item.artist.name} · ${item.album.title}`,
  }),
  albums: (item) => ({
    href: `/albums/${item.id}`,
    image: item.coverUrl,
    imageAlt: `${item.title} cover`,
    title: item.title,
    subtitle: [item.artist.name, item.releaseYear].filter(Boolean).join(' · '),
  }),
  artists: (item) => ({ href: `/artists/${item.id}`, image: item.imageUrl, imageAlt: item.name, title: item.name }),
};

export function toRows(typeKey, items) {
  return items.map((item) => ({
    rank: item.rank,
    ratingAverage: item.ratingAverage,
    ratingCount: item.ratingCount,
    ...ROW_BUILDERS[typeKey](item),
  }));
}
