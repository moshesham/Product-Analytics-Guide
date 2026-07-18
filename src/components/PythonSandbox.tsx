import React, { useState, useEffect, useRef } from 'react';
import { Play, Loader2, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

declare global {
  interface Window {
    loadPyodide: (config: { indexURL: string }) => Promise<any>;
  }
}

export function PythonSandbox() {
  const [code, setCode] = useState('# Write your Python code here...\n\nprint("Hello, Analytics!")\n');
  const [output, setOutput] = useState('');
  const [isPyodideLoading, setIsPyodideLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pyodideRef = useRef<any>(null);

  useEffect(() => {
    async function initPyodide() {
      try {
        if (!window.loadPyodide) {
          throw new Error('Pyodide script not loaded yet. Retrying...');
        }
        const pyodide = await window.loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/',
        });
        
        // We might want to install micropip and pandas if needed, but for a simple sandbox, 
        // we'll just start with basic pyodide.
        // await pyodide.loadPackage(['pandas', 'requests']); // Takes more time to load.
        
        pyodideRef.current = pyodide;
        setIsPyodideLoading(false);
      } catch (err) {
        console.error('Failed to load Pyodide:', err);
        // Retry logic or show error
        setTimeout(initPyodide, 1000);
      }
    }
    initPyodide();
  }, []);

  const runCode = async () => {
    if (!pyodideRef.current) return;
    
    setIsRunning(true);
    setError(null);
    setOutput('');
    
    const pyodide = pyodideRef.current;
    
    // Redirect stdout
    pyodide.setStdout({ batched: (msg: string) => setOutput(prev => prev + msg + '\n') });
    pyodide.setStderr({ batched: (msg: string) => setOutput(prev => prev + msg + '\n') });
    
    try {
      const result = await pyodide.runPythonAsync(code);
      if (result !== undefined) {
        setOutput(prev => prev + String(result) + '\n');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during execution.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col border rounded-xl overflow-hidden shadow-sm bg-white mt-8">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-100 border-b">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 text-sm">Python Sandbox</span>
          {isPyodideLoading && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Loader2 size={12} className="animate-spin" />
              Initializing environment...
            </span>
          )}
        </div>
        <button
          onClick={runCode}
          disabled={isPyodideLoading || isRunning}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-white transition-colors",
            isPyodideLoading || isRunning ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
          )}
        >
          {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          Run Code
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 min-h-[300px]">
        {/* Editor Area */}
        <div className="border-r border-b md:border-b-0 border-slate-200">
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-full min-h-[250px] p-4 font-mono text-sm bg-[#1e1e1e] text-[#d4d4d4] focus:outline-none resize-y"
            spellCheck="false"
          />
        </div>
        
        {/* Output Area */}
        <div className="bg-slate-50 p-4 font-mono text-sm overflow-y-auto max-h-[400px]">
          {error ? (
            <div className="text-red-600 whitespace-pre-wrap flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : (
            <pre className="text-slate-800 whitespace-pre-wrap">{output || 'Output will appear here...'}</pre>
          )}
        </div>
      </div>
    </div>
  );
}
