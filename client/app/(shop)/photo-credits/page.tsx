import Link from 'next/link';
import { AtelierTitle } from '@/components/ui/atelier';

const credits = ["Vegetable_tomatoes.jpg","Red_onion.jpg","Potato1.jpg","Whole-Lemon.jpg","Gfp-bananas.jpg","Apple15112024.jpg","Coconut.png","Spinach_bunches_in_a_stack.jpg","Milk_2.jpg","GroceryStoreEggs.JPG","Bread_1.jpg","Ginger_roots_in_a_bin.jpg","Turmeric_Powder.jpg","Whole_Cumin_Seeds.jpg","Green_Cardamom_Pods.jpg","Steaming_tea_leaves.jpg","Raisins_02.jpg","KASHMIRI_MAMRA_ALMONDS.jpg","Rice_Grains_1.jpg","Rohu_(Lebeo_rohita)_fish_demo.jpg","White_prawn_(Litopenaeus_vannamei).jpg","Coffee-Beans.jpg","The_Grains.jpg","Coriander_bunches_-_Wellington,_New_Zealand.jpg","Plain_Yogurt.jpg","Wheat_flour_01.jpg","Chana_Ko_Dal.jpg","Poha_(Rice_Flakes).jpg","Marayoor_Jaggery_in_bar_form.jpg","Cayenne_and_other_chilli_powders.JPG","Bajra.JPG","Dried_Apricots.jpg"] as const;
export const metadata = { title: 'Product Photo Credits | SmartTijori' };

export default function PhotoCreditsPage() {
  return <section className="space-y-7" aria-labelledby="photo-credits-heading">
    <AtelierTitle lead="Photo" accent="credits." context="Genuine images / representative products"
      description="Real food photography for common unbranded products. Photos are representative, not evidence of a particular shop’s inventory or packaging." />
    <p id="photo-credits-heading" className="max-w-3xl text-sm leading-7">
      We use licensed Wikimedia Commons imagery where an exact product photograph is unavailable.
      Each image is linked to its original source and license details.
      <Link href="/search" className="ml-2 underline underline-offset-4">Back to products</Link>
    </p>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {credits.map(filename => (
        <article className="atelier-panel p-4" key={filename}>
          <h2 className="break-words text-sm font-semibold">{filename.replaceAll('_',' ')}</h2>
          <p className="text-xs text-stone-600 mt-2">Creator and reuse conditions: see original Commons page.</p>
          <a className="mt-3 inline-block text-xs underline underline-offset-4"
            href={`https://commons.wikimedia.org/wiki/File:${encodeURIComponent(filename)}`}
            target="_blank" rel="noopener noreferrer">Source &amp; license</a>
        </article>
      ))}
    </div>
    <p className="text-xs text-stone-600">Rice Grains 1 by Gaurav Dhwaj Khadka is licensed CC BY-SA 4.0. See
      <a href="https://creativecommons.org/licenses/by-sa/4.0/" className="ml-1 underline" target="_blank" rel="noopener noreferrer">the license</a>.
      Images may be cropped to fit cards; verify each image’s original Commons rights information before reuse.</p>
  </section>;
}
