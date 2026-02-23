import express from 'express';
import cors from 'cors';
import { PrismaClient, BlogStatus } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

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

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  
  const systemPrompt = `You are a professional blog writer for ${company}, an African tech company.
Write engaging, informative blog posts that are:
- SEO optimized
- Easy to read
- Relevant to African audiences
- Professional but conversational

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
        model: 'gemini-2.0-flash'
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

// DELETE /api/blogs/:id - Delete blog
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
            model: 'gemini-2.0-flash'
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
    eneza: process.env.ENEZA_BLOG_URL || 'https://api.eneza.app/api/blog/posts',
    yebojobs: process.env.YEBOJOBS_BLOG_URL || 'https://api.yebojobs.com/blog/posts',
    vavu: process.env.VAVU_BLOG_URL || 'https://api.vavu.app/api/blog/posts',
    yebona: process.env.YEBONA_BLOG_URL || 'https://api.yebona.com/api/blog/posts',
    bamzu: process.env.BAMZU_BLOG_URL || 'https://api.bamzu.app/api/blog/posts',
    yebolink: process.env.YEBOLINK_BLOG_URL || 'https://api.yebolink.com/api/blog/posts',
    // YeboLearn backend not found - skip for now
    yebolearn: process.env.YEBOLEARN_BLOG_URL || '',
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
    // YeboLearn backend not found - skip for now  
    yebolearn: process.env.YEBOLEARN_BLOG_API_KEY,
  };
  return keys[company.toLowerCase()] || null;
}

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
