import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-canvas-100 via-white to-artist-50">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 left-10 w-72 h-72 bg-artist-200 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent-200 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36">
        <div className="text-center max-w-3xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur rounded-full border border-canvas-200 shadow-sm mb-8">
            <Sparkles className="w-4 h-4 text-artist-500" />
            <span className="text-sm font-medium text-canvas-700">Free for schools</span>
          </div>

          {/* Headline */}
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-canvas-900 mb-6 leading-tight">
            Online Art Gallery
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-artist-600 to-accent-500">
              for Student Artists
            </span>
          </h1>

          {/* Subhead */}
          <p className="text-lg sm:text-xl text-canvas-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Give your VFA students a portfolio they're proud of. Built entirely on Google Workspace tools your school already has—no cost, no IT headaches.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/docs"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-artist-600 to-artist-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl hover:from-artist-700 hover:to-artist-600 transition-all transform hover:-translate-y-0.5"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="https://github.com/samcorl/vfa_gallery"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-canvas-700 font-semibold rounded-lg border border-canvas-300 hover:border-canvas-400 hover:bg-canvas-50 transition-all"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
