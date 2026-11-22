import Link from 'next/link';
import { AtelierTitle } from '@/components/ui/atelier';

const credits = [["Vegetable_tomatoes.jpg","Public domain","Leon Brooks"],["Red_onion.jpg","Public domain","Eoin Kilfeather"],["Potato1.jpg","CC0 1.0","Wikimedia contributor"],["Whole-Lemon.jpg","CC0 1.0","Evan-Amos"],["Gfp-bananas.jpg","Public domain","Good Free Photos"],["Apple15112024.jpg","CC0 1.0","Wikimedia contributor"],["Coconut.png","Public domain","EJavanainen"],["Spinach_bunches_in_a_stack.jpg","CC0 1.0","Wikimedia contributor"],["Milk_2.jpg","CC0 1.0","Wikimedia contributor"],["GroceryStoreEggs.JPG","CC0 1.0","Wikimedia contributor"],["Bread_1.jpg","CC0 1.0","Wikimedia contributor"],["Ginger_roots_in_a_bin.jpg","CC0 1.0","Wikimedia contributor"],["Turmeric_Powder.jpg","CC0 1.0","Wikimedia contributor"],["Whole_Cumin_Seeds.jpg","CC0 1.0","Misterneedlemouse"],["Green_Cardamom_Pods.jpg","CC0 1.0","Misterneedlemouse"],["Steaming_tea_leaves.jpg","Public domain","Wikimedia contributor"],["Raisins_02.jpg","CC0 1.0","Shams948"],["KASHMIRI_MAMRA_ALMONDS.jpg","CC0 1.0","Ranjithkumar Murugesan"],["Rice_Grains_1.jpg","CC BY-SA 4.0","Gaurav Dhwaj Khadka"],["Rohu_(Lebeo_rohita)_fish_demo.jpg","CC0 1.0","Wikimedia contributor"],["White_prawn_(Litopenaeus_vannamei).jpg","CC0 1.0","Wikimedia contributor"],["Coffee-Beans.jpg","CC0 1.0","Evan-Amos"],["The_Grains.jpg","Public domain (USDA)","Peggy Greb / USDA"],["Coriander_bunches_-_Wellington,_New_Zealand.jpg","CC0 1.0","Wikimedia contributor"],["Plain_Yogurt.jpg","CC0 1.0","Wikimedia contributor"],["Wheat_flour_01.jpg","CC0 1.0","Wikimedia contributor"],["Chana_Ko_Dal.jpg","CC BY-SA 4.0","Gaurav Dhwaj Khadka"],["Poha_(Rice_Flakes).jpg","CC0 1.0","Wikimedia contributor"],["Marayoor_Jaggery_in_bar_form.jpg","CC0 1.0","Wikimedia contributor"],["Cayenne_and_other_chilli_powders.JPG","CC0 1.0","Andrew Dalby"],["Bajra.JPG","CC0 1.0","Wikimedia contributor"],["Dried_Apricots.jpg","CC0 1.0","Kuwanishbek"]] as const;
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
      {credits.map(([filename, license, creator]) => (
        <article className="atelier-panel p-4" key={filename}>
          <h2 className="break-words text-sm font-semibold">{filename.replaceAll('_',' ')}</h2>
          <p className="text-xs text-stone-600 mt-2">{creator} · {license}</p>
          <a className="mt-3 inline-block text-xs underline underline-offset-4"
            href={`https://commons.wikimedia.org/wiki/File:${encodeURIComponent(filename)}`}
            target="_blank" rel="noopener noreferrer">Source &amp; license</a>
        </article>
      ))}
    </div>
    <p className="text-xs text-stone-600">For CC BY-SA 4.0 works by Gaurav Dhwaj Khadka, see
      <a href="https://creativecommons.org/licenses/by-sa/4.0/" className="ml-1 underline" target="_blank" rel="noopener noreferrer">the license</a>.
      Images may be cropped to fit the card presentation.</p>
  </section>;
}
