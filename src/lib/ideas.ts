import caramelWaves from '../assets/ideas/caramel-waves.jpg'
import faceFramingLayers from '../assets/ideas/face-framing-layers.jpg'
import texturedUpdo from '../assets/ideas/textured-updo.jpg'
import romanticHalfUp from '../assets/ideas/romantic-half-up.jpg'
import floralHeadband from '../assets/ideas/floral-headband.jpg'

export type IdeaCategory = 'everyday' | 'occasion'

export interface HairIdea {
  id: string
  title: string
  category: IdeaCategory
  summary: string
  details: string
  tags: string[]
  image: string
  alt: string
}

export const IDEA_FILTERS: { id: 'all' | IdeaCategory; label: string }[] = [
  { id: 'all', label: 'All looks' },
  { id: 'everyday', label: 'Everyday' },
  { id: 'occasion', label: 'Occasion' },
]

export const ideas: HairIdea[] = [
  {
    id: 'caramel-waves',
    title: 'Soft caramel waves',
    category: 'everyday',
    summary: 'Long, loose waves with warm highlights and a soft side part.',
    details:
      'A polished everyday shape: face-framing layers, gentle volume through the lengths, and a warm caramel blend. Easy to wear down for the week or for dinner.',
    tags: ['Long hair', 'Waves', 'Highlights'],
    image: caramelWaves,
    alt: 'Long caramel-highlighted hair styled in loose waves, worn down over one shoulder.',
  },
  {
    id: 'face-framing-layers',
    title: 'Face-framing layers',
    category: 'everyday',
    summary: 'Side-swept layers that fall across the face, with loose ribbon curls.',
    details:
      'Movement starts around the cheekbones. The side sweep softens the hairline, and the curls stay loose rather than set. A useful reference if you want length with shape.',
    tags: ['Layers', 'Side sweep', 'Everyday'],
    image: faceFramingLayers,
    alt: 'Long highlighted hair with side-swept layers and loose curls falling over the shoulders.',
  },
  {
    id: 'textured-updo',
    title: 'Soft textured updo',
    category: 'occasion',
    summary: 'A low, undone updo with a few pieces left out around the face.',
    details:
      'Hair is twisted and pinned into a soft knot, with curls left at the neck and cheek. It suits a wedding guest look, a simcha, or an evening out. A photo of your outfit helps Aviva match the finish.',
    tags: ['Updo', 'Occasion', 'Face-framing'],
    image: texturedUpdo,
    alt: 'A low textured updo with loose face-framing curls and a drop earring.',
  },
  {
    id: 'romantic-half-up',
    title: 'Romantic half-up',
    category: 'occasion',
    summary: 'Half the hair pinned back, the rest in long curls, finished with a delicate comb.',
    details:
      'Volume at the crown, defined curls down the back, and a small pearl comb at the side. The comb is optional — bring a clip you already own, or keep the style simple.',
    tags: ['Half-up', 'Curls', 'Hair accessory'],
    image: romanticHalfUp,
    alt: 'A half-up style with long caramel curls and a pearl hair comb.',
  },
  {
    id: 'floral-headband',
    title: 'Floral crystal headband',
    category: 'occasion',
    summary: 'Long waves worn down, with a delicate floral band across the crown.',
    details:
      'Loose caramel waves with a side part, and a vine of crystals and pearls sitting just back from the hairline. Bring your own headband if you have one, and Aviva can style the hair so it sits cleanly.',
    tags: ['Waves', 'Headband', 'Occasion'],
    image: floralHeadband,
    alt: 'Long caramel waves worn down with a crystal floral headband.',
  },
]

export function ideaById(id: string | null): HairIdea | undefined {
  if (!id) return undefined
  return ideas.find((idea) => idea.id === id)
}

export function lookRequestNote(title: string): string {
  return `I would like a look like "${title}".`
}
