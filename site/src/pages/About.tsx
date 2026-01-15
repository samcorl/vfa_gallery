import { Github, Mail, ExternalLink } from 'lucide-react';

export function About() {
  return (
    <div className="min-h-screen bg-canvas-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <article className="bg-white rounded-xl border border-canvas-200 shadow-sm p-8 sm:p-12">
          <h1 className="font-display text-3xl font-bold text-canvas-900 mb-6">
            About This Project
          </h1>

          <div className="prose prose-canvas max-w-none prose-p:text-canvas-700 prose-p:leading-relaxed prose-headings:text-canvas-900 prose-a:text-artist-600">
            <p>
              VFA Gallery started as a simple idea: art teachers shouldn't need IT departments or budgets to give their students a place to showcase their work online.
            </p>

            <p>
              Too many student portfolios live and die in classroom folders or get lost when school accounts are deactivated. This project gives students a persistent, shareable gallery that teachers can set up themselves using tools their schools already have.
            </p>

            <h2 className="font-display text-xl font-semibold mt-8 mb-4">Why Google Workspace?</h2>
            <p>
              Most schools already have Google Workspace for Education. By building on Drive, Sheets, and Apps Script, we eliminate external dependencies, hosting costs, and IT approval processes. Teachers can set this up over a weekend.
            </p>

            <h2 className="font-display text-xl font-semibold mt-8 mb-4">Open Source</h2>
            <p>
              This entire project—the documentation, the templates, this website—is open source. Fork it, improve it, adapt it for your school. Contributions and suggestions are welcome.
            </p>

            <h2 className="font-display text-xl font-semibold mt-8 mb-4">About Me</h2>
            <p>
              I'm Sam Corl, a full-stack developer since 1996 (my first web page was in 1994 with HTML 1.0). I built this because I believe every student artist deserves a gallery, and no teacher should have to fight bureaucracy to make that happen.
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
                href="mailto:samcorl@gmail.com"
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
