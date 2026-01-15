import { Cloud, Server, Check, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const options = [
  {
    icon: Server,
    title: 'Google Workspace Edition',
    subtitle: 'Self-hosted, school-owned',
    description: 'Run everything on tools your school already has. You own the data, control access, and pay nothing.',
    features: [
      'Google Drive for images',
      'Google Sheets as database',
      'Apps Script web app',
      'School domain SSO',
      'No external services',
    ],
    cta: 'Setup Guide',
    ctaLink: '/docs',
    color: 'artist',
    recommended: true,
  },
  {
    icon: Cloud,
    title: 'Cloudflare Edition',
    subtitle: 'Serverless, scalable',
    description: 'For schools that want more features or outgrow the Workspace version. Uses Cloudflare\'s free tier.',
    features: [
      'Cloudflare Pages hosting',
      'D1 SQLite database',
      'R2 image storage',
      'Custom domain support',
      'Public or private access',
    ],
    cta: 'Coming Soon',
    ctaLink: '#',
    color: 'accent',
    recommended: false,
    disabled: true,
  },
];

export function Options() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-canvas-900 mb-4">
            Two Ways to Get Started
          </h2>
          <p className="text-lg text-canvas-600 max-w-2xl mx-auto">
            Choose the setup that fits your school. Both are free and open source.
          </p>
        </div>

        {/* Option cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {options.map((option) => {
            const Icon = option.icon;
            const colorClasses = option.color === 'artist'
              ? {
                  gradient: 'from-artist-600 to-artist-500',
                  gradientHover: 'hover:from-artist-700 hover:to-artist-600',
                  badge: 'bg-artist-100 text-artist-700',
                  iconBg: 'bg-artist-100',
                  iconColor: 'text-artist-600',
                  border: 'border-artist-200',
                  ring: 'ring-artist-500',
                }
              : {
                  gradient: 'from-accent-600 to-accent-500',
                  gradientHover: 'hover:from-accent-700 hover:to-accent-600',
                  badge: 'bg-accent-100 text-accent-700',
                  iconBg: 'bg-accent-100',
                  iconColor: 'text-accent-600',
                  border: 'border-accent-200',
                  ring: 'ring-accent-500',
                };

            return (
              <div
                key={option.title}
                className={`relative bg-gradient-to-br from-white to-canvas-50 rounded-2xl p-8 border ${colorClasses.border} shadow-lg hover:shadow-xl transition-all ${
                  option.recommended ? `ring-2 ${colorClasses.ring}` : ''
                } ${option.disabled ? 'opacity-75' : ''}`}
              >
                {option.recommended && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 ${colorClasses.badge} text-xs font-semibold rounded-full`}>
                    Recommended
                  </div>
                )}

                <div className={`inline-flex p-3 ${colorClasses.iconBg} rounded-xl mb-4`}>
                  <Icon className={`w-6 h-6 ${colorClasses.iconColor}`} />
                </div>

                <h3 className="font-display text-xl font-bold text-canvas-900 mb-1">
                  {option.title}
                </h3>
                <p className="text-sm text-canvas-500 mb-4">{option.subtitle}</p>
                <p className="text-canvas-600 mb-6">{option.description}</p>

                <ul className="space-y-3 mb-8">
                  {option.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-canvas-700">
                      <Check className={`w-4 h-4 ${colorClasses.iconColor}`} />
                      {feature}
                    </li>
                  ))}
                </ul>

                {option.disabled ? (
                  <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-canvas-200 text-canvas-500 font-semibold rounded-lg cursor-not-allowed">
                    {option.cta}
                  </span>
                ) : (
                  <Link
                    to={option.ctaLink}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r ${colorClasses.gradient} ${colorClasses.gradientHover} text-white font-semibold rounded-lg shadow hover:shadow-lg transition-all`}
                  >
                    {option.cta}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
