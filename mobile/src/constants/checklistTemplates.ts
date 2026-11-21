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
    description: 'Chappals, swimwear, sunscreen, party speaker & beach essentials',
    items: [
      { id: 'b1', title: 'Swimming Costume / Trunks', category: 'Clothing', scope: 'personal' },
      { id: 'b2', title: 'Chappals / Flip-Flops / Crocs', category: 'Clothing', scope: 'personal' },
      { id: 'b3', title: 'Cap / Sun Hat', category: 'Clothing', scope: 'personal' },
      { id: 'b4', title: 'Cotton T-shirts & Shorts', category: 'Clothing', scope: 'personal' },
      { id: 'b5', title: 'Sunscreen Lotion (SPF 50+)', category: 'Toiletries', scope: 'personal' },
      { id: 'b6', title: 'Moisturizer / Body Lotion', category: 'Toiletries', scope: 'personal' },
      { id: 'b7', title: 'Lip Balm', category: 'Toiletries', scope: 'personal' },
      { id: 'b8', title: 'Waterproof Phone Pouch (for beach/water sports)', category: 'Electronics', scope: 'personal' },
      { id: 'b9', title: 'Power Bank & Charging Cables', category: 'Electronics', scope: 'personal' },
      { id: 'b10', title: 'Bluetooth Speaker (for party / beach music)', category: 'Electronics', scope: 'group' },
      { id: 'b11', title: 'Aadhaar Card / Driving License & Hotel Booking', category: 'Documents', scope: 'personal' },
      { id: 'b12', title: 'Sunglasses', category: 'Gear', scope: 'personal' },
      { id: 'b13', title: 'Beach Bedsheet / Mat to sit on sand', category: 'Gear', scope: 'group' },
      { id: 'b14', title: 'Frisbee / Playing Cards (Uno / Taash)', category: 'Gear', scope: 'group' },
      { id: 'b15', title: 'First Aid & Band-aids', category: 'Medical', scope: 'group' },
      { id: 'b16', title: 'Electral / ORS Sachets & Glucose', category: 'Medical', scope: 'personal' },
      { id: 'b17', title: 'Mosquito Repellent (Odomos / Roll-on)', category: 'Medical', scope: 'group' },
      { id: 'b18', title: 'Water Bottles', category: 'Food', scope: 'group' },
    ],
  },
  {
    id: 'mountain',
    name: 'Mountain & Trekking Trip',
    icon: 'trail-sign-outline',
    description: 'Thermals, winter jacket, trekking shoes, flask & survival gear',
    items: [
      { id: 'm1', title: 'Inners / Thermal Wear (Top & Bottom)', category: 'Clothing', scope: 'personal' },
      { id: 'm2', title: 'Warm Winter Jacket / Windcheater', category: 'Clothing', scope: 'personal' },
      { id: 'm3', title: 'Trekking Shoes / Comfortable Sports Shoes', category: 'Clothing', scope: 'personal' },
      { id: 'm4', title: 'Woolen Socks (3-4 pairs)', category: 'Clothing', scope: 'personal' },
      { id: 'm5', title: 'Warm Gloves & Monkey Cap / Beanie', category: 'Clothing', scope: 'personal' },
      { id: 'm6', title: 'Cold Cream, Vaseline & Lip Balm', category: 'Toiletries', scope: 'personal' },
      { id: 'm7', title: 'Wet Wipes & Tissue Roll', category: 'Toiletries', scope: 'personal' },
      { id: 'm8', title: 'Torch / Headlamp with extra batteries', category: 'Electronics', scope: 'personal' },
      { id: 'm9', title: 'High Capacity Power Bank (20,000 mAh)', category: 'Electronics', scope: 'personal' },
      { id: 'm10', title: 'Offline Google Maps downloaded', category: 'Electronics', scope: 'personal' },
      { id: 'm11', title: 'Aadhaar / Govt ID & Trek/Entry Permits', category: 'Documents', scope: 'personal' },
      { id: 'm12', title: 'Hard Cash (ATMs may not work on hills)', category: 'Documents', scope: 'personal' },
      { id: 'm13', title: 'Rucksack / Backpack with Rain Cover', category: 'Gear', scope: 'personal' },
      { id: 'm14', title: 'Trekking Pole / Walking Stick', category: 'Gear', scope: 'personal' },
      { id: 'm15', title: 'Hot Water Flask / Thermos', category: 'Gear', scope: 'personal' },
      { id: 'm16', title: 'Camping Tent & Floor Mat', category: 'Gear', scope: 'group' },
      { id: 'm17', title: 'Dolo 650, Avomine & Mountain Sickness Meds', category: 'Medical', scope: 'group' },
      { id: 'm18', title: 'Moov / Volini Spray & Crepe Bandage', category: 'Medical', scope: 'group' },
      { id: 'm19', title: 'Water Purification Drops / Tablets', category: 'Medical', scope: 'group' },
      { id: 'm20', title: 'Maggi Packets, Dry Fruits & Energy Bars', category: 'Food', scope: 'personal' },
    ],
  },
  {
    id: 'roadtrip',
    name: 'Road Trip & Highway Drive',
    icon: 'car-outline',
    description: 'Fastag, car papers, charger, neck pillow, tools & road snacks',
    items: [
      { id: 'r1', title: 'Original Driving License', category: 'Documents', scope: 'personal' },
      { id: 'r2', title: 'Car RC Book & Active Vehicle Insurance', category: 'Documents', scope: 'group' },
      { id: 'r3', title: 'Fastag with recharge balance', category: 'Documents', scope: 'group' },
      { id: 'r4', title: 'PUC Certificate (Pollution Check)', category: 'Documents', scope: 'group' },
      { id: 'r5', title: 'Fast Car USB Charger (dual port)', category: 'Electronics', scope: 'group' },
      { id: 'r6', title: 'AUX Cable / Bluetooth Connector', category: 'Electronics', scope: 'group' },
      { id: 'r7', title: 'Mobile Holder for Car Dashboard (for Maps)', category: 'Electronics', scope: 'group' },
      { id: 'r8', title: 'Comfortable Driving Shoes / Chappals', category: 'Clothing', scope: 'personal' },
      { id: 'r9', title: 'Sunglasses for daytime glare', category: 'Gear', scope: 'personal' },
      { id: 'r10', title: 'Neck Pillow for car naps', category: 'Gear', scope: 'personal' },
      { id: 'r11', title: 'Tyre Inflator & Air Pressure Gauge', category: 'Gear', scope: 'group' },
      { id: 'r12', title: 'Tyre Puncture Repair Kit', category: 'Gear', scope: 'group' },
      { id: 'r13', title: 'Jumper Cables & Tool Kit', category: 'Gear', scope: 'group' },
      { id: 'r14', title: 'Car Duster Cloth & Trash Bags', category: 'Gear', scope: 'group' },
      { id: 'r15', title: 'Motion Sickness Tablets (Avomine / Vomistop)', category: 'Medical', scope: 'group' },
      { id: 'r16', title: 'Water Bottle Box & Cold Drinks', category: 'Food', scope: 'group' },
      { id: 'r17', title: 'Chips, Biscuits, Namkeen & Mints', category: 'Food', scope: 'group' },
    ],
  },
  {
    id: 'weekend',
    name: 'Weekend Getaway & City Break',
    icon: 'bag-handle-outline',
    description: 'Casual wear, chargers, speaker, basic medicines & travel essentials',
    items: [
      { id: 'w1', title: '2-3 Sets of Casual Clothes', category: 'Clothing', scope: 'personal' },
      { id: 'w2', title: '1 Nice Party / Dinner Outfit', category: 'Clothing', scope: 'personal' },
      { id: 'w3', title: 'Comfortable Walking Sneakers / Shoes', category: 'Clothing', scope: 'personal' },
      { id: 'w4', title: 'Toothbrush, Toothpaste & Tongue Cleaner', category: 'Toiletries', scope: 'personal' },
      { id: 'w5', title: 'Small Shampoo, Soap & Deodorant / Perfume', category: 'Toiletries', scope: 'personal' },
      { id: 'w6', title: 'Comb, Face Wash & Moisturizer', category: 'Toiletries', scope: 'personal' },
      { id: 'w7', title: 'Phone & Smartwatch Chargers', category: 'Electronics', scope: 'personal' },
      { id: 'w8', title: 'Earphones / AirPods', category: 'Electronics', scope: 'personal' },
      { id: 'w9', title: 'Aadhaar Card / ID Proof', category: 'Documents', scope: 'personal' },
      { id: 'w10', title: 'Small Umbrella', category: 'Gear', scope: 'personal' },
      { id: 'w11', title: 'Backpack / Sling Bag', category: 'Gear', scope: 'personal' },
      { id: 'w12', title: 'Basic Medicines (Dolo 650, Digene, Band-aids)', category: 'Medical', scope: 'personal' },
      { id: 'w13', title: 'Hotel Booking Confirmation on phone', category: 'Documents', scope: 'group' },
      { id: 'w14', title: 'Portable Bluetooth Speaker', category: 'Electronics', scope: 'group' },
      { id: 'w15', title: 'Playing Cards / Board Games for evening hangout', category: 'Gear', scope: 'group' },
    ],
  },
  {
    id: 'international',
    name: 'International Travel Essentials',
    icon: 'airplane-outline',
    description: 'Passport, forex card, universal adapter, flight tickets & locks',
    items: [
      { id: 'i1', title: 'Original Passport (valid for 6+ months)', category: 'Documents', scope: 'personal' },
      { id: 'i2', title: 'Visa / eVisa Printout', category: 'Documents', scope: 'personal' },
      { id: 'i3', title: 'International Travel Insurance Copy', category: 'Documents', scope: 'personal' },
      { id: 'i4', title: 'Forex Card + Some US Dollars / Local Cash', category: 'Documents', scope: 'personal' },
      { id: 'i5', title: 'Flight Tickets & Boarding Passes', category: 'Documents', scope: 'personal' },
      { id: 'i6', title: 'Universal World Travel Adapter (multi-pin)', category: 'Electronics', scope: 'personal' },
      { id: 'i7', title: 'International Roaming / eSIM Setup', category: 'Electronics', scope: 'personal' },
      { id: 'i8', title: 'Power Bank (Cabin baggage approved <100Wh)', category: 'Electronics', scope: 'personal' },
      { id: 'i9', title: 'Noise-canceling Earphones', category: 'Electronics', scope: 'personal' },
      { id: 'i10', title: 'Light Warm Jacket for AC Flights', category: 'Clothing', scope: 'personal' },
      { id: 'i11', title: 'Comfortable Flight Trackpants & Shoes', category: 'Clothing', scope: 'personal' },
      { id: 'i12', title: 'TSA Luggage Locks & Bag Tags', category: 'Gear', scope: 'personal' },
      { id: 'i13', title: 'Passport Holder / Travel Sling Pouch', category: 'Gear', scope: 'personal' },
      { id: 'i14', title: 'Portable Luggage Weighing Scale', category: 'Gear', scope: 'group' },
      { id: 'i15', title: 'Doctor Prescription for Personal Medicines', category: 'Medical', scope: 'personal' },
      { id: 'i16', title: 'Jetlag / Melatonin Tablets', category: 'Medical', scope: 'personal' },
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
