import { Mail, Github, HelpCircle } from 'lucide-react';

export function Contact() {
  return (
    <section className="py-20 bg-gradient-to-br from-canvas-800 via-canvas-900 to-canvas-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
          Questions? Ideas?
        </h2>
        <p className="text-lg text-canvas-300 mb-10 max-w-2xl mx-auto">
          This project is open source and community-driven. Reach out if you need help getting started or have suggestions.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="mailto:sam@samcorl.com?subject=VFA%20Gallery%20Question"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-canvas-800 font-semibold rounded-lg hover:bg-canvas-100 transition-colors"
          >
            <Mail className="w-5 h-5" />
            Email Me
          </a>
          <a
            href="https://github.com/samcorl/vfa_gallery/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-canvas-700 text-white font-semibold rounded-lg hover:bg-canvas-600 transition-colors border border-canvas-600"
          >
            <Github className="w-5 h-5" />
            Open an Issue
          </a>
        </div>

        <div className="mt-12 pt-8 border-t border-canvas-700">
          <div className="flex items-center justify-center gap-2 text-canvas-400">
            <HelpCircle className="w-4 h-4" />
            <span className="text-sm">
              Built by <a href="https://samcorl.com" target="_blank" rel="noopener noreferrer" className="text-canvas-300 hover:text-white transition-colors">Sam Corl</a> for emerging artists everywhere
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
