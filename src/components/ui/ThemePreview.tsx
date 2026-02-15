import { useMemo } from 'react'

interface ThemePreviewProps {
  styles: Record<string, string>
  name: string
  size?: 'sm' | 'md'
  selected?: boolean
  onClick?: () => void
}

export default function ThemePreview({
  styles,
  name,
  size = 'md',
  selected = false,
  onClick,
}: ThemePreviewProps) {
  const sizeClasses = useMemo(() => {
    if (size === 'sm') {
      return {
        container: 'p-2',
        header: 'h-1',
        swatchSize: 'w-3 h-3',
        textSize: 'text-xs',
        gap: 'gap-1',
      }
    }
    return {
      container: 'p-4',
      header: 'h-1.5',
      swatchSize: 'w-4 h-4',
      textSize: 'text-sm',
      gap: 'gap-2',
    }
  }, [size])

  // Extract colors with fallbacks
  const primaryColor = styles.primaryColor || '#1f2937'
  const secondaryColor = styles.secondaryColor || '#6b7280'
  const accentColor = styles.accentColor || '#9ca3af'
  const backgroundColor = styles.backgroundColor || '#ffffff'
  const textColor = styles.textColor || '#111827'
  const fontFamily = styles.fontFamily || 'sans-serif'

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border-2 border-gray-300 overflow-hidden transition-all ${
        onClick ? 'cursor-pointer hover:border-gray-400' : ''
      } ${selected ? 'ring-2 ring-gray-800 ring-offset-1' : ''}`}
      style={{ backgroundColor }}
    >
      {/* Header color strip */}
      <div
        className={sizeClasses.header}
        style={{ backgroundColor: primaryColor }}
      />

      {/* Body content */}
      <div className={sizeClasses.container}>
        {/* Color swatches row */}
        <div className={`flex ${sizeClasses.gap} mb-3`}>
          <div
            className={`${sizeClasses.swatchSize} rounded-full border border-gray-200`}
            style={{ backgroundColor: primaryColor }}
            title="Primary"
          />
          <div
            className={`${sizeClasses.swatchSize} rounded-full border border-gray-200`}
            style={{ backgroundColor: secondaryColor }}
            title="Secondary"
          />
          <div
            className={`${sizeClasses.swatchSize} rounded-full border border-gray-200`}
            style={{ backgroundColor: accentColor }}
            title="Accent"
          />
        </div>

        {/* Theme name text */}
        <div
          className={`${sizeClasses.textSize} font-medium truncate`}
          style={{
            color: textColor,
            fontFamily: fontFamily,
          }}
        >
          {name}
        </div>
      </div>
    </div>
  )
}
