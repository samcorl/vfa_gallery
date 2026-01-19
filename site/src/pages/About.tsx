import { Github, Mail, ExternalLink } from 'lucide-react';

export function About() {
  return (
    <div className="min-h-screen bg-canvas-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <article className="bg-white rounded-xl border border-canvas-200 shadow-sm p-8 sm:p-12">
          <h1 className="font-display text-3xl font-bold text-canvas-900 mb-6">
            About VFA Gallery
          </h1>

          <div className="prose prose-canvas max-w-none prose-p:text-canvas-700 prose-p:leading-relaxed prose-headings:text-canvas-900 prose-a:text-artist-600">
            <p>
              VFA Gallery is a free online gallery for emerging visual artists. No algorithm, no likes, no follower counts—just your art, presented the way you want it.
            </p>

            <p>
              Built especially for comics and manga creators, VFA Gallery gives you a clean, professional portfolio with shareable URLs, customizable themes, and mobile-first design. Create your account, upload your work, and share it with the world.
            </p>

            <h2 className="font-display text-xl font-semibold mt-8 mb-4">Why We Built This</h2>
            <p>
              Social media platforms are noisy. They're optimized for engagement, not for showcasing art. We wanted something simpler: a place where emerging artists can present their work without the pressure of metrics and algorithms.
            </p>

            <h2 className="font-display text-xl font-semibold mt-8 mb-4">For Schools</h2>
            <p>
              We also offer a self-hosted version for schools using Google Workspace. Art teachers can set up a private gallery for their students using tools their school already has—Google Drive, Sheets, and Apps Script. No IT department required, no external hosting costs.
            </p>

            <h2 className="font-display text-xl font-semibold mt-8 mb-4">Open Source</h2>
            <p>
              This entire project is open source. Fork it, improve it, adapt it. Contributions and suggestions are welcome on GitHub.
            </p>

            <h2 className="font-display text-xl font-semibold mt-8 mb-4">About Me</h2>
            <p>
              I'm Sam Corl, a full-stack developer since 1996 (my first web page was in 1994 with HTML 1.0). I built this because I believe every artist deserves a gallery, and the internet should make that easier, not harder.
            </p>
          </div>

          {/* Links */}
          <div className="mt-10 pt-8 border-t border-canvas-200">
            <div className="flex flex-wrap gap-4">
              <a
                href="https://github.com/samcorl/vfa_gallery"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-canvas-100 text-canvas-700 rounded-lg hover:bg-canvas-200 transition-colors text-sm font-medium"
              >
                <Github className="w-4 h-4" />
                View on GitHub
              </a>
              <a
                href="mailto:sam@samcorl.com"
                className="inline-flex items-center gap-2 px-4 py-2 bg-canvas-100 text-canvas-700 rounded-lg hover:bg-canvas-200 transition-colors text-sm font-medium"
              >
                <Mail className="w-4 h-4" />
                Contact
              </a>
              <a
                href="https://samcorl.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-canvas-100 text-canvas-700 rounded-lg hover:bg-canvas-200 transition-colors text-sm font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                samcorl.com
              </a>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
