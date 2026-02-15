import { Helmet } from 'react-helmet-async'

const BASE_URL = 'https://vfa.gallery'

function getAbsoluteUrl(path: string): string {
  return `${BASE_URL}${path}`
}

function sanitizeText(text: string | null | undefined, maxLength: number = 155): string {
  if (!text) return ''
  let cleaned = text.replace(/<[^>]*>/g, '')
  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength).trim() + '...'
  }
  return cleaned
}

interface SEOHeadProps {
  title: string
  description?: string
  image?: string
  imageAlt?: string
  path?: string
  type?: 'website' | 'profile' | 'article'
  twitterCard?: 'summary' | 'summary_large_image'
  author?: string
  publishedTime?: string
}

export default function SEOHead({
  title,
  description = 'Discover and support emerging visual fine artists on VFA.gallery.',
  image,
  imageAlt,
  path = '/',
  type = 'website',
  twitterCard = 'summary_large_image',
  author,
  publishedTime,
}: SEOHeadProps) {
  const pageTitle = title.includes('VFA') ? title : `${title} | VFA.gallery`
  const cleanDescription = sanitizeText(description, 155)
  const url = getAbsoluteUrl(path)
  const imageUrl = image ? (image.startsWith('http') ? image : getAbsoluteUrl(image)) : undefined

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={cleanDescription} />
      <link rel="canonical" href={url} />

      {/* Open Graph */}
      <meta property="og:title" content={sanitizeText(title, 60)} />
      <meta property="og:description" content={cleanDescription} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="VFA.gallery" />
      {imageUrl && <meta property="og:image" content={imageUrl} />}
      {imageUrl && <meta property="og:image:width" content="1200" />}
      {imageUrl && <meta property="og:image:height" content="630" />}
      {imageAlt && <meta property="og:image:alt" content={imageAlt} />}
      {type === 'article' && author && <meta property="article:author" content={author} />}
      {type === 'article' && publishedTime && <meta property="article:published_time" content={publishedTime} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={sanitizeText(title, 70)} />
      <meta name="twitter:description" content={sanitizeText(description, 200)} />
      <meta name="twitter:site" content="@vfagallery" />
      {imageUrl && <meta name="twitter:image" content={imageUrl} />}
      {imageAlt && <meta name="twitter:image:alt" content={imageAlt} />}
    </Helmet>
  )
}

export { getAbsoluteUrl, sanitizeText }
