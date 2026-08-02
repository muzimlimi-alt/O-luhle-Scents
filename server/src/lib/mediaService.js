// Keeps MediaAsset/ProductMedia in sync with a product's legacy `images`
// JSON array — which stays the actual source of truth for rendering, so the
// storefront and existing admin gallery are untouched. This is what lets the
// Media Library exist without a risky full cutover: every product save
// mirrors its filenames into structured records automatically, and that's
// where alt text (the concrete new capability) gets attached.
export async function syncProductMedia(tx, productId, filenames) {
  const existingLinks = await tx.productMedia.findMany({
    where: { productId },
    include: { media: true }
  })
  const existingByFilename = Object.fromEntries(existingLinks.map(l => [l.media.storageKey, l]))

  for (const link of existingLinks) {
    if (!filenames.includes(link.media.storageKey)) {
      await tx.productMedia.delete({ where: { id: link.id } })
    }
  }

  for (let i = 0; i < filenames.length; i++) {
    const filename = filenames[i]
    const link = existingByFilename[filename]

    if (!link) {
      let asset = await tx.mediaAsset.findUnique({ where: { storageKey: filename } })
      if (!asset) {
        asset = await tx.mediaAsset.create({
          data: { filename, storageKey: filename, mediaType: 'IMAGE' }
        })
      }
      await tx.productMedia.create({
        data: { productId, mediaId: asset.id, sortOrder: i, isPrimary: i === 0 }
      })
    } else if (link.sortOrder !== i || link.isPrimary !== (i === 0)) {
      await tx.productMedia.update({
        where: { id: link.id },
        data: { sortOrder: i, isPrimary: i === 0 }
      })
    }
  }
}
