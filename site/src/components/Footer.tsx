import { Palette } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-canvas-50 border-t border-canvas-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-canvas-200 rounded">
              <Palette className="w-4 h-4 text-canvas-600" />
            </div>
            <span className="text-sm text-canvas-600">
              VFA Gallery — Open Source
            </span>
          </div>

          <nav className="flex items-center gap-6 text-sm">
            <Link to="/docs" className="text-canvas-600 hover:text-canvas-900 transition-colors">
              Setup Guide
            </Link>
            <a
              href="https://github.com/samcorl/vfa_gallery"
              target="_blank"
              rel="noopener noreferrer"
              className="text-canvas-600 hover:text-canvas-900 transition-colors"
            >
              GitHub
            </a>
            <a
              href="mailto:samcorl@gmail.com"
              className="text-canvas-600 hover:text-canvas-900 transition-colors"
            >
              Contact
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
