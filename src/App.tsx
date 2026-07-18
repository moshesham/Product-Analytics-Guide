/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CheckCircle, ChevronRight, Copy, Terminal, Menu, X, Check, Eye } from 'lucide-react';
import { parts, intro, playbookTips, Section } from './data';
import clsx from 'clsx';
import { PythonSandbox } from './components/PythonSandbox';

export default function App() {
  const [activeSectionId, setActiveSectionId] = useState<string>(parts[0].sections[0].id);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [isCodeRevealed, setIsCodeRevealed] = useState(false);

  const [completedSections, setCompletedSections] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('completedSections');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  useEffect(() => {
    localStorage.setItem('completedSections', JSON.stringify(Array.from(completedSections)));
  }, [completedSections]);

  const toggleCompletion = (id: string) => {
    setCompletedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSections = parts.flatMap((p) => p.sections);
  const totalSections = allSections.length;
  const completedCount = completedSections.size;
  const progressPercent = totalSections > 0 ? Math.round((completedCount / totalSections) * 100) : 0;

  const activeSection = allSections.find((s) => s.id === activeSectionId) || parts[0].sections[0];

  const handleSectionChange = (id: string) => {
    setActiveSectionId(id);
    setIsMobileMenuOpen(false);
    setIsCodeRevealed(false);
  };

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between bg-slate-900 text-white p-4 sticky top-0 z-20">
        <div className="flex items-center gap-2 font-semibold">
          <Terminal size={20} className="text-blue-400" />
          <span>Analytics Playbook</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <nav
        className={clsx(
          "bg-slate-900 text-slate-300 w-full md:w-80 flex-shrink-0 md:h-screen md:sticky top-0 overflow-y-auto flex-col transition-all duration-300 z-10",
          isMobileMenuOpen ? "flex" : "hidden md:flex"
        )}
      >
        <div className="p-6 hidden md:block">
          <div className="flex items-center gap-2 font-bold text-xl text-white">
            <Terminal size={24} className="text-blue-400" />
            <span>Analytics Playbook</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Product/Data Analyst Interview Guide</p>
          
          <div className="mt-6 mb-2">
            <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
              <span>Course Progress</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-500" 
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="px-4 pb-6 flex-1">
          {parts.map((part) => (
            <div key={part.id} className="mb-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 px-2">
                {part.title}
              </h3>
              <ul className="space-y-1">
                {part.sections.map((section) => (
                  <li key={section.id}>
                     <button
                      onClick={() => handleSectionChange(section.id)}
                      className={clsx(
                        "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-start justify-between gap-2",
                        activeSectionId === section.id
                          ? "bg-blue-600/20 text-blue-400 font-medium"
                          : "hover:bg-slate-800 hover:text-white"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <ChevronRight
                          size={16}
                          className={clsx(
                            "mt-0.5 flex-shrink-0 transition-transform",
                            activeSectionId === section.id ? "rotate-90 text-blue-400" : "text-transparent"
                          )}
                        />
                        <span className="truncate leading-tight whitespace-normal">{section.title}</span>
                      </div>
                      {completedSections.has(section.id) && (
                        <CheckCircle size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Playbook Checklist Link */}
          <div className="mt-8">
            <button
              onClick={() => handleSectionChange('playbook-summary')}
              className={clsx(
                "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2",
                activeSectionId === 'playbook-summary'
                  ? "bg-amber-500/20 text-amber-400 font-medium"
                  : "hover:bg-slate-800 hover:text-white"
              )}
            >
              <CheckCircle size={16} className={activeSectionId === 'playbook-summary' ? "text-amber-400" : "text-slate-500"} />
              <span>Interview Checklist</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-12 overflow-x-hidden">
        
        <div className="flex justify-end mb-6">
          <label className="flex items-center gap-3 cursor-pointer bg-white border border-slate-200 px-4 py-2.5 rounded-full shadow-sm hover:bg-slate-50 transition-colors select-none">
            <span className="text-sm font-semibold text-slate-700">Practice Mode</span>
            <div className={clsx("w-11 h-6 rounded-full flex items-center transition-colors p-1", isPracticeMode ? "bg-blue-500" : "bg-slate-300")}>
              <div className={clsx("w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform", isPracticeMode ? "translate-x-5" : "translate-x-0")} />
            </div>
            <input 
              type="checkbox" 
              className="hidden" 
              checked={isPracticeMode} 
              onChange={() => setIsPracticeMode(!isPracticeMode)} 
            />
          </label>
        </div>

        {/* Intro Banner */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-10 shadow-sm">
          <h1 className="text-2xl font-bold mb-4">Event-Driven User Behavior Analysis</h1>
          <p className="text-slate-600 leading-relaxed text-sm md:text-base">
            {intro}
          </p>
        </div>

        {activeSectionId === 'playbook-summary' ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-6">
              Product Analytics Interview Playbook
            </h2>
            <div className="grid gap-6">
              {playbookTips.map((tip, idx) => (
                <div key={idx} className="bg-amber-50 border border-amber-200 rounded-xl p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <CheckCircle className="text-amber-500 mt-1 flex-shrink-0" size={24} />
                    <div>
                      <h3 className="font-bold text-amber-900 text-lg mb-2">{tip.title}</h3>
                      <p className="text-amber-800/80 leading-relaxed">{tip.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500" key={activeSection.id}>
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 leading-snug">
                {activeSection.title}
              </h2>
              <button
                onClick={() => toggleCompletion(activeSection.id)}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-colors flex-shrink-0 md:mt-1",
                  completedSections.has(activeSection.id) 
                    ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100" 
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                <CheckCircle size={16} className={completedSections.has(activeSection.id) ? "text-green-600" : "text-slate-400"} />
                {completedSections.has(activeSection.id) ? "Completed" : "Mark Complete"}
              </button>
            </div>

            {/* The Senior Signal Callout */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-5 rounded-r-xl shadow-sm">
              <h4 className="font-bold text-blue-900 flex items-center gap-2 mb-2">
                <Terminal size={18} />
                The Senior Signal
              </h4>
              <p className="text-blue-800 leading-relaxed text-sm md:text-base">
                {activeSection.signal}
              </p>
            </div>

            {activeSection.extraText && (
              <p className="text-slate-700 leading-relaxed">
                {activeSection.extraText}
              </p>
            )}

            {/* Code Block */}
            {isPracticeMode && !isCodeRevealed ? (
              <div className="mt-8 animate-in fade-in duration-300">
                <div className="flex flex-col items-center justify-center p-8 bg-slate-50 border border-slate-200 rounded-xl mb-6">
                  <h3 className="text-lg font-bold text-slate-700 mb-2">Practice Environment</h3>
                  <p className="text-slate-500 text-center mb-6 max-w-md text-sm">
                    Write and test your implementation below. Click reveal when you're ready to check your solution against the playbook.
                  </p>
                  <button
                    onClick={() => setIsCodeRevealed(true)}
                    className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-sm text-sm"
                  >
                    <Eye size={18} />
                    Reveal Solution
                  </button>
                </div>
                <PythonSandbox />
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden shadow-lg border border-slate-700 bg-[#1e1e1e]">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  <button
                    onClick={() => handleCopy(activeSection.code, activeSection.id)}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-slate-700"
                  >
                    {copiedId === activeSection.id ? (
                      <>
                        <Check size={14} className="text-green-400" />
                        <span className="text-green-400 font-medium">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-4 overflow-x-auto text-sm">
                  <SyntaxHighlighter
                    language="python"
                    style={vscDarkPlus}
                    customStyle={{ margin: 0, padding: 0, background: 'transparent' }}
                  >
                    {activeSection.code}
                  </SyntaxHighlighter>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

