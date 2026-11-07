import type { IconDefinition } from '@fortawesome/free-solid-svg-icons'
import {
  faArrowLeft,
  faCheck,
  faChevronDown,
  faComments,
  faCopy,
  faDesktop,
  faDownload,
  faEllipsisVertical,
  faFileAudio,
  faImage,
  faMicrophone,
  faMinus,
  faPaperPlane,
  faPen,
  faPlus,
  faStop,
  faTrash,
  faXmark
} from '@fortawesome/free-solid-svg-icons'

const faSquareDashed: IconDefinition = {
  prefix: 'fas',
  iconName: 'square-dashed' as IconDefinition['iconName'],
  icon: [
    512,
    512,
    [],
    'e900',
    'M104 80h72v32H104zM232 80h48v32h-48zM336 80h72v32h-72zM80 104h32v72H80zM80 232h32v48H80zM80 336h32v72H80zM432 104h-32v72h32zM432 232h-32v48h32zM432 336h-32v72h32zM104 400h72v32H104zM232 400h48v32h-48zM336 400h72v32h-72z'
  ]
}

export const ICONS = {
  'arrow-left': faArrowLeft,
  check: faCheck,
  'chevron-down': faChevronDown,
  comments: faComments,
  copy: faCopy,
  desktop: faDesktop,
  download: faDownload,
  menu: faEllipsisVertical,
  audio: faFileAudio,
  image: faImage,
  microphone: faMicrophone,
  minus: faMinus,
  send: faPaperPlane,
  pen: faPen,
  plus: faPlus,
  stop: faStop,
  trash: faTrash,
  close: faXmark,
  snip: faSquareDashed
} satisfies Record<string, IconDefinition>

export type IconName = keyof typeof ICONS
