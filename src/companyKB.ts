/**
 * Omevision Company Knowledge Base
 * Single source of truth for all product info used in blog generation.
 * Keep this updated as products evolve.
 */

export interface CompanyInfo {
  name: string;
  tagline: string;
  description: string;
  website: string;
  blogUrl: string;
  primaryColor: string;
  emoji: string;
  founded: string;
  headquarters: string;
  category: string;
  keyFeatures: string[];
  targetAudience: string;
  ctaText: string;
  ctaUrl: string;
}

export const COMPANY_KB: Record<string, CompanyInfo> = {
  eneza: {
    name: 'Eneza',
    tagline: 'WhatsApp Status Advertising for African Businesses',
    description: 'Eneza is a WhatsApp Status advertising platform that connects brands with African consumers through authentic, peer-to-peer WhatsApp Status ads. Businesses pay content creators and everyday users to post branded content on their WhatsApp Status, reaching thousands of engaged contacts at a fraction of traditional ad costs.',
    website: 'https://eneza.app',
    blogUrl: 'https://blog.eneza.app',
    primaryColor: '#25D366',
    emoji: '📱',
    founded: '2023',
    headquarters: 'Mbabane, Eswatini',
    category: 'AdTech / Social Media Advertising',
    keyFeatures: [
      'WhatsApp Status ad campaigns',
      'Creator/influencer network',
      'Performance-based pricing',
      'Real-time campaign analytics',
      'Pan-African reach',
    ],
    targetAudience: 'Small and medium businesses in Africa wanting affordable digital advertising, and individuals who want to earn by posting ads on their WhatsApp Status',
    ctaText: 'Start advertising on WhatsApp Status',
    ctaUrl: 'https://eneza.app',
  },

  yebolink: {
    name: 'YeboLink',
    tagline: 'Communications API Platform for Africa',
    description: 'YeboLink is an African communications API platform that enables businesses to send SMS, WhatsApp messages, emails, and voice calls at scale. Developers and businesses use YeboLink\'s simple API to build notification systems, OTP verification, marketing campaigns, and customer engagement tools.',
    website: 'https://yebolink.com',
    blogUrl: 'https://blog.yebolink.com',
    primaryColor: '#6366f1',
    emoji: '🔗',
    founded: '2024',
    headquarters: 'Mbabane, Eswatini',
    category: 'Communications / CPaaS',
    keyFeatures: [
      'SMS API (bulk & transactional)',
      'WhatsApp Business API',
      'Email API',
      'Voice API',
      'OTP & 2FA verification',
      'USSD gateway',
      'Developer-friendly REST API',
    ],
    targetAudience: 'Developers, startups, and enterprises across Africa that need reliable communication infrastructure',
    ctaText: 'Get started with YeboLink API',
    ctaUrl: 'https://yebolink.com',
  },

  vavu: {
    name: 'Vavu',
    tagline: 'Africa\'s AI-Powered Classifieds Marketplace',
    description: 'Vavu is an AI-powered classifieds marketplace built for Africa. Sellers can list anything from electronics and furniture to vehicles and services. Vavu uses AI to analyze product listings, suggest optimal prices, and match buyers with sellers across the continent.',
    website: 'https://vavu.app',
    blogUrl: 'https://blog.vavu.app',
    primaryColor: '#f97316',
    emoji: '🛒',
    founded: '2024',
    headquarters: 'Mbabane, Eswatini',
    category: 'E-commerce / Classifieds',
    keyFeatures: [
      'AI product analysis and pricing',
      'Multi-category listings',
      'Secure buyer-seller messaging',
      'Photo uploads via mobile',
      'Location-based search',
    ],
    targetAudience: 'Buyers and sellers across Africa looking for a trustworthy, modern classifieds platform',
    ctaText: 'Buy and sell on Vavu',
    ctaUrl: 'https://vavu.app',
  },

  bamzu: {
    name: 'Bamzu',
    tagline: 'Africa\'s Car Marketplace',
    description: 'Bamzu is a dedicated car marketplace for Africa, connecting buyers and sellers of new and used vehicles across the continent. Bamzu makes it easy to search, compare, and purchase cars with detailed specs, photos, pricing, and financing options.',
    website: 'https://bamzu.app',
    blogUrl: 'https://blog.bamzu.app',
    primaryColor: '#ef4444',
    emoji: '🚗',
    founded: '2024',
    headquarters: 'Mbabane, Eswatini',
    category: 'Automotive / Marketplace',
    keyFeatures: [
      'New and used car listings',
      'Detailed vehicle specs and photos',
      'Price comparison tools',
      'Car financing options',
      'Verified dealer listings',
      '474+ car models across 48 makes',
    ],
    targetAudience: 'Car buyers and dealers across Africa looking for a dedicated, trustworthy automotive marketplace',
    ctaText: 'Find your next car on Bamzu',
    ctaUrl: 'https://bamzu.app',
  },

  yebona: {
    name: 'Yebona',
    tagline: 'Africa-China Trade Services Marketplace',
    description: 'Yebona is a marketplace connecting African importers and businesses with verified China trade service providers. Services include currency exchange (local currency to RMB), sourcing agents, factory verification, freight forwarding, translation, and trade consulting — all with escrow protection.',
    website: 'https://yebona.com',
    blogUrl: 'https://blog.yebona.com',
    primaryColor: '#f59e0b',
    emoji: '🌏',
    founded: '2025',
    headquarters: 'Mbabane, Eswatini',
    category: 'Trade / Import-Export',
    keyFeatures: [
      'Verified China trade service providers',
      'Currency exchange (NGN/ZAR/KES to RMB)',
      'Sourcing agents and factory verification',
      'Freight forwarding and customs clearing',
      'Escrow payment protection',
      'Translation and trade consulting',
    ],
    targetAudience: 'African businesses and entrepreneurs who import from China and need reliable, verified trade service partners',
    ctaText: 'Connect with verified trade services on Yebona',
    ctaUrl: 'https://yebona.com',
  },

  yebojobs: {
    name: 'YeboJobs',
    tagline: 'The Job Matching Platform for Africa',
    description: 'YeboJobs is a job matching platform built for Africa, connecting job seekers with formal employers and informal service providers. The platform features AI-powered job matching, swipe-style discovery, skills verification, and an informal services marketplace for gig workers.',
    website: 'https://yebojobs.com',
    blogUrl: 'https://blog.yebojobs.com',
    primaryColor: '#3b82f6',
    emoji: '💼',
    founded: '2024',
    headquarters: 'Mbabane, Eswatini',
    category: 'Employment / HR Tech',
    keyFeatures: [
      'AI-powered job matching',
      'Swipe-to-apply job discovery',
      'Informal services marketplace',
      'Skills and experience verification',
      'Employer and recruiter tools',
      'Gig economy support',
    ],
    targetAudience: 'Job seekers across Africa (both formal employment and gig work), and employers from SMEs to large enterprises',
    ctaText: 'Find your next job on YeboJobs',
    ctaUrl: 'https://yebojobs.com',
  },

  yebolearn: {
    name: 'YeboLearn',
    tagline: 'Online Education Platform for Africa',
    description: 'YeboLearn is an online education platform purpose-built for Africa, offering courses, certifications, and learning paths across tech, business, and vocational skills. Students, teachers, parents, and institutions all have dedicated portals on the platform.',
    website: 'https://yebolearn.com',
    blogUrl: 'https://blog.yebolearn.com',
    primaryColor: '#8b5cf6',
    emoji: '📚',
    founded: '2024',
    headquarters: 'Mbabane, Eswatini',
    category: 'EdTech / Online Education',
    keyFeatures: [
      'Online courses and certifications',
      'Student, teacher, and parent portals',
      'Kids learning app',
      'Institution management dashboard',
      'African-relevant curriculum',
      'Mobile-first learning experience',
    ],
    targetAudience: 'Students, teachers, parents, and educational institutions across Africa seeking quality online education',
    ctaText: 'Start learning on YeboLearn',
    ctaUrl: 'https://yebolearn.com',
  },

  yebomart: {
    name: 'YeboMart',
    tagline: 'AI-Powered Shop Management for African Businesses',
    description: 'YeboMart is an AI-powered point-of-sale and shop management system built for African small businesses. It helps shop owners manage inventory, track sales, handle staff, manage suppliers, and get AI-powered business insights — all from their phone or web browser.',
    website: 'https://yebomart.com',
    blogUrl: 'https://blog.yebomart.com',
    primaryColor: '#10b981',
    emoji: '🏪',
    founded: '2025',
    headquarters: 'Mbabane, Eswatini',
    category: 'POS / Business Management',
    keyFeatures: [
      'Point-of-sale (POS) system',
      'Inventory management',
      'Staff and supplier management',
      'AI business assistant',
      'Sales analytics and reports',
      'Multi-country pricing (15 African countries)',
      'Barcode scanning',
    ],
    targetAudience: 'Small and medium shop owners across Africa — grocery stores, spaza shops, butcheries, pharmacies, salons, and more',
    ctaText: 'Manage your shop with YeboMart',
    ctaUrl: 'https://yebomart.com',
  },
};

/**
 * Get a formatted context string to inject into blog generation prompts.
 * This ensures the AI knows exactly what the company does, its correct domain, and how to reference it.
 */
export function getCompanyContext(company: string): string {
  const info = COMPANY_KB[company.toLowerCase()];
  if (!info) return `${company} is an African tech product by Omevision.`;

  return `
COMPANY KNOWLEDGE BASE — USE THIS EXACTLY:
- Company Name: ${info.name}
- Website: ${info.website}
- Blog: ${info.blogUrl}
- Tagline: "${info.tagline}"
- Category: ${info.category}
- Headquarters: ${info.headquarters}
- Description: ${info.description}
- Key Features: ${info.keyFeatures.join(', ')}
- Target Audience: ${info.targetAudience}
- Call to Action: "${info.ctaText}" → ${info.ctaUrl}

RULES:
1. Always use "${info.website}" as the company website URL — never invent a domain
2. Refer to the company as "${info.name}" (not lowercase, not with "app" suffix unless it's part of the URL)
3. The CTA link at the end must point to ${info.ctaUrl}
4. Do not make up features or services not listed above
`.trim();
}
