import { useState } from 'react';
import { ChevronRight, Clock, BookOpen, Wrench, AlertCircle } from 'lucide-react';
import { eduSetupDocs, eduOperationsDocs, eduTroubleshootingDoc, type DocSection } from '../data/docs';

type TabId = 'setup' | 'operations' | 'troubleshooting';

const tabs: { id: TabId; label: string; icon: typeof BookOpen }[] = [
  { id: 'setup', label: 'Setup Guide', icon: BookOpen },
  { id: 'operations', label: 'Daily Operations', icon: Wrench },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: AlertCircle },
];

export function EduDocs() {
  const [activeTab, setActiveTab] = useState<TabId>('setup');
  const [activeSection, setActiveSection] = useState<string>(eduSetupDocs[0].id);

  const getCurrentDocs = (): DocSection[] => {
    switch (activeTab) {
      case 'setup':
        return eduSetupDocs;
      case 'operations':
        return eduOperationsDocs;
      case 'troubleshooting':
        return [eduTroubleshootingDoc];
    }
  };

  const currentDocs = getCurrentDocs();
  const currentDoc = currentDocs.find(d => d.id === activeSection) || currentDocs[0];

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    const docs = tabId === 'setup' ? eduSetupDocs : tabId === 'operations' ? eduOperationsDocs : [eduTroubleshootingDoc];
    setActiveSection(docs[0].id);
  };

  return (
    <div className="min-h-screen bg-canvas-50">
      {/* Page header */}
      <div className="bg-white border-b border-canvas-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent-100 text-accent-700 text-xs font-semibold rounded-full mb-4">
            For Schools
          </div>
          <h1 className="font-display text-3xl font-bold text-canvas-900 mb-2">
            School Gallery Setup
          </h1>
          <p className="text-canvas-600">
            Set up your own private art gallery using Google Workspace tools your school already has.
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-canvas-200 sticky top-16 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-accent-500 text-accent-600'
                      : 'border-transparent text-canvas-600 hover:text-canvas-900 hover:border-canvas-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="lg:w-64 flex-shrink-0">
            <nav className="lg:sticky lg:top-36 space-y-1">
              {currentDocs.map((doc, index) => (
                <button
                  key={doc.id}
                  onClick={() => setActiveSection(doc.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left rounded-lg transition-colors ${
                    activeSection === doc.id
                      ? 'bg-accent-100 text-accent-700 font-medium'
                      : 'text-canvas-600 hover:bg-canvas-100 hover:text-canvas-900'
                  }`}
                >
                  {activeTab === 'setup' && (
                    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold ${
                      activeSection === doc.id
                        ? 'bg-accent-500 text-white'
                        : 'bg-canvas-200 text-canvas-600'
                    }`}>
                      {index + 1}
                    </span>
                  )}
                  {activeTab !== 'setup' && (
                    <ChevronRight className={`w-4 h-4 ${activeSection === doc.id ? 'text-accent-500' : 'text-canvas-400'}`} />
                  )}
                  <span className="truncate">{doc.title}</span>
                </button>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <main className="flex-1 min-w-0">
            <article className="bg-white rounded-xl border border-canvas-200 shadow-sm p-6 sm:p-8">
              {/* Article header */}
              <header className="mb-6 pb-6 border-b border-canvas-200">
                <h2 className="font-display text-2xl font-bold text-canvas-900 mb-2">
                  {currentDoc.title}
                </h2>
                {currentDoc.readTime && (
                  <div className="flex items-center gap-1.5 text-sm text-canvas-500">
                    <Clock className="w-4 h-4" />
                    {currentDoc.readTime} read
                  </div>
                )}
              </header>

              {/* Article content */}
              <div
                className="prose prose-canvas max-w-none
                  prose-headings:font-display prose-headings:text-canvas-900
                  prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-8 prose-h3:mb-4
                  prose-p:text-canvas-700 prose-p:leading-relaxed
                  prose-a:text-accent-600 prose-a:no-underline hover:prose-a:underline
                  prose-strong:text-canvas-800 prose-strong:font-semibold
                  prose-code:bg-canvas-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-normal prose-code:text-canvas-800
                  prose-ul:my-4 prose-li:text-canvas-700
                  prose-ol:my-4
                  prose-table:my-6 prose-table:text-sm
                  prose-th:bg-canvas-100 prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:text-canvas-800
                  prose-td:px-4 prose-td:py-2 prose-td:border-b prose-td:border-canvas-200"
                dangerouslySetInnerHTML={{ __html: currentDoc.content }}
              />

              {/* Navigation */}
              {activeTab === 'setup' && (
                <nav className="mt-8 pt-6 border-t border-canvas-200 flex justify-between">
                  {(() => {
                    const currentIndex = currentDocs.findIndex(d => d.id === activeSection);
                    const prevDoc = currentIndex > 0 ? currentDocs[currentIndex - 1] : null;
                    const nextDoc = currentIndex < currentDocs.length - 1 ? currentDocs[currentIndex + 1] : null;

                    return (
                      <>
                        {prevDoc ? (
                          <button
                            onClick={() => setActiveSection(prevDoc.id)}
                            className="text-sm text-canvas-600 hover:text-accent-600 transition-colors"
                          >
                            ← {prevDoc.title}
                          </button>
                        ) : <span />}
                        {nextDoc && (
                          <button
                            onClick={() => setActiveSection(nextDoc.id)}
                            className="text-sm font-medium text-accent-600 hover:text-accent-700 transition-colors"
                          >
                            {nextDoc.title} →
                          </button>
                        )}
                      </>
                    );
                  })()}
                </nav>
              )}
            </article>
          </main>
        </div>
      </div>
    </div>
  );
}
