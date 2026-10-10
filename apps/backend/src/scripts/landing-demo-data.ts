// Fictional people and companies for the landing-page screenshot account
// (see seed-landing-demo.ts). Nothing here is a real person: the names are
// invented and every LinkedIn URL lives under /in/qampi-demo-*, so a capture
// can never leak a real prospect onto the marketing site.

export interface DemoLead {
    first: string;
    last: string;
    title: string;
    company: string;
    location: string;
    country: string;
    email?: string;
    tags: string[];
    latestPost?: string;
}

export const DEMO_LEADS: DemoLead[] = [
    { first: 'Sarah', last: 'Mitchell', title: 'VP of Sales', company: 'Brightloop', location: 'Austin, Texas', country: 'United States', email: 'sarah@brightloop.io', tags: ['hot-lead', 'saas'], latestPost: 'We just doubled our SDR team. Hiring well is the hardest part of scaling sales.' },
    { first: 'Daniel', last: 'Okafor', title: 'Founder & CEO', company: 'Ledgerly', location: 'London, England', country: 'United Kingdom', email: 'daniel@ledgerly.co', tags: ['founder', 'fintech'], latestPost: 'Closed our Series A. Huge thanks to the team who believed early.' },
    { first: 'Priya', last: 'Raman', title: 'Head of Growth', company: 'Cartwheel', location: 'Bengaluru, Karnataka', country: 'India', email: 'priya@cartwheel.in', tags: ['hot-lead', 'growth'], latestPost: 'Outbound is not dead. Lazy outbound is.' },
    { first: 'Marcus', last: 'Lindqvist', title: 'Director of Revenue Operations', company: 'Northwind Cloud', location: 'Stockholm, Sweden', country: 'Sweden', email: 'marcus@northwindcloud.se', tags: ['revops'] },
    { first: 'Elena', last: 'Vasquez', title: 'Chief Revenue Officer', company: 'Pallet Health', location: 'Miami, Florida', country: 'United States', email: 'elena@pallethealth.com', tags: ['hot-lead', 'healthtech'], latestPost: 'Our pipeline review this quarter: 3 lessons on qualifying earlier.' },
    { first: 'James', last: 'Whitfield', title: 'Talent Acquisition Lead', company: 'Forgeworks', location: 'Toronto, Ontario', country: 'Canada', tags: ['recruiting'] },
    { first: 'Aiko', last: 'Tanaka', title: 'Co-founder', company: 'Mintleaf AI', location: 'San Francisco, California', country: 'United States', email: 'aiko@mintleaf.ai', tags: ['founder', 'ai'], latestPost: 'Shipping our agent SDK today. Two years of work in one launch.' },
    { first: 'Rohan', last: 'Mehta', title: 'Sales Manager', company: 'Quillstack', location: 'Pune, Maharashtra', country: 'India', email: 'rohan@quillstack.com', tags: ['saas'] },
    { first: 'Claire', last: 'Dubois', title: 'VP Marketing', company: 'Atelier Commerce', location: 'Paris, France', country: 'France', tags: ['marketing'] },
    { first: 'Tomás', last: 'Herrera', title: 'Founder', company: 'Rutas Logistics', location: 'Mexico City', country: 'Mexico', email: 'tomas@rutas.mx', tags: ['founder', 'logistics'] },
    { first: 'Hannah', last: 'Brooks', title: 'Head of People', company: 'Sproutly', location: 'Denver, Colorado', country: 'United States', tags: ['recruiting'] },
    { first: 'Wei', last: 'Zhang', title: 'Account Executive', company: 'Datavine', location: 'Singapore', country: 'Singapore', email: 'wei@datavine.sg', tags: ['saas'] },
    { first: 'Olivia', last: 'Grant', title: 'Partner', company: 'Keystone Ventures', location: 'Boston, Massachusetts', country: 'United States', tags: ['investor'], latestPost: 'What we look for in a seed-stage sales motion.' },
    { first: 'Arjun', last: 'Nair', title: 'Founder', company: 'Tiffin Labs', location: 'Mumbai, Maharashtra', country: 'India', email: 'arjun@tiffinlabs.in', tags: ['founder'] },
    { first: 'Sofia', last: 'Rossi', title: 'Business Development Lead', company: 'Vela Studio', location: 'Milan, Italy', country: 'Italy', tags: ['agency'] },
    { first: 'Noah', last: 'Feldman', title: 'Head of Sales', company: 'Gridline Energy', location: 'Chicago, Illinois', country: 'United States', email: 'noah@gridline.energy', tags: ['hot-lead'] },
    { first: 'Amara', last: 'Nwosu', title: 'COO', company: 'Kora Pay', location: 'Lagos', country: 'Nigeria', tags: ['fintech'] },
    { first: 'Lucas', last: 'Becker', title: 'Senior Recruiter', company: 'Halden Systems', location: 'Berlin, Germany', country: 'Germany', tags: ['recruiting'] },
    { first: 'Grace', last: 'Liu', title: 'Director of Partnerships', company: 'Oakmont Learning', location: 'Seattle, Washington', country: 'United States', email: 'grace@oakmont.edu', tags: ['edtech'] },
    { first: 'Ethan', last: 'Clarke', title: 'Founder', company: 'Pocketmint', location: 'Sydney, New South Wales', country: 'Australia', tags: ['founder', 'fintech'] },
    { first: 'Meera', last: 'Iyer', title: 'Product Marketing Manager', company: 'Cloudnest', location: 'Hyderabad, Telangana', country: 'India', tags: ['marketing'] },
    { first: 'Ben', last: 'Carter', title: 'VP Business Development', company: 'Summit Freight', location: 'Atlanta, Georgia', country: 'United States', email: 'ben@summitfreight.com', tags: ['logistics'] },
    { first: 'Isabel', last: 'Moreno', title: 'Head of Customer Success', company: 'Helio CRM', location: 'Madrid, Spain', country: 'Spain', tags: ['saas'] },
    { first: 'Kenji', last: 'Watanabe', title: 'Engineering Manager', company: 'Driftwood Labs', location: 'Tokyo', country: 'Japan', tags: ['hiring'] },
];
