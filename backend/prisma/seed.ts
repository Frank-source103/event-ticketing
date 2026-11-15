import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const eventsData = [
  {
    title: 'Afrobeats All-Stars Festival 2026',
    date: new Date('2026-12-18T18:00:00Z'),
    venue: 'Eko Atlantic City, Victoria Island, Lagos',
    price: 1500000, // ₦15,000
    capacity: 5000,
  },
  {
    title: 'Global AI & Cloud Summit',
    date: new Date('2026-12-05T09:00:00Z'),
    venue: 'Landmark Event Centre, Oniru, Lagos',
    price: 2500000, // ₦25,000
    capacity: 800,
  },
  {
    title: 'Lagos International Comedy Gala',
    date: new Date('2026-11-28T19:30:00Z'),
    venue: 'Terra Kulture Arena, Victoria Island, Lagos',
    price: 1000000, // ₦10,000
    capacity: 400,
  },
  {
    title: 'African Fintech Pioneers Forum',
    date: new Date('2026-12-10T08:30:00Z'),
    venue: 'Transcorp Hilton Congress Hall, Abuja',
    price: 5000000, // ₦50,000
    capacity: 650,
  },
  {
    title: 'Night of Smooth Jazz & Soul',
    date: new Date('2026-12-22T20:00:00Z'),
    venue: 'Muson Centre, Onikan, Lagos',
    price: 1800000, // ₦18,000
    capacity: 350,
  },
  {
    title: 'Frontend & React Creators Conference',
    date: new Date('2026-12-15T09:30:00Z'),
    venue: 'Zone Tech Park, Gbagada, Lagos',
    price: 1200000, // ₦12,000
    capacity: 500,
  },
  {
    title: 'Nairobi Tech Week & Hackathon',
    date: new Date('2027-01-14T09:00:00Z'),
    venue: 'Sarit Expo Centre, Westlands, Nairobi',
    price: 2000000, // ₦20,000
    capacity: 1200,
  },
  {
    title: 'Artisanal Food & Craft Beer Festival',
    date: new Date('2026-12-12T13:00:00Z'),
    venue: 'Muri Okunola Park, Victoria Island, Lagos',
    price: 500000, // ₦5,000
    capacity: 1500,
  },
  {
    title: 'Cape Town Electronic Music Experience',
    date: new Date('2027-01-23T16:00:00Z'),
    venue: 'Ostrich Ranch Pavilion, Cape Town',
    price: 3000000, // ₦30,000
    capacity: 3500,
  },
  {
    title: 'Startup Pitch & Venture Gala',
    date: new Date('2026-12-08T17:00:00Z'),
    venue: 'The Wheatbaker Ballroom, Ikoyi, Lagos',
    price: 7500000, // ₦75,000
    capacity: 150,
  },
  {
    title: 'Accra Fashion & Runway Showcase',
    date: new Date('2027-01-09T18:30:00Z'),
    venue: 'Grand Arena, International Conference Centre, Accra',
    price: 2200000, // ₦22,000
    capacity: 750,
  },
  {
    title: 'Indie Game Devs & Esports Championship',
    date: new Date('2026-12-19T10:00:00Z'),
    venue: 'Harbour Point, Victoria Island, Lagos',
    price: 750000, // ₦7,500
    capacity: 800,
  },
  {
    title: 'London African Music & Culture Fest',
    date: new Date('2027-02-06T18:00:00Z'),
    venue: 'O2 Indigo, Greenwich, London',
    price: 4500000, // ₦45,000
    capacity: 2800,
  },
  {
    title: 'Kigali Green Energy & Sustainability Expo',
    date: new Date('2027-01-28T09:00:00Z'),
    venue: 'Kigali Convention Centre, Kigali',
    price: 3500000, // ₦35,000
    capacity: 1000,
  },
  {
    title: 'Midnight Stargazing & Acoustic Campout',
    date: new Date('2026-12-26T21:00:00Z'),
    venue: 'Tarkwa Bay Beach Sanctuary, Lagos',
    price: 850000, // ₦8,500
    capacity: 250,
  },
  {
    title: 'Product Design & UX Masterclass',
    date: new Date('2027-01-16T10:00:00Z'),
    venue: 'Civic Centre, Ozumba Mbadiwe, Lagos',
    price: 1500000, // ₦15,000
    capacity: 300,
  },
  {
    title: 'Tokyo & Global Web3 Builders Meetup',
    date: new Date('2027-02-12T14:00:00Z'),
    venue: 'Shibuya Stream Hall, Tokyo',
    price: 4000000, // ₦40,000
    capacity: 600,
  },
  {
    title: 'Gourmet Wine Tasting & Master Chef Dinner',
    date: new Date('2026-12-20T19:00:00Z'),
    venue: 'Federal Palace Hotel Garden Terrace, Lagos',
    price: 6000000, // ₦60,000
    capacity: 120,
  },
  {
    title: 'Berlin Cyber Defense & DevSecOps Summit',
    date: new Date('2027-02-20T09:00:00Z'),
    venue: 'Berlin Congress Center (bcc), Alexanderplatz, Berlin',
    price: 4800000, // ₦48,000
    capacity: 900,
  },
  {
    title: 'New Year’s Eve Beach Countdown Party',
    date: new Date('2026-12-31T20:00:00Z'),
    venue: 'Landmark Beachfront Arena, Lagos',
    price: 3500000, // ₦35,000
    capacity: 4000,
  },
];

async function main() {
  console.log(`Seeding ${eventsData.length} live events into Neon PostgreSQL...`);

  let createdCount = 0;
  for (const ev of eventsData) {
    // Upsert or create if title does not exist
    const existing = await prisma.event.findFirst({
      where: { title: ev.title },
    });

    if (existing) {
      console.log(`- Event "${ev.title}" already exists, updating capacity/date...`);
      await prisma.event.update({
        where: { id: existing.id },
        data: {
          date: ev.date,
          venue: ev.venue,
          price: ev.price,
          capacity: ev.capacity,
        },
      });
    } else {
      await prisma.event.create({
        data: ev,
      });
      createdCount++;
      console.log(`+ Created event: ${ev.title} (${ev.venue})`);
    }
  }

  console.log(`Seeding complete! ${createdCount} new events created, total ${eventsData.length} active.`);
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
