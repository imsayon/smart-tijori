INSERT INTO stores VALUES
  ('blr-01', 'SmartTijori Bengaluru', 'Bengaluru'),
  ('mys-01', 'SmartTijori Mysuru', 'Mysuru')
ON CONFLICT DO NOTHING;

INSERT INTO products (id, name, category, purpose, price_paise, pack_quantity, pack_unit, attributes) VALUES
  ('detergent-front-1l', 'Clear Day Front Load Liquid', 'household', 'front-load-detergent', 24900, 1000, 'ml', '{"machineType":"front-load"}'),
  ('detergent-front-15l', 'Fresh Linen Front Load Liquid', 'household', 'front-load-detergent', 28900, 1500, 'ml', '{"machineType":"front-load"}'),
  ('detergent-front-2l', 'Rain Wash Front Load Liquid', 'household', 'front-load-detergent', 37900, 2000, 'ml', '{"machineType":"front-load"}'),
  ('detergent-front-500', 'Cloud Wash Front Load Liquid', 'household', 'front-load-detergent', 14900, 500, 'ml', '{"machineType":"front-load"}'),
  ('detergent-top-1l', 'Clear Day Top Load Liquid', 'household', 'top-load-detergent', 21900, 1000, 'ml', '{"machineType":"top-load"}'),
  ('detergent-hand-1kg', 'Sun Wash Handwash Powder', 'household', 'handwash-detergent', 13900, 1000, 'g', '{"machineType":"hand-wash"}'),
  ('dish-liquid-500', 'Lime Dishwash Liquid', 'household', 'dishwashing', 10900, 500, 'ml', '{}'),
  ('dish-liquid-1l', 'Lemon Dishwash Refill', 'household', 'dishwashing', 17900, 1000, 'ml', '{}'),
  ('tissues-100', 'Soft Paper Tissues', 'household', 'tissues', 6900, 100, 'count', '{}'),
  ('tissues-200', 'Soft Paper Tissues Twin Pack', 'household', 'tissues', 11900, 200, 'count', '{}'),
  ('tea-250', 'Nilgiri Black Tea', 'pantry', 'black-tea', 15000, 250, 'g', '{"leaf":"black"}'),
  ('tea-500', 'Assam Black Tea', 'pantry', 'black-tea', 26000, 500, 'g', '{"leaf":"black"}'),
  ('tea-green-25', 'Green Tea Bags', 'pantry', 'green-tea', 15500, 25, 'count', '{"leaf":"green"}'),
  ('coffee-100', 'Filter Coffee', 'pantry', 'filter-coffee', 13500, 100, 'g', '{}'),
  ('coffee-200', 'Dark Filter Coffee', 'pantry', 'filter-coffee', 25000, 200, 'g', '{}'),
  ('rice-1kg', 'Sona Masuri Rice', 'pantry', 'everyday-rice', 7500, 1000, 'g', '{}'),
  ('rice-5kg', 'Sona Masuri Rice Family Pack', 'pantry', 'everyday-rice', 35900, 5000, 'g', '{}'),
  ('oats-500', 'Classic Rolled Oats', 'pantry', 'rolled-oats', 10900, 500, 'g', '{}'),
  ('oats-1kg', 'Whole Rolled Oats', 'pantry', 'rolled-oats', 19900, 1000, 'g', '{}'),
  ('dal-500', 'Toor Dal', 'pantry', 'toor-dal', 9500, 500, 'g', '{}'),
  ('dal-1kg', 'Toor Dal Family Pack', 'pantry', 'toor-dal', 17900, 1000, 'g', '{}'),
  ('oil-1l', 'Sunflower Cooking Oil', 'pantry', 'sunflower-oil', 16500, 1000, 'ml', '{}'),
  ('oil-2l', 'Sunflower Cooking Oil Twin Pack', 'pantry', 'sunflower-oil', 31900, 2000, 'ml', '{}'),
  ('salt-1kg', 'Iodized Table Salt', 'pantry', 'table-salt', 2900, 1000, 'g', '{}')
ON CONFLICT DO NOTHING;

INSERT INTO inventory (store_id, product_id, stock_on_hand)
SELECT stores.id, products.id,
  CASE WHEN stores.id = 'blr-01' AND products.id IN ('detergent-front-1l', 'tea-250') THEN 1
       WHEN stores.id = 'mys-01' AND products.id = 'detergent-front-15l' THEN 0
       ELSE 8 END
FROM stores CROSS JOIN products
WHERE stores.id IN ('blr-01', 'mys-01')
  AND products.id IN (
    'detergent-front-1l', 'detergent-front-15l', 'detergent-front-2l', 'detergent-front-500',
    'detergent-top-1l', 'detergent-hand-1kg', 'dish-liquid-500', 'dish-liquid-1l',
    'tissues-100', 'tissues-200', 'tea-250', 'tea-500', 'tea-green-25', 'coffee-100',
    'coffee-200', 'rice-1kg', 'rice-5kg', 'oats-500', 'oats-1kg', 'dal-500',
    'dal-1kg', 'oil-1l', 'oil-2l', 'salt-1kg'
  )
ON CONFLICT DO NOTHING;

INSERT INTO product_barcodes (barcode, product_id)
SELECT 'ST:' || id, id FROM products
WHERE EXISTS (SELECT 1 FROM inventory WHERE product_id = products.id AND store_id = 'blr-01')
ON CONFLICT DO NOTHING;
