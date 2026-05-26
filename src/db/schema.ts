import { Schema, Table, column } from "@powersync/web";

// Minimal first-slice schema: products + product_variants.
// Extend table-by-table as each vertical slice is migrated.
export const AppSchema = new Schema({
  products: new Table({
    name: column.text,
    description: column.text,
    price: column.real,
    stock_quantity: column.real,
    category_id: column.text,
    image_url: column.text,
    is_available: column.integer,
    is_available_online: column.integer,
    created_at: column.text,
    updated_at: column.text,
  }),
  product_variants: new Table({
    product_id: column.text,
    name: column.text,
    price: column.real,
    stock_quantity: column.real,
    sku: column.text,
  }),
});

export type Database = (typeof AppSchema)["types"];