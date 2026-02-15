import type { ValidationError } from './users'

const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * Validate artwork image upload
 */
export function validateArtworkUpload(file: File | null): ValidationError[] {
  const errors: ValidationError[] = []

  if (!file) {
    errors.push({ field: 'file', message: 'File is required' })
    return errors
  }

  if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
    errors.push({
      field: 'file',
      message: 'File must be an image (JPEG, PNG, WebP, or GIF)',
    })
  }

  if (file.size > MAX_FILE_SIZE) {
    errors.push({
      field: 'file',
      message: 'File size must be 10MB or less',
    })
  }

  return errors
}

/**
 * Validate artwork creation fields
 */
export function validateArtworkCreate(data: unknown): ValidationError[] {
  const errors: ValidationError[] = []

  if (!data || typeof data !== 'object') {
    errors.push({ field: 'body', message: 'Request body must be an object' })
    return errors
  }

  const body = data as Record<string, unknown>

  if (!body.title || typeof body.title !== 'string') {
    errors.push({ field: 'title', message: 'Title is required' })
  } else if (body.title.length > 200) {
    errors.push({ field: 'title', message: 'Title must be 200 characters or less' })
  }

  if (!body.imageKey || typeof body.imageKey !== 'string') {
    errors.push({ field: 'imageKey', message: 'Image key is required' })
  }

  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') {
      errors.push({ field: 'description', message: 'Description must be a string' })
    } else if (body.description.length > 2000) {
      errors.push({ field: 'description', message: 'Description must be 2000 characters or less' })
    }
  }

  if (body.materials !== undefined && body.materials !== null) {
    if (typeof body.materials !== 'string') {
      errors.push({ field: 'materials', message: 'Materials must be a string' })
    } else if (body.materials.length > 500) {
      errors.push({ field: 'materials', message: 'Materials must be 500 characters or less' })
    }
  }

  if (body.dimensions !== undefined && body.dimensions !== null) {
    if (typeof body.dimensions !== 'string') {
      errors.push({ field: 'dimensions', message: 'Dimensions must be a string' })
    }
  }

  const validCategories = ['painting', 'sculpture', 'photography', 'digital', 'drawing', 'printmaking', 'mixed-media', 'other']
  if (body.category !== undefined && body.category !== null) {
    if (typeof body.category !== 'string' || !validCategories.includes(body.category)) {
      errors.push({
        field: 'category',
        message: `Category must be one of: ${validCategories.join(', ')}`,
      })
    }
  }

  if (body.tags !== undefined && body.tags !== null) {
    if (!Array.isArray(body.tags)) {
      errors.push({ field: 'tags', message: 'Tags must be an array' })
    } else if (body.tags.length > 20) {
      errors.push({ field: 'tags', message: 'Maximum 20 tags allowed' })
    } else if (!body.tags.every((t: unknown) => typeof t === 'string')) {
      errors.push({ field: 'tags', message: 'Each tag must be a string' })
    }
  }

  return errors
}

/**
 * Validate artwork update fields
 */
export function validateArtworkUpdate(data: unknown): ValidationError[] {
  const errors: ValidationError[] = []

  if (!data || typeof data !== 'object') {
    errors.push({ field: 'body', message: 'Request body must be an object' })
    return errors
  }

  const body = data as Record<string, unknown>

  if (body.title !== undefined && body.title !== null) {
    if (typeof body.title !== 'string') {
      errors.push({ field: 'title', message: 'Title must be a string' })
    } else if (body.title.length === 0) {
      errors.push({ field: 'title', message: 'Title cannot be empty' })
    } else if (body.title.length > 200) {
      errors.push({ field: 'title', message: 'Title must be 200 characters or less' })
    }
  }

  if (body.imageKey !== undefined) {
    errors.push({ field: 'imageKey', message: 'Image key cannot be updated' })
  }

  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') {
      errors.push({ field: 'description', message: 'Description must be a string' })
    } else if (body.description.length > 2000) {
      errors.push({ field: 'description', message: 'Description must be 2000 characters or less' })
    }
  }

  if (body.materials !== undefined && body.materials !== null) {
    if (typeof body.materials !== 'string') {
      errors.push({ field: 'materials', message: 'Materials must be a string' })
    } else if (body.materials.length > 500) {
      errors.push({ field: 'materials', message: 'Materials must be 500 characters or less' })
    }
  }

  if (body.dimensions !== undefined && body.dimensions !== null) {
    if (typeof body.dimensions !== 'string') {
      errors.push({ field: 'dimensions', message: 'Dimensions must be a string' })
    }
  }

  const validCategories = ['painting', 'sculpture', 'photography', 'digital', 'drawing', 'printmaking', 'mixed-media', 'other']
  if (body.category !== undefined && body.category !== null) {
    if (typeof body.category !== 'string' || !validCategories.includes(body.category)) {
      errors.push({
        field: 'category',
        message: `Category must be one of: ${validCategories.join(', ')}`,
      })
    }
  }

  if (body.tags !== undefined && body.tags !== null) {
    if (!Array.isArray(body.tags)) {
      errors.push({ field: 'tags', message: 'Tags must be an array' })
    } else if (body.tags.length > 20) {
      errors.push({ field: 'tags', message: 'Maximum 20 tags allowed' })
    } else if (!body.tags.every((t: unknown) => typeof t === 'string')) {
      errors.push({ field: 'tags', message: 'Each tag must be a string' })
    }
  }

  if (body.createdDate !== undefined && body.createdDate !== null) {
    if (typeof body.createdDate !== 'string') {
      errors.push({ field: 'createdDate', message: 'Created date must be a string' })
    } else if (!/^\d{4}-\d{2}(-\d{2})?$/.test(body.createdDate)) {
      errors.push({ field: 'createdDate', message: 'Created date must match pattern YYYY-MM or YYYY-MM-DD' })
    }
  }

  return errors
}
