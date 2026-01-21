import { prisma } from '@/lib/db/prisma'

export interface BlogPostPreview {
  id: string
  title: string
  slug: string
  excerpt: string
  coverImageUrl: string | null
  publishedAt: Date | null
}

export interface BlogPostDetail extends BlogPostPreview {
  content: string
}

function buildExcerpt(content: string, excerpt?: string | null) {
  if (excerpt && excerpt.trim()) {
    return excerpt.trim()
  }

  const plain = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_>#-]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

  return plain.slice(0, 220)
}

export async function listPublishedBlogPosts(limit?: number): Promise<BlogPostPreview[]> {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: typeof limit === 'number' ? limit : undefined,
  })

  return posts.map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: buildExcerpt(post.content, post.excerpt),
    coverImageUrl: post.coverImageUrl ?? null,
    publishedAt: post.publishedAt ?? post.createdAt,
  }))
}

export async function getPublishedBlogPost(slug: string): Promise<BlogPostDetail | null> {
  const post = await prisma.blogPost.findUnique({
    where: { slug },
  })
  if (!post || !post.published) return null
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: buildExcerpt(post.content, post.excerpt),
    content: post.content,
    coverImageUrl: post.coverImageUrl ?? null,
    publishedAt: post.publishedAt ?? post.createdAt,
  }
}
