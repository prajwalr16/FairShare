export type TemplateCategory =
  | 'Clothing'
  | 'Toiletries'
  | 'Electronics'
  | 'Documents'
  | 'Medical'
  | 'Gear'
  | 'Food'
  | 'General';

export type TemplateItem = {
  id: string;
  title: string;
  category: TemplateCategory;
  scope: 'personal' | 'group';
};

export type ChecklistTemplatePack = {
  id: string;
  name: string;
  icon: string;
  description: string;
  items: TemplateItem[];
};

export const CHECKLIST_TEMPLATE_PACKS: ChecklistTemplatePack[] = [
  {
    id: 'beach',
    name: 'Beach & Coastal Vacation',
    icon: 'water-outline',
    description: 'Swimwear, sun protection, waterproof gear & essentials for the coast',
    items: [
      { id: 'b1', title: 'Swimwear / Trunks', category: 'Clothing', scope: 'personal' },
      { id: 'b2', title: 'Flip-flops / Water sandals', category: 'Clothing', scope: 'personal' },
      { id: 'b3', title: 'Sun hat / Cap', category: 'Clothing', scope: 'personal' },
      { id: 'b4', title: 'Quick-dry shorts & tees', category: 'Clothing', scope: 'personal' },
      { id: 'b5', title: 'Water-resistant Sunscreen (SPF 50+)', category: 'Toiletries', scope: 'personal' },
      { id: 'b6', title: 'Aloe vera / After-sun lotion', category: 'Toiletries', scope: 'personal' },
      { id: 'b7', title: 'Lip balm with SPF', category: 'Toiletries', scope: 'personal' },
      { id: 'b8', title: 'Waterproof phone pouch', category: 'Electronics', scope: 'personal' },
      { id: 'b9', title: 'Power bank & cables', category: 'Electronics', scope: 'personal' },
      { id: 'b10', title: 'Portable Bluetooth speaker', category: 'Electronics', scope: 'group' },
      { id: 'b11', title: 'Government ID & Hotel booking', category: 'Documents', scope: 'personal' },
      { id: 'b12', title: 'UV Polarized Sunglasses', category: 'Gear', scope: 'personal' },
      { id: 'b13', title: 'Large Beach Mat / Sheet', category: 'Gear', scope: 'group' },
      { id: 'b14', title: 'Beach Frisbee / Uno Cards', category: 'Gear', scope: 'group' },
      { id: 'b15', title: 'First Aid & Antihistamines', category: 'Medical', scope: 'group' },
      { id: 'b16', title: 'ORS / Hydration packets', category: 'Medical', scope: 'personal' },
    ],
  },
  {
    id: 'mountain',
    name: 'Mountain & Trekking Trip',
    icon: 'trail-sign-outline',
    description: 'Thermals, windbreakers, high-ankle shoes & outdoor survival gear',
    items: [
      { id: 'm1', title: 'Thermals / Base layers', category: 'Clothing', scope: 'personal' },
      { id: 'm2', title: 'Windproof & Waterproof jacket', category: 'Clothing', scope: 'personal' },
      { id: 'm3', title: 'High-ankle trekking shoes', category: 'Clothing', scope: 'personal' },
      { id: 'm4', title: 'Woolen socks (3-4 pairs)', category: 'Clothing', scope: 'personal' },
      { id: 'm5', title: 'Fleece gloves & Beanie', category: 'Clothing', scope: 'personal' },
      { id: 'm6', title: 'Cold cream & Lip balm', category: 'Toiletries', scope: 'personal' },
      { id: 'm7', title: 'Biodegradable wet wipes', category: 'Toiletries', scope: 'personal' },
      { id: 'm8', title: 'Headlamp with extra batteries', category: 'Electronics', scope: 'personal' },
      { id: 'm9', title: 'High capacity power bank (20k mAh)', category: 'Electronics', scope: 'personal' },
      { id: 'm10', title: 'Offline GPS maps downloaded', category: 'Electronics', scope: 'personal' },
      { id: 'm11', title: 'Trek permits & Medical certificate', category: 'Documents', scope: 'personal' },
      { id: 'm12', title: 'Emergency cash (ATMs scarce)', category: 'Documents', scope: 'personal' },
      { id: 'm13', title: 'Backpack with Rain Cover (40L+)', category: 'Gear', scope: 'personal' },
      { id: 'm14', title: 'Trekking pole pair', category: 'Gear', scope: 'personal' },
      { id: 'm15', title: 'Thermos flask for hot water', category: 'Gear', scope: 'personal' },
      { id: 'm16', title: 'Camp Tent & Ground Sheet', category: 'Gear', scope: 'group' },
      { id: 'm17', title: 'Altitude sickness meds (Diamox)', category: 'Medical', scope: 'group' },
      { id: 'm18', title: 'Pain relief spray & Crepe bandage', category: 'Medical', scope: 'group' },
      { id: 'm19', title: 'Water purification drops / tabs', category: 'Medical', scope: 'group' },
      { id: 'm20', title: 'Trail mix & Energy bars', category: 'Food', scope: 'personal' },
    ],
  },
  {
    id: 'roadtrip',
    name: 'Road Trip & Highway Drive',
    icon: 'car-outline',
    description: 'Vehicle documents, car chargers, navigation & road snacks',
    items: [
      { id: 'r1', title: 'Original Driver’s License', category: 'Documents', scope: 'personal' },
      { id: 'r2', title: 'Car Registration (RC) & Insurance', category: 'Documents', scope: 'group' },
      { id: 'r3', title: 'Fastag recharged with balance', category: 'Documents', scope: 'group' },
      { id: 'r4', title: 'Pollution Under Control (PUC)', category: 'Documents', scope: 'group' },
      { id: 'r5', title: 'High-speed dual car USB charger', category: 'Electronics', scope: 'group' },
      { id: 'r6', title: 'AUX cable / Bluetooth receiver', category: 'Electronics', scope: 'group' },
      { id: 'r7', title: 'Magnetic phone car mount', category: 'Electronics', scope: 'group' },
      { id: 'r8', title: 'Comfortable slip-on driving shoes', category: 'Clothing', scope: 'personal' },
      { id: 'r9', title: 'Sunglasses for daytime glare', category: 'Gear', scope: 'personal' },
      { id: 'r10', title: 'Memory foam neck pillow', category: 'Gear', scope: 'personal' },
      { id: 'r11', title: 'Tire inflator & Pressure gauge', category: 'Gear', scope: 'group' },
      { id: 'r12', title: 'Tire puncture repair kit', category: 'Gear', scope: 'group' },
      { id: 'r13', title: 'Battery jumper cables', category: 'Gear', scope: 'group' },
      { id: 'r14', title: 'Car trash bags & Microfiber cloth', category: 'Gear', scope: 'group' },
      { id: 'r15', title: 'Motion / Car sickness tablets (Avomine)', category: 'Medical', scope: 'group' },
      { id: 'r16', title: 'Packaged water bottle crate', category: 'Food', scope: 'group' },
      { id: 'r17', title: 'Highway snacks & Mints', category: 'Food', scope: 'group' },
    ],
  },
  {
    id: 'weekend',
    name: 'Weekend Getaway & City Break',
    icon: 'bag-handle-outline',
    description: 'Light luggage, smart casuals, chargers & everyday essentials',
    items: [
      { id: 'w1', title: '2-3 Casual day outfits', category: 'Clothing', scope: 'personal' },
      { id: 'w2', title: 'Dinner / Evening wear', category: 'Clothing', scope: 'personal' },
      { id: 'w3', title: 'Walking sneakers', category: 'Clothing', scope: 'personal' },
      { id: 'w4', title: 'Travel toiletry kit (Toothbrush/paste)', category: 'Toiletries', scope: 'personal' },
      { id: 'w5', title: 'Mini shampoo & body wash', category: 'Toiletries', scope: 'personal' },
      { id: 'w6', title: 'Perfume / Deodorant', category: 'Toiletries', scope: 'personal' },
      { id: 'w7', title: 'Phone & Smartwatch chargers', category: 'Electronics', scope: 'personal' },
      { id: 'w8', title: 'Earbuds / Headphones', category: 'Electronics', scope: 'personal' },
      { id: 'w9', title: 'Government ID card', category: 'Documents', scope: 'personal' },
      { id: 'w10', title: 'Compact umbrella', category: 'Gear', scope: 'personal' },
      { id: 'w11', title: 'Daypack / Crossbody sling bag', category: 'Gear', scope: 'personal' },
      { id: 'w12', title: 'Basic pain relief & band-aids', category: 'Medical', scope: 'personal' },
      { id: 'w13', title: 'Hotel booking confirmation & vouchers', category: 'Documents', scope: 'group' },
      { id: 'w14', title: 'Portable Bluetooth speaker', category: 'Electronics', scope: 'group' },
      { id: 'w15', title: 'Card / Board games for evening hangout', category: 'Gear', scope: 'group' },
    ],
  },
  {
    id: 'international',
    name: 'International Travel Essentials',
    icon: 'airplane-outline',
    description: 'Passports, forex, universal adapters & long-haul travel items',
    items: [
      { id: 'i1', title: 'Passport (6+ months validity)', category: 'Documents', scope: 'personal' },
      { id: 'i2', title: 'Visa / eVisa printed copy', category: 'Documents', scope: 'personal' },
      { id: 'i3', title: 'International travel insurance copy', category: 'Documents', scope: 'personal' },
      { id: 'i4', title: 'Forex Multi-currency Card + Cash', category: 'Documents', scope: 'personal' },
      { id: 'i5', title: 'Flight boarding passes / Tickets', category: 'Documents', scope: 'personal' },
      { id: 'i6', title: 'Universal World Travel Adapter', category: 'Electronics', scope: 'personal' },
      { id: 'i7', title: 'International roaming / eSIM setup', category: 'Electronics', scope: 'personal' },
      { id: 'i8', title: 'Power bank (airline approved <100Wh)', category: 'Electronics', scope: 'personal' },
      { id: 'i9', title: 'Noise-canceling headphones', category: 'Electronics', scope: 'personal' },
      { id: 'i10', title: 'In-flight compression socks', category: 'Clothing', scope: 'personal' },
      { id: 'i11', title: 'Compact packable down jacket', category: 'Clothing', scope: 'personal' },
      { id: 'i12', title: 'TSA approved luggage locks', category: 'Gear', scope: 'personal' },
      { id: 'i13', title: 'RFID blocking passport pouch', category: 'Gear', scope: 'personal' },
      { id: 'i14', title: 'Luggage weigh scale', category: 'Gear', scope: 'group' },
      { id: 'i15', title: 'Doctor prescription for carry-on meds', category: 'Medical', scope: 'personal' },
      { id: 'i16', title: 'Melatonin / Jetlag tablets', category: 'Medical', scope: 'personal' },
    ],
  },
];

export const CATEGORY_ICONS: Record<string, string> = {
  Clothing: 'shirt-outline',
  Toiletries: 'sparkles-outline',
  Electronics: 'hardware-chip-outline',
  Documents: 'card-outline',
  Medical: 'medkit-outline',
  Gear: 'briefcase-outline',
  Food: 'fast-food-outline',
  General: 'checkbox-outline',
};

export const CATEGORY_COLORS: Record<string, string> = {
  Clothing: '#00E5FF',
  Toiletries: '#EC4899',
  Electronics: '#A855F7',
  Documents: '#F59E0B',
  Medical: '#EF4444',
  Gear: '#10B981',
  Food: '#F97316',
  General: '#64748B',
};
