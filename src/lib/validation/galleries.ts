import type { ValidationError } from './users'

/**
 * Validate gallery creation fields
 */
export function validateGalleryCreate(data: unknown): ValidationError[] {
  const errors: ValidationError[] = []

  if (!data || typeof data !== 'object') {
    errors.push({ field: 'body', message: 'Request body must be an object' })
    return errors
  }

  const body = data as Record<string, unknown>

  if (!body.name || typeof body.name !== 'string') {
    errors.push({ field: 'name', message: 'Name is required' })
  } else if (body.name.length > 200) {
    errors.push({ field: 'name', message: 'Name must be 200 characters or less' })
  }

  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') {
      errors.push({ field: 'description', message: 'Description must be a string' })
    } else if (body.description.length > 2000) {
      errors.push({ field: 'description', message: 'Description must be 2000 characters or less' })
    }
  }

  if (body.welcomeMessage !== undefined && body.welcomeMessage !== null) {
    if (typeof body.welcomeMessage !== 'string') {
      errors.push({ field: 'welcomeMessage', message: 'Welcome message must be a string' })
    } else if (body.welcomeMessage.length > 2000) {
      errors.push({ field: 'welcomeMessage', message: 'Welcome message must be 2000 characters or less' })
    }
  }

  return errors
}

/**
 * Validate gallery update fields
 */
export function validateGalleryUpdate(data: unknown): ValidationError[] {
  const errors: ValidationError[] = []

  if (!data || typeof data !== 'object') {
    errors.push({ field: 'body', message: 'Request body must be an object' })
    return errors
  }

  const body = data as Record<string, unknown>

  // Check if isDefault is being modified
  if ('isDefault' in body) {
    errors.push({ field: 'isDefault', message: 'Default status cannot be modified' })
  }

  if (body.name !== undefined && body.name !== null) {
    if (typeof body.name !== 'string') {
      errors.push({ field: 'name', message: 'Name must be a string' })
    } else if (body.name.length === 0) {
      errors.push({ field: 'name', message: 'Name cannot be empty' })
    } else if (body.name.length > 200) {
      errors.push({ field: 'name', message: 'Name must be 200 characters or less' })
    }
  }

  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') {
      errors.push({ field: 'description', message: 'Description must be a string' })
    } else if (body.description.length > 2000) {
      errors.push({ field: 'description', message: 'Description must be 2000 characters or less' })
    }
  }

  if (body.welcomeMessage !== undefined && body.welcomeMessage !== null) {
    if (typeof body.welcomeMessage !== 'string') {
      errors.push({ field: 'welcomeMessage', message: 'Welcome message must be a string' })
    } else if (body.welcomeMessage.length > 2000) {
      errors.push({ field: 'welcomeMessage', message: 'Welcome message must be 2000 characters or less' })
    }
  }

  if (body.themeId !== undefined && body.themeId !== null) {
    if (typeof body.themeId !== 'string') {
      errors.push({ field: 'themeId', message: 'Theme ID must be a string' })
    }
  }

  const validStatuses = ['active', 'archived', 'draft']
  if (body.status !== undefined && body.status !== null) {
    if (typeof body.status !== 'string' || !validStatuses.includes(body.status)) {
      errors.push({
        field: 'status',
        message: `Status must be one of: ${validStatuses.join(', ')}`,
      })
    }
  }

  return errors
}
