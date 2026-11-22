-- OPT-IN ILLUSTRATIVE DATA ONLY. Not real participating merchants or observed inventory.
-- Geography names refer to real Indian towns/market areas; shop identities,
-- prices, stock and purchase eligibility are synthetic demonstration fixtures.
-- Run only in a disposable/explicitly approved st_* schema, not as normal migrations.
INSERT INTO stores (id, name, city) VALUES
  ('dm-blr-jay-kr', 'Jayanagar 4th Block Kirana', 'Bengaluru'),
  ('dm-blr-krm-vg', 'KR Market Vegetable Stall', 'Bengaluru'),
  ('dm-blr-ind-sm', 'Indiranagar Mini Supermarket', 'Bengaluru'),
  ('dm-mys-dev-sp', 'Devaraja Market Spice Shop', 'Mysuru'),
  ('dm-chi-ctl-kr', 'Mylapore Corner Kirana', 'Chennai'),
  ('dm-coi-rsp-sm', 'RS Puram Neighbourhood Mart', 'Coimbatore'),
  ('dm-mdu-mat-vg', 'Mattuthavani Produce Stall', 'Madurai'),
  ('dm-kum-twn-te', 'Kumbakonam Town Tea & Grocery', 'Kumbakonam'),
  ('dm-mum-dad-kr', 'Dadar West Kirana', 'Mumbai'),
  ('dm-pun-tul-bz', 'Tulsi Baug Street Market', 'Pune'),
  ('dm-nsk-pan-vg', 'Panchavati Produce Seller', 'Nashik'),
  ('dm-bar-mkt-vg', 'Baramati Market Yard Vendor', 'Baramati'),
  ('dm-kol-gar-fs', 'Gariahat Fish Seller', 'Kolkata'),
  ('dm-kol-new-sm', 'New Market Grocery Mart', 'Kolkata'),
  ('dm-sil-bid-sp', 'Bidhan Market Spice Shop', 'Siliguri'),
  ('dm-bis-twn-kr', 'Bishnupur Town Kirana', 'Bishnupur'),
  ('dm-del-sar-sm', 'Sarojini Nagar Grocery Mart', 'New Delhi'),
  ('dm-del-kha-sp', 'Khari Baoli Spice Trader', 'New Delhi'),
  ('dm-hyd-beg-kr', 'Begum Bazaar Kirana', 'Hyderabad'),
  ('dm-war-han-vg', 'Hanamkonda Vegetable Seller', 'Warangal'),
  ('dm-ahm-man-kr', 'Manek Chowk Kirana', 'Ahmedabad'),
  ('dm-sur-ada-sm', 'Adajan Family Supermarket', 'Surat'),
  ('dm-bhv-mai-st', 'Bhavnagar Main Bazaar Street Stall', 'Bhavnagar'),
  ('dm-jai-joh-kr', 'Johari Bazaar Corner Kirana', 'Jaipur'),
  ('dm-uda-hat-sp', 'Hathi Pole Spice Merchant', 'Udaipur'),
  ('dm-dau-old-vg', 'Dausa Old Market Vendor', 'Dausa'),
  ('dm-lko-ami-kr', 'Aminabad Kirana', 'Lucknow'),
  ('dm-var-god-kr', 'Godowlia Grocery Shop', 'Varanasi'),
  ('dm-gor-gol-vg', 'Golghar Produce Stall', 'Gorakhpur'),
  ('dm-pat-bor-kr', 'Boring Road Kirana', 'Patna'),
  ('dm-gay-tow-kr', 'Tower Chowk Grocery', 'Gaya'),
  ('dm-bhu-uni-vg', 'Unit 1 Market Vegetable Stall', 'Bhubaneswar'),
  ('dm-cut-cho-kr', 'Choudhury Bazar Kirana', 'Cuttack'),
  ('dm-guw-fan-kr', 'Fancy Bazaar Grocery Shop', 'Guwahati'),
  ('dm-nag-tow-vg', 'Nagaon Town Market Seller', 'Nagaon'),
  ('dm-ran-upp-kr', 'Upper Bazar Kirana', 'Ranchi'),
  ('dm-dha-ban-hh', 'Bank More Household Shop', 'Dhanbad'),
  ('dm-koc-bro-sp', 'Broadway Spice Counter', 'Kochi'),
  ('dm-pal-sul-kr', 'Sultanpet Grocery Shop', 'Palakkad'),
  ('dm-ind-raj-kr', 'Rajwada Kirana', 'Indore'),
  ('dm-bho-new-sm', 'New Market Supermarket', 'Bhopal'),
  ('dm-viz-dwa-kr', 'Dwaraka Nagar Kirana', 'Visakhapatnam'),
  ('dm-raj-mai-vg', 'Rajahmundry Produce Seller', 'Rajahmundry'),
  ('dm-rai-gol-kr', 'Gol Bazar Kirana', 'Raipur'),
  ('dm-amr-hal-bk', 'Hall Bazaar Bakery Counter', 'Amritsar'),
  ('dm-deh-pal-kr', 'Paltan Bazar Grocery Shop', 'Dehradun'),
  ('dm-sri-lal-dr', 'Lal Chowk Dry Fruit Seller', 'Srinagar'),
  ('dm-asm-maj-ha', 'Garamur Weekly Haat', 'Majuli'),
  ('dm-nag-kho-ha', 'Khonoma Village Produce Stall', 'Khonoma'),
  ('dm-ker-kum-fi', 'Kumarakom Fish Counter', 'Kumarakom'),
  ('dm-guj-dho-kr', 'Dholavira Village Kirana', 'Dholavira'),
  ('dm-tam-ath-kr', 'Athangudi Village Provision Store', 'Athangudi'),
  ('dm-raj-man-kr', 'Mandawa Bazaar General Store', 'Mandawa'),
  ('dm-hp-kaz-kr', 'Kaza Town Grocery Counter', 'Kaza'),
  ('dm-sik-nam-vg', 'Namchi Market Vegetable Seller', 'Namchi')
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, name, category, purpose, price_paise, pack_quantity, pack_unit, attributes) VALUES
  ('demo-tomato-500g', 'Fresh Tomatoes', 'essentials', 'fresh-vegetable', 2800, 500, 'g', '{}'::jsonb),
  ('demo-onion-1kg', 'Red Onions', 'essentials', 'fresh-vegetable', 4500, 1000, 'g', '{}'::jsonb),
  ('demo-potato-1kg', 'Everyday Potatoes', 'essentials', 'fresh-vegetable', 3500, 1000, 'g', '{}'::jsonb),
  ('demo-lemon-6ct', 'Fresh Lemons', 'essentials', 'fresh-fruit', 3000, 6, 'count', '{}'::jsonb),
  ('demo-banana-12ct', 'Local Bananas (12 pcs)', 'essentials', 'fresh-fruit', 6500, 12, 'count', '{}'::jsonb),
  ('demo-apple-1kg', 'Seasonal Apples', 'essentials', 'fresh-fruit', 18000, 1000, 'g', '{}'::jsonb),
  ('demo-coconut-1ct', 'Fresh Coconut', 'essentials', 'fresh-fruit', 4500, 1, 'count', '{}'::jsonb),
  ('demo-spinach-250g', 'Fresh Spinach Bunch', 'essentials', 'leafy-greens', 2500, 250, 'g', '{}'::jsonb),
  ('demo-coriander-100g', 'Fresh Coriander Leaves', 'essentials', 'leafy-greens', 1800, 100, 'g', '{}'::jsonb),
  ('demo-milk-500ml', 'Full Cream Milk', 'essentials', 'dairy-milk', 3300, 500, 'ml', '{"storage":"chilled"}'::jsonb),
  ('demo-curd-400g', 'Plain Curd', 'essentials', 'dairy-curd', 4500, 400, 'g', '{"storage":"chilled"}'::jsonb),
  ('demo-eggs-6ct', 'Farm Eggs (Pack of 6)', 'essentials', 'eggs', 4500, 6, 'count', '{}'::jsonb),
  ('demo-bread-400g', 'Fresh Sandwich Bread', 'essentials', 'bakery-bread', 4500, 400, 'g', '{}'::jsonb),
  ('demo-snack-200g', 'Masala Namkeen', 'pantry', 'savory-snacks', 5800, 200, 'g', '{}'::jsonb),
  ('demo-atta-5kg', 'Whole Wheat Atta', 'pantry', 'wheat-flour', 24500, 5000, 'g', '{}'::jsonb),
  ('demo-besan-500g', 'Gram Flour (Besan)', 'pantry', 'gram-flour', 5900, 500, 'g', '{}'::jsonb),
  ('demo-chana-1kg', 'Chana Dal', 'pantry', 'chana-dal', 11500, 1000, 'g', '{}'::jsonb),
  ('demo-ragi-1kg', 'Ragi Flour', 'pantry', 'millet-flour', 7200, 1000, 'g', '{}'::jsonb),
  ('demo-poha-500g', 'Thick Poha', 'pantry', 'flattened-rice', 6000, 500, 'g', '{}'::jsonb),
  ('demo-idlirice-1kg', 'Idli Rice', 'pantry', 'idli-rice', 7600, 1000, 'g', '{}'::jsonb),
  ('demo-mustard-1l', 'Mustard Cooking Oil', 'pantry', 'mustard-oil', 18500, 1000, 'ml', '{}'::jsonb),
  ('demo-groundnut-1l', 'Groundnut Cooking Oil', 'pantry', 'groundnut-oil', 19200, 1000, 'ml', '{}'::jsonb),
  ('demo-jaggery-1kg', 'Jaggery', 'pantry', 'jaggery', 9000, 1000, 'g', '{}'::jsonb),
  ('demo-turmeric-100g', 'Ground Turmeric', 'pantry', 'spice-turmeric', 3900, 100, 'g', '{}'::jsonb),
  ('demo-cumin-100g', 'Cumin Seeds', 'pantry', 'spice-cumin', 6900, 100, 'g', '{}'::jsonb),
  ('demo-chilli-100g', 'Red Chilli Powder', 'pantry', 'spice-chilli', 4900, 100, 'g', '{}'::jsonb),
  ('demo-cardamom-50g', 'Green Cardamom', 'pantry', 'spice-cardamom', 18000, 50, 'g', '{}'::jsonb),
  ('demo-tea-250g', 'Loose Black Tea', 'pantry', 'black-tea', 16000, 250, 'g', '{}'::jsonb),
  ('demo-dry-fruit-250g', 'Raisins', 'pantry', 'dry-fruit', 12000, 250, 'g', '{}'::jsonb),
  ('demo-almonds-250g', 'Whole Almonds', 'pantry', 'dry-fruit', 24000, 250, 'g', '{}'::jsonb),
  ('demo-toothpaste-150g', 'Fluoride Toothpaste', 'essentials', 'oral-care', 9500, 150, 'g', '{}'::jsonb),
  ('demo-soap-100g', 'Bath Soap', 'essentials', 'body-care', 3500, 100, 'g', '{}'::jsonb),
  ('demo-shampoo-180ml', 'Daily Shampoo', 'essentials', 'hair-care', 13500, 180, 'ml', '{}'::jsonb),
  ('demo-sanitary-8ct', 'Sanitary Pads (Pack of 8)', 'essentials', 'menstrual-care', 8900, 8, 'count', '{}'::jsonb),
  ('demo-washbar-200g', 'Laundry Washing Bar', 'household', 'laundry-soap', 2800, 200, 'g', '{}'::jsonb),
  ('demo-cleaner-1l', 'Floor Cleaning Liquid', 'household', 'floor-cleaner', 9000, 1000, 'ml', '{}'::jsonb),
  ('demo-dishbar-200g', 'Dishwashing Bar', 'household', 'dishwashing', 3300, 200, 'g', '{}'::jsonb),
  ('demo-water-1l', 'Drinking Water Bottle', 'essentials', 'drinking-water', 2000, 1000, 'ml', '{}'::jsonb),
  ('demo-rohu-500g', 'Rohu Fish (Portion)', 'essentials', 'fresh-fish', 12500, 500, 'g', '{"storage":"chilled"}'::jsonb),
  ('demo-sardines-500g', 'Fresh Sardines', 'essentials', 'fresh-fish', 9500, 500, 'g', '{"storage":"chilled"}'::jsonb),
  ('demo-prawns-500g', 'Fresh Prawns', 'essentials', 'fresh-seafood', 22000, 500, 'g', '{"storage":"chilled"}'::jsonb),
  ('demo-bajra-1kg', 'Pearl Millet (Bajra)', 'pantry', 'millet-grain', 6800, 1000, 'g', '{}'::jsonb),
  ('demo-sona-masoori-1kg', 'Sona Masoori Rice', 'pantry', 'everyday-rice', 8400, 1000, 'g', '{}'::jsonb),
  ('demo-assam-joha-500g', 'Joha Aromatic Rice', 'pantry', 'aromatic-rice', 9000, 500, 'g', '{}'::jsonb),
  ('demo-mustard-greens-250g', 'Mustard Greens Bunch', 'essentials', 'leafy-greens', 2900, 250, 'g', '{}'::jsonb),
  ('demo-ginger-250g', 'Fresh Ginger', 'essentials', 'fresh-vegetable', 4000, 250, 'g', '{}'::jsonb),
  ('demo-ladakh-apricot-250g', 'Dried Apricots', 'pantry', 'dry-fruit', 22000, 250, 'g', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Pack name and size follow manufacturer listings. Store offers remain illustrative.
INSERT INTO products (id, name, category, purpose, price_paise, pack_quantity, pack_unit, attributes, image_url) VALUES
  ('demo-aashirvaad-shudh-chakki-5kg', 'Aashirvaad Shudh Chakki Atta, 5 kg', 'pantry', 'wheat-flour', 29500, 5000, 'g', '{"brand":"Aashirvaad"}'::jsonb,
   'https://shop.aashirvaad.com/shudhchakki/quality_certificate_dhc_od/assets/sku_1_shudh_chakki_150_by_150.jpg'),
  ('demo-india-gate-classic-1kg', 'India Gate Classic Basmati Rice, 1 kg', 'pantry', 'basmati-rice', 24500, 1000, 'g', '{"brand":"India Gate"}'::jsonb,
   'https://krblrice.com/wp-content/uploads/2024/05/IG-Classic-Basmati-Rice.png')
ON CONFLICT (id) DO NOTHING;

WITH profiles(store_id, kind) AS (
  VALUES
  ('dm-blr-jay-kr', 'kirana'),
  ('dm-blr-krm-vg', 'vegetable'),
  ('dm-blr-ind-sm', 'supermarket'),
  ('dm-mys-dev-sp', 'spices'),
  ('dm-chi-ctl-kr', 'kirana'),
  ('dm-coi-rsp-sm', 'supermarket'),
  ('dm-mdu-mat-vg', 'vegetable'),
  ('dm-kum-twn-te', 'kirana'),
  ('dm-mum-dad-kr', 'kirana'),
  ('dm-pun-tul-bz', 'street'),
  ('dm-nsk-pan-vg', 'vegetable'),
  ('dm-bar-mkt-vg', 'vegetable'),
  ('dm-kol-gar-fs', 'fish'),
  ('dm-kol-new-sm', 'supermarket'),
  ('dm-sil-bid-sp', 'spices'),
  ('dm-bis-twn-kr', 'kirana'),
  ('dm-del-sar-sm', 'supermarket'),
  ('dm-del-kha-sp', 'spices'),
  ('dm-hyd-beg-kr', 'kirana'),
  ('dm-war-han-vg', 'vegetable'),
  ('dm-ahm-man-kr', 'kirana'),
  ('dm-sur-ada-sm', 'supermarket'),
  ('dm-bhv-mai-st', 'street'),
  ('dm-jai-joh-kr', 'kirana'),
  ('dm-uda-hat-sp', 'spices'),
  ('dm-dau-old-vg', 'vegetable'),
  ('dm-lko-ami-kr', 'kirana'),
  ('dm-var-god-kr', 'kirana'),
  ('dm-gor-gol-vg', 'vegetable'),
  ('dm-pat-bor-kr', 'kirana'),
  ('dm-gay-tow-kr', 'kirana'),
  ('dm-bhu-uni-vg', 'vegetable'),
  ('dm-cut-cho-kr', 'kirana'),
  ('dm-guw-fan-kr', 'kirana'),
  ('dm-nag-tow-vg', 'vegetable'),
  ('dm-ran-upp-kr', 'kirana'),
  ('dm-dha-ban-hh', 'household'),
  ('dm-koc-bro-sp', 'spices'),
  ('dm-pal-sul-kr', 'kirana'),
  ('dm-ind-raj-kr', 'kirana'),
  ('dm-bho-new-sm', 'supermarket'),
  ('dm-viz-dwa-kr', 'kirana'),
  ('dm-raj-mai-vg', 'vegetable'),
  ('dm-rai-gol-kr', 'kirana'),
  ('dm-amr-hal-bk', 'bakery'),
  ('dm-deh-pal-kr', 'kirana'),
  ('dm-sri-lal-dr', 'dry-fruit'),
  ('dm-asm-maj-ha', 'haat'),
  ('dm-nag-kho-ha', 'haat'),
  ('dm-ker-kum-fi', 'fish'),
  ('dm-guj-dho-kr', 'kirana'),
  ('dm-tam-ath-kr', 'kirana'),
  ('dm-raj-man-kr', 'kirana'),
  ('dm-hp-kaz-kr', 'kirana'),
  ('dm-sik-nam-vg', 'vegetable')
)
INSERT INTO inventory (store_id, product_id, stock_on_hand)
SELECT profiles.store_id, products.id,
  CASE
    WHEN get_byte(decode(md5(profiles.store_id || ':' || products.id), 'hex'), 0) % 16 = 0 THEN 0
    WHEN get_byte(decode(md5(profiles.store_id || ':' || products.id), 'hex'), 0) % 16 = 1 THEN 1
    ELSE 3 + (get_byte(decode(md5(profiles.store_id || ':' || products.id), 'hex'), 0) % 24)
  END
FROM profiles
JOIN products ON products.id LIKE 'demo-%'
WHERE
  profiles.kind = 'supermarket'
  OR (profiles.kind = 'kirana' AND products.purpose NOT IN ('fresh-fish', 'fresh-seafood', 'dry-fruit'))
  OR (profiles.kind = 'vegetable' AND products.purpose IN ('fresh-vegetable', 'fresh-fruit', 'leafy-greens', 'drinking-water'))
  OR (profiles.kind = 'street' AND products.purpose IN ('fresh-vegetable', 'fresh-fruit', 'leafy-greens', 'savory-snacks', 'drinking-water'))
  OR (profiles.kind = 'haat' AND products.purpose IN ('fresh-vegetable', 'fresh-fruit', 'leafy-greens', 'eggs', 'aromatic-rice', 'millet-grain'))
  OR (profiles.store_id = 'dm-hp-kaz-kr' AND products.id = 'demo-ladakh-apricot-250g')
  OR (profiles.kind = 'spices' AND (products.purpose LIKE 'spice-%' OR products.purpose IN ('black-tea', 'dry-fruit', 'jaggery', 'flattened-rice')))
  OR (profiles.kind = 'fish' AND products.purpose IN ('fresh-fish', 'fresh-seafood', 'drinking-water'))
  OR (profiles.kind = 'household' AND products.category = 'household')
  OR (profiles.kind = 'bakery' AND products.purpose IN ('bakery-bread', 'eggs', 'dairy-milk', 'dairy-curd', 'savory-snacks'))
  OR (profiles.kind = 'dry-fruit' AND products.purpose IN ('dry-fruit', 'spice-cardamom', 'black-tea'))
ON CONFLICT (store_id, product_id) DO NOTHING;

INSERT INTO product_barcodes (barcode, product_id)
SELECT 'ST:' || p.id, p.id FROM products p WHERE p.id LIKE 'demo-%'
ON CONFLICT (barcode) DO NOTHING;
