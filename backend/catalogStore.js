'use strict';
async function seedCatalog(client, products) {
  for (const product of products) {
    // Existing prices and stocks are managed in the database; never reset them on sync.
    await client.query(
      `INSERT INTO product (id, name_fr, name_en, unit, price_usd, image_url, category, stock_qty, catalog_group)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         name_fr = EXCLUDED.name_fr,
         name_en = EXCLUDED.name_en,
         unit = EXCLUDED.unit,
         image_url = EXCLUDED.image_url,
         category = EXCLUDED.category,
         catalog_group = EXCLUDED.catalog_group,
         stock_qty = COALESCE(product.stock_qty, EXCLUDED.stock_qty)`,
      [product.id, product.name_fr, product.name_en, product.unit, product.price, product.img, product.category, product.stock, product.catalog_group || null]
    );
  }
}

module.exports = { seedCatalog };
