# Product photography and credit

SmartTijori prefers `products.image_url` when the retailer provides an exact manufacturer or product photo. For otherwise unillustrated popular commodity listings, the storefront offers a **representative real photograph** from Wikimedia Commons (and falls back to its existing vector illustration if loading fails).

**Do not treat representative images as proof of exact brand, package size, quality, fresh stock, or participating merchant identity.** Photos are not synchronized with stock or the merchant's live POS.

The Commons image files are hotlinked through `Special:FilePath` at a scaled width. Each file's rights and author are recorded below; the original Commons page remains authoritative and contains full creator, history and license details. If a link becomes unavailable, the illustrated placeholder is shown. Photos must not be replaced with random unrelated images. Actual partner stores should be onboarded with images of their own merchandise.

For **CC BY-SA 4.0** photos: attribution to Gaurav Dhwaj Khadka, with source links below; license: https://creativecommons.org/licenses/by-sa/4.0/. Product cards may crop images to fit the UI; no color/subject modification is intended. The photo-credit page in the storefront links to these exact files.

## Representative image sources

The Commons file pages linked below provide original creator, license and image history. Only a subset have been independently checked for author/license in this rollout. **Do not infer CC0 or public-domain status from hosting on Commons.** The live image may be resized/cropped in the product card. If a source is absent, incorrect or not eligible for reuse, remove that mapping in `representative-photography.ts` and retain the neutral vector fallback.

- Verified example: [Vegetable tomatoes.jpg](https://commons.wikimedia.org/wiki/File:Vegetable_tomatoes.jpg), Leon Brooks, public domain.
- Verified example: [Rice Grains 1.jpg](https://commons.wikimedia.org/wiki/File:Rice_Grains_1.jpg), Gaurav Dhwaj Khadka, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) (photo may be cropped).

- [Vegetable tomatoes.jpg](https://commons.wikimedia.org/wiki/File:Vegetable_tomatoes.jpg)
- [Red onion.jpg](https://commons.wikimedia.org/wiki/File:Red_onion.jpg)
- [Potato1.jpg](https://commons.wikimedia.org/wiki/File:Potato1.jpg)
- [Whole-Lemon.jpg](https://commons.wikimedia.org/wiki/File:Whole-Lemon.jpg)
- [Gfp-bananas.jpg](https://commons.wikimedia.org/wiki/File:Gfp-bananas.jpg)
- [Apple15112024.jpg](https://commons.wikimedia.org/wiki/File:Apple15112024.jpg)
- [Coconut.png](https://commons.wikimedia.org/wiki/File:Coconut.png)
- [Spinach bunches in a stack.jpg](https://commons.wikimedia.org/wiki/File:Spinach_bunches_in_a_stack.jpg)
- [Milk 2.jpg](https://commons.wikimedia.org/wiki/File:Milk_2.jpg)
- [GroceryStoreEggs.JPG](https://commons.wikimedia.org/wiki/File:GroceryStoreEggs.JPG)
- [Bread 1.jpg](https://commons.wikimedia.org/wiki/File:Bread_1.jpg)
- [Ginger roots in a bin.jpg](https://commons.wikimedia.org/wiki/File:Ginger_roots_in_a_bin.jpg)
- [Turmeric Powder.jpg](https://commons.wikimedia.org/wiki/File:Turmeric_Powder.jpg)
- [Whole Cumin Seeds.jpg](https://commons.wikimedia.org/wiki/File:Whole_Cumin_Seeds.jpg)
- [Green Cardamom Pods.jpg](https://commons.wikimedia.org/wiki/File:Green_Cardamom_Pods.jpg)
- [Steaming tea leaves.jpg](https://commons.wikimedia.org/wiki/File:Steaming_tea_leaves.jpg)
- [Raisins 02.jpg](https://commons.wikimedia.org/wiki/File:Raisins_02.jpg)
- [KASHMIRI MAMRA ALMONDS.jpg](https://commons.wikimedia.org/wiki/File:KASHMIRI_MAMRA_ALMONDS.jpg)
- [Rice Grains 1.jpg](https://commons.wikimedia.org/wiki/File:Rice_Grains_1.jpg)
- [Rohu (Lebeo rohita) fish demo.jpg](https://commons.wikimedia.org/wiki/File:Rohu_(Lebeo_rohita)_fish_demo.jpg)
- [White prawn (Litopenaeus vannamei).jpg](https://commons.wikimedia.org/wiki/File:White_prawn_(Litopenaeus_vannamei).jpg)
- [Coffee-Beans.jpg](https://commons.wikimedia.org/wiki/File:Coffee-Beans.jpg)
- [The Grains.jpg](https://commons.wikimedia.org/wiki/File:The_Grains.jpg)
- [Coriander bunches - Wellington, New Zealand.jpg](https://commons.wikimedia.org/wiki/File:Coriander_bunches_-_Wellington%2C_New_Zealand.jpg)
- [Plain Yogurt.jpg](https://commons.wikimedia.org/wiki/File:Plain_Yogurt.jpg)
- [Wheat flour 01.jpg](https://commons.wikimedia.org/wiki/File:Wheat_flour_01.jpg)
- [Chana Ko Dal.jpg](https://commons.wikimedia.org/wiki/File:Chana_Ko_Dal.jpg)
- [Poha (Rice Flakes).jpg](https://commons.wikimedia.org/wiki/File:Poha_(Rice_Flakes).jpg)
- [Marayoor Jaggery in bar form.jpg](https://commons.wikimedia.org/wiki/File:Marayoor_Jaggery_in_bar_form.jpg)
- [Cayenne and other chilli powders.JPG](https://commons.wikimedia.org/wiki/File:Cayenne_and_other_chilli_powders.JPG)
- [Bajra.JPG](https://commons.wikimedia.org/wiki/File:Bajra.JPG)
- [Dried Apricots.jpg](https://commons.wikimedia.org/wiki/File:Dried_Apricots.jpg)

The existing two manufacturer product images are separately sourced from their respective publishers. Those assets should be used only for the named matching branded products. No photo replaces a verified manufacturer listing or changes database price, stock or identity.

## Handoff QR

A QR on a confirmed order contains an **order locator URL**, not a payment credential, password, or unguessable bearer capability. Verification requires independent authorized merchant sign-in for the correct branch, and the server queries the database again. It does not mark an order collected or delivered. Delivery agent roles are not implemented, so unapproved external agents cannot inspect orders.

The long-scroll landing page shows a 59→0 **illustrative** timer and a sample QR at zero pointing only to checkout. It never creates a reservation or a pickup credential; the actual CartLock timer remains bound to the PostgreSQL reservation timestamps. Only a confirmed order gets the branch-verification QR.
