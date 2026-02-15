/**
 * Validation errors
 */
export interface ValidationError {
  field: string
  message: string
}

export class ValidationException extends Error {
  errors: ValidationError[]

  constructor(errors: ValidationError[]) {
    super('Validation failed')
    this.errors = errors
    this.name = 'ValidationException'
  }
}

/**
 * Validate display name
 */
function validateDisplayName(value: string | null | undefined): ValidationError[] {
  const errors: ValidationError[] = []

  if (value !== null && value !== undefined) {
    if (typeof value !== 'string') {
      errors.push({ field: 'displayName', message: 'Display name must be a string' })
    } else if (value.length > 100) {
      errors.push({ field: 'displayName', message: 'Display name must be 100 characters or less' })
    }
  }

  return errors
}

/**
 * Validate bio
 */
function validateBio(value: string | null | undefined): ValidationError[] {
  const errors: ValidationError[] = []

  if (value !== null && value !== undefined) {
    if (typeof value !== 'string') {
      errors.push({ field: 'bio', message: 'Bio must be a string' })
    } else if (value.length > 500) {
      errors.push({ field: 'bio', message: 'Bio must be 500 characters or less' })
    }
  }

  return errors
}

/**
 * Validate website URL
 */
function validateWebsite(value: string | null | undefined): ValidationError[] {
  const errors: ValidationError[] = []

  if (value !== null && value !== undefined) {
    if (typeof value !== 'string') {
      errors.push({ field: 'website', message: 'Website must be a string' })
    } else if (value.length > 0) {
      try {
        new URL(value)
      } catch {
        errors.push({ field: 'website', message: 'Website must be a valid URL' })
      }
    }
  }

  return errors
}

/**
 * Validate phone number
 */
function validatePhone(value: string | null | undefined): ValidationError[] {
  const errors: ValidationError[] = []

  if (value !== null && value !== undefined) {
    if (typeof value !== 'string') {
      errors.push({ field: 'phone', message: 'Phone must be a string' })
    } else if (value.length > 20) {
      errors.push({ field: 'phone', message: 'Phone must be 20 characters or less' })
    }
  }

  return errors
}

/**
 * Validate social media links
 */
function validateSocials(value: unknown): ValidationError[] {
  const errors: ValidationError[] = []

  if (value === null || value === undefined) {
    return errors
  }

  if (!Array.isArray(value)) {
    errors.push({ field: 'socials', message: 'Socials must be an array' })
    return errors
  }

  const validPlatforms = ['twitter', 'instagram', 'facebook', 'linkedin', 'github', 'youtube', 'tiktok', 'website']

  value.forEach((social, index) => {
    if (!social || typeof social !== 'object') {
      errors.push({ field: `socials[${index}]`, message: 'Each social must be an object' })
      return
    }

    const s = social as Record<string, unknown>

    if (!s.platform || typeof s.platform !== 'string') {
      errors.push({ field: `socials[${index}].platform`, message: 'Platform is required and must be a string' })
    } else if (!validPlatforms.includes(s.platform)) {
      errors.push({
        field: `socials[${index}].platform`,
        message: `Platform must be one of: ${validPlatforms.join(', ')}`,
      })
    }

    if (!s.url || typeof s.url !== 'string') {
      errors.push({ field: `socials[${index}].url`, message: 'URL is required and must be a string' })
    } else {
      try {
        new URL(s.url)
      } catch {
        errors.push({ field: `socials[${index}].url`, message: 'URL must be valid' })
      }
    }
  })

  return errors
}

/**
 * Validate profile update request
 */
export function validateProfileUpdate(data: unknown): ValidationError[] {
  const errors: ValidationError[] = []

  if (!data || typeof data !== 'object') {
    errors.push({ field: 'body', message: 'Request body must be an object' })
    return errors
  }

  const body = data as Record<string, unknown>

  // Validate each field
  errors.push(...validateDisplayName(body.displayName as string | null | undefined))
  errors.push(...validateBio(body.bio as string | null | undefined))
  errors.push(...validateWebsite(body.website as string | null | undefined))
  errors.push(...validatePhone(body.phone as string | null | undefined))
  errors.push(...validateSocials(body.socials))

  return errors
}

/**
 * Validate avatar upload
 */
export function validateAvatarUpload(file: File | null): ValidationError[] {
  const errors: ValidationError[] = []

  if (!file) {
    errors.push({ field: 'file', message: 'File is required' })
    return errors
  }

  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.size > maxSize) {
    errors.push({ field: 'file', message: 'File size must be 5MB or less' })
  }

  const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!validMimeTypes.includes(file.type)) {
    errors.push({ field: 'file', message: 'File must be an image (JPEG, PNG, WebP, or GIF)' })
  }

  return errors
}
