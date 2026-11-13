export const events = [
  {
    id: 'lagos-tech-summit',
    title: 'Lagos Tech Summit',
    city: 'Lagos',
    venue: 'Civic Centre',
    date: '2026-12-05T17:00:00Z',
    status: 'published',
    tiers: [
      { id: 'lagos-summit-general', name: 'General admission', priceCents: 250000, capacity: 300, sold: 186, seatsLeft: 114 },
      { id: 'lagos-summit-vip', name: 'VIP access', priceCents: 650000, capacity: 60, sold: 52, seatsLeft: 8 },
    ],
  },
  {
    id: 'abuja-jazz-night',
    title: 'Abuja Jazz Night',
    city: 'Abuja',
    venue: 'The Dome',
    date: '2026-12-12T19:30:00Z',
    status: 'published',
    tiers: [
      { id: 'abuja-jazz-front-row', name: 'Front row', priceCents: 900000, capacity: 40, sold: 40, seatsLeft: 0 },
      { id: 'abuja-jazz-standard', name: 'Standard', priceCents: 450000, capacity: 160, sold: 98, seatsLeft: 62 },
    ],
  },
  {
    id: 'lagos-art-market',
    title: 'Sunday Art & Makers Market',
    city: 'Lagos',
    venue: 'Freedom Park',
    date: '2026-11-28T10:00:00Z',
    status: 'published',
    tiers: [
      { id: 'market-entry', name: 'Market entry', priceCents: 150000, capacity: 250, sold: 212, seatsLeft: 38 },
    ],
  },
  {
    id: 'port-harcourt-comedy',
    title: 'Laugh Out Loud',
    city: 'Port Harcourt',
    venue: 'Aztech Arcum',
    date: '2027-01-09T18:00:00Z',
    status: 'published',
    tiers: [
      { id: 'comedy-general', name: 'General admission', priceCents: 350000, capacity: 120, sold: 45, seatsLeft: 75 },
    ],
  },
];
