import { useState } from 'react'

interface ProfileAvatarProps {
  src: string | null | undefined
  name: string
  size?: 'sm' | 'md' | 'lg'
  fallback?: 'icon' | 'initials'
  className?: string
}

const sizeClasses = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-24 w-24 text-2xl',
}

export function ProfileAvatar({ src, name, size = 'md', fallback = 'icon', className = '' }: ProfileAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = Boolean(src) && src !== failedSrc

  return (
    <span
      role="img"
      aria-label={`Foto de ${name || 'usuario'}`}
      title={name || 'Usuario'}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-surface-hover)] text-[var(--color-link)] ${sizeClasses[size]} ${className}`}
    >
      {showImage ? (
        <img
          src={src!}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setFailedSrc(src!)}
        />
      ) : fallback === 'initials' ? (
        <span aria-hidden="true" className="font-bold">{name.trim().charAt(0).toLocaleUpperCase() || '?'}</span>
      ) : (
        <svg aria-hidden="true" className="h-1/2 w-1/2" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="3.5" />
          <path strokeLinecap="round" d="M4.5 20a7.5 7.5 0 0 1 15 0" />
        </svg>
      )}
    </span>
  )
}
