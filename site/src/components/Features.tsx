import { Upload, Users, Palette, Shield, Smartphone, FolderOpen } from 'lucide-react';

const features = [
  {
    icon: Upload,
    title: 'Easy Uploads',
    description: 'Students upload from phone or computer. Auto-resizing and thumbnails included.',
  },
  {
    icon: Users,
    title: 'Class Galleries',
    description: 'Organize by class and semester. Each student gets their own collection.',
  },
  {
    icon: Palette,
    title: 'Customizable Themes',
    description: 'Light, dark, or custom colors. Let the art speak for itself.',
  },
  {
    icon: Shield,
    title: 'School-Only Access',
    description: 'Workspace SSO keeps it private. Only school accounts can sign in.',
  },
  {
    icon: Smartphone,
    title: 'Mobile-First',
    description: 'Works great on phones where students actually are.',
  },
  {
    icon: FolderOpen,
    title: 'Persistent Portfolios',
    description: 'Student work persists across semesters on their profile page.',
  },
];

export function Features() {
  return (
    <section className="py-20 bg-canvas-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-canvas-900 mb-4">
            Built for Art Teachers
          </h2>
          <p className="text-lg text-canvas-600 max-w-2xl mx-auto">
            Everything you need, nothing you don't. Simple tools that stay out of the way.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="bg-white rounded-xl p-6 border border-canvas-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="inline-flex p-2.5 bg-gradient-to-br from-artist-100 to-accent-100 rounded-lg mb-4">
                  <Icon className="w-5 h-5 text-artist-600" />
                </div>
                <h3 className="font-semibold text-canvas-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-canvas-600 leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
