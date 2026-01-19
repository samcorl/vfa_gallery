import { Palette, Github, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/docs', label: 'Docs' },
    { href: '/edu', label: 'For Schools' },
    { href: '/about', label: 'About' },
  ];

  return (
    <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-canvas-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="p-2 bg-gradient-to-br from-artist-500 to-artist-600 rounded-lg group-hover:from-artist-600 group-hover:to-artist-700 transition-all">
              <Palette className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-canvas-800 text-lg">VFA Gallery</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map(link => {
              const isActive = link.href === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-artist-600'
                      : 'text-canvas-600 hover:text-canvas-900'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <a
              href="https://github.com/samcorl/vfa_gallery"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium text-canvas-600 hover:text-canvas-900 transition-colors"
            >
              <Github className="w-4 h-4" />
              GitHub
            </a>
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-canvas-600 hover:text-canvas-900"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <nav className="md:hidden py-4 border-t border-canvas-200">
            <div className="flex flex-col gap-3">
              {navLinks.map(link => {
                const isActive = link.href === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`text-sm font-medium py-2 ${
                      isActive
                        ? 'text-artist-600'
                        : 'text-canvas-600'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <a
                href="https://github.com/samcorl/vfa_gallery"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm font-medium text-canvas-600 py-2"
              >
                <Github className="w-4 h-4" />
                GitHub
              </a>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
