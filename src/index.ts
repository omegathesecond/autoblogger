import express from 'express';
import cors from 'cors';
import { PrismaClient, BlogStatus } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { getCompanyContext, COMPANY_KB } from './companyKB';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 8080;

// Initialize Gemini
const genAI = process.env.GEMINI_API_KEY 
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

app.use(cors());
app.use(express.json());

const SEO_MATRIX: Record<string, { keywords: string[], countries: string[] }> = {
  eneza: {
    keywords: [
      'WhatsApp status ads', 'WhatsApp advertising platform', 'advertise on WhatsApp',
      'WhatsApp marketing', 'WhatsApp status marketing', 'social media advertising',
      'mobile advertising platform', 'WhatsApp ads for business', 'digital advertising Africa',
      'cheap advertising platform', 'targeted mobile ads', 'WhatsApp promotions',
      'small business advertising', 'local business marketing', 'affordable digital ads'
    ],
    countries: ['Kenya', 'Eswatini', 'South Africa', 'Nigeria', 'Tanzania', 'Uganda', 'Ghana', 'Rwanda', 'Ethiopia', 'Zambia']
  },
  yebojobs: {
    keywords: [
      'job search sites', 'find jobs online', 'employment platform', 'career opportunities',
      'job vacancies', 'recruitment platform', 'hire employees', 'job board',
      'remote jobs', 'part time jobs', 'internship opportunities', 'graduate jobs',
      'tech jobs', 'entry level jobs', 'freelance work platform'
    ],
    countries: ['Kenya', 'Eswatini', 'South Africa', 'Nigeria', 'Tanzania', 'Uganda', 'Ghana', 'Rwanda', 'Ethiopia', 'Zambia']
  },
  vavu: {
    keywords: [
      'online shopping sites', 'buy and sell online', 'classifieds marketplace',
      'second hand items', 'online marketplace', 'sell stuff online', 'buy used items',
      'local marketplace app', 'cheap products online', 'online store',
      'electronics for sale', 'furniture marketplace', 'fashion marketplace',
      'deals and discounts', 'trusted online shopping'
    ],
    countries: ['Kenya', 'Eswatini', 'South Africa', 'Nigeria', 'Tanzania', 'Uganda', 'Ghana', 'Rwanda', 'Zambia', 'Mozambique']
  },
  bamzu: {
    keywords: [
      'buy cars online', 'used cars for sale', 'car marketplace', 'affordable cars',
      'sell my car', 'car dealership online', 'second hand cars', 'car prices',
      'best cars to buy', 'car financing', 'import cars', 'car reviews',
      'SUV for sale', 'cheap cars', 'certified used cars'
    ],
    countries: ['Kenya', 'Eswatini', 'South Africa', 'Nigeria', 'Tanzania', 'Uganda', 'Ghana', 'Rwanda', 'Zambia', 'Botswana']
  },
  yebona: {
    keywords: [
      'import from China to Africa', 'China sourcing agent', 'trade services Africa',
      'shipping from China', 'wholesale from China', 'factory verification China',
      'currency exchange Africa China', 'freight forwarding Africa', 'customs clearing',
      'buy from Alibaba', 'China trade consultant', 'import export business',
      'dropshipping from China', 'product sourcing', 'trade finance Africa'
    ],
    countries: ['Kenya', 'Nigeria', 'South Africa', 'Tanzania', 'Ghana', 'Uganda', 'Ethiopia', 'Zambia', 'Mozambique', 'Rwanda']
  },
  yebolink: {
    keywords: [
      'SMS API', 'bulk messaging platform', 'WhatsApp business API',
      'communication API', 'send SMS online', 'business messaging',
      'OTP verification service', 'transactional SMS', 'marketing SMS platform',
      'two way messaging', 'SMS gateway', 'notification service',
      'email API', 'voice API', 'omnichannel messaging'
    ],
    countries: ['Kenya', 'Eswatini', 'South Africa', 'Nigeria', 'Tanzania', 'Uganda', 'Ghana', 'Rwanda', 'Ethiopia', 'Zambia']
  }
};

async function pickNextKeywords(company: string, count: number = 3): Promise<{keyword: string, country: string}[]> {
  const matrix = SEO_MATRIX[company];
  if (!matrix) return [];

  const existing = await prisma.blog.findMany({
    where: { company },
    select: { targetKeyword: true, targetCountry: true }
  });
  const usedCombos = new Set(existing.map(e => `${e.targetKeyword}||${e.targetCountry}`));

  const allCombos: {keyword: string, country: string}[] = [];
  for (const keyword of matrix.keywords) {
    for (const country of matrix.countries) {
      if (!usedCombos.has(`${keyword}||${country}`)) {
        allCombos.push({ keyword, country });
      }
    }
  }

  for (let i = allCombos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allCombos[i], allCombos[j]] = [allCombos[j], allCombos[i]];
  }

  return allCombos.slice(0, count);
}

async function generateBlogImage(title: string, company: string): Promise<string | null> {
  if (!genAI) return null;
  
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const imagePromptResult = await model.generateContent([
      { text: `Create a short, vivid image description (1-2 sentences) for a blog featured image about: "${title}" for ${company}. The image should be professional, modern, and relevant to African tech/business. Return ONLY the image description, nothing else.` }
    ]);
    
    const imagePrompt = imagePromptResult.response.text().trim();
    console.log(`Image prompt: ${imagePrompt}`);
    
    return imagePrompt;
  } catch (err) {
    console.error('Image prompt generation failed:', err);
    return null;
  }
}

// Auth middleware
const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'autoblogger',
    gemini: !!genAI,
    timestamp: new Date().toISOString()
  });
});

// Generate blog content with Gemini
async function generateBlogContent(prompt: string, company: string, category?: string): Promise<{
  title: string;
  content: string;
  excerpt: string;
  tags: string[];
}> {
  if (!genAI) {
    throw new Error('Gemini API not configured');
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  const companyContext = getCompanyContext(company);

  const systemPrompt = `You are a professional blog writer for ${company}, an African tech company.

${companyContext}

Write engaging, informative blog posts that are:
- SEO optimized
- Easy to read
- Relevant to African audiences
- Professional but conversational
- Always include a CTA at the end linking to the correct website

Category: ${category || 'General'}

Return JSON with this exact structure:
{
  "title": "Blog title here",
  "content": "Full blog content in markdown format...",
  "excerpt": "2-3 sentence summary",
  "tags": ["tag1", "tag2", "tag3"]
}`;

  const result = await model.generateContent([
    { text: systemPrompt },
    { text: prompt }
  ]);

  const response = result.response.text();
  
  // Extract JSON from response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse Gemini response');
  }
  
  return JSON.parse(jsonMatch[0]);
}

// Generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

// POST /api/blogs/generate - Generate a new blog
app.post('/api/blogs/generate', authenticate, async (req, res) => {
  try {
    const { prompt, company, category } = req.body;

    if (!prompt || !company) {
      return res.status(400).json({ error: 'prompt and company are required' });
    }

    const generated = await generateBlogContent(prompt, company, category);
    const slug = generateSlug(generated.title);

    const blog = await prisma.blog.create({
      data: {
        title: generated.title,
        slug,
        content: generated.content,
        excerpt: generated.excerpt,
        company,
        category: category || null,
        tags: generated.tags,
        status: BlogStatus.GENERATED,
        prompt,
        model: 'gemini-2.5-flash'
      }
    });

    res.json({ success: true, blog });
  } catch (error: any) {
    console.error('Generate error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/blogs - List blogs (public - read-only)
app.get('/api/blogs', async (req, res) => {
  try {
    const company = req.query.company as string | undefined;
    const status = req.query.status as BlogStatus | undefined;
    const slug = req.query.slug as string | undefined;
    const limit = parseInt(req.query.limit as string || '20');
    const offset = parseInt(req.query.offset as string || '0');

    const blogs = await prisma.blog.findMany({
      where: {
        ...(company && { company }),
        ...(status && { status }),
        ...(slug && { slug })
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    res.json({ success: true, blogs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/blogs/stats - Real analytics across all companies
app.get('/api/blogs/stats', async (req, res) => {
  try {
    const [total, published, generated, failed, byCompany] = await Promise.all([
      prisma.blog.count(),
      prisma.blog.count({ where: { status: BlogStatus.PUBLISHED } }),
      prisma.blog.count({ where: { status: BlogStatus.GENERATED } }),
      prisma.blog.count({ where: { status: BlogStatus.FAILED } }),
      prisma.blog.groupBy({
        by: ['company', 'status'],
        _count: { id: true }
      })
    ]);

    // Build per-company stats
    const companies: Record<string, any> = {};
    for (const row of byCompany) {
      if (!companies[row.company]) companies[row.company] = { total: 0, published: 0, generated: 0, failed: 0 };
      companies[row.company].total += row._count.id;
      companies[row.company][row.status.toLowerCase()] = row._count.id;
    }

    res.json({ success: true, stats: { total, published, generated, failed, byCompany: companies } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/blogs/seo-coverage - Show keyword coverage stats
app.get('/api/blogs/seo-coverage', authenticate, async (req, res) => {
  try {
    const coverage: any = {};
    
    for (const [company, matrix] of Object.entries(SEO_MATRIX)) {
      const existing = await prisma.blog.findMany({
        where: { company },
        select: { targetKeyword: true, targetCountry: true }
      });
      const usedCombos = new Set(existing.map(e => `${e.targetKeyword}||${e.targetCountry}`));
      
      const totalCombos = matrix.keywords.length * matrix.countries.length;
      const covered = existing.filter(e => e.targetKeyword && e.targetCountry).length;
      
      coverage[company] = {
        totalKeywords: matrix.keywords.length,
        totalCountries: matrix.countries.length,
        totalCombinations: totalCombos,
        covered,
        remaining: totalCombos - covered,
        percentComplete: Math.round((covered / totalCombos) * 100)
      };
    }
    
    res.json({ success: true, coverage });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/blogs/:id - Get single blog (public - read-only)
app.get('/api/blogs/:id', async (req, res) => {
  try {
    const blog = await prisma.blog.findUnique({
      where: { id: req.params.id as string }
    });

    if (!blog) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    res.json({ success: true, blog });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/blogs/auto-publish - Auto-publish all GENERATED posts to their target products
app.post('/api/blogs/auto-publish', authenticate, async (req, res) => {
  try {
    const generatedBlogs = await prisma.blog.findMany({
      where: { status: BlogStatus.GENERATED }
    });

    const results = [];

    for (const blog of generatedBlogs) {
      try {
        const targetUrl = getProductBlogUrl(blog.company);
        const apiKey = getProductApiKey(blog.company);

        if (!targetUrl || !apiKey) {
          results.push({ id: blog.id, company: blog.company, success: false, error: `No endpoint for ${blog.company}` });
          continue;
        }

        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
          body: JSON.stringify({
            title: blog.title, slug: blog.slug, content: blog.content,
            excerpt: blog.excerpt, category: blog.category, tags: blog.tags
          })
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(error);
        }

        await prisma.blog.update({
          where: { id: blog.id },
          data: { status: BlogStatus.PUBLISHED, publishedAt: new Date(), pushedAt: new Date(), pushError: null }
        });

        results.push({ id: blog.id, company: blog.company, success: true });
      } catch (error: any) {
        await prisma.blog.update({
          where: { id: blog.id },
          data: { status: BlogStatus.FAILED, pushError: error.message }
        });
        results.push({ id: blog.id, company: blog.company, success: false, error: error.message });
      }
    }

    res.json({ success: true, published: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length, results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/blogs/:id/publish - Publish blog to target product
app.post('/api/blogs/:id/publish', authenticate, async (req, res) => {
  try {
    const blog = await prisma.blog.findUnique({
      where: { id: req.params.id as string }
    });

    if (!blog) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    // Push to the target product's blog API
    const targetUrl = getProductBlogUrl(blog.company);
    const apiKey = getProductApiKey(blog.company);

    if (!targetUrl || !apiKey) {
      throw new Error(`No blog endpoint configured for ${blog.company}`);
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        title: blog.title,
        slug: blog.slug,
        content: blog.content,
        excerpt: blog.excerpt,
        category: blog.category,
        tags: blog.tags
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to publish: ${error}`);
    }

    // Update blog status
    const updated = await prisma.blog.update({
      where: { id: blog.id },
      data: {
        status: BlogStatus.PUBLISHED,
        publishedAt: new Date(),
        pushedAt: new Date(),
        pushError: null
      }
    });

    res.json({ success: true, blog: updated });
  } catch (error: any) {
    // Record push error
    await prisma.blog.update({
      where: { id: req.params.id as string },
      data: {
        status: BlogStatus.FAILED,
        pushError: error.message
      }
    });

    res.status(500).json({ error: error.message });
  }
});

// POST /api/blogs/generate-seo - Generate SEO-targeted posts for a company
app.post('/api/blogs/generate-seo', authenticate, async (req, res) => {
  try {
    const { company, count = 3 } = req.body;
    
    if (!company) {
      return res.status(400).json({ error: 'company is required' });
    }
    
    const targets = await pickNextKeywords(company, count);
    
    if (targets.length === 0) {
      return res.json({ success: true, message: 'All keyword combinations covered!', blogs: [] });
    }
    
    const results = [];
    
    for (const target of targets) {
      try {
        const kb = getCompanyContext(company);
        const seoPrompt = `${kb}

Write a comprehensive, SEO-optimized blog post targeting the keyword "${target.keyword} in ${target.country}".

Requirements:
- Title MUST contain "${target.keyword} in ${target.country}" or a close variant
- Use the keyword naturally 3-5 times in the content
- Include local context specific to ${target.country}
- Mention the company above as a solution (naturally, not forced) using the correct website URL
- Include actionable tips or information
- Target 800-1200 words
- Include a compelling meta description
- Use headers (H2, H3) for structure
- End with a CTA linking to the correct company website`;

        const generated = await generateBlogContent(seoPrompt, company, 'seo');
        const slug = generateSlug(generated.title);
        const imagePrompt = await generateBlogImage(generated.title, company);

        const blog = await prisma.blog.create({
          data: {
            title: generated.title,
            slug,
            content: generated.content,
            excerpt: generated.excerpt,
            company,
            category: 'seo',
            tags: [...generated.tags, target.country.toLowerCase(), target.keyword.split(' ')[0]],
            status: BlogStatus.GENERATED,
            prompt: seoPrompt,
            model: 'gemini-2.5-flash',
            targetKeyword: target.keyword,
            targetCountry: target.country,
          }
        });

        results.push({ id: blog.id, keyword: target.keyword, country: target.country, title: blog.title, success: true });
      } catch (err: any) {
        results.push({ keyword: target.keyword, country: target.country, success: false, error: err.message });
      }
    }
    
    res.json({ success: true, generated: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length, results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Dashboard-driven generation
//
// Fetches the CEO dashboard activity feed (tasks completed in the last N hours,
// grouped by product) and, for each product that had activity, generates a
// daily digest blog post summarising what shipped. Auto-publishes each
// generated post to the matching product blog endpoint.
//
// Triggered by Cloud Scheduler at 09:00 SAST daily, but also callable manually
// for backfill / debugging via the same endpoint.
// ──────────────────────────────────────────────────────────────────────────────

const CEO_DASHBOARD_API_URL =
  process.env.CEO_DASHBOARD_API_URL ||
  'https://ceo-dashboard-api-238692725328.europe-west1.run.app';

// Map dashboard product names → autoblogger company keys. Most are the same,
// but the rebrand aliases (yebocars=bamzu, yeboshops=vavu) need translation
// because the autoblogger's company knowledge base + publish endpoints still
// use the legacy keys.
const PRODUCT_TO_COMPANY: Record<string, string> = {
  eneza: 'eneza',
  yebojobs: 'yebojobs',
  yebolearn: 'yebolearn',
  yebolink: 'yebolink',
  yebomart: 'yebomart',
  yebona: 'yebona',
  yebocars: 'bamzu',   // rebrand: Bamzu → yebocars
  bamzu: 'bamzu',
  yeboshops: 'vavu',   // rebrand: Vavu → yeboshops
  vavu: 'vavu',
};

interface DashboardActivity {
  type: string;
  product: string;
  title: string;
  description: string | null;
  priority: string | null;
  labels: string[];
  taskId: string;
  occurredAt: string;
}

async function fetchDashboardActivityByProduct(
  sinceHours: number
): Promise<Record<string, DashboardActivity[]>> {
  const internalKey = process.env.CEO_DASHBOARD_INTERNAL_KEY;
  if (!internalKey) {
    throw new Error(
      'CEO_DASHBOARD_INTERNAL_KEY not set — autoblogger cannot authenticate to dashboard API'
    );
  }

  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
  const url = `${CEO_DASHBOARD_API_URL}/api/activities/by-product?since=${encodeURIComponent(since)}`;

  const resp = await fetch(url, {
    headers: { 'X-Internal-Key': internalKey },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(
      `Dashboard activities fetch failed (${resp.status}): ${text.slice(0, 200)}`
    );
  }

  const data = (await resp.json()) as {
    success: boolean;
    products: Record<string, DashboardActivity[]>;
  };
  return data.products || {};
}

function buildDigestPrompt(
  company: string,
  activities: DashboardActivity[],
  windowHours: number
): string {
  const kb = getCompanyContext(company);
  const items = activities
    .map((a, i) => {
      const desc = a.description ? ` — ${a.description.slice(0, 200)}` : '';
      return `${i + 1}. ${a.title}${desc}`;
    })
    .join('\n');

  return `${kb}

Write a "What we shipped" digest blog post for ${company}, summarising the work that was completed in the last ${windowHours} hours. Use the following internal completion log as your source material — translate it into customer-facing language. Do NOT mention internal task IDs, status values, or anything that sounds like a Jira ticket.

INTERNAL COMPLETION LOG (last ${windowHours}h):
${items}

Requirements:
- Title: a confident, customer-facing headline (NOT "Daily Digest" — make it specific to what shipped). Examples: "New ways to reach more customers on WhatsApp", "Faster onboarding for new sellers", "What's new this week".
- Open with a 1-2 sentence overview of the theme of the work.
- Then a list (or short prose) covering each shipped item. Group similar items together. Translate engineering language into product/user benefit language — readers don't care about implementation, they care about what's now possible.
- 400–700 words total. Tight, scannable, useful.
- End with a CTA linking to ${COMPANY_KB[company]?.ctaUrl || COMPANY_KB[company]?.website}.
- If a shipped item isn't customer-facing (internal refactor, infra), summarise it as "behind-the-scenes improvements" rather than dropping it.
- Use markdown headers (## and ###) for structure. Keep it skimmable.`;
}

// POST /api/blogs/generate-from-dashboard
// Body: { sinceHours?: number, dryRun?: boolean, autoPublish?: boolean }
// Defaults: sinceHours=24, dryRun=false, autoPublish=true
// Also accepts X-Job-Secret header for cron-style invocation (no INTERNAL_API_KEY required).
app.post('/api/blogs/generate-from-dashboard', async (req, res) => {
  // Auth: accept either INTERNAL_API_KEY (manual ops) OR JOB_SECRET (Cloud Scheduler).
  const apiKey =
    (req.headers['x-api-key'] as string | undefined) ||
    (req.headers['authorization'] as string | undefined)?.replace('Bearer ', '');
  const jobSecret = req.headers['x-job-secret'] as string | undefined;

  const apiKeyOk = !!apiKey && apiKey === process.env.INTERNAL_API_KEY;
  const jobSecretOk = !!jobSecret && jobSecret === process.env.JOB_SECRET;
  if (!apiKeyOk && !jobSecretOk) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const sinceHours = Number(req.body?.sinceHours) || 24;
    const dryRun = req.body?.dryRun === true;
    const autoPublish = req.body?.autoPublish !== false; // default true

    const productsActivity = await fetchDashboardActivityByProduct(sinceHours);
    const productKeys = Object.keys(productsActivity);

    if (productKeys.length === 0) {
      return res.json({
        success: true,
        message: `No activity in the last ${sinceHours}h — nothing to post.`,
        sinceHours,
        generated: 0,
      });
    }

    const results: any[] = [];

    for (const productKey of productKeys) {
      const company = PRODUCT_TO_COMPANY[productKey.toLowerCase()];
      if (!company || !COMPANY_KB[company]) {
        results.push({
          product: productKey,
          success: false,
          skipped: true,
          reason: `No company mapping or KB entry for "${productKey}" — add to PRODUCT_TO_COMPANY + companyKB.ts`,
        });
        continue;
      }

      const activities = productsActivity[productKey];
      const prompt = buildDigestPrompt(company, activities, sinceHours);

      if (dryRun) {
        results.push({
          product: productKey,
          company,
          activityCount: activities.length,
          dryRun: true,
          promptPreview: prompt.slice(0, 300) + '...',
        });
        continue;
      }

      try {
        const generated = await generateBlogContent(prompt, company, 'dashboard-digest');
        const slug = generateSlug(generated.title);

        const blog = await prisma.blog.create({
          data: {
            title: generated.title,
            slug,
            content: generated.content,
            excerpt: generated.excerpt,
            company,
            category: 'dashboard-digest',
            tags: [...generated.tags, 'whats-new', 'product-update'],
            status: BlogStatus.GENERATED,
            prompt,
            model: 'gemini-2.5-flash',
          },
        });

        let published = false;
        let publishError: string | null = null;

        if (autoPublish) {
          const targetUrl = getProductBlogUrl(company);
          const apiKeyForProduct = getProductApiKey(company);

          if (!targetUrl || !apiKeyForProduct) {
            publishError = `No publish endpoint configured for ${company}`;
          } else {
            try {
              const pubResp = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-API-Key': apiKeyForProduct,
                },
                body: JSON.stringify({
                  title: blog.title,
                  slug: blog.slug,
                  content: blog.content,
                  excerpt: blog.excerpt,
                  category: blog.category,
                  tags: blog.tags,
                }),
              });
              if (!pubResp.ok) {
                publishError = `Publish failed (${pubResp.status}): ${(await pubResp.text()).slice(0, 200)}`;
              } else {
                published = true;
                await prisma.blog.update({
                  where: { id: blog.id },
                  data: {
                    status: BlogStatus.PUBLISHED,
                    publishedAt: new Date(),
                    pushedAt: new Date(),
                    pushError: null,
                  },
                });
              }
            } catch (e: any) {
              publishError = e.message;
            }
          }

          if (publishError) {
            await prisma.blog.update({
              where: { id: blog.id },
              data: { status: BlogStatus.FAILED, pushError: publishError },
            });
          }
        }

        results.push({
          product: productKey,
          company,
          activityCount: activities.length,
          blogId: blog.id,
          title: blog.title,
          published,
          publishError,
          success: true,
        });
      } catch (err: any) {
        results.push({
          product: productKey,
          company,
          success: false,
          error: err.message,
        });
      }
    }

    res.json({
      success: true,
      sinceHours,
      productsWithActivity: productKeys.length,
      generated: results.filter((r) => r.success).length,
      published: results.filter((r) => r.published).length,
      failed: results.filter((r) => r.success === false).length,
      results,
    });
  } catch (error: any) {
    console.error('generate-from-dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/blogs/generate-all-seo - Generate SEO posts for ALL companies
app.post('/api/blogs/generate-all-seo', authenticate, async (req, res) => {
  try {
    const { postsPerCompany = 3 } = req.body;
    const companies = Object.keys(SEO_MATRIX);
    const allResults: any[] = [];

    for (const company of companies) {
      const targets = await pickNextKeywords(company, postsPerCompany);
      
      for (const target of targets) {
        try {
          const kb = getCompanyContext(company);
          const seoPrompt = `${kb}

Write a comprehensive, SEO-optimized blog post targeting the keyword "${target.keyword} in ${target.country}".

Requirements:
- Title MUST contain "${target.keyword} in ${target.country}" or a close variant
- Use the keyword naturally 3-5 times in the content
- Include local context specific to ${target.country}
- Mention the company above as a solution (naturally, not forced) using the correct website URL
- Include actionable tips or information
- Target 800-1200 words
- Include a compelling meta description
- Use headers (H2, H3) for structure
- End with a CTA linking to the correct company website`;

          const generated = await generateBlogContent(seoPrompt, company, 'seo');
          const slug = generateSlug(generated.title);

          const blog = await prisma.blog.create({
            data: {
              title: generated.title,
              slug,
              content: generated.content,
              excerpt: generated.excerpt,
              company,
              category: 'seo',
              tags: [...generated.tags, target.country.toLowerCase(), target.keyword.split(' ')[0]],
              status: BlogStatus.GENERATED,
              prompt: seoPrompt,
              model: 'gemini-2.5-flash',
              targetKeyword: target.keyword,
              targetCountry: target.country,
            }
          });

          allResults.push({ id: blog.id, company, keyword: target.keyword, country: target.country, title: blog.title, success: true });
        } catch (err: any) {
          allResults.push({ company, keyword: target.keyword, country: target.country, success: false, error: err.message });
        }
      }
    }

    res.json({
      success: true,
      total: allResults.length,
      generated: allResults.filter(r => r.success).length,
      failed: allResults.filter(r => !r.success).length,
      results: allResults
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/blogs/:id - Delete blog
// PATCH /api/blogs/:id — update title, content, excerpt, category, tags, status
app.patch('/api/blogs/:id', authenticate, async (req, res) => {
  try {
    const { title, content, excerpt, category, tags, status } = req.body;
    const data: Record<string, any> = {};
    if (title !== undefined) data.title = title;
    if (content !== undefined) data.content = content;
    if (excerpt !== undefined) data.excerpt = excerpt;
    if (category !== undefined) data.category = category;
    if (tags !== undefined) data.tags = tags;
    if (status !== undefined) {
      data.status = status;
      if (status === 'PUBLISHED' && !data.publishedAt) data.publishedAt = new Date();
    }
    const blog = await prisma.blog.update({ where: { id: req.params.id as string }, data });
    res.json({ success: true, blog });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/blogs/:id', authenticate, async (req, res) => {
  try {
    await prisma.blog.delete({
      where: { id: req.params.id as string }
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Schedules CRUD
app.get('/api/schedules', authenticate, async (req, res) => {
  try {
    const schedules = await prisma.blogSchedule.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, schedules });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/schedules', authenticate, async (req, res) => {
  try {
    const { company, category, cronExpr, prompt, enabled = true } = req.body;

    const schedule = await prisma.blogSchedule.create({
      data: { company, category, cronExpr, prompt, enabled }
    });

    res.json({ success: true, schedule });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/schedules/run - Manually trigger scheduled generation
app.post('/api/schedules/run', authenticate, async (req, res) => {
  try {
    // Verify job secret for cron calls
    const jobSecret = req.headers['x-job-secret'];
    if (jobSecret && jobSecret !== process.env.JOB_SECRET) {
      return res.status(401).json({ error: 'Invalid job secret' });
    }

    const schedules = await prisma.blogSchedule.findMany({
      where: { enabled: true }
    });

    const results = [];

    for (const schedule of schedules) {
      try {
        const generated = await generateBlogContent(
          schedule.prompt,
          schedule.company,
          schedule.category || undefined
        );

        const slug = generateSlug(generated.title);

        const blog = await prisma.blog.create({
          data: {
            title: generated.title,
            slug,
            content: generated.content,
            excerpt: generated.excerpt,
            company: schedule.company,
            category: schedule.category,
            tags: generated.tags,
            status: BlogStatus.GENERATED,
            prompt: schedule.prompt,
            model: 'gemini-2.5-flash'
          }
        });

        await prisma.blogSchedule.update({
          where: { id: schedule.id },
          data: { lastRun: new Date() }
        });

        results.push({ scheduleId: schedule.id, blogId: blog.id, success: true });
      } catch (error: any) {
        results.push({ scheduleId: schedule.id, success: false, error: error.message });
      }
    }

    res.json({ success: true, results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Helper: Get product blog API URL
function getProductBlogUrl(company: string): string | null {
  const urls: Record<string, string> = {
    eneza: process.env.ENEZA_BLOG_URL || 'https://eneza-api-prod-1026777738823.europe-west1.run.app/api/blog/posts',
    yebojobs: process.env.YEBOJOBS_BLOG_URL || 'https://yebojobs-api-376380527123.europe-west1.run.app/api/blog/posts',
    vavu: process.env.VAVU_BLOG_URL || 'https://vavu-api-41980725786.europe-west1.run.app/api/blog/posts',
    bamzu: process.env.BAMZU_BLOG_URL || 'https://bamzu-api-25158090642.europe-west1.run.app/api/blog/posts',
    yebona: process.env.YEBONA_BLOG_URL || 'https://yebona-api-402346709223.europe-west1.run.app/api/blog/posts',
    yebolink: process.env.YEBOLINK_BLOG_URL || 'https://yebolink-api-487987213774.europe-west1.run.app/api/blog/posts',
    yebolearn: process.env.YEBOLEARN_BLOG_URL || '',
    yebomart: process.env.YEBOMART_BLOG_URL || 'https://yebomart-api-717538265700.europe-west1.run.app/api/blog/posts',
  };
  return urls[company.toLowerCase()] || null;
}

// Helper: Get product API key
function getProductApiKey(company: string): string | null {
  const keys: Record<string, string | undefined> = {
    eneza: process.env.ENEZA_BLOG_API_KEY,
    yebojobs: process.env.YEBOJOBS_BLOG_API_KEY,
    vavu: process.env.VAVU_BLOG_API_KEY,
    yebona: process.env.YEBONA_BLOG_API_KEY,
    bamzu: process.env.BAMZU_BLOG_API_KEY,
    yebolink: process.env.YEBOLINK_BLOG_API_KEY,
    yebolearn: process.env.YEBOLEARN_BLOG_API_KEY,
    yebomart: process.env.YEBOMART_BLOG_API_KEY,
  };
  return keys[company.toLowerCase()] || null;
}

// ── Comments (public read, public post) ────────────────────────────────────

// GET /api/blogs/:slug/comments?company=eneza
app.get('/api/blogs/:slug/comments', async (req, res) => {
  try {
    const { slug } = req.params;
    const company = (req.query.company as string) || '';
    const blog = await prisma.blog.findFirst({ where: { slug, company } });
    if (!blog) return res.status(404).json({ error: 'Post not found' });
    const comments = await prisma.comment.findMany({
      where: { blogId: blog.id, approved: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, body: true, createdAt: true },
    });
    res.json({ comments });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/blogs/:slug/comments  { name, email?, body, company }
app.post('/api/blogs/:slug/comments', async (req, res) => {
  try {
    const { slug } = req.params;
    const { name, email, body, company } = req.body;
    if (!name?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'name and body required' });
    }
    if (body.trim().length < 3 || body.trim().length > 2000) {
      return res.status(400).json({ error: 'Comment must be 3–2000 characters' });
    }
    const blog = await prisma.blog.findFirst({ where: { slug, company } });
    if (!blog) return res.status(404).json({ error: 'Post not found' });
    const comment = await prisma.comment.create({
      data: { blogId: blog.id, name: name.trim(), email: email?.trim() || null, body: body.trim() },
      select: { id: true, name: true, body: true, createdAt: true },
    });
    res.json({ success: true, comment });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Autoblogger running on port ${PORT}`);
  console.log(`   Gemini: ${genAI ? '✅ Connected' : '❌ Not configured'}`);
  console.log(`   Endpoints:`);
  console.log(`   - POST /api/blogs/generate`);
  console.log(`   - GET  /api/blogs`);
  console.log(`   - POST /api/blogs/:id/publish`);
  console.log(`   - GET  /api/schedules`);
  console.log(`   - POST /api/schedules/run`);
});
