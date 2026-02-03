import { Upload, FolderHeart, Palette, Share2, Smartphone, Link as LinkIcon } from 'lucide-react';

const features = [
  {
    icon: Upload,
    title: 'Easy Uploads',
    description: 'Upload from phone or computer. Auto-resizing, thumbnails, and watermarks included.',
  },
  {
    icon: FolderHeart,
    title: 'Galleries & Collections',
    description: 'Organize your work into galleries and collections. Curate like a real museum.',
  },
  {
    icon: Palette,
    title: 'Customizable Themes',
    description: 'Light, dark, or custom colors. Let your art speak for itself.',
  },
  {
    icon: Share2,
    title: 'Built for Sharing',
    description: 'Every artwork gets a shareable URL. Easy social media integration.',
  },
  {
    icon: Smartphone,
    title: 'Mobile-First',
    description: 'Designed for phones first. Upload, browse, and share from anywhere.',
  },
  {
    icon: LinkIcon,
    title: 'Clean URLs',
    description: 'Human-readable links like /your-name/gallery/collection/artwork.',
  },
];

export function Features() {
  return (
    <section className="py-20 bg-canvas-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-canvas-900 mb-4">
            Built for Emerging Artists
          </h2>
          <p className="text-lg text-canvas-600 max-w-2xl mx-auto">
            Everything you need, nothing you don't. Simple tools that let your art shine.
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
